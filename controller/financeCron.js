
import dayjs from 'dayjs';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

import { authModel } from '../Models/auth.js';
import { orderModel } from '../Models/order.js';
import { PayoutConfig } from '../Models/finance.js';
import { notificationModel } from '../Models/NotificationSettings.js';
import { listingModel } from '../Models/Listing.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"AYDI Marketplace" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log('📩 Email sent to:', to);
  } catch (err) {
    console.error('❌ Email failed:', err.message);
  }
};

const payoutEmailTemplate = ({
  title,
  message,
  gross,
  commissionRate,
  commissionAmount,
  net,
  totalOrders,
  type,
}) => {
  const color = type === 'due' ? '#dc2626' : '#2563eb';

  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f9; padding:40px;">
    <div style="max-width:650px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.05);">
      
      <div style="background:${color}; padding:20px; text-align:center;">
        <h2 style="color:white; margin:0;">${title}</h2>
      </div>

      <div style="padding:30px;">
        <p style="font-size:15px; color:#444;">
          ${message}
        </p>

        <div style="background:#f9fafb; padding:20px; border-radius:8px; margin:20px 0;">
          
          <p style="margin:0; font-size:14px;">
            <strong>Total Orders:</strong> ${totalOrders}
          </p>

          <hr style="margin:15px 0; border:none; border-top:1px solid #eee;" />

          <p style="margin:5px 0;">
            Gross Amount: <strong>$${gross.toFixed(2)}</strong>
          </p>

          <p style="margin:5px 0; color:#dc2626;">
            Commission (${commissionRate}%): -$${commissionAmount.toFixed(2)}
          </p>

          <p style="margin-top:10px; font-size:18px; font-weight:bold; color:${color};">
            Net Payout: $${net.toFixed(2)}
          </p>

        </div>

        <p style="font-size:13px; color:#888;">
          Please login to the admin dashboard to process payouts.
        </p>
      </div>

      <div style="background:#f3f4f6; padding:15px; text-align:center; font-size:12px; color:#888;">
        © ${dayjs().year()} AYDI Marketplace. All rights reserved.
      </div>

    </div>
  </div>
  `;
};

const calculateUserBasedCommission = async (orders) => {
  let gross = 0;
  let totalCommission = 0;

  const productCache = {};
  const merchantCache = {};

  for (const order of orders) {
    for (const item of order.lineItems || []) {
      const variantId = item.variant_id;
      if (!variantId) continue;

      const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);

      gross += itemTotal;

      // 🔹 1️⃣ Find Product by Variant (with caching)
      if (!productCache[variantId]) {
        productCache[variantId] = await listingModel.findOne({
          'variants.id': variantId,
        });
      }

      const product = productCache[variantId];
      if (!product?.userId) continue;

      const userId = product.userId.toString();

      // 🔹 2️⃣ Get Merchant (with caching)
      if (!merchantCache[userId]) {
        merchantCache[userId] = await authModel.findById(userId);
      }

      const merchant = merchantCache[userId];
      const rate = merchant?.comissionRate || 0;

      const commission = (itemTotal * rate) / 100;

      totalCommission += commission;
    }
  }

  return {
    gross,
    totalCommission,
    net: gross - totalCommission,
  };
};

// export const financeCron = () => {
//   cron.schedule('* * * * *', async () => {
//     try {
//       console.log('🔁 Cron Started at:', new Date());

// const today = dayjs().utc().startOf('day');
// const tomorrow = today.add(1, 'day');

//       // ============================
//       // 1️⃣ Notification Check
//       // ============================

//       const notificationSettings = await notificationModel.findOne({});
//       if (!notificationSettings?.approvals?.payoutNotification) {
//         console.log('⛔ STOPPED → Payout notification disabled');
//         return;
//       }

//       // ============================
//       // 2️⃣ Admin + Staff Emails
//       // ============================

//       const admins = await authModel.find({
//         role: { $in: ['Master Admin', 'Dev Admin'] },
//       });

//       const adminEmails = admins.map((a) => a.email);
//       const staffEmails = notificationSettings.recipientEmails || [];

//       const recipients = [...new Set([...adminEmails, ...staffEmails])];

//       if (!recipients.length) {
//         console.log('⛔ STOPPED → No recipients found');
//         return;
//       }

//       console.log('📧 Recipients:', recipients);

//       // ============================
//       // 3️⃣ TODAY REMINDER
//       // ============================

//       const todayOrders = await orderModel.find({
//         payoutStatus: { $regex: /^pending$/i },
//         scheduledPayoutDate: {
//           $gte: today.toDate(),
//           $lt: today.add(1, 'day').toDate(),
//         },
//       });

//       console.log('📦 Today Orders:', todayOrders.length);

//       if (todayOrders.length) {
//         const { gross, totalCommission } =
//           await calculateUserBasedCommission(todayOrders);

//         const net = gross - totalCommission;

//         const html = payoutEmailTemplate({
//           title: '📢 Payout Required Today',
//           message: 'Today scheduled payouts must be processed.',
//           gross,
//           commissionRate: 'User Based',
//           commissionAmount: totalCommission,
//           net,
//           totalOrders: todayOrders.length,
//           type: 'reminder',
//         });

//         await sendEmail({
//           to: recipients,
//           subject: `Payout Required Today - ${today.format('MMM D, YYYY')}`,
//           html,
//         });

//         console.log('✅ Reminder Email Sent');
//       }

//       // ============================
//       // 4️⃣ ALL OVERDUE (ANY PAST DATE)
//       // ============================

//       const dueOrders = await orderModel.find({
//         payoutStatus: { $regex: /^pending$/i },
//         scheduledPayoutDate: { $lt: today.toDate() },
//       });

//       console.log('📦 Due Orders:', dueOrders.length);

//       if (dueOrders.length) {
//         const { gross, totalCommission } =
//           await calculateUserBasedCommission(dueOrders);

//         const net = gross - totalCommission;

//         await orderModel.updateMany(
//           { _id: { $in: dueOrders.map((o) => o._id) } },
//           { payoutStatus: 'Due' }
//         );

//         console.log('🛑 Orders Marked as Due');

//         const html = payoutEmailTemplate({
//           title: '⚠️ Payout Due Alert',
//           message:
//             'These payouts are overdue and must be processed immediately.',
//           gross,
//           commissionRate: 'User Based',
//           commissionAmount: totalCommission,
//           net,
//           totalOrders: dueOrders.length,
//           type: 'due',
//         });

//         await sendEmail({
//           to: recipients,
//           subject: '⚠️ Overdue Payout Alert',
//           html,
//         });

//         console.log('✅ Due Email Sent');
//       }

//       console.log('🏁 Cron Finished Successfully');
//     } catch (error) {
//       console.error('🔥 Finance cron failed:', error);
//     }
//   });
// };

export const financeCron = () => {
  cron.schedule('* * * * *', async () => {
    try {
      console.log('🔁 Cron Started at:', new Date());

      const today = dayjs().utc().startOf('day');

      // ============================
      // 1️⃣ Notification Check
      // ============================

      const notificationSettings = await notificationModel.findOne({});
      if (!notificationSettings?.approvals?.payoutNotification) {
        console.log('⛔ STOPPED → Payout notification disabled');
        return;
      }

      // ============================
      // 2️⃣ Admin + Staff Emails
      // ============================

      const admins = await authModel.find({
        role: { $in: ['Master Admin', 'Dev Admin'] },
      });

      const adminEmails = admins.map((a) => a.email);
      const staffEmails = notificationSettings.recipientEmails || [];

      const recipients = [...new Set([...adminEmails, ...staffEmails])];

      if (!recipients.length) {
        console.log('⛔ STOPPED → No recipients found');
        return;
      }

      console.log('📧 Recipients:', recipients);

      // =====================================================
      // 3️⃣ TODAY REMINDER (SNAPSHOT BASED)
      // =====================================================

      const todayOrders = await orderModel.find({
        scheduledPayoutDate: {
          $gte: today.toDate(),
          $lt: today.add(1, 'day').toDate(),
        },
        'ProductSnapshot.payoutStatus': 'pending',
      });

      console.log('📦 Today Orders:', todayOrders.length);

      if (todayOrders.length) {
        const { gross, totalCommission } =
          await calculateUserBasedCommission(todayOrders);

        const net = gross - totalCommission;

        const html = payoutEmailTemplate({
          title: '📢 Payout Required Today',
          message: 'Today scheduled payouts must be processed.',
          gross,
          commissionRate: 'User Based',
          commissionAmount: totalCommission,
          net,
          totalOrders: todayOrders.length,
          type: 'reminder',
        });

        await sendEmail({
          to: recipients,
          subject: `Payout Required Today - ${today.format('MMM D, YYYY')}`,
          html,
        });

        console.log('✅ Reminder Email Sent');
      }

      // =====================================================
      // 4️⃣ ALL OVERDUE (SNAPSHOT BASED SAFE VERSION)
      // =====================================================

      const dueOrders = await orderModel.find({
        scheduledPayoutDate: { $lt: today.toDate() },
        'ProductSnapshot.payoutStatus': 'pending',
      });

      console.log('📦 Due Orders:', dueOrders.length);

      if (dueOrders.length) {
        const { gross, totalCommission } =
          await calculateUserBasedCommission(dueOrders);

        const net = gross - totalCommission;

        // 🔥 SAFE UPDATE (ONLY pending snapshots become Due)
        await orderModel.updateMany(
          {
            _id: { $in: dueOrders.map((o) => o._id) },
          },
          {
            $set: {
              'ProductSnapshot.$[elem].payoutStatus': 'Due',
            },
          },
          {
            arrayFilters: [{ 'elem.payoutStatus': 'pending' }],
          }
        );

        console.log('🛑 Only Pending Snapshots Marked as Due');

        const html = payoutEmailTemplate({
          title: '⚠️ Payout Due Alert',
          message:
            'These payouts are overdue and must be processed immediately.',
          gross,
          commissionRate: 'User Based',
          commissionAmount: totalCommission,
          net,
          totalOrders: dueOrders.length,
          type: 'due',
        });

        await sendEmail({
          to: recipients,
          subject: '⚠️ Overdue Payout Alert',
          html,
        });

        console.log('✅ Due Email Sent');
      }

      console.log('🏁 Cron Finished Successfully');
    } catch (error) {
      console.error('🔥 Finance cron failed:', error);
    }
  });
};
