import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true, index: true },
    procurement: { type: mongoose.Schema.Types.ObjectId, ref: 'Procurement' },
    buyerName: { type: String, required: true, trim: true },
    buyerCompany: { type: String, required: true, trim: true },
    buyerRole: {
      type: String,
      default: 'Verified Bulk Buyer',
      trim: true,
    },
    buyerCity: { type: String, default: '', trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
    crop: { type: String, trim: true, default: 'Wheat' },
    lotQuantityQtl: { type: Number, min: 0 },
    tags: [{ type: String, trim: true }],
    verifiedPurchase: { type: Boolean, default: true },
    helpfulCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

reviewSchema.index({ farmer: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
