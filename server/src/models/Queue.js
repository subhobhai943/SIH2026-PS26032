import mongoose from 'mongoose';

export const QUEUE_STATUSES = ['booked', 'checked_in', 'serving', 'completed', 'cancelled', 'no_show'];

/**
 * One farmer's place in one centre's queue for one day.
 * `token` is the printed/SMS'd number; `position` is recalculated live from the
 * set of waiting entries, so it is derived rather than stored.
 */
const queueSchema = new mongoose.Schema(
  {
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', required: true, index: true },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true, index: true },
    date: { type: String, required: true, index: true },
    token: { type: Number, required: true },
    status: { type: String, enum: QUEUE_STATUSES, default: 'booked', index: true },
    crop: { type: String, trim: true, default: '' },
    estimatedQuantityQtl: { type: Number, min: 0 },
    checkedInAt: { type: Date },
    servingStartedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

queueSchema.index({ center: 1, date: 1, token: 1 }, { unique: true });
queueSchema.index({ farmer: 1, date: 1 });

/** Entries that still occupy a place in line. */
queueSchema.statics.WAITING_STATUSES = ['booked', 'checked_in'];

export default mongoose.model('Queue', queueSchema);
