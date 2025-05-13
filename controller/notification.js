import mongoose from 'mongoose';
import { notificationModel } from '../Models/Notifications.js';

export const addNotification = async (req, res) => {
  try {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message are required' });
    }

    const saveNotification = new notificationModel({
      message,
      userId,
    });

    const saved = await saveNotification.save();

    return res.status(201).json(saved);
  } catch (error) {
    console.error('Notification Save Error:', error);
    return res.status(500).json({ error: 'Failed to save notification' });
  }
};

export const getNotificationByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await notificationModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $project: {
          userId: 1,
          message: 1,
          createdAt: 1,
        },
      },
    ]);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};
