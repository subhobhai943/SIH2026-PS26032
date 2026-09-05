import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farmer',
      index: true,
    },
    phone: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'sms',
        'payment_advance',
        'payment_balance',
        'payment_confirmed',
        'booking_confirmed',
        'booking_cancelled',
        'queue_alert',
        'general',
      ],
      default: 'sms',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    provider: {
      type: String,
      default: 'sns',
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ phone: 1, createdAt: -1 });
notificationSchema.index({ farmer: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
