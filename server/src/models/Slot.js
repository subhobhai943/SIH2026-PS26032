import mongoose from 'mongoose';

/**
 * A bookable time window at a centre on a given date.
 * `booked` is kept on the document so capacity can be claimed atomically
 * with a single conditional update (see slotController.bookSlot).
 */
const slotSchema = new mongoose.Schema(
  {
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', required: true, index: true },
    date: { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'] },
    startTime: { type: String, required: true, match: [/^\d{2}:\d{2}$/, 'startTime must be HH:mm'] },
    endTime: { type: String, required: true, match: [/^\d{2}:\d{2}$/, 'endTime must be HH:mm'] },
    capacity: { type: Number, required: true, min: 1 },
    booked: { type: Number, default: 0, min: 0 },
    crop: { type: String, trim: true, default: 'any' },
    status: { type: String, enum: ['open', 'closed', 'cancelled'], default: 'open' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

slotSchema.index({ center: 1, date: 1, startTime: 1 }, { unique: true });

slotSchema.virtual('available').get(function available() {
  return Math.max(0, this.capacity - this.booked);
});

slotSchema.virtual('isFull').get(function isFull() {
  return this.booked >= this.capacity;
});

export default mongoose.model('Slot', slotSchema);
