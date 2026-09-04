import mongoose from 'mongoose';

export const SHIPMENT_STATUSES = [
  'order_confirmed',
  'produce_dispatched',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

const checkpointSchema = new mongoose.Schema(
  {
    status: { type: String, enum: SHIPMENT_STATUSES, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    location: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * 3rd-Party Logistics & Consignment Tracking for procured crops.
 * Provides e-commerce style tracking with carrier details, live checkpoints,
 * driver contact, and GPS digital seal verification.
 */
const shipmentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    trackingNumber: { type: String, required: true, unique: true, index: true },

    queueEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue', required: true, index: true },
    procurement: { type: mongoose.Schema.Types.ObjectId, ref: 'Procurement' },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true, index: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', required: true },

    crop: { type: String, default: 'Wheat' },
    quantityQtl: { type: Number, default: 0 },
    cropGrade: { type: String, default: 'A' },

    // Origin and Destination Hubs
    originCenter: {
      name: { type: String, default: 'Central APMC Mandi' },
      district: { type: String, default: '' },
      state: { type: String, default: '' },
    },
    destinationGodown: {
      name: { type: String, default: 'Central Warehousing Corporation (CWC) Mega Depot' },
      address: { type: String, default: 'Sector 34, Industrial Area' },
      district: { type: String, default: 'Karnal' },
      state: { type: String, default: 'Haryana' },
      pincode: { type: String, default: '132001' },
    },

    // 3rd-Party Logistics Provider Details
    logisticsPartner: {
      name: { type: String, default: 'Delhivery Agri Logistics' },
      serviceType: { type: String, default: 'Dedicated Agri FTL (Full Truckload)' },
      awbNumber: { type: String, default: '' },
      supportPhone: { type: String, default: '1800-102-4455' },
      vehicleNumber: { type: String, default: 'HR 05 BA 4421' },
      vehicleType: { type: String, default: '16-Ton Multi-Axle Covered Carrier' },
      driverName: { type: String, default: 'Rajesh Kumar' },
      driverPhone: { type: String, default: '+91 98765 43210' },
      securitySealNumber: { type: String, default: 'SEAL-IND-88421' },
    },

    status: {
      type: String,
      enum: SHIPMENT_STATUSES,
      default: 'order_confirmed',
      index: true,
    },
    currentLocation: { type: String, default: 'APMC Mandi Yard' },
    estimatedDelivery: { type: Date },
    deliveredAt: { type: Date },

    // Financial & Security Indicators
    advanceSecured: { type: Boolean, default: true },
    advanceAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    checkpoints: { type: [checkpointSchema], default: [] },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Shipment', shipmentSchema);
