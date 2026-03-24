import { alertModel } from "../Models/alert.js";
import mongoose from "mongoose";


export const getAllAlerts = async (req, res) => {
  try {
    const alerts = await alertModel.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            productId: '$productId',
            type: '$type',
          },
          doc: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: { newRoot: '$doc' },
      },

      // 👇 ADD THIS LOOKUP (same as user API)
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },

      // 👇 SAME STRUCTURE AS getUserAlerts
      {
        $project: {
          message: 1,
          type: 1,
          productId: 1,
          createdAt: 1,
          meta: 1,

          user: {
            _id: '$user._id',
            name: {
              $concat: ['$user.firstName', ' ', '$user.lastName'],
            },
            email: '$user.email',
          },
        },
      },
    ]);

    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching alerts' });
  }
};

export const getUserAlerts = async (req, res) => {
  try {
    const userId = req.userId;

    const alerts = await alertModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            productId: '$productId',
            type: '$type',
          },
          doc: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: { newRoot: '$doc' },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          message: 1,
          type: 1,
          productId: 1,
          createdAt: 1,
          meta: 1,

          user: {
            _id: '$user._id',
            name: {
              $concat: ['$user.firstName', ' ', '$user.lastName'],
            },
            email: '$user.email',
          },
        },
      },
    ]);

    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching user alerts' });
  }
};