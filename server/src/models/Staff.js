import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/** Procurement centre staff / district admin who operate the admin panel. */
const staffSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['operator', 'admin'], default: 'operator' },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'Center' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

staffSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

staffSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
};

export default mongoose.model('Staff', staffSchema);
