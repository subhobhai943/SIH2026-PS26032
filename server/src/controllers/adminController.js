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
import { escapeRegex } from '../utils/sanitize.js';
import { generateAndUploadBill } from '../services/pdfBillService.js';
import Farmer from '../models/Farmer.js';
import Notification from '../models/Notification.js';
import Shipment from '../models/Shipment.js';
import Review from '../models/Review.js';
import Otp from '../models/Otp.js';
import Announcement from '../models/Announcement.js';

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
      { username: { $regex: new RegExp(`^${escapeRegex(identifier)}$`, 'i') } },
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
  await broadcastQueue(String(entry.center._id || entry.center), entry.date);

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
  await broadcastQueue(String(entry.center._id || entry.center), entry.date);

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

  // Generate official Mandi Bill PDF and upload to S3
  try {
    const billPdfUrl = await generateAndUploadBill(procurement._id);
    procurement.billPdfUrl = billPdfUrl;
  } catch (err) {
    console.warn('[adminController] Bill PDF generation warning on payBalance:', err.message);
  }

  if (procurement.paymentConfirmed) {
    await sendTemplate(entry.farmer.phone, 'paymentConfirmed', {
      token: entry.token,
      amount: procurement.amount,
      advanceAmount: procurement.advanceAmount,
      balanceAmount: procurement.balanceAmount,
      utrNumber: procurement.utrNumber,
      billPdfUrl: procurement.billPdfUrl,
    });
  } else {
    await sendTemplate(entry.farmer.phone, 'paymentDone', {
      amount: procurement.balanceAmount || procurement.amount,
      paymentRef: ref,
      billPdfUrl: procurement.billPdfUrl,
    });
  }

  try { await ensureShipmentForQueue(entry._id); } catch (_) {}
  await broadcastQueue(String(entry.center._id || entry.center), entry.date);

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

  // Generate official Mandi Bill PDF and upload to S3
  try {
    const billPdfUrl = await generateAndUploadBill(procurement._id);
    procurement.billPdfUrl = billPdfUrl;
  } catch (err) {
    console.warn('[adminController] Bill PDF generation warning on confirmPayment:', err.message);
  }

  // Send DBT Payment Confirmation SMS & WhatsApp
  await sendTemplate(entry.farmer.phone, 'paymentConfirmed', {
    token: entry.token,
    amount: procurement.amount,
    advanceAmount: procurement.advanceAmount,
    balanceAmount: procurement.balanceAmount,
    utrNumber: procurement.utrNumber,
    billPdfUrl: procurement.billPdfUrl,
  });

  try { await ensureShipmentForQueue(entry._id); } catch (_) {}

  res.json({ ok: true, data: procurement });
});

/** POST /api/admin/procurement/:queueEntryId/generate-bill — manually generate / upload official PDF bill to S3 */
export const generateBill = asyncHandler(async (req, res) => {
  const entry = await Queue.findById(req.params.queueEntryId);
  if (!entry) throw ApiError.notFound('Queue entry not found');
  resolveCenterScope(req.staff, entry.center);

  let procurement = await Procurement.findOne({ queueEntry: entry._id });
  if (!procurement) throw ApiError.badRequest('Procurement record not found');

  const billPdfUrl = await generateAndUploadBill(procurement._id);
  const updatedProc = await Procurement.findById(procurement._id);
  res.json({ ok: true, data: { billPdfUrl, procurement: updatedProc } });
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

// ---------------------------------------------------------------- users / farmers

/** GET /api/admin/farmers — list registered farmers with search and stats */
export const listFarmers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const search = String(req.query.search || '').trim();
  const state = String(req.query.state || '').trim();

  const filter = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { village: rx }, { district: rx }, { state: rx }, { badge: rx }];
  }
  if (state && state !== 'All') {
    filter.state = state;
  }

  const [total, farmersDocs, statsOverview] = await Promise.all([
    Farmer.countDocuments(filter),
    Farmer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Promise.all([
      Farmer.countDocuments(),
      Farmer.countDocuments({ aadhaarLast4: { $exists: true, $ne: '' } }),
      Farmer.aggregate([{ $group: { _id: null, totalAcres: { $sum: '$landAreaAcres' } } }]),
      Farmer.distinct('state'),
    ]),
  ]);

  const [totalRegistered, verifiedKyc, acresAgg, statesList] = statsOverview;

  // Enrich each farmer with their total queue bookings and procurements count
  const enrichedFarmers = await Promise.all(
    farmersDocs.map(async (f) => {
      const [bookingsCount, procurements] = await Promise.all([
        Queue.countDocuments({ farmer: f._id }),
        Procurement.find({ farmer: f._id }).select('amount stage advanceStatus balanceStatus billPdfUrl').lean(),
      ]);

      const totalMspValue = procurements.reduce((sum, p) => sum + (p.amount || 0), 0);
      const completedDeliveries = procurements.filter((p) => p.stage === 'paid' || p.balanceStatus === 'paid').length;
      const hasBill = procurements.some((p) => Boolean(p.billPdfUrl));

      return {
        ...f,
        totalBookings: bookingsCount,
        totalProcurements: procurements.length,
        completedDeliveries,
        totalMspValue,
        hasBill,
      };
    })
  );

  res.json({
    ok: true,
    data: {
      farmers: enrichedFarmers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        totalFarmers: totalRegistered,
        verifiedKyc,
        totalLandAcres: acresAgg[0]?.totalAcres || 0,
        statesCount: statesList.filter(Boolean).length,
      },
    },
  });
});

/** GET /api/admin/farmers/:id — get full farmer profile, bookings, procurements, and notifications */
export const getFarmerDossier = asyncHandler(async (req, res) => {
  const farmer = await Farmer.findById(req.params.id).lean();
  if (!farmer) throw ApiError.notFound('Farmer not found');

  const [bookings, procurements, notifications] = await Promise.all([
    Queue.find({ farmer: farmer._id })
      .populate('center', 'name code district state address contactPhone')
      .populate('slot', 'startTime endTime')
      .sort({ createdAt: -1 })
      .lean(),
    Procurement.find({ farmer: farmer._id })
      .populate('center', 'name code district state')
      .sort({ createdAt: -1 })
      .lean(),
    Notification.find({ farmer: farmer._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
  ]);

  res.json({
    ok: true,
    data: {
      farmer,
      bookings,
      procurements,
      notifications,
    },
  });
});

/** PATCH /api/admin/farmers/:id — update farmer details or badge */
export const updateFarmer = asyncHandler(async (req, res) => {
  const allowed = ['name', 'village', 'district', 'state', 'badge', 'landAreaAcres', 'preferredLanguage', 'crops'];
  const updateData = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updateData[key] = req.body[key];
  }

  const farmer = await Farmer.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  if (!farmer) throw ApiError.notFound('Farmer not found');

  res.json({ ok: true, data: farmer });
});

// ---------------------------------------------------------------- database inspector

/** GET /api/admin/database/overview — comprehensive DB stats, telemetry, and collection list */
export const getDatabaseOverview = asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  if (!db) throw ApiError.internal('Database connection not established');

  const [dbStats, collectionsList] = await Promise.all([
    db.stats(),
    db.listCollections().toArray(),
  ]);

  const collectionNames = collectionsList.map((c) => c.name);

  // Friendly meta descriptions for known collections
  const META_MAP = {
    farmers: { label: 'Farmers / Users', icon: '👨‍🌾', description: 'Registered farmers, mobile authentication, KYC, landholding and profile data' },
    procurements: { label: 'Procurements & DBT Bills', icon: '🌾', description: 'Grain weighing records, MSP rates, 20% advance & 80% final settlement, UTRs, and AWS S3 bills' },
    queues: { label: 'Queue Entries & Tokens', icon: '⏳', description: 'Daily token gate passes, live queue positions, arrival & serving lifecycle timestamps' },
    slots: { label: 'Procurement Slots', icon: '📅', description: 'Centre operating time windows, capacity allocations, and booked seats' },
    centers: { label: 'Procurement Mandis', icon: '🏛️', description: 'Official APMC mandis, PACS yards, and FCI depots across states' },
    notifications: { label: 'Digital SMS & WA Audit', icon: '📲', description: 'Transactional SMS receipts, WhatsApp bot dispatches, and delivery logs' },
    shipments: { label: '3rd-Party Logistics', icon: '🚚', description: 'Delhivery / carrier consignments, vehicle numbers, drivers, and GPS transit checkpoints' },
    reviews: { label: 'Buyer Quality Ratings', icon: '⭐', description: 'Grain inspection feedback and farmer reputation ratings from bulk buyers and FCI officers' },
    announcements: { label: 'Announcements & Advisories', icon: '📢', description: 'Official Government advisories, MSP bulletins, weather warnings, and urgent Mandi broadcasts' },
    staffs: { label: 'Staff & Operators', icon: '🛡️', description: 'Admin, operator, and weighing clerk credentials with center-level scoping' },
    otps: { label: 'Phone Verification OTPs', icon: '🔐', description: 'Temporary OTP audit logs with expiration TTL indexes' },
  };

  const collections = await Promise.all(
    collectionNames.map(async (name) => {
      const col = db.collection(name);
      const count = await col.countDocuments();
      let sampleDoc = null;
      try {
        sampleDoc = await col.findOne({}, { sort: { _id: -1 } });
      } catch (_) {}

      const meta = META_MAP[name] || { label: name, icon: '📁', description: `MongoDB collection for ${name}` };

      return {
        name,
        label: meta.label,
        icon: meta.icon,
        description: meta.description,
        count,
        sampleDocId: sampleDoc?._id || null,
      };
    })
  );

  const order = ['farmers', 'procurements', 'queues', 'centers', 'slots', 'notifications', 'shipments', 'reviews', 'staffs', 'otps'];
  collections.sort((a, b) => {
    const ia = order.indexOf(a.name);
    const ib = order.indexOf(b.name);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  res.json({
    ok: true,
    data: {
      dbName: dbStats.db,
      connected: mongoose.connection.readyState === 1,
      host: mongoose.connection.host || 'localhost',
      port: mongoose.connection.port || 27017,
      totalCollections: dbStats.collections,
      totalObjects: dbStats.objects,
      avgObjSizeKb: Math.round((dbStats.avgObjSize || 0) / 1024 * 100) / 100,
      dataSizeMb: Math.round((dbStats.dataSize || 0) / (1024 * 1024) * 100) / 100,
      storageSizeMb: Math.round((dbStats.storageSize || 0) / (1024 * 1024) * 100) / 100,
      indexesCount: dbStats.indexes,
      indexSizeMb: Math.round((dbStats.indexSize || 0) / (1024 * 1024) * 100) / 100,
      collections,
    },
  });
});

function sanitizeDocument(doc, colName) {
  if (!doc || typeof doc !== 'object') return doc;
  const clone = { ...doc };
  if (colName === 'staffs') {
    delete clone.passwordHash;
  }
  return clone;
}

/** GET /api/admin/database/collection/:name — browse documents in any collection with pagination & search */
export const getCollectionData = asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  if (!db) throw ApiError.internal('Database connection not established');

  const collectionName = req.params.name;
  if (
    !collectionName ||
    typeof collectionName !== 'string' ||
    !/^[a-zA-Z0-9_]+$/.test(collectionName) ||
    collectionName.startsWith('system.')
  ) {
    throw ApiError.badRequest('Invalid or forbidden collection name');
  }

  const col = db.collection(collectionName);

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const search = String(req.query.search || '').trim();

  let filter = {};
  if (search) {
    if (mongoose.Types.ObjectId.isValid(search) && search.length === 24) {
      filter.$or = [{ _id: new mongoose.Types.ObjectId(search) }, { farmer: new mongoose.Types.ObjectId(search) }];
    } else {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { name: rx },
        { phone: rx },
        { status: rx },
        { stage: rx },
        { crop: rx },
        { code: rx },
        { district: rx },
        { state: rx },
        { title: rx },
        { paymentRef: rx },
        { utrNumber: rx },
        { trackingNumber: rx },
        { username: rx },
        { email: rx },
      ];
    }
  }

  let total = 0;
  let documents = [];

  try {
    [total, documents] = await Promise.all([
      col.countDocuments(filter),
      col
        .find(filter)
        .sort({ _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);
  } catch (queryErr) {
    // If complex $or failed against some schema types, fallback to simple find
    total = await col.countDocuments();
    documents = await col
      .find({})
      .sort({ _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
  }

  // Security: scrub sensitive fields such as passwordHash
  const safeDocuments = documents.map((doc) => sanitizeDocument(doc, collectionName));

  res.json({
    ok: true,
    data: {
      collection: collectionName,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      documents: safeDocuments,
    },
  });
});

/** GET /api/admin/database/collection/:name/:id — get exact document JSON */
export const getDocumentDetails = asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  if (!db) throw ApiError.internal('Database connection not established');

  const { name, id } = req.params;
  if (
    !name ||
    typeof name !== 'string' ||
    !/^[a-zA-Z0-9_]+$/.test(name) ||
    name.startsWith('system.')
  ) {
    throw ApiError.badRequest('Invalid or forbidden collection name');
  }

  const col = db.collection(name);

  let doc = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    doc = await col.findOne({ _id: new mongoose.Types.ObjectId(id) });
  }
  if (!doc) {
    doc = await col.findOne({ _id: id });
  }
  if (!doc) throw ApiError.notFound('Document not found');

  res.json({ ok: true, data: sanitizeDocument(doc, name) });
});

// ---------------------------------------------------------------- announcements

const announcementSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(150),
  message: z.string().min(5, 'Message must be at least 5 characters').max(1000),
  type: z
    .enum(['general', 'msp', 'payment_advance', 'booking_confirmed', 'weather', 'emergency', 'logistics'])
    .default('general'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  isActive: z.boolean().default(true),
  targetAudience: z.enum(['all', 'farmers', 'staff', 'public']).default('all'),
  state: z.string().optional().default('All India'),
  crop: z.string().optional().default('All Crops'),
  authorName: z.string().optional(),
});

/** GET /api/admin/announcements — List all announcements with filtering and statistics */
export const listAnnouncements = asyncHandler(async (req, res) => {
  const { search, type, status, priority } = req.query;

  const filter = {};

  if (search && typeof search === 'string' && search.trim()) {
    const s = escapeRegex(search.trim());
    filter.$or = [
      { title: { $regex: s, $options: 'i' } },
      { message: { $regex: s, $options: 'i' } },
      { state: { $regex: s, $options: 'i' } },
    ];
  }

  if (type && type !== 'all') {
    filter.type = type;
  }

  if (priority && priority !== 'all') {
    filter.priority = priority;
  }

  if (status === 'active') {
    filter.isActive = true;
  } else if (status === 'inactive') {
    filter.isActive = false;
  }

  const announcements = await Announcement.find(filter)
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  const total = await Announcement.countDocuments();
  const activeCount = await Announcement.countDocuments({ isActive: true });
  const urgentCount = await Announcement.countDocuments({ priority: { $in: ['urgent', 'high'] }, isActive: true });

  res.json({
    ok: true,
    data: {
      announcements,
      stats: {
        total,
        activeCount,
        inactiveCount: total - activeCount,
        urgentCount,
      },
    },
  });
});

/** POST /api/admin/announcements — Create a new announcement */
export const createAnnouncement = asyncHandler(async (req, res) => {
  const payload = parse(announcementSchema, req.body);

  const announcement = await Announcement.create({
    ...payload,
    authorName: req.staff?.name || payload.authorName || 'Admin Staff',
  });

  res.status(201).json({
    ok: true,
    data: announcement,
  });
});

/** PUT /api/admin/announcements/:id — Update existing announcement */
export const updateAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = parse(announcementSchema.partial(), req.body);

  const announcement = await Announcement.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true }
  );

  if (!announcement) throw ApiError.notFound('Announcement not found');

  res.json({
    ok: true,
    data: announcement,
  });
});

/** PATCH /api/admin/announcements/:id/toggle — Toggle active/inactive status */
export const toggleAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const announcement = await Announcement.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');

  announcement.isActive = !announcement.isActive;
  await announcement.save();

  res.json({
    ok: true,
    data: announcement,
  });
});

/** DELETE /api/admin/announcements/:id — Delete announcement */
export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const announcement = await Announcement.findByIdAndDelete(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');

  res.json({
    ok: true,
    data: { deleted: true, id },
  });
});

