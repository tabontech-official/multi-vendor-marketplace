import { notificationModel } from '../Models/NotificationSettings.js';

export const getNotificationSettings = async (req, res) => {
  try {
    let settings = await notificationModel.findOne();

    if (!settings) {
      settings = await notificationModel.create({});
    }

    return res.status(200).json(settings);
  } catch (error) {
    console.error('Error in getNotificationSettings:', error);
    res.status(500).json({ error: error.message });
  }
};

export const saveNotificationSettings = async (req, res) => {
  try {
    const {
      userRegistrationApproval,
      productListingApproval,
      systemAlerts,
      payoutNotification,
      recipientEmails,
    } = req.body;

    const settings = await notificationModel.findOneAndUpdate(
      {},
      {
        approvals: {
          userRegistrationApproval,
          productListingApproval,
          systemAlerts,
          payoutNotification,
        },
        recipientEmails,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      message: 'Notification settings saved successfully',
      settings,
    });
  } catch (error) {
    console.error('Error in saveNotificationSettings:', error);
    res.status(500).json({ error: error.message });
  }
};
