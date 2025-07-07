import mongoose from 'mongoose';
import { notificationModel } from '../Models/Notifications.js';

export const addNotification = async (req, res) => {
  try {
    const { userId, message,source } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message are required' });
    }

    const saveNotification = new notificationModel({
      message,
      userId,
      source,
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
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $unwind: '$userInfo',
      },
      {
        $project: {
          userId: 1,
          message: 1,
          createdAt: 1,
          firstName: '$userInfo.firstName',
          lastName:"$userInfo.lastName",
          source:1,
        },
      },
    ]);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const updateSeen=async(req,res)=>{
   try {
    const { userId } = req.params;
    await notificationModel.updateMany({ userId, seen: false }, { seen: true });
    res.status(200).json({ message: "Marked all as seen" });
  } catch (err) {
    res.status(500).json({ error: "Error updating seen status" });
  }
}