import mongoose from 'mongoose';

const NotificationSettingsSchema = new mongoose.Schema(
  {
    approvals: {
      userRegistrationApproval: {
        type: Boolean,
      },
      productListingApproval: {
        type: Boolean,
      },
      systemAlerts: {
        type: Boolean,
      },
      payoutNotification: {
        type: Boolean,
      },
    },

    recipientEmails: {
      type: [String],
      validate: {
        validator: (emails) =>
          emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
        message: 'Invalid email format in recipient list',
      },
      default: [],
    },
  },
  { timestamps: true }
);

export const notificationModel = mongoose.model(
  'NotificationSettings',
  NotificationSettingsSchema
);
