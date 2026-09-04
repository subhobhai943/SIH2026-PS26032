import mongoose from 'mongoose';

export const PROCUREMENT_STAGES = ['arrived', 'weighed', 'approved', 'advance_paid', 'paid', 'rejected'];

const stageEventSchema = new mongoose.Schema(
  {
    stage: { type: String, enum: PROCUREMENT_STAGES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    remark: { type: String, default: '' },
  },
  { _id: false }
);

/** The record of what was actually procured from a farmer, with 20% safety advance guarantee and final settlement. */
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

    // 20% Safety Advance Guarantee
    advancePercent: { type: Number, default: 20 },
    advanceAmount: { type: Number, min: 0, default: 0 },
    balanceAmount: { type: Number, min: 0, default: 0 },
    advanceStatus: { type: String, enum: ['pending', 'paid'], default: 'pending', index: true },
    advancePaymentRef: { type: String, default: '' },
    advancePaidAt: { type: Date },

    // Final 80% Payment Settlement
    balanceStatus: { type: String, enum: ['pending', 'paid'], default: 'pending', index: true },
    stage: { type: String, enum: PROCUREMENT_STAGES, default: 'arrived', index: true },
    timeline: { type: [stageEventSchema], default: [] },
    paymentRef: { type: String, default: '' },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

procurementSchema.pre('save', function computeAmounts(next) {
  if (this.isModified('quantityQtl') || this.isModified('ratePerQtl') || this.isModified('advancePercent')) {
    this.amount = Math.round(this.quantityQtl * this.ratePerQtl * 100) / 100;
  }
  if (this.amount >= 0) {
    const pct = this.advancePercent || 20;
    this.advanceAmount = Math.round(this.amount * (pct / 100) * 100) / 100;
    this.balanceAmount = Math.round((this.amount - this.advanceAmount) * 100) / 100;
  }
  next();
});

export default mongoose.model('Procurement', procurementSchema);
