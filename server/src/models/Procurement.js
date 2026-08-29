import mongoose from 'mongoose';

export const PROCUREMENT_STAGES = ['arrived', 'weighed', 'approved', 'paid', 'rejected'];

const stageEventSchema = new mongoose.Schema(
  {
    stage: { type: String, enum: PROCUREMENT_STAGES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    remark: { type: String, default: '' },
  },
  { _id: false }
);

/** The record of what was actually procured from a farmer, and whether they were paid. */
const procurementSchema = new mongoose.Schema(
  {
    queueEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue', required: true, unique: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true, index: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', required: true, index: true },
    date: { type: String, required: true },
    crop: { type: String, trim: true, default: '' },
    quantityQtl: { type: Number, min: 0, default: 0 },
    qualityGrade: { type: String, enum: ['A', 'B', 'C', 'FAQ', ''], default: '' },
    ratePerQtl: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, default: 0 },
    stage: { type: String, enum: PROCUREMENT_STAGES, default: 'arrived', index: true },
    timeline: { type: [stageEventSchema], default: [] },
    paymentRef: { type: String, default: '' },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

procurementSchema.pre('save', function computeAmount(next) {
  if (this.isModified('quantityQtl') || this.isModified('ratePerQtl')) {
    this.amount = Math.round(this.quantityQtl * this.ratePerQtl * 100) / 100;
  }
  next();
});

export default mongoose.model('Procurement', procurementSchema);
