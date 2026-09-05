import { z } from 'zod';
import Shipment, { SHIPMENT_STATUSES } from '../models/Shipment.js';
import Queue from '../models/Queue.js';
import Procurement from '../models/Procurement.js';
import Center from '../models/Center.js';
import Farmer from '../models/Farmer.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { parse } from '../utils/validate.js';
import { escapeRegex } from '../utils/sanitize.js';

const CARRIERS = [
  { name: 'Delhivery Agri Logistics', support: '1800-102-4455', prefix: 'DELH' },
  { name: 'BlackBuck Ag-Freight', support: '1800-209-6688', prefix: 'BBLK' },
  { name: 'TCI Express Mandi Line', support: '1800-200-8242', prefix: 'TCIE' },
  { name: 'Rivigo Agri Relay', support: '1800-120-7484', prefix: 'RIVG' },
];

/**
 * Ensures a valid Shipment record exists for a given Queue entry.
 * Generates realistic initial checkpoints and carrier details if none exists.
 */
export async function ensureShipmentForQueue(queueEntryId) {
  let shipment = await Shipment.findOne({ queueEntry: queueEntryId })
    .populate('center', 'name code address district state contactPhone')
    .populate('farmer', 'name phone village district state')
    .populate('procurement');

  if (shipment) return shipment;

  const entry = await Queue.findById(queueEntryId)
    .populate('center', 'name code address district state')
    .populate('farmer', 'name phone village district state');

  if (!entry) return null;

  const procurement = await Procurement.findOne({ queueEntry: entry._id });

  const idSuffix = entry._id.toString().slice(-4).toUpperCase();
  const tokenNum = String(entry.token).padStart(4, '0');
  const orderId = `ORD-2026-${tokenNum}-${idSuffix}`;
  const carrier = CARRIERS[Math.abs(entry.token) % CARRIERS.length];
  const trackingNumber = `${carrier.prefix}-${entry.date.replace(/-/g, '').slice(2)}-${tokenNum}${idSuffix.slice(0, 2)}`;

  const createdTime = entry.createdAt || new Date();
  const now = new Date();

  // Determine realistic initial status & checkpoints
  let status = 'order_confirmed';
  const checkpoints = [
    {
      status: 'order_confirmed',
      title: 'Order Confirmed & 20% Safety Advance Guarantee Locked',
      description: `Crop procurement order verified for Token #${entry.token}. 20% upfront advance reserved.`,
      location: entry.center?.name || 'APMC Procurement Mandi',
      timestamp: createdTime,
    },
  ];

  if (entry.checkedInAt || ['checked_in', 'serving', 'completed'].includes(entry.status)) {
    status = 'produce_dispatched';
    checkpoints.push({
      status: 'produce_dispatched',
      title: 'Produce Weighed & Bagged for 3rd-Party Freight',
      description: `Farmer delivered produce at mandi. Quality inspection completed and standardized bags prepared for shipping.`,
      location: entry.center?.name || 'Mandi Weighbridge',
      timestamp: entry.checkedInAt || new Date(createdTime.getTime() + 30 * 60000),
    });
  }

  if (procurement?.stage === 'approved' || procurement?.stage === 'advance_paid' || procurement?.stage === 'paid') {
    status = 'picked_up';
    checkpoints.push({
      status: 'picked_up',
      title: `Handed over to ${carrier.name}`,
      description: `Truck loaded, GPS digital security seal SEAL-IND-${Math.floor(10000 + Math.random() * 90000)} attached.`,
      location: `${entry.center?.name || 'Mandi Center'} Logistics Gate`,
      timestamp: new Date(createdTime.getTime() + 60 * 60000),
    });
  }

  if (procurement?.advanceStatus === 'paid' || procurement?.stage === 'advance_paid' || procurement?.stage === 'paid') {
    status = 'in_transit';
    checkpoints.push({
      status: 'in_transit',
      title: 'In Transit via Logistics Express Corridor',
      description: `Consignment en route to Central Buffer Godown. GPS speed and temperature normal.`,
      location: `NH-44 Freight Corridor, Checkpoint ${entry.center?.district || 'Ambala'}`,
      timestamp: procurement?.advancePaidAt || new Date(createdTime.getTime() + 120 * 60000),
    });
  }

  if (procurement?.balanceStatus === 'paid' || procurement?.stage === 'paid') {
    status = 'delivered';
    checkpoints.push({
      status: 'out_for_delivery',
      title: 'Arrived at Central Warehouse Unloading Bay',
      description: 'Vehicle checked in at destination depot. Awaiting dock assignment.',
      location: 'CWC Mega Depot, Dock #4',
      timestamp: new Date(now.getTime() - 30 * 60000),
    });
    checkpoints.push({
      status: 'delivered',
      title: 'Produce Received & Verified by Warehouse Custodian',
      description: 'Digital seal intact. Stock accounted in national e-procurement ledger.',
      location: 'CWC Central Silo Complex, Karnal',
      timestamp: procurement?.paidAt || now,
    });
  }

  const estDelivery = new Date(Date.now() + 36 * 3600 * 1000); // +36 hours

  shipment = await Shipment.create({
    orderId,
    trackingNumber,
    queueEntry: entry._id,
    procurement: procurement?._id,
    farmer: entry.farmer._id,
    center: entry.center._id,
    crop: entry.crop || procurement?.crop || 'Wheat',
    quantityQtl: procurement?.quantityQtl || entry.estimatedQuantityQtl || 10,
    cropGrade: procurement?.qualityGrade || 'A',
    originCenter: {
      name: entry.center?.name || 'APMC Procurement Mandi',
      district: entry.center?.district || '',
      state: entry.center?.state || 'Punjab / Haryana',
    },
    destinationGodown: {
      name: 'Central Warehousing Corporation (CWC) Mega Depot',
      address: 'Plot 45-A, GT Road Logistics Park',
      district: 'Karnal',
      state: 'Haryana',
      pincode: '132001',
    },
    logisticsPartner: {
      name: carrier.name,
      serviceType: 'Dedicated Agri FTL (Full Truckload)',
      awbNumber: `${carrier.prefix}${Math.floor(10000000 + Math.random() * 90000000)}`,
      supportPhone: carrier.support,
      vehicleNumber: `HR 05 BA ${Math.floor(1000 + Math.random() * 9000)}`,
      vehicleType: '16-Ton Multi-Axle Covered Carrier',
      driverName: 'Rajesh Kumar',
      driverPhone: '+91 98765 43210',
      securitySealNumber: `SEAL-IND-${Math.floor(10000 + Math.random() * 90000)}`,
    },
    status,
    currentLocation: checkpoints[checkpoints.length - 1]?.location || 'APMC Mandi Yard',
    estimatedDelivery: estDelivery,
    deliveredAt: status === 'delivered' ? (procurement?.paidAt || now) : null,
    advanceSecured: true,
    advanceAmount: procurement?.advanceAmount || Math.round((procurement?.amount || 22750) * 0.2),
    totalAmount: procurement?.amount || 22750,
    checkpoints,
  });

  return await Shipment.findById(shipment._id)
    .populate('center', 'name code address district state contactPhone')
    .populate('farmer', 'name phone village district state')
    .populate('procurement');
}

/**
 * GET /api/shipments/my-shipments
 * Requires farmer authentication.
 * Returns only the logged-in farmer's shipments.
 */
export const myShipments = asyncHandler(async (req, res) => {
  const farmerId = req.farmer._id;

  // Ensure shipments exist for all bookings of this farmer
  const farmerQueues = await Queue.find({ farmer: farmerId }).sort({ createdAt: -1 });
  for (const q of farmerQueues) {
    await ensureShipmentForQueue(q._id);
  }

  const shipments = await Shipment.find({ farmer: farmerId })
    .sort({ createdAt: -1 })
    .populate('center', 'name code address district state contactPhone')
    .populate('farmer', 'name phone village district state')
    .populate('procurement');

  res.json({ ok: true, data: shipments });
});

/**
 * GET /api/shipments/track/:query
 * Requires farmer authentication.
 * Only allows tracking if the shipment belongs to the authenticated farmer.
 */
export const trackShipment = asyncHandler(async (req, res) => {
  const query = String(req.params.query || '').trim();
  if (!query) throw ApiError.badRequest('Tracking number, Order ID, or Token is required');

  const farmerId = req.farmer._id;
  const queryRegex = new RegExp(`^${escapeRegex(query)}$`, 'i');

  let shipment = await Shipment.findOne({
    farmer: farmerId,
    $or: [{ trackingNumber: queryRegex }, { orderId: queryRegex }],
  })
    .populate('center', 'name code address district state contactPhone')
    .populate('farmer', 'name phone village district state')
    .populate('procurement');

  // If not found by direct ID, check if query matches a Token number (e.g. 1, 2, 102) for this farmer
  if (!shipment && /^\d+$/.test(query)) {
    const tokenNum = parseInt(query, 10);
    const queueEntry = await Queue.findOne({ farmer: farmerId, token: tokenNum }).sort({ createdAt: -1 });
    if (queueEntry) {
      shipment = await ensureShipmentForQueue(queueEntry._id);
    }
  }

  // If still not found, check if query is an ObjectId
  if (!shipment && query.match(/^[0-9a-fA-F]{24}$/)) {
    shipment = await Shipment.findOne({
      farmer: farmerId,
      $or: [{ _id: query }, { queueEntry: query }],
    })
      .populate('center', 'name code address district state contactPhone')
      .populate('farmer', 'name phone village district state')
      .populate('procurement');

    if (!shipment) {
      const qEntry = await Queue.findOne({ _id: query, farmer: farmerId });
      if (qEntry) {
        shipment = await ensureShipmentForQueue(qEntry._id);
      }
    }
  }

  if (!shipment) {
    throw ApiError.notFound(`No consignment found for your account matching '${query}'`);
  }

  res.json({ ok: true, data: shipment });
});

/**
 * GET /api/shipments/booking/:queueEntryId
 * Requires farmer authentication.
 * Verifies booking ownership.
 */
export const getShipmentByBooking = asyncHandler(async (req, res) => {
  const { queueEntryId } = req.params;
  const entry = await Queue.findOne({ _id: queueEntryId, farmer: req.farmer._id });
  if (!entry) throw ApiError.notFound('Booking not found under your account');

  const shipment = await ensureShipmentForQueue(entry._id);
  if (!shipment) throw ApiError.notFound('Shipment not found');
  res.json({ ok: true, data: shipment });
});

/**
 * PATCH /api/admin/shipments/:id
 * Admin updates logistics partner, driver, vehicle, status, or destination
 */
const updateShipmentSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES).optional(),
  currentLocation: z.string().optional(),
  partnerName: z.string().optional(),
  vehicleNumber: z.string().optional(),
  vehicleType: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  destinationName: z.string().optional(),
  destinationDistrict: z.string().optional(),
  notes: z.string().optional(),
});

export const adminUpdateShipment = asyncHandler(async (req, res) => {
  const body = parse(updateShipmentSchema, req.body);
  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) throw ApiError.notFound('Shipment not found');

  if (body.status) {
    const oldStatus = shipment.status;
    shipment.status = body.status;
    if (body.status === 'delivered') shipment.deliveredAt = new Date();

    // Auto-append checkpoint for status change if not already present
    if (oldStatus !== body.status) {
      const titles = {
        order_confirmed: 'Order Confirmed & Advance Secured',
        produce_dispatched: 'Produce Bagged & Scheduled for Logistics Dispatch',
        picked_up: `Produce Loaded & Picked Up by ${body.partnerName || shipment.logisticsPartner.name}`,
        in_transit: 'In Transit along National Agri Logistics Corridor',
        out_for_delivery: 'Out for Final Delivery to Buffer Depot',
        delivered: 'Produce Successfully Received & Stocked at Central Depot',
      };
      shipment.checkpoints.push({
        status: body.status,
        title: titles[body.status] || `Status updated to ${body.status}`,
        description: body.notes || `Consignment checkpoint recorded at ${body.currentLocation || shipment.currentLocation}.`,
        location: body.currentLocation || shipment.currentLocation,
        timestamp: new Date(),
      });
    }
  }

  if (body.currentLocation) shipment.currentLocation = body.currentLocation;
  if (body.partnerName) shipment.logisticsPartner.name = body.partnerName;
  if (body.vehicleNumber) shipment.logisticsPartner.vehicleNumber = body.vehicleNumber;
  if (body.vehicleType) shipment.logisticsPartner.vehicleType = body.vehicleType;
  if (body.driverName) shipment.logisticsPartner.driverName = body.driverName;
  if (body.driverPhone) shipment.logisticsPartner.driverPhone = body.driverPhone;
  if (body.destinationName) shipment.destinationGodown.name = body.destinationName;
  if (body.destinationDistrict) shipment.destinationGodown.district = body.destinationDistrict;
  if (body.notes !== undefined) shipment.notes = body.notes;

  await shipment.save();
  res.json({ ok: true, data: shipment });
});

/**
 * POST /api/admin/shipments/:id/checkpoint
 * Admin adds a live transit checkpoint
 */
const checkpointSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES),
  title: z.string().min(2),
  description: z.string().default(''),
  location: z.string().min(2),
});

export const adminAddCheckpoint = asyncHandler(async (req, res) => {
  const body = parse(checkpointSchema, req.body);
  const shipment = await Shipment.findById(req.params.id);
  if (!shipment) throw ApiError.notFound('Shipment not found');

  shipment.checkpoints.push({
    status: body.status,
    title: body.title,
    description: body.description,
    location: body.location,
    timestamp: new Date(),
  });

  shipment.status = body.status;
  shipment.currentLocation = body.location;
  if (body.status === 'delivered') shipment.deliveredAt = new Date();

  await shipment.save();
  res.json({ ok: true, data: shipment });
});
