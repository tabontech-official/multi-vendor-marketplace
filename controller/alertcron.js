import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

import { authModel } from '../Models/auth.js';
import { orderModel } from '../Models/order.js';
import { listingModel } from '../Models/Listing.js';
import { alertModel } from '../Models/alert.js';
import { viewModel } from '../Models/viewModel.js';

const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error('Email error:', err.message);
  }
};

const LOW_STOCK_THRESHOLD = 5;

const checkStockAlerts = async () => {
  const listings = await listingModel.find();

  for (const product of listings) {
    if (!product.userId) continue;

    const totalQty =
      product.variants?.reduce(
        (sum, v) => sum + (v.inventory_quantity || 0),
        0
      ) || 0;

    let type = null;
    let message = '';

    if (totalQty === 0) {
      type = 'out_of_stock';
      message = `Product "${product.title}" is OUT OF STOCK`;
    } else if (totalQty <= LOW_STOCK_THRESHOLD) {
      type = 'low_stock';
      message = `Product "${product.title}" is LOW on stock (${totalQty})`;
    }

    if (!type) continue;

    const exists = await alertModel.findOne({
      userId: product.userId,
      productId: product.id,
      type,
    });

    if (exists) continue;

    await alertModel.create({
      userId: product.userId,
      productId: product.id,
      type,
      message,
      meta: {
        currentStock: totalQty,
        threshold: LOW_STOCK_THRESHOLD,
      },
    });

    const user = await authModel.findById(product.userId);

    if (user?.email) {
      await sendEmail(user.email, 'Stock Alert', message);
    }
  }
};

const checkConversionAlerts = async () => {
  const users = await listingModel.distinct('userId');

  for (const userId of users) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);

    const sales = await orderModel.aggregate([
      { $unwind: '$ProductSnapshot' },
      {
        $match: {
          createdAt: { $gte: startDate },
          'ProductSnapshot.merchantId': new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: '$ProductSnapshot.productId',
          units: { $sum: '$ProductSnapshot.quantity' },
          name: { $first: '$ProductSnapshot.product.title' },
        },
      },
    ]);

    const viewsData = await viewModel.find({ userId });

    const viewsMap = {};
    viewsData.forEach((u) => {
      u.products?.forEach((p) => {
        viewsMap[p.productId] = (viewsMap[p.productId] || 0) + p.totalViews;
      });
    });

    for (const item of sales) {
      const views = viewsMap[item._id] || 0;
      const conversion = views > 0 ? (item.units / views) * 100 : 0;

      if (conversion < 1) {
        const exists = await alertModel.findOne({
          userId,
          productId: item._id,
          type: 'conversion',
        });

        if (exists) continue;

        const message = `Low conversion (${conversion.toFixed(
          2
        )}%) for product "${item.name}"`;

        await alertModel.create({
          userId,
          productId: item._id,
          type: 'conversion',
          message,
          meta: {
            conversionRate: conversion,
          },
        });

        const user = await authModel.findById(userId);

        if (user?.email) {
          await sendEmail(user.email, 'Conversion Alert', message);
        }
      }
    }
  }
};

export const startAlertCron = () => {
  console.log(' Alert cron initialized');

  cron.schedule('0 9 * * *', async () => {
    console.log('Alert cron running...');

    try {
      await checkStockAlerts();
      await checkConversionAlerts();
    } catch (err) {
      console.error('Cron Error:', err);
    }
  });
};
