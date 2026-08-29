import mongoose from 'mongoose';

/**
 * A government procurement centre (mandi / PACS / FCI depot).
 * Slots and queues are always scoped to a centre.
 */
const centerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: { type: String, trim: true, default: '' },
    district: { type: String, required: true, trim: true, index: true },
    state: { type: String, required: true, trim: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    crops: [{ type: String, trim: true }],
    dailyCapacity: { type: Number, default: 120, min: 1 },
    avgServiceMinutes: { type: Number, default: 12, min: 1 },
    openTime: { type: String, default: '09:00' },
    closeTime: { type: String, default: '17:00' },
    contactPhone: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

centerSchema.index({ location: '2dsphere' });

export default mongoose.model('Center', centerSchema);
