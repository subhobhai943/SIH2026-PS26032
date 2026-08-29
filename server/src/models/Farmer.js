import mongoose from 'mongoose';

const farmerSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      match: [/^[6-9]\d{9}$/, 'phone must be a 10-digit Indian mobile number'],
    },
    name: { type: String, trim: true, default: '' },
    // Last 4 digits only — we never store a full Aadhaar number.
    aadhaarLast4: { type: String, match: [/^\d{4}$/, 'aadhaarLast4 must be 4 digits'] },
    village: { type: String, trim: true, default: '' },
    district: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    crops: [{ type: String, trim: true }],
    landAreaAcres: { type: Number, min: 0 },
    preferredLanguage: { type: String, enum: ['en', 'hi', 'bn', 'ta', 'te', 'mr'], default: 'en' },
    profileComplete: { type: Boolean, default: false },
    fcmToken: { type: String, default: '' },
  },
  { timestamps: true }
);

farmerSchema.pre('save', function markProfileComplete(next) {
  this.profileComplete = Boolean(this.name && this.village && this.district);
  next();
});

export default mongoose.model('Farmer', farmerSchema);
