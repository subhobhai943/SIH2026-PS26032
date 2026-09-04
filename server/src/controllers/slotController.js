import mongoose from 'mongoose';
import { z } from 'zod';
import Center from '../models/Center.js';
import Slot from '../models/Slot.js';
import Queue from '../models/Queue.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { parse } from '../utils/validate.js';
import { addDaysISO, isPastDate, todayISO } from '../utils/datetime.js';
import { nextToken } from '../services/queueService.js';
import { broadcastQueue } from '../services/socketService.js';
import { sendTemplate } from '../services/smsService.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const listSlotsSchema = z.object({
  centerId: z.string().min(1),
  date: dateSchema.optional(),
});

const bookSchema = z.object({
  slotId: z.string().min(1),
  crop: z.string().min(1).max(40),
  estimatedQuantityQtl: z.number().min(0.1).max(1000),
  cropPhotoUrl: z.string().optional(),
});

/** GET /api/centers — optionally filtered by district or crop. */
export const listCenters = asyncHandler(async (req, res) => {
  const { district, crop, q } = req.query;
  const filter = { isActive: true };
  if (district) filter.district = new RegExp(`^${String(district)}$`, 'i');
  if (crop) filter.crops = new RegExp(`^${String(crop)}$`, 'i');
  if (q) filter.$or = [{ name: new RegExp(String(q), 'i') }, { code: new RegExp(String(q), 'i') }];

  const centers = await Center.find(filter).sort({ district: 1, name: 1 }).lean();
  res.json({ ok: true, data: centers });
});

/** GET /api/centers/:id */
export const getCenter = asyncHandler(async (req, res) => {
  const center = await Center.findById(req.params.id).lean();
  if (!center) throw ApiError.notFound('Procurement centre not found');
  res.json({ ok: true, data: center });
});

/** GET /api/slots?centerId=&date= — availability for one centre on one day. */
export const listSlots = asyncHandler(async (req, res) => {
  const { centerId, date = todayISO() } = parse(listSlotsSchema, req.query);

  const slots = await Slot.find({ center: centerId, date, status: 'open' }).sort({ startTime: 1 });
  res.json({
    ok: true,
    data: slots.map((slot) => ({
      id: String(slot._id),
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
      booked: slot.booked,
      available: slot.available,
      crop: slot.crop,
    })),
  });
});

/** GET /api/slots/availability?centerId=&days=7 — a week's outlook for the booking screen. */
export const getAvailability = asyncHandler(async (req, res) => {
  const centerId = String(req.query.centerId || '');
  if (!centerId) throw ApiError.badRequest('centerId is required');
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30);

  const start = todayISO();
  const end = addDaysISO(start, days - 1);

  const summary = await Slot.aggregate([
    {
      $match: {
        center: new mongoose.Types.ObjectId(centerId),
        date: { $gte: start, $lte: end },
        status: 'open',
      },
    },
    {
      $group: {
        _id: '$date',
        capacity: { $sum: '$capacity' },
        booked: { $sum: '$booked' },
        slots: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    ok: true,
    data: summary.map((d) => ({
      date: d._id,
      slots: d.slots,
      capacity: d.capacity,
      booked: d.booked,
      available: Math.max(0, d.capacity - d.booked),
    })),
  });
});

/**
 * POST /api/slots/book — claims one seat in a slot and issues a queue token.
 *
 * Capacity is claimed with a conditional update ($expr: booked < capacity) so two
 * farmers hitting the last seat at the same time cannot both succeed.
 */
export const bookSlot = asyncHandler(async (req, res) => {
  const { slotId, crop, estimatedQuantityQtl, cropPhotoUrl } = parse(bookSchema, req.body);
  const farmer = req.farmer;

  const slot = await Slot.findById(slotId);
  if (!slot) throw ApiError.notFound('Slot not found');
  if (slot.status !== 'open') throw ApiError.conflict('This slot is no longer open for booking');
  if (isPastDate(slot.date)) throw ApiError.badRequest('Cannot book a slot in the past');

  const existing = await Queue.findOne({
    farmer: farmer._id,
    date: slot.date,
    status: { $in: ['booked', 'checked_in', 'serving'] },
  });
  if (existing) {
    throw ApiError.conflict(`You already hold token ${existing.token} for ${slot.date}`, {
      queueEntryId: String(existing._id),
    });
  }

  const claimed = await Slot.findOneAndUpdate(
    { _id: slot._id, status: 'open', $expr: { $lt: ['$booked', '$capacity'] } },
    { $inc: { booked: 1 } },
    { new: true }
  );
  if (!claimed) throw ApiError.conflict('This slot just filled up — please pick another');

  let entry;
  try {
    // The unique (center, date, token) index is the real guard; retry on collision.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        entry = await Queue.create({
          center: claimed.center,
          slot: claimed._id,
          farmer: farmer._id,
          date: claimed.date,
          token: await nextToken(claimed.center, claimed.date),
          crop,
          cropPhotoUrl: cropPhotoUrl || '',
          estimatedQuantityQtl,
        });
        break;
      } catch (err) {
        if (err.code !== 11000 || attempt === 4) throw err;
      }
    }
  } catch (err) {
    await Slot.updateOne({ _id: claimed._id }, { $inc: { booked: -1 } });
    throw err;
  }

  const center = await Center.findById(claimed.center).lean();
  await sendTemplate(farmer.phone, 'bookingConfirmed', {
    token: entry.token,
    centerName: center.name,
    date: claimed.date,
    startTime: claimed.startTime,
  });
  await broadcastQueue(String(claimed.center), claimed.date);

  res.status(201).json({
    ok: true,
    data: {
      id: String(entry._id),
      token: entry.token,
      status: entry.status,
      date: entry.date,
      crop: entry.crop,
      estimatedQuantityQtl: entry.estimatedQuantityQtl,
      slot: { id: String(claimed._id), startTime: claimed.startTime, endTime: claimed.endTime },
      center: { id: String(center._id), name: center.name, address: center.address },
    },
  });
});

/** DELETE /api/slots/bookings/:id — a farmer cancels their own booking. */
export const cancelBooking = asyncHandler(async (req, res) => {
  const entry = await Queue.findOne({ _id: req.params.id, farmer: req.farmer._id });
  if (!entry) throw ApiError.notFound('Booking not found');
  if (!['booked', 'checked_in'].includes(entry.status)) {
    throw ApiError.conflict(`A booking that is '${entry.status}' cannot be cancelled`);
  }

  entry.status = 'cancelled';
  entry.cancelledAt = new Date();
  await entry.save();
  await Slot.updateOne({ _id: entry.slot }, { $inc: { booked: -1 } });

  const center = await Center.findById(entry.center).lean();
  await sendTemplate(req.farmer.phone, 'bookingCancelled', {
    token: entry.token,
    centerName: center?.name || 'the centre',
    date: entry.date,
  });
  await broadcastQueue(String(entry.center), entry.date);

  res.json({ ok: true, data: { id: String(entry._id), status: entry.status } });
});

/** GET /api/slots/bookings/me — the farmer's booking history, newest first. */
export const myBookings = asyncHandler(async (req, res) => {
  const entries = await Queue.find({ farmer: req.farmer._id })
    .sort({ date: -1, token: -1 })
    .limit(50)
    .populate('center', 'name code address district contactPhone')
    .populate('slot', 'startTime endTime')
    .lean();

  res.json({ ok: true, data: entries });
});
