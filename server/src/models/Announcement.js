import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: [
        'general',
        'msp',
        'payment_advance',
        'booking_confirmed',
        'weather',
        'emergency',
        'logistics',
      ],
      default: 'general',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    targetAudience: {
      type: String,
      enum: ['all', 'farmers', 'staff', 'public'],
      default: 'all',
    },
    state: {
      type: String,
      default: 'All India',
      trim: true,
    },
    crop: {
      type: String,
      default: 'All Crops',
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    authorName: {
      type: String,
      default: 'Admin Staff',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

announcementSchema.index({ isActive: 1, priority: 1, createdAt: -1 });

export default mongoose.model('Announcement', announcementSchema);
