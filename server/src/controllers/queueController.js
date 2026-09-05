import Queue from '../models/Queue.js';
import Center from '../models/Center.js';
import Procurement from '../models/Procurement.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { todayISO } from '../utils/datetime.js';
import { getFarmerQueueView, getQueueState } from '../services/queueService.js';
import { generateAndUploadBill } from '../services/pdfBillService.js';

/** GET /api/queue/:centerId?date= — the public live board for a centre. */
export const getBoard = asyncHandler(async (req, res) => {
  const date = String(req.query.date || todayISO());
  const state = await getQueueState(req.params.centerId, date);
  if (!state) throw ApiError.notFound('Procurement centre not found');

  // The public board shows tokens and masked names only — never phone numbers.
  res.json({
    ok: true,
    data: {
      ...state,
      waiting: state.waiting.map((entry) => ({
        token: entry.token,
        status: entry.status,
        position: entry.position,
        estimatedWaitLabel: entry.estimatedWaitLabel,
        farmerName: maskName(entry.farmer?.name),
        village: entry.farmer?.village || '',
        slot: entry.slot ? `${entry.slot.startTime}–${entry.slot.endTime}` : '',
      })),
    },
  });
});

function maskName(name) {
  if (!name) return 'Farmer';
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

/** GET /api/queue/me/position?centerId=&date= — the logged-in farmer's own view. */
export const myPosition = asyncHandler(async (req, res) => {
  const date = String(req.query.date || todayISO());
  let centerId = req.query.centerId ? String(req.query.centerId) : null;

  if (!centerId) {
    const active = await Queue.findOne({
      farmer: req.farmer._id,
      date,
      status: { $in: ['booked', 'checked_in', 'serving'] },
    }).lean();
    if (!active) return res.json({ ok: true, data: null });
    centerId = String(active.center);
  }

  const view = await getFarmerQueueView(req.farmer._id, centerId, date);
  if (!view) throw ApiError.notFound('Procurement centre not found');
  return res.json({ ok: true, data: view });
});

/** GET /api/queue/me/status/:bookingId — full procurement timeline for one booking. */
export const myProcurementStatus = asyncHandler(async (req, res) => {
  const entry = await Queue.findOne({ _id: req.params.bookingId, farmer: req.farmer._id })
    .populate('center', 'name code address contactPhone')
    .populate('slot', 'startTime endTime')
    .populate('farmer', 'name phone village district state')
    .lean();
  if (!entry) throw ApiError.notFound('Booking not found');

  let procurement = await Procurement.findOne({ queueEntry: entry._id }).lean();

  if (
    procurement &&
    (procurement.balanceStatus === 'paid' || procurement.paymentConfirmed || procurement.stage === 'paid') &&
    !procurement.billPdfUrl
  ) {
    try {
      const billUrl = await generateAndUploadBill(procurement._id);
      procurement.billPdfUrl = billUrl;
      procurement.billGeneratedAt = new Date();
    } catch (billErr) {
      console.warn('[queueController] auto-generate bill warning:', billErr.message);
    }
  }

  res.json({
    ok: true,
    data: {
      booking: entry,
      procurement: procurement || null,
      stages: buildStageChecklist(entry, procurement),
    },
  });
});

/**
 * Flattens the booking + procurement records into the ordered checklist the
 * farmer-facing status timeline renders.
 */
function buildStageChecklist(entry, procurement) {
  const order = ['booked', 'arrived', 'weighed', 'approved', 'advance_paid', 'paid'];
  const doneAt = {
    booked: entry.createdAt,
    arrived: entry.checkedInAt,
  };
  for (const event of procurement?.timeline || []) doneAt[event.stage] = event.at;
  if (procurement?.advanceStatus === 'paid' && !doneAt.advance_paid) {
    doneAt.advance_paid = procurement.advancePaidAt || procurement.updatedAt;
  }
  if (procurement?.balanceStatus === 'paid' && !doneAt.paid) {
    doneAt.paid = procurement.paidAt || procurement.updatedAt;
  }

  let reachedIndex = -1;
  order.forEach((stage, i) => {
    if (doneAt[stage]) reachedIndex = i;
  });

  return order.map((stage, i) => ({
    stage,
    done: Boolean(doneAt[stage]),
    current: i === reachedIndex,
    at: doneAt[stage] || null,
  }));
}

/** GET /api/queue/me/history */
export const myHistory = asyncHandler(async (req, res) => {
  const records = await Procurement.find({ farmer: req.farmer._id })
    .sort({ date: -1 })
    .limit(50)
    .populate('center', 'name code district')
    .lean();
  res.json({ ok: true, data: records });
});

/** GET /api/queue/:centerId/stats?date= — headline numbers for dashboards. */
export const getStats = asyncHandler(async (req, res) => {
  const date = String(req.query.date || todayISO());
  const centerId = req.params.centerId;

  const center = await Center.findById(centerId).lean();
  if (!center) throw ApiError.notFound('Procurement centre not found');

  const [byStatus, procured] = await Promise.all([
    Queue.aggregate([
      { $match: { center: center._id, date } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Procurement.aggregate([
      { $match: { center: center._id, date } },
      {
        $group: {
          _id: null,
          quantityQtl: { $sum: '$quantityQtl' },
          amount: { $sum: '$amount' },
          paid: { $sum: { $cond: [{ $eq: ['$stage', 'paid'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const statusCounts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
  const totals = procured[0] || { quantityQtl: 0, amount: 0, paid: 0 };

  res.json({
    ok: true,
    data: {
      center: { id: String(center._id), name: center.name, code: center.code },
      date,
      statusCounts,
      served: statusCounts.completed || 0,
      waiting: (statusCounts.booked || 0) + (statusCounts.checked_in || 0),
      quantityQtl: Math.round(totals.quantityQtl * 100) / 100,
      amount: Math.round(totals.amount * 100) / 100,
      paymentsReleased: totals.paid,
      utilizationPct: center.dailyCapacity
        ? Math.round(((statusCounts.completed || 0) / center.dailyCapacity) * 100)
        : 0,
    },
  });
});
