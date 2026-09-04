import os from 'node:os';
import mongoose from 'mongoose';
import { z } from 'zod';
import Staff from '../models/Staff.js';
import Center from '../models/Center.js';
import Slot from '../models/Slot.js';
import Queue, { QUEUE_STATUSES } from '../models/Queue.js';
import Procurement, { PROCUREMENT_STAGES } from '../models/Procurement.js';
import { signToken, resolveCenterScope } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { parse } from '../utils/validate.js';
import { minutesOfDay, toHHMM, todayISO } from '../utils/datetime.js';
import { broadcastQueue, notifyFarmer } from '../services/socketService.js';
import { sendTemplate } from '../services/smsService.js';
import { farmersToAlert, getQueueState } from '../services/queueService.js';
import { ensureShipmentForQueue } from './shipmentController.js';
import { getRateLimitMetrics } from '../middleware/rateLimiter.js';

// ---------------------------------------------------------------- auth

const loginSchema = z.object({
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
});

/** POST /api/admin/login */
export const login = asyncHandler(async (req, res) => {
  const body = parse(loginSchema, req.body);
  const identifier = (body.username || body.email || '').trim();
  if (!identifier) throw ApiError.badRequest('Username or email is required');

  const staff = await Staff.findOne({
    $or: [
      { username: { $regex: new RegExp(`^${identifier}$`, 'i') } },
      { email: identifier.toLowerCase() },
      { email: `${identifier.toLowerCase()}@sih26032.local` },
    ],
  }).select('+passwordHash');

  if (!staff || !staff.isActive) throw ApiError.unauthorized('Invalid credentials');

  const ok = await staff.verifyPassword(body.password);
  if (!ok) throw ApiError.unauthorized('Invalid credentials');

  res.json({
    ok: true,
    data: {
      token: signToken({ sub: String(staff._id), kind: 'staff', role: staff.role }),
      staff: { id: String(staff._id), name: staff.name, email: staff.email, username: staff.username, role: staff.role, center: staff.center },
    },
  });
});

/** GET /api/admin/me */
export const me = asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    data: {
      id: String(req.staff._id),
      name: req.staff.name,
      email: req.staff.email,
      role: req.staff.role,
      center: req.staff.center,
    },
  });
});

// ---------------------------------------------------------------- centres

const centerSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(20),
  address: z.string().optional(),
  district: z.string().min(2),
  state: z.string().min(2),
  crops: z.array(z.string()).optional(),
  dailyCapacity: z.number().min(1).optional(),
  avgServiceMinutes: z.number().min(1).optional(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  contactPhone: z.string().optional(),
});

/** POST /api/admin/centers — admin only. */
export const createCenter = asyncHandler(async (req, res) => {
  const payload = parse(centerSchema, req.body);
  const center = await Center.create(payload);
  res.status(201).json({ ok: true, data: center });
});

/** PUT /api/admin/centers/:id — admin only. */
export const updateCenter = asyncHandler(async (req, res) => {
  const payload = parse(centerSchema.partial(), req.body);
  const center = await Center.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!center) throw ApiError.notFound('Procurement centre not found');
  res.json({ ok: true, data: center });
});

// ---------------------------------------------------------------- slot generation

const generateSlotsSchema = z.object({
  centerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotLengthMinutes: z.number().min(5).max(120).optional(),
  perSlotCapacity: z.number().min(1).max(200).optional(),
  crop: z.string().optional(),
});

/**
 * POST /api/admin/slots/generate — carves a centre's open hours into equal
 * slots for a date. Existing slots for that date are left untouched (idempotent
 * on re-run for already-created windows thanks to the unique index).
 */
export const generateSlots = asyncHandler(async (req, res) => {
  const body = parse(generateSlotsSchema, req.body);
  const centerId = resolveCenterScope(req.staff, body.centerId);

  const center = await Center.findById(centerId);
  if (!center) throw ApiError.notFound('Procurement centre not found');

  const slotLength = body.slotLengthMinutes || 30;
  const perSlotCapacity =
    body.perSlotCapacity || Math.max(1, Math.round((slotLength / (center.avgServiceMinutes || 12))));

  const start = minutesOfDay(center.openTime);
  const end = minutesOfDay(center.closeTime);

  const docs = [];
  for (let t = start; t + slotLength <= end; t += slotLength) {
    docs.push({
      center: center._id,
      date: body.date,
      startTime: toHHMM(t),
      endTime: toHHMM(t + slotLength),
      capacity: perSlotCapacity,
      crop: body.crop || 'any',
    });
  }

  let created = 0;
  for (const doc of docs) {
    try {
      await Slot.create(doc);
      created += 1;
    } catch (err) {
      if (err.code !== 11000) throw err; // slot already exists for this window — skip
    }
  }

  res.status(201).json({ ok: true, data: { requested: docs.length, created, skipped: docs.length - created } });
});

/** GET /api/admin/slots?centerId=&date= — full slot list including closed ones, for editing. */
export const listAllSlots = asyncHandler(async (req, res) => {
  const centerId = resolveCenterScope(req.staff, req.query.centerId);
  const date = String(req.query.date || todayISO());
  const slots = await Slot.find({ center: centerId, date }).sort({ startTime: 1 });
  res.json({ ok: true, data: slots });
});

/** PATCH /api/admin/slots/:id — close/cancel a slot or adjust capacity. */
export const updateSlot = asyncHandler(async (req, res) => {
  const payload = parse(
    z.object({ capacity: z.number().min(0).optional(), status: z.enum(['open', 'closed', 'cancelled']).optional() }),
    req.body
  );
  const slot = await Slot.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!slot) throw ApiError.notFound('Slot not found');
  res.json({ ok: true, data: slot });
});

// ---------------------------------------------------------------- queue operations

/** GET /api/admin/queue?centerId=&date= — the operator's working view of the queue. */
export const adminQueueBoard = asyncHandler(async (req, res) => {
  const centerId = resolveCenterScope(req.staff, req.query.centerId);
  const date = String(req.query.date || todayISO());
  const state = await getQueueState(centerId, date);
  if (!state) throw ApiError.notFound('Procurement centre not found');
  res.json({ ok: true, data: state });
});

/** POST /api/admin/queue/:id/check-in — farmer has physically arrived. */
export const checkIn = asyncHandler(async (req, res) => {
  const entry = await Queue.findById(req.params.id);
  if (!entry) throw ApiError.notFound('Queue entry not found');
  resolveCenterScope(req.staff, entry.center);
  if (entry.status !== 'booked') throw ApiError.conflict(`Cannot check in an entry that is '${entry.status}'`);

  entry.status = 'checked_in';
  entry.checkedInAt = new Date();
  await entry.save();
  await broadcastQueue(String(entry.center), entry.date);

  res.json({ ok: true, data: entry });
});

/**
 * POST /api/admin/queue/:id/call-next — marks the given entry as being served
 * (completing whoever the centre was previously serving), and warns the next
 * few farmers in line by SMS that their turn is close.
 */
export const callNext = asyncHandler(async (req, res) => {
  const entry = await Queue.findById(req.params.id).populate('farmer', 'phone').populate('center', 'name');
  if (!entry) throw ApiError.notFound('Queue entry not found');
  resolveCenterScope(req.staff, entry.center._id);
  if (!['booked', 'checked_in'].includes(entry.status)) {
    throw ApiError.conflict(`Cannot call an entry that is '${entry.status}'`);
  }

  await Queue.updateMany(
    { center: entry.center._id, date: entry.date, status: 'serving' },
    { status: 'completed', completedAt: new Date() }
  );

  entry.status = 'serving';
  entry.servingStartedAt = new Date();
  await entry.save();

  await Procurement.findOneAndUpdate(
    { queueEntry: entry._id },
    {
      $setOnInsert: {
        queueEntry: entry._id,
        farmer: entry.farmer._id,
        center: entry.center._id,
        date: entry.date,
        crop: entry.crop,
        stage: 'arrived',
        timeline: [{ stage: 'arrived', by: req.staff._id }],
      },
    },
    { upsert: true, new: true }
  );

  await sendTemplate(entry.farmer.phone, 'yourTurn', { token: entry.token, centerName: entry.center.name });
  const state = await broadcastQueue(String(entry.center._id), entry.date);
  notifyFarmer(String(entry.farmer._id), 'queue:your-turn', { token: entry.token });

  for (const upcoming of farmersToAlert(state)) {
    await sendTemplate(upcoming.farmer.phone, 'nearingTurn', {
      token: upcoming.token,
      ahead: upcoming.ahead,
      centerName: entry.center.name,
    });
  }

  res.json({ ok: true, data: entry });
});

const markSchema = z.object({ status: z.enum(QUEUE_STATUSES) });

/** PATCH /api/admin/queue/:id/status — manual override (no-show, cancel, etc.). */
export const setQueueStatus = asyncHandler(async (req, res) => {
  const { status } = parse(markSchema, req.body);
  const entry = await Queue.findById(req.params.id);
  if (!entry) throw ApiError.notFound('Queue entry not found');
  resolveCenterScope(req.staff, entry.center);

  const wasWaiting = Queue.WAITING_STATUSES.includes(entry.status);
  entry.status = status;
  if (status === 'completed') entry.completedAt = new Date();
  if (status === 'cancelled') entry.cancelledAt = new Date();
  await entry.save();

  // Freeing a waiting seat needs to be reflected back on the slot's capacity.
  if (wasWaiting && ['cancelled', 'no_show'].includes(status)) {
    await Slot.updateOne({ _id: entry.slot }, { $inc: { booked: -1 } });
  }

  await broadcastQueue(String(entry.center), entry.date);
  res.json({ ok: true, data: entry });
});

// ---------------------------------------------------------------- procurement

const procurementSchema = z.object({
  stage: z.enum(PROCUREMENT_STAGES).optional(),
  quantityQtl: z.number().min(0).optional(),
  qualityGrade: z.enum(['A', 'B', 'C', 'FAQ', '']).optional(),
  ratePerQtl: z.number().min(0).optional(),
  remark: z.string().max(200).optional(),
  paymentRef: z.string().max(60).optional(),
  advancePaymentRef: z.string().max(60).optional(),
});

/** GET /api/admin/procurement/:queueEntryId — get or create procurement record for an entry. */
export const getProcurementDetails = asyncHandler(async (req, res) => {
  const entry = await Queue.findById(req.params.queueEntryId)
    .populate('farmer', 'name phone village district state')
    .populate('center', 'name code district state')
    .populate('slot', 'startTime endTime');
  if (!entry) throw ApiError.notFound('Queue entry not found');
  resolveCenterScope(req.staff, entry.center._id);

  let procurement = await Procurement.findOne({ queueEntry: entry._id });
  if (!procurement) {
    procurement = await Procurement.create({
      queueEntry: entry._id,
      farmer: entry.farmer._id,
      center: entry.center._id,
      date: entry.date,
      crop: entry.crop || 'wheat',
      quantityQtl: entry.estimatedQuantityQtl || 10,
      stage: 'arrived',
      timeline: [{ stage: 'arrived', by: req.staff._id }],
    });
  }

  res.json({ ok: true, data: { entry, procurement } });
});

/** PATCH /api/admin/procurement/:queueEntryId — advance a farmer through the stage pipeline. */
export const updateProcurementStage = asyncHandler(async (req, res) => {
  const body = parse(procurementSchema, req.body);
  const entry = await Queue.findById(req.params.queueEntryId).populate('farmer', 'phone name').populate('center', 'name');
  if (!entry) throw ApiError.notFound('Queue entry not found');
  resolveCenterScope(req.staff, entry.center._id);

  const procurement = await Procurement.findOneAndUpdate(
    { queueEntry: entry._id },
    {
      $setOnInsert: { farmer: entry.farmer._id, center: entry.center._id, date: entry.date, crop: entry.crop },
    },
    { upsert: true, new: true }
  );

  if (body.stage) procurement.stage = body.stage;
  if (body.quantityQtl !== undefined) procurement.quantityQtl = body.quantityQtl;
  if (body.qualityGrade !== undefined) procurement.qualityGrade = body.qualityGrade;
  if (body.ratePerQtl !== undefined) procurement.ratePerQtl = body.ratePerQtl;
  if (body.paymentRef !== undefined) procurement.paymentRef = body.paymentRef;
  if (body.advancePaymentRef !== undefined) procurement.advancePaymentRef = body.advancePaymentRef;

  if (body.stage === 'advance_paid') {
    procurement.advanceStatus = 'paid';
    procurement.advancePaidAt = new Date();
    procurement.advancePaymentRef = body.advancePaymentRef || body.paymentRef || ('ADV-' + Date.now().toString().slice(-6));
  }

  if (body.stage === 'paid') {
    procurement.balanceStatus = 'paid';
    procurement.paidAt = new Date();
    procurement.paymentRef = body.paymentRef || ('BAL-' + Date.now().toString().slice(-6));
  }

  if (body.stage) {
    procurement.timeline.push({ stage: body.stage, by: req.staff._id, remark: body.remark || '' });
  }

  await procurement.save();

  if (body.stage === 'advance_paid') {
    await sendTemplate(entry.farmer.phone, 'advancePaymentDone', {
      amount: procurement.amount,
      advanceAmount: procurement.advanceAmount,
      balanceAmount: procurement.balanceAmount,
      paymentRef: procurement.advancePaymentRef,
      token: entry.token,
    });
  } else if (body.stage === 'paid') {
    await sendTemplate(entry.farmer.phone, 'paymentDone', {
      amount: procurement.balanceAmount || procurement.amount,
      paymentRef: procurement.paymentRef,
    });
  } else if (body.stage) {
    await sendTemplate(entry.farmer.phone, 'procurementUpdate', { token: entry.token, stage: body.stage });
  }

  try { await ensureShipmentForQueue(entry._id); } catch (_) {}

  res.json({ ok: true, data: procurement });
});

/** POST /api/admin/procurement/:queueEntryId/pay-advance — release 20% advance guarantee */
export const payAdvance = asyncHandler(async (req, res) => {
  const entry = await Queue.findById(req.params.queueEntryId).populate('farmer', 'phone name').populate('center', 'name');
  if (!entry) throw ApiError.notFound('Queue entry not found');
  resolveCenterScope(req.staff, entry.center._id);

  let procurement = await Procurement.findOne({ queueEntry: entry._id });
  if (!procurement) throw ApiError.badRequest('Procurement record not found, weigh and approve crop first');

  if (procurement.amount <= 0) {
    throw ApiError.badRequest('Total amount must be greater than 0 before paying advance');
  }

  const ref = req.body.paymentRef || `ADV-${Date.now().toString().slice(-6)}`;
  procurement.advanceStatus = 'paid';
  procurement.advancePaidAt = new Date();
  procurement.advancePaymentRef = ref;
  procurement.advanceUtr = ref;
  procurement.stage = 'advance_paid';
  procurement.timeline.push({
    stage: 'advance_paid',
    by: req.staff._id,
    remark: `20% Safety Advance Guarantee released (Rs ${procurement.advanceAmount})`,
  });

  await procurement.save();

  await sendTemplate(entry.farmer.phone, 'advancePaymentDone', {
    amount: procurement.amount,
    advanceAmount: procurement.advanceAmount,
    balanceAmount: procurement.balanceAmount,
    paymentRef: ref,
    token: entry.token,
  });

  try { await ensureShipmentForQueue(entry._id); } catch (_) {}

  res.json({ ok: true, data: procurement });
});

/** POST /api/admin/procurement/:queueEntryId/pay-balance — release final 80% balance */
export const payBalance = asyncHandler(async (req, res) => {
  const entry = await Queue.findById(req.params.queueEntryId).populate('farmer', 'phone name').populate('center', 'name');
  if (!entry) throw ApiError.notFound('Queue entry not found');
  resolveCenterScope(req.staff, entry.center._id);

  let procurement = await Procurement.findOne({ queueEntry: entry._id });
  if (!procurement) throw ApiError.badRequest('Procurement record not found');

  const ref = req.body.paymentRef || `BAL-${Date.now().toString().slice(-6)}`;
  procurement.balanceStatus = 'paid';
  procurement.paidAt = new Date();
  procurement.paymentRef = ref;
  procurement.balanceUtr = ref;
  procurement.stage = 'paid';

  // Mark full DBT payment confirmed if both advance and balance are settled
  if (procurement.advanceStatus === 'paid') {
    procurement.paymentConfirmed = true;
    procurement.paymentConfirmedAt = new Date();
    procurement.utrNumber = procurement.utrNumber || `P${Date.now().toString().slice(-10)}${Math.floor(1000 + Math.random() * 9000)}`;
    procurement.paymentConfirmationSlipId = procurement.paymentConfirmationSlipId || `DBT-REC-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    procurement.confirmedBy = req.staff._id;
  }

  procurement.timeline.push({
    stage: 'paid',
    by: req.staff._id,
    remark: `Final 80% Settlement released (Rs ${procurement.balanceAmount})`,
  });

  await procurement.save();

  if (procurement.paymentConfirmed) {
    await sendTemplate(entry.farmer.phone, 'paymentConfirmed', {
      token: entry.token,
      amount: procurement.amount,
      advanceAmount: procurement.advanceAmount,
      balanceAmount: procurement.balanceAmount,
      utrNumber: procurement.utrNumber,
    });
  } else {
    await sendTemplate(entry.farmer.phone, 'paymentDone', {
      amount: procurement.balanceAmount || procurement.amount,
      paymentRef: ref,
    });
  }

  try { await ensureShipmentForQueue(entry._id); } catch (_) {}

  res.json({ ok: true, data: procurement });
});

/** POST /api/admin/procurement/:queueEntryId/confirm-payment — confirm and settle DBT payment with official UTR */
export const confirmPayment = asyncHandler(async (req, res) => {
  const entry = await Queue.findById(req.params.queueEntryId).populate('farmer', 'phone name').populate('center', 'name');
  if (!entry) throw ApiError.notFound('Queue entry not found');
  resolveCenterScope(req.staff, entry.center._id);

  let procurement = await Procurement.findOne({ queueEntry: entry._id });
  if (!procurement) throw ApiError.badRequest('Procurement record not found');

  if (procurement.amount <= 0) {
    throw ApiError.badRequest('Total produce value must be greater than 0');
  }

  const now = Date.now();
  const utrNumber = req.body.utrNumber?.trim() || `P${now.toString().slice(-10)}${Math.floor(1000 + Math.random() * 9000)}`;
  const advanceUtr = req.body.advanceUtr?.trim() || procurement.advanceUtr || `ADV-UTR-${now.toString().slice(-8)}`;
  const balanceUtr = req.body.balanceUtr?.trim() || procurement.balanceUtr || `BAL-UTR-${now.toString().slice(-8)}`;
  const slipId = procurement.paymentConfirmationSlipId || `DBT-REC-${new Date().getFullYear()}-${now.toString(36).toUpperCase()}`;

  procurement.paymentConfirmed = true;
  procurement.paymentConfirmedAt = new Date();
  procurement.paymentConfirmationSlipId = slipId;
  procurement.utrNumber = utrNumber;
  procurement.advanceUtr = advanceUtr;
  procurement.balanceUtr = balanceUtr;
  procurement.confirmedBy = req.staff._id;

  if (req.body.bankName) procurement.bankName = req.body.bankName;
  if (req.body.accountMasked) procurement.accountMasked = req.body.accountMasked;
  if (req.body.ifscCode) procurement.ifscCode = req.body.ifscCode;

  // Mark both advance and balance as paid
  procurement.advanceStatus = 'paid';
  if (!procurement.advancePaidAt) procurement.advancePaidAt = new Date();
  if (!procurement.advancePaymentRef) procurement.advancePaymentRef = advanceUtr;

  procurement.balanceStatus = 'paid';
  if (!procurement.paidAt) procurement.paidAt = new Date();
  if (!procurement.paymentRef) procurement.paymentRef = balanceUtr;

  procurement.stage = 'paid';
  procurement.timeline.push({
    stage: 'paid',
    by: req.staff._id,
    remark: `DBT Payment Confirmed & Settled (Gross: Rs ${procurement.amount}, UTR: ${utrNumber})`,
  });

  await procurement.save();

  // Send DBT Payment Confirmation SMS
  await sendTemplate(entry.farmer.phone, 'paymentConfirmed', {
    token: entry.token,
    amount: procurement.amount,
    advanceAmount: procurement.advanceAmount,
    balanceAmount: procurement.balanceAmount,
    utrNumber: procurement.utrNumber,
  });

  try { await ensureShipmentForQueue(entry._id); } catch (_) {}

  res.json({ ok: true, data: procurement });
});

/** GET /api/admin/system-metrics — Live telemetry on cluster load balancer and rate limiters */
export const getSystemMetrics = asyncHandler(async (req, res) => {
  const mem = process.memoryUsage();
  const rateLimitStats = getRateLimitMetrics();

  res.json({
    ok: true,
    data: {
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
      instanceId: process.env.NODE_APP_INSTANCE || '0',
      clusterMode: process.env.NODE_APP_INSTANCE !== undefined ? 'PM2 Cluster (Multi-Worker)' : 'Node Process',
      loadAverage: os.loadavg(),
      cpuCores: os.cpus().length,
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      memory: {
        rssMb: Math.round(mem.rss / (1024 * 1024)),
        heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
        systemFreeMb: Math.round(os.freemem() / (1024 * 1024)),
        systemTotalMb: Math.round(os.totalmem() / (1024 * 1024)),
      },
      loadBalancer: {
        status: 'ACTIVE',
        algorithm: 'Least Connections (least_conn) & Round-Robin',
        trustProxyConfig: 'Enabled (Level 1)',
        detectedClientIp: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        forwardedProto: req.headers['x-forwarded-proto'] || req.protocol,
        host: req.get('host'),
      },
      database: {
        status: mongoose.connection.readyState === 1 ? 'Connected (Optimal)' : 'Disconnected',
        name: mongoose.connection.name,
      },
      rateLimiter: rateLimitStats,
    },
  });
});

