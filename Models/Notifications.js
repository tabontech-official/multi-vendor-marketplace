import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    message: {
      type: String,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    source: { type: String},
  },
  {
    timestamps: true,
  }
);

export const notificationModel = mongoose.model(
  'notifications',
  NotificationSchema
);
