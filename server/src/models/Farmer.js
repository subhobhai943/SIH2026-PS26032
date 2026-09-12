import mongoose from 'mongoose';

const farmerSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      unique: true,
      sparse: true,
      match: [/^[6-9]\d{9}$/, 'phone must be a 10-digit Indian mobile number'],
    },
    email: { type: String, lowercase: true, trim: true, sparse: true },
    googleId: { type: String, unique: true, sparse: true },
    authProvider: { type: String, enum: ['phone', 'google'], default: 'phone' },
    name: { type: String, trim: true, default: '' },
    photoUrl: { type: String, default: '' },
    // 12-digit Indian Aadhaar number
    aadhaarNumber: {
      type: String,
      trim: true,
      sparse: true,
      match: [/^\d{12}$/, 'aadhaarNumber must be a 12-digit number'],
    },
    // Last 4 digits for masked display
    aadhaarLast4: { type: String, match: [/^\d{4}$/, 'aadhaarLast4 must be 4 digits'] },
    // Aadhaar Card photo / document URL
    aadhaarCardUrl: { type: String, default: '' },
    aadhaarVerified: { type: Boolean, default: false },
    village: { type: String, trim: true, default: '' },
    district: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    crops: [{ type: String, trim: true }],
    landAreaAcres: { type: Number, min: 0 },
    preferredLanguage: { type: String, enum: ['en', 'hi', 'pa', 'bn', 'ta', 'te', 'mr'], default: 'en' },
    profileComplete: { type: Boolean, default: false },
    fcmToken: { type: String, default: '' },
    averageRating: { type: Number, default: 5, min: 1, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },
    badge: { type: String, default: 'Verified Producer' },
  },
  { timestamps: true }
);

farmerSchema.pre('save', function markProfileComplete(next) {
  if (this.aadhaarNumber && !this.aadhaarLast4) {
    this.aadhaarLast4 = this.aadhaarNumber.slice(-4);
  }
  if (this.aadhaarNumber || this.aadhaarLast4) {
    this.aadhaarVerified = true;
  }
  this.profileComplete = Boolean(
    this.name && this.village && this.district && this.phone && (this.aadhaarNumber || this.aadhaarLast4)
  );
  next();
});

export default mongoose.model('Farmer', farmerSchema);
