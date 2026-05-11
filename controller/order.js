import { authModel } from '../Models/auth.js';
import { orderModel } from '../Models/order.js';
import axios from 'axios';
import mongoose from 'mongoose';
import { listingModel } from '../Models/Listing.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import dayjs from 'dayjs';
import minMax from 'dayjs/plugin/minMax.js';
import { PayoutConfig } from '../Models/finance.js';
import { orderRquestModel } from '../Models/OrderRequest.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import { Parser } from 'json2csv';
import path from 'path';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';
import { notificationModel } from '../Models/NotificationSettings.js';
import { viewModel } from '../Models/viewModel.js';
dayjs.extend(customParseFormat);
dayjs.extend(minMax);

const generatePayoutReference = () => {
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  const timestamp = Date.now();
  return `PYT-${timestamp}-${random}`;
};
export const addComission = async (req, res) => {
  try {
    const { comission } = req.body;

    if (comission === undefined || comission === null) {
      return res.status(400).json({ message: 'Commission is required' });
    }

    if (isNaN(comission) || comission < 0 || comission > 100) {
      return res
        .status(400)
        .json({ message: 'Commission must be between 0 and 100' });
    }

    const payoutConfig = await PayoutConfig.findOne();
    if (!payoutConfig) {
      return res
        .status(404)
        .json({ message: 'No payout configuration found to update' });
    }

    payoutConfig.Comission = comission;
    await payoutConfig.save();

    return res.status(200).json({
      message: 'Commission updated successfully',
      data: payoutConfig,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const shopifyRequest = async (
  url,
  method,
  body,
  apiKey,
  accessToken
) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error(`❌ Shopify API Request Failed`);
    console.error(`URL: ${url}`);
    console.error(`Status: ${response.status}`);
    console.error(`Response: ${errorText}`);

    throw new Error(`Request failed: ${errorText}`);
  }

  return response.json();
};

async function checkProductExists(productId) {
  const url = `https://${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}@${process.env.SHOPIFY_STORE_URL}/admin/api/2023-01/products/${productId}.json`;

  try {
    const response = await axios.get(url);
    return response.data.product ? true : false;
  } catch (error) {
    console.error('Error checking product existence:', error);
    return false;
  }
}

const sendRefundEmail = async ({
  to,
  customerName,
  orderNo,
  refundAmount,
  currency,
  reason,
}) => {
  if (!to) {
    console.log('⚠️ Customer email missing. Refund email skipped.');
    return {
      sent: false,
      reason: 'Customer email missing',
    };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const subject = `Your refund has been processed for Order #${orderNo}`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
      <h2>Your refund has been processed</h2>

      <p>Hi ${customerName || 'Customer'},</p>

      <p>
        Your refund for order <strong>#${orderNo}</strong> has been processed successfully.
      </p>

      <p>
        <strong>Refund Amount:</strong> ${currency || ''} ${Number(refundAmount || 0).toFixed(2)}
      </p>

      ${reason
      ? `<p><strong>Reason:</strong> ${reason}</p>`
      : ''
    }

      <p>
        Depending on your bank or payment provider, it may take a few business days for the refund to appear in your account.
      </p>

      <p>Thank you.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html,
  });

  return {
    sent: true,
  };
};
// export const createOrder = async (req, res) => {
//   try {
//     const orderData = req.body;
//     const orderId = String(orderData.id);
//     const shopifyOrderNo = orderData.order_number;

//     const productId = orderData.line_items?.[0]?.product_id;
//     if (!productId) {
//       return res.status(400).send('Missing product ID');
//     }

//     const product = await listingModel.findOne({ id: productId }).lean();
//     if (!product) {
//       return res.status(404).send('Product does not exist');
//     }

//     const quantity = orderData.line_items?.reduce(
//       (sum, i) => sum + (i.quantity || 0),
//       0
//     );

//     let existingOrder = await orderModel.findOne({ orderId });
//     let serialNumber;

//     if (existingOrder) {
//       serialNumber = existingOrder.serialNumber;

//       await orderModel.updateOne(
//         { orderId },
//         {
//           $set: {
//             customer: orderData.customer,
//             lineItems: orderData.line_items,
//             ProductSnapshot: product,
//             createdAt: orderData.created_at,
//             shopifyOrderNo,
//           },
//         }
//       );
//     } else {
//       const lastOrder = await orderModel
//         .findOne({ serialNumber: { $ne: null } })
//         .sort({ serialNumber: -1 });

//       const lastSerial =
//         typeof lastOrder?.serialNumber === 'number' &&
//         !isNaN(lastOrder.serialNumber)
//           ? lastOrder.serialNumber
//           : 100;

//       serialNumber = lastSerial + 1;

//       await orderModel.create({
//         orderId,
//         customer: orderData.customer,
//         lineItems: orderData.line_items,
//         ProductSnapshot: product,
//         createdAt: orderData.created_at,
//         serialNumber,
//         shopifyOrderNo,
//       });
//     }

//     const user = await authModel.findOne({ email: orderData.customer.email });
//     if (user) {
//       if (user.subscription) {
//         user.subscription.quantity =
//           (user.subscription.quantity || 0) + quantity;
//       } else {
//         user.subscription = { quantity };
//       }
//       await user.save();
//     }

//     res.status(200).json({
//       message: 'Order saved (or updated) with product snapshot',
//       orderId,
//       shopifyOrderNo,
//       serialNumber,
//     });
//   } catch (error) {
//     console.error('❌ Error saving order:', error);
//     res.status(500).send('Error saving order');
//   }
// };

export const createOrder = async (req, res) => {
  try {
    console.log('📥 Incoming Order Webhook');

    const orderData = req.body;
    const orderId = String(orderData.id);
    const shopifyOrderNo = orderData.order_number;
    const lineItems = orderData.line_items || [];

    console.log('🛒 Line Items:', lineItems.length);

    if (!lineItems.length) {
      return res.status(400).send('No line items found');
    }

    /* ===============================
       CREATE PRODUCT + VARIANT SNAPSHOTS
    =============================== */

    const productSnapshots = [];

    for (const item of lineItems) {
      console.log(
        `➡️ Product: ${item.product_id} | Variant: ${item.variant_id}`
      );

      if (!item.product_id || !item.variant_id) continue;

      const product = await listingModel
        .findOne({ id: String(item.product_id) })
        .lean();

      if (!product) {
        console.log('❌ Product not found:', item.product_id);
        continue;
      }

      const variant = product.variants?.find(
        (v) => String(v.id) === String(item.variant_id)
      );

      if (!variant) {
        console.log('⚠️ Variant not found:', item.variant_id);
        continue;
      }

      productSnapshots.push({
        productId: String(item.product_id),
        variantId: String(item.variant_id),
        quantity: item.quantity || 0,
        merchantId: product.userId || null,
        product, // FULL PRODUCT SNAPSHOT
        variant, // EXACT VARIANT SNAPSHOT
        payoutReferenceId: generatePayoutReference(),
      });

      console.log(
        `✅ Snapshot Saved | Product: ${product.title} | Variant: ${variant.title}`
      );
    }

    console.log('📦 Total Snapshots:', productSnapshots.length);

    /* ===============================
       SERIAL NUMBER
    =============================== */

    const lastOrder = await orderModel
      .findOne({ serialNumber: { $ne: null } })
      .sort({ serialNumber: -1 })
      .lean();

    const serialNumber =
      typeof lastOrder?.serialNumber === 'number'
        ? lastOrder.serialNumber + 1
        : 101;

    /* ===============================
       SAVE ORDER
    =============================== */

    await orderModel.findOneAndUpdate(
      { orderId },
      {
        orderId,
        customer: orderData.customer,
        lineItems,
        ProductSnapshot: productSnapshots,
        createdAt: orderData.created_at,
        shopifyOrderNo,
        serialNumber,
      },
      { upsert: true, new: true }
    );

    console.log('🎉 Order Saved:', orderId);

    res.status(200).json({
      message: 'Order saved with full product & variant snapshots',
      orderId,
      shopifyOrderNo,
      serialNumber,
      totalProducts: productSnapshots.length,
    });
  } catch (error) {
    console.error('❌ Error saving order:', error);
    res.status(500).send('Error saving order');
  }
};

// export const getFinanceSummary = async (req, res) => {
//   try {
//     const allOrders = await orderModel.find();

//     const totalOrdersInDb = allOrders.length;

//     const getOrderIncome = (order) => {
//       return order.lineItems.reduce((total, item) => {
//         const price = parseFloat(item.price || '0');
//         const qty = parseFloat(item.quantity || '1');
//         total += price * qty;
//         return total;
//       }, 0);
//     };

//     let totalIncome = 0;
//     let paidIncome = 0;
//     let unpaidIncome = 0;
//     let fulfilledOrdersCount = 0;
//     let unfulfilledOrdersCount = 0;

//     allOrders.forEach((order) => {
//       const income = getOrderIncome(order);
//       totalIncome += income;

//       const allFulfilled = order.lineItems.every(
//         (item) => item.fulfillment_status === 'fulfilled'
//       );

//       if (allFulfilled) {
//         fulfilledOrdersCount += 1;
//         paidIncome += income;
//       } else {
//         unfulfilledOrdersCount += 1;
//         unpaidIncome += income;
//       }
//     });

//     const netProfit = totalIncome;

//     const mrr = allOrders
//       .filter((order) => {
//         const item = order.lineItems[0];
//         return (
//           item.name?.toLowerCase()?.includes('subscription') ||
//           item.title?.toLowerCase()?.includes('subscription') ||
//           item.vendor?.toLowerCase()?.includes('recurring')
//         );
//       })
//       .reduce((sum, order) => sum + getOrderIncome(order), 0);

//     res.status(200).json({
//       totalIncome: totalIncome.toFixed(2),
//       netProfit: netProfit.toFixed(2),
//       mrr: mrr.toFixed(2),
//       totalOrdersInDb,
//       paidIncome: paidIncome.toFixed(2),
//       unpaidIncome: unpaidIncome.toFixed(2),
//       fulfilledOrders: fulfilledOrdersCount,
//       unfulfilledOrders: unfulfilledOrdersCount,
//     });
//   } catch (error) {
//     console.error('Finance summary error:', error);
//     res.status(500).json({ message: 'Error calculating finance summary' });
//   }
// };

// export const getFinanceSummaryForUser = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (!userId) {
//       return res.status(400).json({ message: 'UserId required' });
//     }

//     const allOrders = await orderModel.find();

//     let totalIncome = 0;
//     let netProfit = 0;

//     let totalOrders = 0;
//     let fulfilledOrdersCount = 0;
//     let unfulfilledOrdersCount = 0;
//     let paidIncome = 0;
//     let unpaidIncome = 0;

//     for (const order of allOrders) {
//       const snapshots = order.ProductSnapshot || [];

//       let userSnapshots = [];
//       let orderIncome = 0;
//       let orderCost = 0;

//       for (const snap of snapshots) {
//         if (snap.merchantId?.toString() !== userId) continue;

//         userSnapshots.push(snap);

//         const price =
//           parseFloat(snap.variant?.price || 0) ||
//           parseFloat(snap.product?.variants?.[0]?.price || 0);

//         const qty = parseFloat(snap.quantity || 1);
//         const cost = parseFloat(snap.variant?.cost || 0);

//         orderIncome += price * qty;
//         orderCost += cost * qty;
//       }

//       if (userSnapshots.length > 0) {
//         totalOrders += 1;
//         totalIncome += orderIncome;
//         netProfit += orderIncome - orderCost;

//         // 🔎 fulfillment check (lineItems se match karenge)
//         const userLineItems = order.lineItems.filter((item) =>
//           userSnapshots.some(
//             (snap) => snap.variantId?.toString() === item.variant_id?.toString()
//           )
//         );

//         const allFulfilled = userLineItems.every(
//           (item) => item.fulfillment_status === 'fulfilled'
//         );

//         if (allFulfilled) {
//           fulfilledOrdersCount += 1;
//           paidIncome += orderIncome;
//         } else {
//           unfulfilledOrdersCount += 1;
//           unpaidIncome += orderIncome;
//         }
//       }
//     }

//     // 🔥 MRR calculation using snapshot
//     let mrr = 0;

//     for (const order of allOrders) {
//       const snapshots = order.ProductSnapshot || [];

//       for (const snap of snapshots) {
//         if (snap.merchantId?.toString() !== userId) continue;

//         const productName = snap.product?.title?.toLowerCase() || '';

//         if (
//           productName.includes('subscription') ||
//           productName.includes('recurring')
//         ) {
//           const price =
//             parseFloat(snap.variant?.price || 0) ||
//             parseFloat(snap.product?.variants?.[0]?.price || 0);

//           const qty = parseFloat(snap.quantity || 1);

//           mrr += price * qty;
//         }
//       }
//     }

//     return res.status(200).json({
//       totalIncome: totalIncome.toFixed(2),
//       netProfit: netProfit.toFixed(2),
//       mrr: mrr.toFixed(2),
//       totalOrdersInDb: totalOrders,
//       paidIncome: paidIncome.toFixed(2),
//       unpaidIncome: unpaidIncome.toFixed(2),
//       fulfilledOrders: fulfilledOrdersCount,
//       unfulfilledOrders: unfulfilledOrdersCount,
//     });
//   } catch (error) {
//     console.error('Finance summary error for user:', error);
//     res
//       .status(500)
//       .json({ message: 'Error calculating finance summary for user' });
//   }
// };

export const getFinanceSummary = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);

    const allOrders = await orderModel.find({
      createdAt: { $gte: startOfLastMonth },
    });

    const viewData = await viewModel.find();

    const totalViews = viewData.reduce(
      (sum, item) => sum + (item.totalViews || 0),
      0
    );

    const lastMonthViews = viewData.reduce(
      (sum, item) => sum + (item.monthlyViews || 0),
      0
    );
    // ===== CURRENT =====
    let totalIncome = 0;
    let netProfit = 0;
    let totalOrders = 0;
    let fulfilledOrdersCount = 0;
    let unfulfilledOrdersCount = 0;
    let paidIncome = 0;
    let unpaidIncome = 0;

    // ===== LAST MONTH =====
    let lastMonthIncome = 0;
    let lastMonthProfit = 0;
    let lastMonthOrders = 0;

    const getOrderIncome = (order) => {
      return order.lineItems.reduce((total, item) => {
        const price = parseFloat(item.price || '0');
        const qty = parseFloat(item.quantity || '1');
        return total + price * qty;
      }, 0);
    };

    for (const order of allOrders) {
      const orderDate = new Date(order.createdAt);

      const isCurrent = orderDate >= startOfCurrentMonth;
      const isLast =
        orderDate >= startOfLastMonth && orderDate < startOfCurrentMonth;

      const income = getOrderIncome(order);

      const cost = order.lineItems.reduce((total, item) => {
        const itemCost = parseFloat(item.cost || '0');
        const qty = parseFloat(item.quantity || '1');
        return total + itemCost * qty;
      }, 0);

      // ===== CURRENT =====
      if (isCurrent) {
        totalOrders++;
        totalIncome += income;
        netProfit += income - cost;

        const allFulfilled = order.lineItems.every(
          (item) => item.fulfillment_status === 'fulfilled'
        );

        if (allFulfilled) {
          fulfilledOrdersCount++;
          paidIncome += income;
        } else {
          unfulfilledOrdersCount++;
          unpaidIncome += income;
        }
      }

      // ===== LAST MONTH =====
      if (isLast) {
        lastMonthOrders++;
        lastMonthIncome += income;
        lastMonthProfit += income - cost;
      }
    }

    // ===== AOV =====
    const averageOrderValue = totalOrders > 0 ? totalIncome / totalOrders : 0;

    const lastMonthAOV =
      lastMonthOrders > 0 ? lastMonthIncome / lastMonthOrders : 0;

    // ===== GROWTH =====
    const calcGrowth = (current, previous) => {
      if (!previous || previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    const revenueGrowth = calcGrowth(totalIncome, lastMonthIncome);
    const profitGrowth = calcGrowth(netProfit, lastMonthProfit);
    const ordersGrowth = calcGrowth(totalOrders, lastMonthOrders);
    const aovGrowth = calcGrowth(averageOrderValue, lastMonthAOV);
    const visitorsGrowth = calcGrowth(totalViews, lastMonthViews);

    // ===== CONVERSION =====
    const conversionRate =
      totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

    const lastMonthConversionRate =
      lastMonthViews > 0 ? (lastMonthOrders / lastMonthViews) * 100 : 0;

    const conversionGrowth = calcGrowth(
      conversionRate,
      lastMonthConversionRate
    );

    return res.status(200).json({
      // ===== CURRENT =====
      totalIncome: totalIncome.toFixed(2),
      netProfit: netProfit.toFixed(2),
      totalOrdersInDb: totalOrders,
      paidIncome: paidIncome.toFixed(2),
      unpaidIncome: unpaidIncome.toFixed(2),
      fulfilledOrders: fulfilledOrdersCount,
      unfulfilledOrders: unfulfilledOrdersCount,
      averageOrderValue: averageOrderValue.toFixed(2),
      totalViews,

      // ===== LAST MONTH =====
      lastMonthIncome: lastMonthIncome.toFixed(2),
      lastMonthProfit: lastMonthProfit.toFixed(2),
      lastMonthOrders,
      lastMonthAOV: lastMonthAOV.toFixed(2),
      lastMonthViews,

      // ===== GROWTH =====
      revenueGrowth: revenueGrowth.toFixed(2),
      profitGrowth: profitGrowth.toFixed(2),
      ordersGrowth: ordersGrowth.toFixed(2),
      aovGrowth: aovGrowth.toFixed(2),
      visitorsGrowth: visitorsGrowth.toFixed(2),
      conversionGrowth: conversionGrowth.toFixed(2),

      // ===== EXTRA =====
      conversionRate: conversionRate.toFixed(2),
    });
  } catch (error) {
    console.error('Finance summary error:', error);
    res.status(500).json({
      message: 'Error calculating finance summary',
    });
  }
};

export const getFinanceSummaryForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'UserId required' });
    }

    // 🔥 Fetch only relevant time range (performance fix)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);

    const allOrders = await orderModel.find({
      createdAt: { $gte: startOfLastMonth },
    });

    // 🔥 GET VIEWS
    const viewData = await viewModel.findOne({ userId });

    const totalViews = viewData?.totalViews || 0;
    const lastMonthViews = viewData?.monthlyViews || 0; // ⚠️ rolling month

    // ===== CURRENT =====
    let totalIncome = 0;
    let netProfit = 0;
    let totalOrders = 0;
    let fulfilledOrdersCount = 0;
    let unfulfilledOrdersCount = 0;
    let paidIncome = 0;
    let unpaidIncome = 0;

    // ===== LAST MONTH =====
    let lastMonthIncome = 0;
    let lastMonthProfit = 0;
    let lastMonthOrders = 0;

    for (const order of allOrders) {
      const orderDate = new Date(order.createdAt);

      const isCurrent = orderDate >= startOfCurrentMonth;
      const isLast =
        orderDate >= startOfLastMonth && orderDate < startOfCurrentMonth;

      const snapshots = order.ProductSnapshot || [];

      let userSnapshots = [];
      let orderIncome = 0;
      let orderCost = 0;

      for (const snap of snapshots) {
        if (snap.merchantId?.toString() !== userId) continue;

        const lineItem = order.lineItems.find(
          (item) => item.variant_id?.toString() === snap.variantId?.toString()
        );

        if (!lineItem) continue;
        if (lineItem.fulfillment_status === 'cancelled') continue;

        userSnapshots.push(snap);

        const price =
          parseFloat(snap.variant?.price || 0) ||
          parseFloat(snap.product?.variants?.[0]?.price || 0);

        const qty = parseFloat(snap.quantity || 1);
        const cost = parseFloat(snap.variant?.cost || 0);

        orderIncome += price * qty;
        orderCost += cost * qty;
      }

      if (userSnapshots.length === 0) continue;

      // ===== CURRENT =====
      if (isCurrent) {
        totalOrders++;
        totalIncome += orderIncome;
        netProfit += orderIncome - orderCost;

        const userLineItems = order.lineItems.filter((item) =>
          userSnapshots.some(
            (snap) => snap.variantId?.toString() === item.variant_id?.toString()
          )
        );

        const allFulfilled = userLineItems.every(
          (item) => item.fulfillment_status === 'fulfilled'
        );

        if (allFulfilled) {
          fulfilledOrdersCount++;
          paidIncome += orderIncome;
        } else {
          unfulfilledOrdersCount++;
          unpaidIncome += orderIncome;
        }
      }

      // ===== LAST MONTH =====
      if (isLast) {
        lastMonthOrders++;
        lastMonthIncome += orderIncome;
        lastMonthProfit += orderIncome - orderCost;
      }
    }

    // ===== AOV =====
    const averageOrderValue = totalOrders > 0 ? totalIncome / totalOrders : 0;

    const lastMonthAOV =
      lastMonthOrders > 0 ? lastMonthIncome / lastMonthOrders : 0;

    // ===== GROWTH =====
    const calcGrowth = (current, previous) => {
      if (!previous || previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    const revenueGrowth = calcGrowth(totalIncome, lastMonthIncome);
    const profitGrowth = calcGrowth(netProfit, lastMonthProfit);
    const ordersGrowth = calcGrowth(totalOrders, lastMonthOrders);
    const aovGrowth = calcGrowth(averageOrderValue, lastMonthAOV);

    const visitorsGrowth = calcGrowth(totalViews, lastMonthViews);

    // ===== CONVERSION =====
    const conversionRate =
      totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

    const lastMonthConversionRate =
      lastMonthViews > 0 ? (lastMonthOrders / lastMonthViews) * 100 : 0;

    const conversionGrowth = calcGrowth(
      conversionRate,
      lastMonthConversionRate
    );

    return res.status(200).json({
      // ===== CURRENT =====
      totalIncome: totalIncome.toFixed(2),
      netProfit: netProfit.toFixed(2),
      totalOrdersInDb: totalOrders,
      paidIncome: paidIncome.toFixed(2),
      unpaidIncome: unpaidIncome.toFixed(2),
      fulfilledOrders: fulfilledOrdersCount,
      unfulfilledOrders: unfulfilledOrdersCount,
      averageOrderValue: averageOrderValue.toFixed(2),

      totalViews,

      // ===== LAST MONTH =====
      lastMonthIncome: lastMonthIncome.toFixed(2),
      lastMonthProfit: lastMonthProfit.toFixed(2),
      lastMonthOrders,
      lastMonthAOV: lastMonthAOV.toFixed(2),
      lastMonthViews,

      // ===== GROWTH =====
      revenueGrowth: revenueGrowth.toFixed(2),
      profitGrowth: profitGrowth.toFixed(2),
      ordersGrowth: ordersGrowth.toFixed(2),
      aovGrowth: aovGrowth.toFixed(2),
      visitorsGrowth: visitorsGrowth.toFixed(2),
      conversionGrowth: conversionGrowth.toFixed(2),

      // ===== EXTRA =====
      conversionRate: conversionRate.toFixed(2),
    });
  } catch (error) {
    console.error('Finance summary error for user:', error);
    res.status(500).json({
      message: 'Error calculating finance summary for user',
    });
  }
};

// export const getOrderById = async (req, res) => {
//   try {
//     console.log('🚀 getOrderById API hit');

//     const userId = req.userId?.toString();
//     console.log('👤 Logged in User ID:', userId);

//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//       console.log('❌ Invalid user ID');
//       return res.status(400).send({ message: 'Invalid user ID' });
//     }

//     const allOrders = await orderModel.find({});
//     console.log('📦 Total Orders Found:', allOrders.length);

//     const ordersGrouped = new Map();

//     for (const order of allOrders) {
//       console.log('\n===============================');
//       console.log('🧾 Processing Order:', order.orderId);

//       const filteredLineItems = [];
//       const snapshots = order.ProductSnapshot || [];

//       console.log('📸 Snapshot Count:', snapshots.length);
//       console.log('🧺 LineItems Count:', order.lineItems?.length || 0);

//       for (const item of order.lineItems || []) {
//         const variantId = item.variant_id?.toString();
//         const productId = item.product_id?.toString();

//         console.log('\n➡️ Checking Line Item Variant:', variantId);

//         if (!variantId && !productId) {
//           console.log('⛔ Skipped: No variantId/productId');
//           continue;
//         }

//         // 🔎 Find matching snapshot
//         const snapshotItem = snapshots.find(
//           (snap) =>
//             snap.variantId?.toString() === variantId ||
//             snap.productId?.toString() === productId
//         );

//         if (!snapshotItem) {
//           console.log('❌ No matching snapshot found');
//           continue;
//         }

//         console.log('✅ Snapshot found');
//         console.log(
//           '📌 Snapshot MerchantId:',
//           snapshotItem.merchantId?.toString()
//         );

//         // 🚫 Skip if not this merchant
//         if (snapshotItem.merchantId?.toString() !== userId) {
//           console.log('🚫 Not this merchant item');
//           continue;
//         }

//         console.log('🎯 Merchant match confirmed');

//         const productData = snapshotItem.product || {};
//         let imageData = null;

//         // ✅ Variant Image
//         if (
//           snapshotItem.variant?.image_id &&
//           Array.isArray(productData.variantImages)
//         ) {
//           const img = productData.variantImages.find(
//             (i) =>
//               i?.id &&
//               snapshotItem.variant.image_id &&
//               i.id.toString() === snapshotItem.variant.image_id.toString()
//           );

//           if (img) {
//             console.log('🖼 Variant image found');
//             imageData = {
//               id: img.id,
//               src: img.src,
//               alt: img.alt || '',
//               position: img.position,
//               width: img.width,
//               height: img.height,
//             };
//           }
//         }

//         // ✅ Product Image fallback
//         if (!imageData && Array.isArray(productData.images)) {
//           if (productData.images.length > 0) {
//             const img = productData.images[0];
//             console.log('🔁 Using product image fallback');
//             imageData = {
//               id: img.id || null,
//               src: img.src || null,
//               alt: img.alt || '',
//               position: img.position || 1,
//               width: img.width || null,
//               height: img.height || null,
//             };
//           }
//         }

//         // ✅ Shopify lineItem fallback
//         if (!imageData && item.image) {
//           console.log('🔁 Using Shopify lineItem image');
//           imageData = item.image;
//         }

//         if (!imageData) {
//           console.log('⚠️ No image found, but keeping item');
//         }

//         console.log('✅ Line item added');

//         filteredLineItems.push({
//           ...item,
//           image: imageData || null,
//           payoutStatus: snapshotItem.variant?.payoutStatus || null,
//           payoutReferenceId: snapshotItem.variant?.payoutReferenceId || null,
//         });
//       }

//       if (!filteredLineItems.length) {
//         console.log('🚫 No valid items for this order');
//         continue;
//       }

//       const orderData = order.toObject();
//       orderData.lineItems = filteredLineItems;

//       if (ordersGrouped.has(order.orderId)) {
//         const existing = ordersGrouped.get(order.orderId);
//         existing.lineItems.push(...filteredLineItems);

//         // 🔁 Dedupe by variant_id
//         existing.lineItems = Array.from(
//           new Map(
//             existing.lineItems.map((li) => [li.variant_id?.toString(), li])
//           ).values()
//         );
//       } else {
//         ordersGrouped.set(order.orderId, orderData);
//       }
//     }

//     const finalOrders = Array.from(ordersGrouped.values());

//     console.log('\n===============================');
//     console.log('📊 Final Orders Count:', finalOrders.length);

//     if (!finalOrders.length) {
//       console.log('❌ No orders found for this merchant');
//       return res.status(404).send({ message: 'No orders found' });
//     }

//     console.log('✅ Sending response');

//     return res.status(200).send({
//       message: 'Orders found',
//       data: finalOrders,
//     });
//   } catch (error) {
//     console.error('❌ getOrderById error:', error);
//     return res.status(500).send({ message: 'Internal Server Error' });
//   }
// };

export const getOrderById = async (req, res) => {
  try {
    console.log('🚀 getOrderById API hit');

    const userId = req.userId?.toString();
    console.log('👤 Logged in User ID:', userId);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      console.log('❌ Invalid user ID');
      return res.status(400).send({ message: 'Invalid user ID' });
    }

    const allOrders = await orderModel.find({});
    console.log('📦 Total Orders Found:', allOrders.length);

    const ordersGrouped = new Map();

    /* =====================================================
       HELPERS: REFUND TRACKING
    ===================================================== */
    const getLineItemId = (item) => {
      return item?.id || item?.lineItemId || item?.line_item_id || null;
    };

    const getRefundedQtyByLineItemId = (order, lineItemId) => {
      return (order.refunds || []).reduce((total, refund) => {
        const matchedRefundItems = (refund.refundItems || []).filter(
          (item) => String(item.lineItemId) === String(lineItemId)
        );

        const refundedQtyForLine = matchedRefundItems.reduce((sum, item) => {
          return sum + Number(item.quantity || 0);
        }, 0);

        return total + refundedQtyForLine;
      }, 0);
    };

    const getRefundedAmountByLineItemId = (order, lineItemId) => {
      return (order.refunds || []).reduce((total, refund) => {
        const matchedRefundItems = (refund.refundItems || []).filter(
          (item) => String(item.lineItemId) === String(lineItemId)
        );

        const refundedAmountForLine = matchedRefundItems.reduce((sum, item) => {
          return sum + Number(item.amount || 0);
        }, 0);

        return total + refundedAmountForLine;
      }, 0);
    };

    for (const order of allOrders) {
      console.log('\n===============================');
      console.log('🧾 Processing Order:', order.orderId);

      const filteredLineItems = [];
      const snapshots = order.ProductSnapshot || [];

      console.log('📸 Snapshot Count:', snapshots.length);
      console.log('🧺 LineItems Count:', order.lineItems?.length || 0);

      for (const item of order.lineItems || []) {
        const variantId = item.variant_id?.toString();
        const productId = item.product_id?.toString();

        console.log('\n➡️ Checking Line Item Variant:', variantId);

        if (!variantId && !productId) {
          console.log('⛔ Skipped: No variantId/productId');
          continue;
        }

        const snapshotItem = snapshots.find(
          (snap) =>
            snap.variantId?.toString() === variantId ||
            snap.productId?.toString() === productId
        );

        if (!snapshotItem) {
          console.log('❌ No matching snapshot found');
          continue;
        }

        console.log('✅ Snapshot found');
        console.log(
          '📌 Snapshot MerchantId:',
          snapshotItem.merchantId?.toString()
        );

        if (snapshotItem.merchantId?.toString() !== userId) {
          console.log('🚫 Not this merchant item');
          continue;
        }

        console.log('🎯 Merchant match confirmed');

        const productData = snapshotItem.product || {};
        let imageData = null;

        /* =====================================================
           IMAGE LOGIC
        ===================================================== */
        if (
          snapshotItem.variant?.image_id &&
          Array.isArray(productData.variantImages)
        ) {
          const img = productData.variantImages.find(
            (i) =>
              i?.id &&
              snapshotItem.variant.image_id &&
              i.id.toString() === snapshotItem.variant.image_id.toString()
          );

          if (img) {
            console.log('🖼 Variant image found');

            imageData = {
              id: img.id,
              src: img.src,
              alt: img.alt || '',
              position: img.position,
              width: img.width,
              height: img.height,
            };
          }
        }

        if (!imageData && Array.isArray(productData.images)) {
          if (productData.images.length > 0) {
            const img = productData.images[0];

            console.log('🔁 Using product image fallback');

            imageData = {
              id: img.id || null,
              src: img.src || null,
              alt: img.alt || '',
              position: img.position || 1,
              width: img.width || null,
              height: img.height || null,
            };
          }
        }

        if (!imageData && item.image) {
          console.log('🔁 Using Shopify lineItem image');
          imageData = item.image;
        }

        if (!imageData) {
          console.log('⚠️ No image found, but keeping item');
        }

        /* =====================================================
           REFUND + FULFILLMENT CALCULATION
        ===================================================== */
        const lineItemId = getLineItemId(item);

        const originalQty = Number(item.quantity || 0);
        const fulfilledQty = Number(item.fulfilled_quantity || 0);
        const refundedQty = getRefundedQtyByLineItemId(order, lineItemId);

        const handledQty = fulfilledQty + refundedQty;

        const remainingQty = Math.max(originalQty - refundedQty, 0);

        const refundableQty = Math.max(
          originalQty - fulfilledQty - refundedQty,
          0
        );

        const refundedAmount = getRefundedAmountByLineItemId(
          order,
          lineItemId
        );

        const itemPrice = Number(item.price || 0);
        const originalAmount = itemPrice * originalQty;
        const fulfilledAmount = itemPrice * fulfilledQty;
        const remainingAmount = itemPrice * remainingQty;
        const refundableAmount = itemPrice * refundableQty;

        const isFullyRefunded = refundedQty >= originalQty && originalQty > 0;
        const isPartiallyRefunded = refundedQty > 0 && refundedQty < originalQty;

        let calculatedFulfillmentStatus = item.fulfillment_status || null;

        if (originalQty > 0 && handledQty >= originalQty) {
          calculatedFulfillmentStatus = 'fulfilled';
        } else if (handledQty > 0 && handledQty < originalQty) {
          calculatedFulfillmentStatus = 'partial';
        } else {
          calculatedFulfillmentStatus = item.fulfillment_status || null;
        }

        console.log('✅ Line item added with refund tracking');

        filteredLineItems.push({
          ...item,

          image: imageData || null,

          payoutStatus: snapshotItem.variant?.payoutStatus || null,
          payoutReferenceId: snapshotItem.variant?.payoutReferenceId || null,

          // keep Shopify/raw item id
          lineItemId,

          // IMPORTANT:
          // quantity yahan remaining after refund hai, same as admin API
          quantity: remainingQty,

          original_quantity: originalQty,
          fulfilled_quantity: fulfilledQty,
          refunded_quantity: refundedQty,

          remaining_quantity: remainingQty,

          // refund page ke liye direct useful field
          refundable_quantity: refundableQty,

          original_amount: Number(originalAmount.toFixed(2)),
          fulfilled_amount: Number(fulfilledAmount.toFixed(2)),
          refunded_amount: Number(refundedAmount.toFixed(2)),
          remaining_amount: Number(remainingAmount.toFixed(2)),
          refundable_amount: Number(refundableAmount.toFixed(2)),

          refund_status: isFullyRefunded
            ? 'fully_refunded'
            : isPartiallyRefunded
              ? 'partially_refunded'
              : 'not_refunded',

          // frontend status ke liye
          calculated_fulfillment_status: calculatedFulfillmentStatus,
        });
      }

      if (!filteredLineItems.length) {
        console.log('🚫 No valid items for this order');
        continue;
      }

      const orderData = order.toObject();

      orderData.lineItems = filteredLineItems;

      // refunds frontend ko bhi chahiye
      orderData.refunds = order.refunds || [];

      // optional summary fields
      orderData.totalRefundedQty = filteredLineItems.reduce((sum, item) => {
        return sum + Number(item.refunded_quantity || 0);
      }, 0);

      orderData.totalFulfilledQty = filteredLineItems.reduce((sum, item) => {
        return sum + Number(item.fulfilled_quantity || 0);
      }, 0);

      orderData.totalRemainingQty = filteredLineItems.reduce((sum, item) => {
        return sum + Number(item.remaining_quantity || 0);
      }, 0);

      orderData.totalRefundableQty = filteredLineItems.reduce((sum, item) => {
        return sum + Number(item.refundable_quantity || 0);
      }, 0);

      orderData.totalRefundedValue = filteredLineItems.reduce((sum, item) => {
        return sum + Number(item.refunded_amount || 0);
      }, 0);

      orderData.totalRemainingValue = filteredLineItems.reduce((sum, item) => {
        return sum + Number(item.remaining_amount || 0);
      }, 0);

      if (ordersGrouped.has(order.orderId)) {
        const existing = ordersGrouped.get(order.orderId);

        existing.lineItems.push(...filteredLineItems);

        existing.lineItems = Array.from(
          new Map(
            existing.lineItems.map((li) => [
              li.variant_id?.toString() || li.id?.toString(),
              li,
            ])
          ).values()
        );

        existing.refunds = order.refunds || [];

        existing.totalRefundedQty = existing.lineItems.reduce((sum, item) => {
          return sum + Number(item.refunded_quantity || 0);
        }, 0);

        existing.totalFulfilledQty = existing.lineItems.reduce((sum, item) => {
          return sum + Number(item.fulfilled_quantity || 0);
        }, 0);

        existing.totalRemainingQty = existing.lineItems.reduce((sum, item) => {
          return sum + Number(item.remaining_quantity || 0);
        }, 0);

        existing.totalRefundableQty = existing.lineItems.reduce((sum, item) => {
          return sum + Number(item.refundable_quantity || 0);
        }, 0);

        existing.totalRefundedValue = existing.lineItems.reduce((sum, item) => {
          return sum + Number(item.refunded_amount || 0);
        }, 0);

        existing.totalRemainingValue = existing.lineItems.reduce((sum, item) => {
          return sum + Number(item.remaining_amount || 0);
        }, 0);
      } else {
        ordersGrouped.set(order.orderId, orderData);
      }
    }

    const finalOrders = Array.from(ordersGrouped.values()).sort((a, b) => {
      return Number(b.shopifyOrderNo || 0) - Number(a.shopifyOrderNo || 0);
    });

    console.log('\n===============================');
    console.log('📊 Final Orders Count:', finalOrders.length);

    if (!finalOrders.length) {
      console.log('❌ No orders found for this merchant');

      return res.status(404).send({
        message: 'No orders found',
      });
    }

    console.log('✅ Sending response');

    return res.status(200).send({
      message: 'Orders found with refund and fulfillment tracking',
      data: finalOrders,
    });
  } catch (error) {
    console.error('❌ getOrderById error:', error);

    return res.status(500).send({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};


export const deleteUser = async (req, res) => {
  orderModel.deleteMany().then((result) => {
    if (result) {
      res.status(200).send('delted');
    }
  });
};

export const getOrderByOrderId = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await orderModel.findOne({ orderId: id });
    if (!result) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(200).json({ data: result });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Server error' });
  }
};


// export const fulfillOrder = async (req, res) => {
//   try {
//     const { orderId, itemsToFulfill, trackingInfo } = req.body;

//     if (!orderId || !Array.isArray(itemsToFulfill)) {
//       return res
//         .status(400)
//         .json({ error: 'Order ID and fulfillment items are required.' });
//     }

//     const shopifyConfig = await shopifyConfigurationModel.findOne();

//     if (!shopifyConfig) {
//       return res
//         .status(404)
//         .json({ error: 'Shopify configuration not found.' });
//     }

//     const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

//     const order = await orderModel.findOne({ orderId });

//     if (!order) {
//       return res.status(404).json({ error: 'Order not found in MongoDB.' });
//     }

//     const fulfillmentOrdersUrl = `${shopifyStoreUrl}/admin/api/2024-01/orders/${orderId}/fulfillment_orders.json`;

//     const fulfillmentOrdersRes = await shopifyRequest(
//       fulfillmentOrdersUrl,
//       'GET',
//       null,
//       null,
//       shopifyAccessToken
//     );

//     const fulfillmentOrder = fulfillmentOrdersRes?.fulfillment_orders?.[0];

//     if (!fulfillmentOrder?.id) {
//       return res
//         .status(400)
//         .json({ error: 'No fulfillment order found for this order.' });
//     }

//     const fulfillmentLineItems = [];

//     itemsToFulfill.forEach((itemToFulfill) => {
//       const fulfillable = fulfillmentOrder.line_items.find(
//         (f) => Number(f.line_item_id) === Number(itemToFulfill.lineItemId)
//       );

//       if (!fulfillable) return;

//       const remainingQty = Number(fulfillable.fulfillable_quantity || 0);
//       const requestedQty = Number(itemToFulfill.quantity || 0);

//       if (requestedQty > 0 && requestedQty <= remainingQty) {
//         fulfillmentLineItems.push({
//           lineItemId: Number(itemToFulfill.lineItemId),
//           fulfillmentOrderLineItemId: fulfillable.id,
//           quantity: requestedQty,
//         });
//       }
//     });

//     if (fulfillmentLineItems.length === 0) {
//       return res.status(400).json({
//         error: 'No valid line items to fulfill. Check remaining quantities.',
//       });
//     }

//     const graphqlUrl = `${shopifyStoreUrl}/admin/api/2024-01/graphql.json`;

//     const query = `
//       mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
//         fulfillmentCreateV2(fulfillment: $fulfillment) {
//           fulfillment {
//             id
//             status
//             createdAt
//           }
//           userErrors {
//             field
//             message
//           }
//         }
//       }
//     `;

//     const variables = {
//       fulfillment: {
//         lineItemsByFulfillmentOrder: [
//           {
//             fulfillmentOrderId: `gid://shopify/FulfillmentOrder/${fulfillmentOrder.id}`,
//             fulfillmentOrderLineItems: fulfillmentLineItems.map((item) => ({
//               id: `gid://shopify/FulfillmentOrderLineItem/${item.fulfillmentOrderLineItemId}`,
//               quantity: item.quantity,
//             })),
//           },
//         ],
//         notifyCustomer: true,
//         trackingInfo: {
//           number: trackingInfo?.number || null,
//           url: trackingInfo?.url || null,
//           company: trackingInfo?.company || null,
//         },
//       },
//     };

//     const response = await fetch(graphqlUrl, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'X-Shopify-Access-Token': shopifyAccessToken,
//       },
//       body: JSON.stringify({ query, variables }),
//     });

//     const result = await response.json();

//     console.log('🛬 Shopify Response:', result);

//     if (
//       result.errors ||
//       result.data?.fulfillmentCreateV2?.userErrors?.length > 0
//     ) {
//       return res.status(400).json({
//         error: 'GraphQL fulfillment error.',
//         details: result.errors || result.data.fulfillmentCreateV2.userErrors,
//       });
//     }

//     const newFulfillment = result.data.fulfillmentCreateV2.fulfillment;

//     const fulfilledAt = newFulfillment?.createdAt
//       ? new Date(newFulfillment.createdAt)
//       : new Date();

//     /*
//       IMPORTANT:
//       lineItems: Array hai, isliye hum direct fields add kar sakte hain:
//       - fulfilledAt
//       - fulfillmentHistory
//       - fulfillment_status
//       - fulfilled_quantity
//     */

//     order.lineItems = order.lineItems.map((item) => {
//       const fulfilled = fulfillmentLineItems.find(
//         (fulfilledItem) => Number(fulfilledItem.lineItemId) === Number(item.id)
//       );

//       if (!fulfilled || fulfilled.quantity <= 0) {
//         return item;
//       }

//       const alreadyFulfilled = Number(item.fulfilled_quantity || 0);
//       const totalFulfilled = alreadyFulfilled + Number(fulfilled.quantity || 0);
//       const totalQty = Number(item.quantity || 0);

//       const fulfillmentHistory = Array.isArray(item.fulfillmentHistory)
//         ? item.fulfillmentHistory
//         : [];

//       const updatedItem = {
//         ...item,

//         fulfilled_quantity: totalFulfilled,

//         // latest fulfilled time
//         fulfilledAt,

//         // keep complete fulfillment history
//         fulfillmentHistory: [
//           ...fulfillmentHistory,
//           {
//             fulfillmentId: newFulfillment?.id || null,
//             quantity: Number(fulfilled.quantity || 0),
//             fulfilledAt,
//             status: newFulfillment?.status || 'SUCCESS',
//             trackingInfo: {
//               number: trackingInfo?.number || null,
//               url: trackingInfo?.url || null,
//               company: trackingInfo?.company || null,
//             },
//           },
//         ],
//       };

//       if (totalFulfilled >= totalQty) {
//         updatedItem.fulfillment_status = 'fulfilled';
//       } else if (totalFulfilled > 0) {
//         updatedItem.fulfillment_status = 'partial';
//       }

//       console.log(
//         `📌 Updating DB: item ${item.id}, fulfilled ${fulfilled.quantity}, total fulfilled ${totalFulfilled}, status: ${updatedItem.fulfillment_status || 'unfulfilled'}`
//       );

//       return updatedItem;
//     });

//     /*
//       Optional order-level fulfillment history.
//       Useful for Shopify response reference.
//     */
//     order.shopifyFulfillments = Array.isArray(order.shopifyFulfillments)
//       ? order.shopifyFulfillments
//       : [];

//     const alreadyExists = order.shopifyFulfillments.some(
//       (f) => f.id === newFulfillment.id
//     );

//     if (!alreadyExists) {
//       order.shopifyFulfillments.push({
//         ...newFulfillment,
//         fulfilledAt,
//         trackingInfo: {
//           number: trackingInfo?.number || null,
//           url: trackingInfo?.url || null,
//           company: trackingInfo?.company || null,
//         },
//         itemsToFulfill: fulfillmentLineItems.map((item) => ({
//           lineItemId: item.lineItemId,
//           quantity: item.quantity,
//         })),
//       });
//     }

//     await order.save();

//     return res.status(200).json({
//       message: 'Order fulfilled successfully and MongoDB updated.',
//       data: newFulfillment,
//     });
//   } catch (error) {
//     console.error('Fulfill Order Error:', error);

//     return res.status(500).json({
//       error: 'Server error while fulfilling order.',
//       details: error.message,
//     });
//   }
// };

// export const getOrderDatafromShopify = async (req, res) => {
//   const { id: orderId, userId: merchantId } = req.params;

//   if (!merchantId) {
//     return res.status(400).json({ error: 'User ID is required.' });
//   }

//   try {
//     /* ===============================
//        FETCH SHOPIFY CONFIG
//     =============================== */
//     const shopifyConfig = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfig) {
//       return res
//         .status(404)
//         .json({ error: 'Shopify configuration not found.' });
//     }

//     const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

//     /* ===============================
//        FETCH SHOPIFY ORDER
//     =============================== */
//     const response = await axios.get(
//       `${shopifyStoreUrl}/admin/api/2024-01/orders/${orderId}.json`,
//       {
//         headers: {
//           'X-Shopify-Access-Token': shopifyAccessToken,
//           'Content-Type': 'application/json',
//         },
//       }
//     );

//     const shopifyOrder = response.data?.order;
//     if (!shopifyOrder) {
//       return res.status(404).json({ message: 'Order not found on Shopify' });
//     }

//     /* ===============================
//        FETCH DB ORDER
//     =============================== */
//     const dbOrder = await orderModel.findOne({ orderId }).lean();
//     if (!dbOrder) {
//       return res.status(404).json({ message: 'Order not found in database' });
//     }

//     /* ===============================
//        FILTER MERCHANT PRODUCTS
//     =============================== */
//     const merchantProducts = (dbOrder.ProductSnapshot || []).filter(
//       (item) => String(item.merchantId) === String(merchantId)
//     );

//     if (!merchantProducts.length) {
//       return res.status(404).json({
//         message: 'No products found for this merchant in this order',
//       });
//     }

//     /* ===============================
//        MAP LINE ITEMS (CRITICAL LOGIC)
//     =============================== */
//     const dbLineItems = dbOrder.lineItems || [];

//     const enrichedProducts = merchantProducts.map((item) => {
//       const matchedLineItem = dbLineItems.find(
//         (li) => String(li.variant_id) === String(item.variantId)
//       );

//       const totalQty = matchedLineItem?.quantity ?? item.quantity;
//       const fulfilledQty = matchedLineItem?.fulfilled_quantity ?? 0;

//       // ✅ REAL remaining qty (Shopify-safe)
//       const remainingQty = Math.max(totalQty - fulfilledQty, 0);

//       return {
//         productId: item.productId,
//         variantId: item.variantId,

//         // ✅ THIS IS WHAT SHOPIFY NEEDS
//         lineItemId: matchedLineItem?.id || null,

//         quantity: totalQty,
//         fulfilled_quantity: fulfilledQty,
//         fulfillable_quantity: remainingQty,

//         fulfillment_status: matchedLineItem?.fulfillment_status ?? null,

//         product: item.product,
//         variant: item.variant,
//       };
//     });

//     /* ===============================
//        FINAL RESPONSE (NO STRUCTURE CHANGE)
//     =============================== */
//     const responseOrder = {
//       orderId: shopifyOrder.id,
//       shopifyOrderNo: shopifyOrder.order_number,
//       financial_status: shopifyOrder.financial_status,
//       fulfillment_status: shopifyOrder.fulfillment_status,
//       currency: shopifyOrder.currency,
//       total_price: shopifyOrder.total_price,
//       created_at: shopifyOrder.created_at,

//       customer: shopifyOrder.customer,
//       customers: dbOrder.customer,
//       shipping_address: shopifyOrder.shipping_address,
//       billing_address: shopifyOrder.billing_address,

//       products: enrichedProducts,
//       fulfillments: shopifyOrder.fulfillments || [],

//       serialNumber: dbOrder.serialNumber,
//       payoutStatus: dbOrder.payoutStatus,
//       dbCreatedAt: dbOrder.createdAt,
//     };

//     return res.status(200).json({
//       message: 'Order fetched with correct lineItemId & quantities',
//       data: responseOrder,
//     });
//   } catch (error) {
//     console.error('❌ Error:', error.response?.data || error.message);

//     return res.status(500).json({
//       message: 'Failed to fetch order data',
//       error: error.response?.data || error.message,
//     });
//   }
// };


export const fulfillOrder = async (req, res) => {
  try {
    const { orderId, itemsToFulfill, trackingInfo } = req.body;

    if (!orderId || !Array.isArray(itemsToFulfill)) {
      return res.status(400).json({
        error: 'Order ID and fulfillment items are required.',
      });
    }

    const shopifyConfig = await shopifyConfigurationModel.findOne();

    if (!shopifyConfig) {
      return res.status(404).json({
        error: 'Shopify configuration not found.',
      });
    }

    const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

    const order = await orderModel.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        error: 'Order not found in MongoDB.',
      });
    }

    const fulfillmentOrdersUrl = `${shopifyStoreUrl}/admin/api/2024-01/orders/${orderId}/fulfillment_orders.json`;

    const fulfillmentOrdersRes = await shopifyRequest(
      fulfillmentOrdersUrl,
      'GET',
      null,
      null,
      shopifyAccessToken
    );

    const fulfillmentOrder = fulfillmentOrdersRes?.fulfillment_orders?.[0];

    if (!fulfillmentOrder?.id) {
      return res.status(400).json({
        error: 'No fulfillment order found for this order.',
      });
    }

    const fulfillmentLineItems = [];

    itemsToFulfill.forEach((itemToFulfill) => {
      const fulfillable = fulfillmentOrder.line_items.find(
        (f) => Number(f.line_item_id) === Number(itemToFulfill.lineItemId)
      );

      if (!fulfillable) return;

      const remainingQty = Number(fulfillable.fulfillable_quantity || 0);
      const requestedQty = Number(itemToFulfill.quantity || 0);

      if (requestedQty > 0 && requestedQty <= remainingQty) {
        fulfillmentLineItems.push({
          lineItemId: Number(itemToFulfill.lineItemId),
          fulfillmentOrderLineItemId: fulfillable.id,
          quantity: requestedQty,
        });
      }
    });

    if (fulfillmentLineItems.length === 0) {
      return res.status(400).json({
        error: 'No valid line items to fulfill. Check remaining quantities.',
      });
    }

    const graphqlUrl = `${shopifyStoreUrl}/admin/api/2024-01/graphql.json`;

    const query = `
      mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
        fulfillmentCreateV2(fulfillment: $fulfillment) {
          fulfillment {
            id
            status
            createdAt
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      fulfillment: {
        lineItemsByFulfillmentOrder: [
          {
            fulfillmentOrderId: `gid://shopify/FulfillmentOrder/${fulfillmentOrder.id}`,
            fulfillmentOrderLineItems: fulfillmentLineItems.map((item) => ({
              id: `gid://shopify/FulfillmentOrderLineItem/${item.fulfillmentOrderLineItemId}`,
              quantity: item.quantity,
            })),
          },
        ],
        notifyCustomer: true,
        trackingInfo: {
          number: trackingInfo?.number || null,
          url: trackingInfo?.url || null,
          company: trackingInfo?.company || null,
        },
      },
    };

    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    console.log('🛬 Shopify Response:', result);

    if (
      result.errors ||
      result.data?.fulfillmentCreateV2?.userErrors?.length > 0
    ) {
      return res.status(400).json({
        error: 'GraphQL fulfillment error.',
        details: result.errors || result.data.fulfillmentCreateV2.userErrors,
      });
    }

    const newFulfillment = result.data?.fulfillmentCreateV2?.fulfillment;

    if (!newFulfillment?.id) {
      return res.status(400).json({
        error: 'Fulfillment was not created on Shopify.',
        details: result,
      });
    }

    const fulfilledAt = newFulfillment?.createdAt
      ? new Date(newFulfillment.createdAt)
      : new Date();

    /*
      Prepare shopify fulfillment history before inventory decrement.
      This avoids duplicate decrement if same fulfillment already exists.
    */
    order.shopifyFulfillments = Array.isArray(order.shopifyFulfillments)
      ? order.shopifyFulfillments
      : [];

    const alreadyExists = order.shopifyFulfillments.some(
      (f) => String(f.id) === String(newFulfillment.id)
    );

    /*
      Helper: decrement local listing inventory by fulfilled quantity.
      Matching:
      - listing.id OR listing.shopifyId = Shopify product_id
      - variants.id = Shopify variant_id
    */
    const decrementListingInventory = async () => {
      for (const fulfilled of fulfillmentLineItems) {
        const matchedOrderLineItem = order.lineItems.find(
          (item) => Number(item.id) === Number(fulfilled.lineItemId)
        );

        if (!matchedOrderLineItem) {
          console.log(
            `⚠️ Order line item not found for lineItemId: ${fulfilled.lineItemId}`
          );
          continue;
        }

        const productId = String(matchedOrderLineItem.product_id || '');
        const variantId = String(matchedOrderLineItem.variant_id || '');
        const fulfilledQty = Number(fulfilled.quantity || 0);

        if (!productId || !variantId || fulfilledQty <= 0) {
          console.log('⚠️ Missing productId/variantId/fulfilledQty');
          continue;
        }

        const listing = await listingModel.findOne({
          $or: [{ id: productId }, { shopifyId: productId }],
        });

        if (!listing) {
          console.log(`⚠️ Listing not found for productId: ${productId}`);
          continue;
        }

        let variantFound = false;

        listing.variants = listing.variants.map((variant) => {
          if (String(variant.id) !== String(variantId)) {
            return variant;
          }

          variantFound = true;

          const currentQty = Number(variant.inventory_quantity || 0);
          const newQty = Math.max(currentQty - fulfilledQty, 0);

          return {
            ...variant,
            inventory_quantity: newQty,
          };
        });

        if (!variantFound) {
          console.log(
            `⚠️ Variant not found in listing. productId: ${productId}, variantId: ${variantId}`
          );
          continue;
        }

        const newTotalQty = listing.variants.reduce((sum, variant) => {
          return sum + Number(variant.inventory_quantity || 0);
        }, 0);

        listing.inventory = {
          ...listing.inventory,
          quantity: newTotalQty,
        };

        listing.totalQuantity = String(newTotalQty);
        listing.updated_at = new Date();

        await listing.save();

        console.log(
          `✅ Listing inventory decremented. Product: ${productId}, Variant: ${variantId}, Qty -${fulfilledQty}, New Total: ${newTotalQty}`
        );
      }
    };

    /*
      Update order line items fulfillment info.
      This updates:
      - fulfilled_quantity
      - fulfilledAt
      - fulfillmentHistory
      - fulfillment_status
    */
    order.lineItems = order.lineItems.map((item) => {
      const fulfilled = fulfillmentLineItems.find(
        (fulfilledItem) => Number(fulfilledItem.lineItemId) === Number(item.id)
      );

      if (!fulfilled || Number(fulfilled.quantity || 0) <= 0) {
        return item;
      }

      const alreadyFulfilled = Number(item.fulfilled_quantity || 0);
      const newlyFulfilled = Number(fulfilled.quantity || 0);
      const totalFulfilled = alreadyFulfilled + newlyFulfilled;
      const totalQty = Number(item.quantity || 0);

      const fulfillmentHistory = Array.isArray(item.fulfillmentHistory)
        ? item.fulfillmentHistory
        : [];

      const updatedItem = {
        ...item,

        fulfilled_quantity: totalFulfilled,
        fulfilledAt,

        fulfillmentHistory: [
          ...fulfillmentHistory,
          {
            fulfillmentId: newFulfillment.id,
            quantity: newlyFulfilled,
            fulfilledAt,
            status: newFulfillment?.status || 'SUCCESS',
            trackingInfo: {
              number: trackingInfo?.number || null,
              url: trackingInfo?.url || null,
              company: trackingInfo?.company || null,
            },
          },
        ],
      };

      if (totalFulfilled >= totalQty) {
        updatedItem.fulfillment_status = 'fulfilled';
      } else if (totalFulfilled > 0) {
        updatedItem.fulfillment_status = 'partial';
      } else {
        updatedItem.fulfillment_status = item.fulfillment_status || null;
      }

      console.log(
        `📌 Updating DB: item ${item.id}, fulfilled ${newlyFulfilled}, total fulfilled ${totalFulfilled}, status: ${updatedItem.fulfillment_status || 'unfulfilled'}`
      );

      return updatedItem;
    });

    /*
      IMPORTANT:
      Inventory decrement only once per Shopify fulfillment.
      If fulfillment already exists, do not decrement again.
    */
    if (!alreadyExists) {
      await decrementListingInventory();

      order.shopifyFulfillments.push({
        ...newFulfillment,
        fulfilledAt,
        trackingInfo: {
          number: trackingInfo?.number || null,
          url: trackingInfo?.url || null,
          company: trackingInfo?.company || null,
        },
        itemsToFulfill: fulfillmentLineItems.map((item) => ({
          lineItemId: item.lineItemId,
          quantity: item.quantity,
        })),
      });
    } else {
      console.log(
        `⚠️ Fulfillment already exists in MongoDB. Inventory decrement skipped. Fulfillment ID: ${newFulfillment.id}`
      );
    }

    await order.save();

    return res.status(200).json({
      message: 'Order fulfilled successfully. Order and listing inventory updated.',
      data: {
        fulfillment: newFulfillment,
        fulfilledAt,
        inventoryUpdated: !alreadyExists,
        itemsFulfilled: fulfillmentLineItems.map((item) => ({
          lineItemId: item.lineItemId,
          quantity: item.quantity,
        })),
      },
    });
  } catch (error) {
    console.error('Fulfill Order Error:', error);

    return res.status(500).json({
      error: 'Server error while fulfilling order.',
      details: error.message,
    });
  }
};
export const getOrderDatafromShopify = async (req, res) => {
  const { id: orderId, userId: merchantId } = req.params;

  if (!merchantId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    /* ===============================
       FETCH SHOPIFY CONFIG
    =============================== */
    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

    /* ===============================
       FETCH SHOPIFY ORDER
    =============================== */
    const response = await axios.get(
      `${shopifyStoreUrl}/admin/api/2024-01/orders/${orderId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    const shopifyOrder = response.data?.order;
    if (!shopifyOrder) {
      return res.status(404).json({ message: 'Order not found on Shopify' });
    }

    /* ===============================
       FETCH DB ORDER
    =============================== */
    const dbOrder = await orderModel.findOne({ orderId }).lean();
    if (!dbOrder) {
      return res.status(404).json({ message: 'Order not found in database' });
    }

    /* ===============================
       FILTER MERCHANT PRODUCTS
    =============================== */
    const merchantProducts = (dbOrder.ProductSnapshot || []).filter(
      (item) => String(item.merchantId) === String(merchantId)
    );

    if (!merchantProducts.length) {
      return res.status(404).json({
        message: 'No products found for this merchant in this order',
      });
    }

    /* ===============================
       MAP LINE ITEMS
    =============================== */
    const dbLineItems = dbOrder.lineItems || [];

    const enrichedProducts = merchantProducts.map((item) => {
      const matchedLineItem = dbLineItems.find(
        (li) => String(li.variant_id) === String(item.variantId)
      );

      const totalQty = matchedLineItem?.quantity ?? item.quantity;
      const fulfilledQty = matchedLineItem?.fulfilled_quantity ?? 0;

      const remainingQty = Math.max(totalQty - fulfilledQty, 0);

      return {
        productId: item.productId,
        variantId: item.variantId,

        lineItemId: matchedLineItem?.id || null,

        quantity: totalQty,
        fulfilled_quantity: fulfilledQty,
        fulfillable_quantity: remainingQty,

        fulfillment_status: matchedLineItem?.fulfillment_status ?? null,

        product: item.product,
        variant: item.variant,
      };
    });

    /* ===============================
       FILTER REFUNDS FOR THIS MERCHANT
    =============================== */
    const merchantLineItemIds = enrichedProducts
      .map((item) => String(item.lineItemId))
      .filter(Boolean);

    const refunds = (dbOrder.refunds || [])
      .map((refund) => {
        const merchantRefundItems = (refund.refundItems || []).filter((item) =>
          merchantLineItemIds.includes(String(item.lineItemId))
        );

        const merchantItemsAmount = merchantRefundItems.reduce(
          (total, item) => total + Number(item.amount || 0),
          0
        );

        const merchantRefundAmount =
          merchantItemsAmount +
          (refund.shippingRefunded ? Number(refund.shippingAmount || 0) : 0);

        return {
          ...refund,
          refundItems: merchantRefundItems,
          refundAmount: Number(merchantRefundAmount.toFixed(2)),
        };
      })
      .filter(
        (refund) =>
          refund.refundItems.length > 0 ||
          refund.shippingRefunded === true
      );

    /* ===============================
       FINAL RESPONSE
    =============================== */
    const responseOrder = {
      orderId: shopifyOrder.id,
      shopifyOrderNo: shopifyOrder.order_number,
      financial_status: shopifyOrder.financial_status,
      fulfillment_status: shopifyOrder.fulfillment_status,
      currency: shopifyOrder.currency,
      total_price: shopifyOrder.total_price,
      created_at: shopifyOrder.created_at,

      customer: shopifyOrder.customer,
      customers: dbOrder.customer,
      shipping_address: shopifyOrder.shipping_address,
      billing_address: shopifyOrder.billing_address,

      products: enrichedProducts,
      fulfillments: shopifyOrder.fulfillments || [],

      refunds,

      serialNumber: dbOrder.serialNumber,
      payoutStatus: dbOrder.payoutStatus,
      dbCreatedAt: dbOrder.createdAt,
    };

    return res.status(200).json({
      message: 'Order fetched with correct lineItemId, quantities & refunds',
      data: responseOrder,
    });
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);

    return res.status(500).json({
      message: 'Failed to fetch order data',
      error: error.response?.data || error.message,
    });
  }
};
// export const getAllOrdersForAdmin = async (req, res) => {
//   try {
//     const allOrders = await orderModel.find({});

//     const finalOrders = [];
//     const merchantDetailsMap = new Map();
//     const merchantStatsMap = new Map();

//     for (const order of allOrders) {
//       console.log(
//         '\n Processing Order:',
//         order.shopifyOrderNo,
//         'Order ID:',
//         order.orderId
//       );

//       const merchantGroups = new Map();
//       const snapshots = order.ProductSnapshot || [];

//       for (const item of order.lineItems || []) {
//         const variantId = item.variant_id?.toString();
//         const productId = item.product_id?.toString();

//         let merchantId = null;
//         let imageData = null;

//         // 🔥 Find matching snapshot item
//         const snapshotItem = snapshots.find(
//           (snap) =>
//             snap.variantId?.toString() === variantId ||
//             snap.productId?.toString() === productId
//         );

//         if (snapshotItem) {
//           merchantId = snapshotItem.merchantId?.toString() || null;

//           const productData = snapshotItem.product;

//           // ✅ Variant image first
//           if (
//             snapshotItem.variant?.image_id &&
//             Array.isArray(productData?.variantImages)
//           ) {
//             const image = productData.variantImages.find(
//               (img) => img.id === snapshotItem.variant.image_id
//             );
//             if (image) {
//               imageData = {
//                 id: image.id,
//                 src: image.src,
//                 alt: image.alt,
//                 position: image.position,
//                 width: image.width,
//                 height: image.height,
//               };
//             }
//           }

//           // ✅ Fallback product image
//           if (
//             !imageData &&
//             Array.isArray(productData?.images) &&
//             productData.images.length > 0
//           ) {
//             const defaultImage = productData.images[0];
//             imageData = {
//               id: defaultImage.id || null,
//               src: defaultImage.src,
//               alt: defaultImage.alt || '',
//               position: defaultImage.position || 1,
//               width: defaultImage.width || null,
//               height: defaultImage.height || null,
//             };
//           }
//         }

//         if (!merchantId) {
//           console.log(
//             '⚠️ Skipped item because merchantId could not be determined'
//           );
//           continue;
//         }

//         const enrichedItem = {
//           ...item,
//           image: imageData || item.image || null,
//           orderId: order.orderId,
//           customer: [
//             {
//               first_name: order.customer?.first_name || '',
//               last_name: order.customer?.last_name || '',
//               email: order.customer?.email || '',
//               phone: order.customer?.phone || '',
//               created_at: order.customer?.created_at || '',
//               default_address: order.customer?.default_address || {},
//             },
//           ],
//         };

//         // Group by merchant
//         if (!merchantGroups.has(merchantId)) {
//           merchantGroups.set(merchantId, []);
//         }
//         merchantGroups.get(merchantId).push(enrichedItem);

//         // Fetch merchant details once
//         if (!merchantDetailsMap.has(merchantId)) {
//           const merchant = await authModel
//             .findById(merchantId)
//             .select('-password');

//           if (merchant) {
//             merchantDetailsMap.set(merchantId, {
//               _id: merchant._id,
//               name: `${merchant.firstName} ${merchant.lastName}`,
//               email: merchant.email,
//               role: merchant.role,
//               dispatchAddress: merchant.dispatchAddress,
//               dispatchCountry: merchant.dispatchCountry,
//             });
//           } else {
//             merchantDetailsMap.set(merchantId, { id: merchantId });
//           }
//         }

//         // Stats
//         if (!merchantStatsMap.has(merchantId)) {
//           merchantStatsMap.set(merchantId, {
//             totalOrdersCount: 0,
//             totalOrderValue: 0,
//             ordersSeen: new Set(),
//           });
//         }

//         const stats = merchantStatsMap.get(merchantId);

//         if (!stats.ordersSeen.has(order.orderId)) {
//           stats.ordersSeen.add(order.orderId);
//           stats.totalOrdersCount += 1;
//         }

//         const amount =
//           parseFloat(item.price || 0) * parseInt(item.quantity || 1);

//         stats.totalOrderValue += amount;
//       }

//       // Build response (UNCHANGED STRUCTURE)
//       const merchantsArray = [];
//       const lineItemsByMerchant = {};

//       merchantGroups.forEach((items, merchantId) => {
//         const merchantInfo = merchantDetailsMap.get(merchantId) || {
//           id: merchantId,
//         };
//         const stats = merchantStatsMap.get(merchantId);

//         merchantsArray.push({
//           id: merchantId,
//           info: merchantInfo,
//           totalOrdersCount: stats?.totalOrdersCount || 0,
//           totalOrderValue: stats?.totalOrderValue || 0,
//         });

//         lineItemsByMerchant[merchantId] = items;
//       });

//       finalOrders.push({
//         serialNo: order.shopifyOrderNo,
//         merchants: merchantsArray,
//         lineItemsByMerchant,
//       });
//     }

//     if (finalOrders.length > 0) {
//       finalOrders.sort((a, b) => b.serialNo - a.serialNo);

//       return res.status(200).send({
//         message: 'Orders grouped per order (not merged by merchant)',
//         data: finalOrders,
//       });
//     } else {
//       return res
//         .status(404)
//         .send({ message: 'No orders found across merchants' });
//     }
//   } catch (error) {
//     console.error('❌ Error in getAllOrdersForAdmin:', error);
//     return res.status(500).send({ message: 'Internal Server Error' });
//   }
// };

export const getAllOrdersForAdmin = async (req, res) => {
  try {
    const allOrders = await orderModel.find({});

    const finalOrders = [];
    const merchantDetailsMap = new Map();
    const merchantStatsMap = new Map();

    const getRefundedQtyByLineItemId = (order, lineItemId) => {
      return (order.refunds || []).reduce((total, refund) => {
        const matchedRefundItems = (refund.refundItems || []).filter(
          (item) => String(item.lineItemId) === String(lineItemId)
        );

        const refundedQtyForLine = matchedRefundItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        );

        return total + refundedQtyForLine;
      }, 0);
    };

    const getRefundedAmountByLineItemId = (order, lineItemId) => {
      return (order.refunds || []).reduce((total, refund) => {
        const matchedRefundItems = (refund.refundItems || []).filter(
          (item) => String(item.lineItemId) === String(lineItemId)
        );

        const refundedAmountForLine = matchedRefundItems.reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );

        return total + refundedAmountForLine;
      }, 0);
    };

    for (const order of allOrders) {
      console.log(
        '\n Processing Order:',
        order.shopifyOrderNo,
        'Order ID:',
        order.orderId
      );

      const merchantGroups = new Map();
      const snapshots = order.ProductSnapshot || [];

      for (const item of order.lineItems || []) {
        const variantId = item.variant_id?.toString();
        const productId = item.product_id?.toString();

        const lineItemId =
          item.id ||
          item.lineItemId ||
          item.line_item_id;

        let merchantId = null;
        let imageData = null;

        const snapshotItem = snapshots.find(
          (snap) =>
            snap.variantId?.toString() === variantId ||
            snap.productId?.toString() === productId
        );

        if (snapshotItem) {
          merchantId = snapshotItem.merchantId?.toString() || null;

          const productData = snapshotItem.product;

          if (
            snapshotItem.variant?.image_id &&
            Array.isArray(productData?.variantImages)
          ) {
            const image = productData.variantImages.find(
              (img) => img.id === snapshotItem.variant.image_id
            );

            if (image) {
              imageData = {
                id: image.id,
                src: image.src,
                alt: image.alt,
                position: image.position,
                width: image.width,
                height: image.height,
              };
            }
          }

          if (
            !imageData &&
            Array.isArray(productData?.images) &&
            productData.images.length > 0
          ) {
            const defaultImage = productData.images[0];

            imageData = {
              id: defaultImage.id || null,
              src: defaultImage.src,
              alt: defaultImage.alt || '',
              position: defaultImage.position || 1,
              width: defaultImage.width || null,
              height: defaultImage.height || null,
            };
          }
        }

        if (!merchantId) {
          console.log(
            '⚠️ Skipped item because merchantId could not be determined'
          );
          continue;
        }

        const originalQty = Number(item.quantity || 0);
        const refundedQty = getRefundedQtyByLineItemId(order, lineItemId);
        const remainingQty = Math.max(originalQty - refundedQty, 0);

        const refundedAmount = getRefundedAmountByLineItemId(order, lineItemId);

        const itemPrice = Number(item.price || 0);
        const originalAmount = itemPrice * originalQty;
        const remainingAmount = itemPrice * remainingQty;

        const isFullyRefunded = remainingQty === 0 && originalQty > 0;
        const isPartiallyRefunded = refundedQty > 0 && remainingQty > 0;

        const enrichedItem = {
          ...item,

          quantity: remainingQty,

          original_quantity: originalQty,
          refunded_quantity: refundedQty,
          remaining_quantity: remainingQty,

          original_amount: Number(originalAmount.toFixed(2)),
          refunded_amount: Number(refundedAmount.toFixed(2)),
          remaining_amount: Number(remainingAmount.toFixed(2)),

          refund_status: isFullyRefunded
            ? 'fully_refunded'
            : isPartiallyRefunded
              ? 'partially_refunded'
              : 'not_refunded',

          image: imageData || item.image || null,
          orderId: order.orderId,
          customer: [
            {
              first_name: order.customer?.first_name || '',
              last_name: order.customer?.last_name || '',
              email: order.customer?.email || '',
              phone: order.customer?.phone || '',
              created_at: order.customer?.created_at || '',
              default_address: order.customer?.default_address || {},
            },
          ],
        };

        if (!merchantGroups.has(merchantId)) {
          merchantGroups.set(merchantId, []);
        }

        merchantGroups.get(merchantId).push(enrichedItem);

        if (!merchantDetailsMap.has(merchantId)) {
          const merchant = await authModel
            .findById(merchantId)
            .select('-password');

          if (merchant) {
            merchantDetailsMap.set(merchantId, {
              _id: merchant._id,
              name: `${merchant.firstName} ${merchant.lastName}`,
              email: merchant.email,
              role: merchant.role,
              dispatchAddress: merchant.dispatchAddress,
              dispatchCountry: merchant.dispatchCountry,
            });
          } else {
            merchantDetailsMap.set(merchantId, { id: merchantId });
          }
        }

        if (!merchantStatsMap.has(merchantId)) {
          merchantStatsMap.set(merchantId, {
            totalOrdersCount: 0,
            totalOrderValue: 0,
            totalRefundedValue: 0,
            totalRemainingValue: 0,
            totalRefundedQty: 0,
            totalRemainingQty: 0,
            ordersSeen: new Set(),
          });
        }

        const stats = merchantStatsMap.get(merchantId);

        if (!stats.ordersSeen.has(order.orderId)) {
          stats.ordersSeen.add(order.orderId);
          stats.totalOrdersCount += 1;
        }

        stats.totalOrderValue += originalAmount;
        stats.totalRefundedValue += refundedAmount;
        stats.totalRemainingValue += remainingAmount;
        stats.totalRefundedQty += refundedQty;
        stats.totalRemainingQty += remainingQty;
      }

      const merchantsArray = [];
      const lineItemsByMerchant = {};

      merchantGroups.forEach((items, merchantId) => {
        const merchantInfo = merchantDetailsMap.get(merchantId) || {
          id: merchantId,
        };

        const stats = merchantStatsMap.get(merchantId);

        merchantsArray.push({
          id: merchantId,
          info: merchantInfo,

          totalOrdersCount: stats?.totalOrdersCount || 0,

          totalOrderValue: Number(
            (stats?.totalOrderValue || 0).toFixed(2)
          ),

          totalRefundedValue: Number(
            (stats?.totalRefundedValue || 0).toFixed(2)
          ),

          totalRemainingValue: Number(
            (stats?.totalRemainingValue || 0).toFixed(2)
          ),

          totalRefundedQty: stats?.totalRefundedQty || 0,
          totalRemainingQty: stats?.totalRemainingQty || 0,
        });

        lineItemsByMerchant[merchantId] = items;
      });

      finalOrders.push({
        serialNo: order.shopifyOrderNo,
        orderId: order.orderId,

        refunds: order.refunds || [],

        merchants: merchantsArray,
        lineItemsByMerchant,
      });
    }

    if (finalOrders.length > 0) {
      finalOrders.sort((a, b) => b.serialNo - a.serialNo);

      return res.status(200).send({
        message: 'Orders grouped per order with refund tracking',
        data: finalOrders,
      });
    }

    return res.status(404).send({
      message: 'No orders found across merchants',
    });
  } catch (error) {
    console.error('❌ Error in getAllOrdersForAdmin:', error);

    return res.status(500).send({
      message: 'Internal Server Error',
    });
  }
};
export const addPaypalAccount = async (req, res) => {
  try {
    const { payPal, merchantIds } = req.body;

    if (!payPal || !Array.isArray(merchantIds) || merchantIds.length === 0) {
      return res.status(400).json({ message: 'Missing payPal or merchantIds' });
    }

    const updatedUsers = [];

    for (const id of merchantIds) {
      const user = await authModel.findById(id);
      if (user) {
        user.paypalAccount = payPal;
        await user.save();
        updatedUsers.push({
          merchantId: user._id,
          paypalAccount: user.paypalAccount,
        });
      }
    }

    return res.status(200).json({
      message: 'PayPal account updated for all valid merchants',
      updated: updatedUsers,
    });
  } catch (error) {
    console.error('Error in addPaypalAccount:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const addPaypalAccountNo = async (req, res) => {
  try {
    const { payPal, merchantId } = req.body;

    if (!payPal || !merchantId) {
      return res.status(400).json({ message: 'Missing payPal or merchantId' });
    }

    const user = await authModel.findById(merchantId);
    if (!user) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    user.paypalAccountNo = payPal;
    await user.save();

    return res.status(200).json({
      message: 'PayPal account updated successfully',
      data: {
        merchantId: user._id,
        paypalAccountNo: user.paypalAccountNo,
      },
    });
  } catch (error) {
    console.error(' Error in addPaypalAccount:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// export const addPayouts = async (req, res) => {
//   const {
//     payoutFrequency,
//     graceTime = 0,
//     firstDate,
//     secondDate,
//     weeklyDay,
//   } = req.body;

//   if (!payoutFrequency) {
//     return res.status(400).json({ message: 'Payout frequency is required.' });
//   }

//   try {
//     let config = await PayoutConfig.findOne();
//     if (!config) config = new PayoutConfig();

//     config.graceTime = graceTime;
//     config.payoutFrequency = payoutFrequency;

//     const now = dayjs().add(graceTime, 'day');
//     const currentMonth = now.month(); // 0-indexed
//     const currentYear = now.year();

//     switch (payoutFrequency) {
//       case 'daily':
//         config.firstPayoutDate = now.startOf('day').toDate();
//         config.secondPayoutDate = null;
//         config.weeklyDay = null;
//         break;

//       case 'weekly':
//         if (!weeklyDay) {
//           return res.status(400).json({ message: 'Weekly day is required.' });
//         }

//         const weekdays = {
//           Sunday: 0,
//           Monday: 1,
//           Tuesday: 2,
//           Wednesday: 3,
//           Thursday: 4,
//           Friday: 5,
//           Saturday: 6,
//         };

//         const targetDay = weekdays[weeklyDay];
//         if (targetDay === undefined) {
//           return res.status(400).json({ message: 'Invalid weekly day.' });
//         }

//         let nextWeekly = now;
//         while (nextWeekly.day() !== targetDay) {
//           nextWeekly = nextWeekly.add(1, 'day');
//         }

//         config.firstPayoutDate = nextWeekly.toDate();
//         config.secondPayoutDate = null;
//         config.weeklyDay = weeklyDay;
//         break;

//       case 'once':
//         if (typeof firstDate !== 'number' || firstDate < 1) {
//           return res
//             .status(400)
//             .json({ message: 'First payout day is required.' });
//         }

//         config.firstPayoutDate = dayjs()
//           .set('date', Math.min(firstDate, 28))
//           .set('month', currentMonth)
//           .set('year', currentYear)
//           .toDate();

//         config.secondPayoutDate = null;
//         config.weeklyDay = null;
//         break;

//       case 'twice':
//         if (
//           typeof firstDate !== 'number' ||
//           typeof secondDate !== 'number' ||
//           firstDate < 1 ||
//           secondDate < 1
//         ) {
//           return res
//             .status(400)
//             .json({ message: 'Both payout days required.' });
//         }

//         config.firstPayoutDate = dayjs()
//           .set('date', Math.min(firstDate, 28))
//           .set('month', currentMonth)
//           .set('year', currentYear)
//           .toDate();

//         config.secondPayoutDate = dayjs()
//           .set('date', Math.min(secondDate, 28))
//           .set('month', currentMonth)
//           .set('year', currentYear)
//           .toDate();

//         config.weeklyDay = null;
//         break;

//       default:
//         return res
//           .status(400)
//           .json({ message: 'Invalid payout frequency selected.' });
//     }

//     await config.save();

//     return res.json({ message: 'Payout config saved successfully.' });
//   } catch (error) {
//     console.error('❌ Error saving payout config:', error);
//     return res.status(500).json({ message: 'Failed to save payout config.' });
//   }
// };

export const addPayouts = async (req, res) => {
  const {
    payoutFrequency,
    graceTime = 0,
    firstDate,
    secondDate,
    weeklyDay,
    commission = 0,
  } = req.body;

  if (!payoutFrequency) {
    return res.status(400).json({ message: 'Payout frequency is required.' });
  }

  if (commission < 0 || commission > 100) {
    return res
      .status(400)
      .json({ message: 'Commission must be between 0 and 100.' });
  }

  try {
    let config = await PayoutConfig.findOne();
    if (!config) config = new PayoutConfig();

    config.graceTime = graceTime;
    config.payoutFrequency = payoutFrequency;
    config.commission = commission;

    const baseDate = dayjs().add(graceTime, 'day');
    const currentMonth = baseDate.month();
    const currentYear = baseDate.year();

    switch (payoutFrequency) {
      case 'daily': {
        config.firstPayoutDate = baseDate.startOf('day').toDate();
        config.secondPayoutDate = null;
        config.weeklyDay = null;
        break;
      }

      case 'weekly': {
        if (!weeklyDay) {
          return res.status(400).json({ message: 'Weekly day is required.' });
        }

        const weekdays = {
          Sunday: 0,
          Monday: 1,
          Tuesday: 2,
          Wednesday: 3,
          Thursday: 4,
          Friday: 5,
          Saturday: 6,
        };

        const targetDay = weekdays[weeklyDay];
        if (targetDay === undefined) {
          return res.status(400).json({ message: 'Invalid weekly day.' });
        }

        let nextWeekly = baseDate;
        while (nextWeekly.day() !== targetDay) {
          nextWeekly = nextWeekly.add(1, 'day');
        }

        config.firstPayoutDate = nextWeekly.toDate();
        config.secondPayoutDate = null;
        config.weeklyDay = weeklyDay;
        break;
      }

      case 'once': {
        if (typeof firstDate !== 'number' || firstDate < 1) {
          return res
            .status(400)
            .json({ message: 'First payout day is required.' });
        }

        let payoutDate = dayjs()
          .set('date', Math.min(firstDate, 28))
          .set('month', currentMonth)
          .set('year', currentYear);

        // 🔥 ensure future date
        if (payoutDate.isBefore(baseDate)) {
          payoutDate = payoutDate.add(1, 'month');
        }

        config.firstPayoutDate = payoutDate.toDate();
        config.secondPayoutDate = null;
        config.weeklyDay = null;
        break;
      }

      case 'twice': {
        if (
          typeof firstDate !== 'number' ||
          typeof secondDate !== 'number' ||
          firstDate < 1 ||
          secondDate < 1
        ) {
          return res
            .status(400)
            .json({ message: 'Both payout days are required.' });
        }

        let first = dayjs()
          .set('date', Math.min(firstDate, 28))
          .set('month', currentMonth)
          .set('year', currentYear);

        let second = dayjs()
          .set('date', Math.min(secondDate, 28))
          .set('month', currentMonth)
          .set('year', currentYear);

        if (first.isBefore(baseDate)) first = first.add(1, 'month');
        if (second.isBefore(baseDate)) second = second.add(1, 'month');

        config.firstPayoutDate = first.toDate();
        config.secondPayoutDate = second.toDate();
        config.weeklyDay = null;
        break;
      }

      default:
        return res
          .status(400)
          .json({ message: 'Invalid payout frequency selected.' });
    }

    await config.save();

    return res.json({
      message: 'Payout config saved successfully.',
      config,
    });
  } catch (error) {
    console.error('❌ Error saving payout config:', error);
    return res.status(500).json({ message: 'Failed to save payout config.' });
  }
};

export const getPayoutDate = async (req, res) => {
  try {
    const config = await PayoutConfig.findOne();

    if (!config) {
      return res.status(404).json({
        message: 'No payout configuration found',
      });
    }

    return res.json({
      payoutFrequency: config.payoutFrequency,
      graceTime: config.graceTime ?? 0,
      weeklyDay: config.weeklyDay ?? null,

      firstDate: config.firstPayoutDate
        ? config.firstPayoutDate.toISOString()
        : null,

      secondDate: config.secondPayoutDate
        ? config.secondPayoutDate.toISOString()
        : null,

      commission: config.commission ?? 0,
    });
  } catch (error) {
    console.error('❌ Error fetching payout config:', error);
    return res.status(500).json({
      message: 'Failed to fetch payout configuration',
    });
  }
};

function getNextPayoutDate(startDate, config) {
  const frequency = config.payoutFrequency || 'twice';
  const base = dayjs(startDate).startOf('day');

  if (frequency === 'daily') {
    return base;
  }

  if (frequency === 'weekly') {
    const weekdays = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const targetDay = weekdays[config.weeklyDay] ?? 1;
    const diff = (targetDay + 7 - base.day()) % 7;
    return base.add(diff, 'day');
  }

  const d1 = config.firstPayoutDate ? dayjs(config.firstPayoutDate).date() : 5;
  const d2 = config.secondPayoutDate
    ? dayjs(config.secondPayoutDate).date()
    : 20;

  const possible = [
    dayjs(`${base.year()}-${base.month() + 1}-${d1}`),
    dayjs(`${base.year()}-${base.month() + 1}-${d2}`),
    dayjs(`${base.year()}-${base.month() + 2}-${d1}`),
    dayjs(`${base.year()}-${base.month() + 2}-${d2}`),
  ];

  if (frequency === 'once') {
    return base.isBefore(possible[0]) ? possible[0] : possible[2];
  }

  const next = possible.find((d) => d.isAfter(base));
  return next || possible[0];
}

// export const getPayout = async (req, res) => {
//   try {
//     const config = await PayoutConfig.findOne({});
//     if (!config) {
//       return res.status(400).json({ error: 'Payout config not found.' });
//     }

//     const orders = await orderModel.find({});
//     const updates = [];
//     const currentDate = dayjs().startOf('day');

//     for (const order of orders) {
//       let createdAt = dayjs(order.createdAt);

//       // ================= RESCHEDULE IF UNFULFILLED =================
//       if (
//         order.scheduledPayoutDate &&
//         dayjs(order.scheduledPayoutDate).isSame(currentDate, 'day')
//       ) {
//         const isAnyItemUnfulfilled = (order.lineItems || []).some(
//           (item) => item.fulfillment_status === null
//         );

//         if (isAnyItemUnfulfilled) {
//           createdAt = createdAt.add(1, 'day');
//           order.createdAt = createdAt.toDate();

//           const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
//           const payoutDate = getNextPayoutDate(eligibleDate.toDate(), config);

//           order.scheduledPayoutDate = payoutDate.toDate();
//         }
//       }

//       // ================= SET ELIGIBLE / PAYOUT DATE =================
//       if (!order.scheduledPayoutDate || !order.eligibleDate) {
//         const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
//         const payoutDate = getNextPayoutDate(eligibleDate.toDate(), config);

//         if (!order.eligibleDate) order.eligibleDate = eligibleDate.toDate();

//         if (!order.scheduledPayoutDate)
//           order.scheduledPayoutDate = payoutDate.toDate();
//       }

//       const enrichedLineItems = [];

//       for (const item of order.lineItems || []) {
//         const price = Number(item.price) || 0;
//         const qty = Number(item.quantity || item.current_quantity) || 0;

//         const itemTotal = price * qty;

//         let merchantName = 'Unknown';
//         let merchantEmail = 'Unknown';
//         let merchantId = null;
//         let commissionRate = 0;

//         const variantId = item.variantId || item.variant_id;

//         if (variantId) {
//           const listing = await listingModel.findOne({
//             'variants.id': String(variantId),
//           });

//           if (listing?.userId) {
//             const merchant = await authModel.findById(listing.userId);
//             if (merchant) {
//               merchantName =
//                 `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
//               merchantEmail = merchant.email || 'N/A';
//               merchantId = merchant._id;
//               commissionRate = Number(merchant.comissionRate || 0);
//             }
//           }
//         }

//         // ================= 🔥 GET PAYOUT STATUS FROM ProductSnapshot =================
//         const snapshot = order.ProductSnapshot?.find(
//           (p) =>
//             String(p.productId) === String(item.product_id) &&
//             String(p.variantId) === String(item.variant_id)
//         );

//         const payoutStatus = snapshot?.payoutStatus;
//         const payoutReferenceId = snapshot?.payoutReferenceId;

//         enrichedLineItems.push({
//           ...item,
//           merchantId,
//           merchantName,
//           merchantEmail,
//           commissionRate,
//           itemTotal,
//           payoutStatus,
//           payoutReferenceId, // ✅ FROM ProductSnapshot
//         });
//       }

//       await order.save();

//       updates.push({
//         orderId: order._id,
//         scheduledPayoutDate: order.scheduledPayoutDate,
//         createdAt: order.createdAt,
//         lineItems: enrichedLineItems,
//       });
//     }

//     // ================= GROUPING (MERCHANT + STATUS BASED) =================

//     const grouped = {};

//     updates.forEach((order) => {
//       order.lineItems.forEach((line) => {
//         if (!line.merchantId) return;

//         const status = line.payoutStatus || 'pending';

//         const key = `${dayjs(order.scheduledPayoutDate).format(
//           'YYYY-MM-DD'
//         )}__${status}`;

//         if (!grouped[key]) {
//           grouped[key] = {
//             payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
//             status:
//               status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
//             createdAts: [],
//             orders: {},
//             sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
//           };
//         }

//         grouped[key].createdAts.push(dayjs(order.createdAt));

//         const merchantKey = `${line.merchantId}-${order.scheduledPayoutDate}`;

//         if (!grouped[key].orders[merchantKey]) {
//           grouped[key].orders[merchantKey] = {
//             merchantId: line.merchantId,
//             merchantName: line.merchantName,
//             merchantEmail: line.merchantEmail,
//             commissionRate: line.commissionRate,
//             grossAmount: 0,
//             commissionAmount: 0,
//             netAmount: 0,
//             fulfilledCount: 0,
//             unfulfilledCount: 0,
//             lineItems: [],
//           };
//         }

//         const merchant = grouped[key].orders[merchantKey];

//         merchant.grossAmount += line.itemTotal;

//         if (line.fulfillment_status === 'fulfilled') {
//           merchant.fulfilledCount += 1;
//         } else if (line.fulfillment_status === null) {
//           merchant.unfulfilledCount += 1;
//         }

//         merchant.lineItems.push(line);
//       });
//     });

//     // ================= COMMISSION CALC =================

//     Object.values(grouped).forEach((group) => {
//       Object.values(group.orders).forEach((merchant) => {
//         merchant.commissionAmount =
//           (merchant.grossAmount * merchant.commissionRate) / 100;

//         merchant.netAmount = merchant.grossAmount - merchant.commissionAmount;
//       });
//     });

//     // ================= FINAL RESPONSE =================

//     const allPayouts = Object.values(grouped)
//       .map((group) => {
//         const minDate = dayjs.min(group.createdAts);
//         const maxDate = dayjs.max(group.createdAts);

//         return {
//           payoutDate: group.payoutDate,
//           transactionDates: `${minDate.format(
//             'MMM D'
//           )} – ${maxDate.format('MMM D, YYYY')}`,
//           status: group.status,
//           orders: Object.values(group.orders),
//           sortKey: group.sortKey,
//         };
//       })
//       .sort((a, b) => {
//         if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
//         return b.sortKey - a.sortKey;
//       });

//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const startIndex = (page - 1) * limit;

//     res.json({
//       message: 'Payouts calculated',
//       totalPayouts: allPayouts.length,
//       page,
//       limit,
//       payouts: allPayouts.slice(startIndex, startIndex + limit),
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       error: 'Server error while calculating payouts',
//     });
//   }
// };

export const getPayout = async (req, res) => {
  try {
    console.log('🚀 getPayout API HIT');

    const config = await PayoutConfig.findOne({});
    if (!config) {
      return res.status(400).json({ error: 'Payout config not found.' });
    }

    const orders = await orderModel.find({});
    const updates = [];
    const currentDate = dayjs().startOf('day');

    for (const order of orders) {
      console.log('\n==============================');
      console.log('Processing Order:', order.orderId);

      let createdAt = dayjs(order.createdAt);

      // ================= RESCHEDULE IF UNFULFILLED =================
      if (
        order.scheduledPayoutDate &&
        dayjs(order.scheduledPayoutDate).isSame(currentDate, 'day')
      ) {
        const isAnyItemUnfulfilled = (order.lineItems || []).some(
          (item) => item.fulfillment_status === null
        );

        if (isAnyItemUnfulfilled) {
          createdAt = createdAt.add(1, 'day');
          order.createdAt = createdAt.toDate();

          const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
          const payoutDate = getNextPayoutDate(eligibleDate.toDate(), config);

          order.scheduledPayoutDate = payoutDate.toDate();
        }
      }

      // ================= SET ELIGIBLE / PAYOUT DATE =================
      if (!order.scheduledPayoutDate || !order.eligibleDate) {
        const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
        const payoutDate = getNextPayoutDate(eligibleDate.toDate(), config);

        if (!order.eligibleDate) order.eligibleDate = eligibleDate.toDate();
        if (!order.scheduledPayoutDate)
          order.scheduledPayoutDate = payoutDate.toDate();
      }

      const enrichedLineItems = [];

      for (const item of order.lineItems || []) {
        console.log('\nChecking LineItem Variant:', item.variant_id);

        const price = Number(item.price) || 0;
        const qty = Number(item.quantity || item.current_quantity) || 0;
        const itemTotal = price * qty;

        // 🔥 SNAPSHOT MATCH (ONLY VARIANT ID)
        const snapshot = order.ProductSnapshot?.find(
          (p) => String(p.variantId).trim() === String(item.variant_id).trim()
        );

        console.log('Matched Snapshot:', snapshot);

        let merchantId = null;
        let merchantName = 'Unknown';
        let merchantEmail = 'Unknown';
        let commissionRate = 0;
        let payoutStatus = 'pending';
        let payoutReferenceId = null;

        if (snapshot) {
          merchantId = snapshot.merchantId;

          console.log('Snapshot Variant Object:', snapshot.variant);

          payoutStatus = snapshot.payoutStatus || 'pending';
          payoutReferenceId = snapshot.payoutReferenceId || null;

          console.log('Extracted payoutReferenceId:', payoutReferenceId);

          const merchant = await authModel.findById(merchantId);

          if (merchant) {
            merchantName = `${merchant.firstName || ''} ${merchant.lastName || ''
              }`.trim();

            merchantEmail = merchant.email || 'N/A';
            commissionRate = Number(merchant.comissionRate || 0);
          }
        } else {
          console.log('❌ Snapshot not found for this item');
        }

        enrichedLineItems.push({
          ...item,
          merchantId,
          merchantName,
          merchantEmail,
          commissionRate,
          itemTotal,
          payoutStatus,
          payoutReferenceId,
        });
      }

      await order.save();

      updates.push({
        orderId: order._id,
        scheduledPayoutDate: order.scheduledPayoutDate,
        createdAt: order.createdAt,
        lineItems: enrichedLineItems,
      });
    }

    // ================= GROUPING =================
    const grouped = {};

    updates.forEach((order) => {
      order.lineItems.forEach((line) => {
        if (!line.merchantId) return;

        const status = line.payoutStatus || 'pending';

        const key = `${dayjs(order.scheduledPayoutDate).format(
          'YYYY-MM-DD'
        )}__${status}`;

        if (!grouped[key]) {
          grouped[key] = {
            payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
            status:
              status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(),
            createdAts: [],
            orders: {},
            sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
          };
        }

        grouped[key].createdAts.push(dayjs(order.createdAt));

        const merchantKey = `${line.merchantId}-${order.scheduledPayoutDate}`;

        if (!grouped[key].orders[merchantKey]) {
          grouped[key].orders[merchantKey] = {
            merchantId: line.merchantId,
            merchantName: line.merchantName,
            merchantEmail: line.merchantEmail,
            commissionRate: line.commissionRate,
            grossAmount: 0,
            commissionAmount: 0,
            netAmount: 0,
            fulfilledCount: 0,
            unfulfilledCount: 0,
            lineItems: [],
          };
        }

        const merchant = grouped[key].orders[merchantKey];

        merchant.grossAmount += line.itemTotal;

        if (line.fulfillment_status === 'fulfilled') {
          merchant.fulfilledCount += 1;
        } else if (line.fulfillment_status === null) {
          merchant.unfulfilledCount += 1;
        }

        merchant.lineItems.push(line);
      });
    });

    // ================= COMMISSION =================
    Object.values(grouped).forEach((group) => {
      Object.values(group.orders).forEach((merchant) => {
        merchant.commissionAmount =
          (merchant.grossAmount * merchant.commissionRate) / 100;

        merchant.netAmount = merchant.grossAmount - merchant.commissionAmount;
      });
    });

    // ================= FINAL RESPONSE =================
    const allPayouts = Object.values(grouped)
      .map((group) => {
        const minDate = dayjs.min(group.createdAts);
        const maxDate = dayjs.max(group.createdAts);

        return {
          payoutDate: group.payoutDate,
          transactionDates: `${minDate.format(
            'MMM D'
          )} – ${maxDate.format('MMM D, YYYY')}`,
          status: group.status,
          orders: Object.values(group.orders), // MUST BE ARRAY
          sortKey: group.sortKey,
        };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
        return b.sortKey - a.sortKey;
      });

    return res.json({
      message: 'Payouts calculated',
      totalPayouts: allPayouts.length,
      payouts: allPayouts,
    });
  } catch (err) {
    console.error('❌ Payout Error:', err);
    res.status(500).json({
      error: 'Server error while calculating payouts',
    });
  }
};

// export const getPayoutByUserId = async (req, res) => {
//   try {
//     const { userId } = req.query;

//     const config = await PayoutConfig.findOne({});
//     if (!config) {
//       return res.status(400).json({ error: 'Payout config not found.' });
//     }

//     const orders = await orderModel.find({});
//     const updates = [];
//     let totalPayoutAmount = 0;
//     let totalRefundAmount = 0;

//     for (const order of orders) {
//       const createdAt = dayjs(order.createdAt);
//       const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
//       const payoutDate = getNextPayoutDate(eligibleDate.toDate(), config);

//       order.eligibleDate = eligibleDate.toDate();
//       order.scheduledPayoutDate = payoutDate.toDate();

//       const lineItems = order.lineItems || [];
//       const snapshots = order.ProductSnapshot || [];

//       let payoutAmount = 0;
//       let refundAmount = 0;
//       let commissionAmount = 0;

//       const enrichedLineItems = [];
//       let fulfilledCount = 0;
//       let unfulfilledCount = 0;

//       let merchantCommissionRate = 0;

//       // 🔥 Get merchant snapshot
//       const merchantSnapshot = snapshots.find(
//         (snap) => String(snap.merchantId) === String(userId)
//       );

//       if (!merchantSnapshot) continue;

//       const snapshotStatus = merchantSnapshot.payoutStatus || 'pending';
//       const payoutReferenceId = merchantSnapshot.payoutReferenceId; // ✅ ADD THIS

//       for (const item of lineItems) {
//         const price = Number(item.price) || 0;
//         const qty = Number(item.quantity || item.current_quantity) || 0;
//         const total = price * qty;
//         const status = item.fulfillment_status;

//         let merchantId = null;
//         let merchantName = 'Unknown';
//         let merchantEmail = 'Unknown';

//         const variantId = item.variantId || item.variant_id;

//         if (variantId) {
//           const listing = await listingModel.findOne({
//             'variants.id': String(variantId),
//           });

//           if (listing?.userId) {
//             merchantId = String(listing.userId);

//             if (merchantId !== String(userId)) continue;

//             const merchant = await authModel.findById(listing.userId);

//             if (merchant) {
//               merchantName =
//                 `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
//               merchantEmail = merchant.email || 'N/A';
//               merchantCommissionRate = Number(merchant.comissionRate || 0);
//             }
//           }
//         }

//         if (status === 'fulfilled') {
//           fulfilledCount++;
//         } else if (status !== 'cancelled') {
//           unfulfilledCount++;
//         }

//         enrichedLineItems.push({
//           ...item,
//           merchantId,
//           merchantName,
//           merchantEmail,
//           commissionRate: merchantCommissionRate,
//           isCancelled: status === 'cancelled',
//         });

//         if (status === 'cancelled') {
//           refundAmount += total;
//         } else {
//           payoutAmount += total;
//           commissionAmount += (total * merchantCommissionRate) / 100;
//         }
//       }

//       if (enrichedLineItems.length === 0) continue;

//       const netPayoutAmount = payoutAmount - commissionAmount;

//       totalPayoutAmount += netPayoutAmount;
//       totalRefundAmount += refundAmount;

//       updates.push({
//         orderId: order._id,
//         shopifyOrderId: order.orderId,
//         shopifyOrderNo: order.shopifyOrderNo || 'N/A',
//         eligibleDate: order.eligibleDate,
//         scheduledPayoutDate: order.scheduledPayoutDate,
//         payoutReferenceId,
//         // ✅ SNAPSHOT STATUS
//         payoutStatus:
//           snapshotStatus === 'Deposited'
//             ? 'Deposited'
//             : snapshotStatus === 'Due'
//               ? 'Due'
//               : 'Pending',

//         payoutAmount: netPayoutAmount,
//         refundAmount,
//         commissionAmount,
//         createdAt: order.createdAt,
//         lineItems: enrichedLineItems,
//         fulfillmentSummary: {
//           fulfilled: fulfilledCount,
//           unfulfilled: unfulfilledCount,
//         },
//       });
//     }

//     // ================= GROUPING =================

//     const grouped = {};

//     updates.forEach((order) => {
//       const key = `${dayjs(order.scheduledPayoutDate).format(
//         'YYYY-MM-DD'
//       )}__${order.payoutStatus}`;

//       if (!grouped[key]) {
//         grouped[key] = {
//           payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
//           status: order.payoutStatus,
//           createdAts: [],
//           totalAmount: 0,
//           totalRefundAmount: 0,
//           totalFulfilled: 0,
//           totalUnfulfilled: 0,
//           orders: [],
//           sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
//         };
//       }

//       grouped[key].createdAts.push(dayjs(order.createdAt));

//       grouped[key].totalAmount += order.payoutAmount;
//       grouped[key].totalRefundAmount += order.refundAmount;
//       grouped[key].totalFulfilled += order.fulfillmentSummary.fulfilled;
//       grouped[key].totalUnfulfilled += order.fulfillmentSummary.unfulfilled;

//       grouped[key].orders.push({
//         orderId: order.orderId,
//         shopifyOrderId: order.shopifyOrderId,
//         shopifyOrderNo: order.shopifyOrderNo,
//         amount: order.payoutAmount,
//         refund: order.refundAmount,
//         commissionAmount: order.commissionAmount,
//         status: order.payoutStatus,
//         createdAt: order.createdAt,
//         fulfillmentSummary: order.fulfillmentSummary,
//         lineItems: order.lineItems,
//         payoutReferenceId: order.payoutReferenceId,
//       });
//     });

//     const payouts = Object.values(grouped)
//       .map((group) => {
//         const minDate = dayjs.min(group.createdAts);
//         const maxDate = dayjs.max(group.createdAts);

//         return {
//           payoutDate: group.payoutDate,
//           transactionDates: `${minDate.format(
//             'MMM D'
//           )} – ${maxDate.format('MMM D, YYYY')}`,
//           status: group.status,
//           amount: `$${group.totalAmount.toFixed(2)} AUD`,
//           totalRefundAmount: `$${group.totalRefundAmount.toFixed(2)} AUD`,
//           totalFulfilled: group.totalFulfilled,
//           totalUnfulfilled: group.totalUnfulfilled,
//           orders: group.orders,
//           sortKey: group.sortKey,
//         };
//       })
//       .sort((a, b) => {
//         const orderPriority = {
//           Pending: 1,
//           Due: 2,
//           Deposited: 3,
//         };

//         if (a.status !== b.status) {
//           return orderPriority[a.status] - orderPriority[b.status];
//         }

//         return b.sortKey - a.sortKey;
//       });

//     res.json({
//       message: 'Payouts calculated',
//       totalAmount: totalPayoutAmount,
//       totalRefundAmount,
//       payouts,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       error: 'Server error while calculating payouts',
//     });
//   }
// };

export const getPayoutByUserId = async (req, res) => {
  try {
    const { userId } = req.query;

    const config = await PayoutConfig.findOne({});
    if (!config) {
      return res.status(400).json({ error: 'Payout config not found.' });
    }

    const orders = await orderModel.find({});
    const updates = [];
    let totalPayoutAmount = 0;
    let totalRefundAmount = 0;

    for (const order of orders) {
      const createdAt = dayjs(order.createdAt);
      const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
      const payoutDate = getNextPayoutDate(eligibleDate.toDate(), config);

      order.eligibleDate = eligibleDate.toDate();
      order.scheduledPayoutDate = payoutDate.toDate();

      const lineItems = order.lineItems || [];
      const snapshots = order.ProductSnapshot || [];

      let payoutAmount = 0;
      let refundAmount = 0;
      let commissionAmount = 0;

      const enrichedLineItems = [];
      let fulfilledCount = 0;
      let unfulfilledCount = 0;

      let merchantCommissionRate = 0;

      // 🔥 Find all snapshots of this merchant
      const merchantSnapshots = snapshots.filter(
        (snap) => String(snap.merchantId) === String(userId)
      );

      if (merchantSnapshots.length === 0) continue;

      // Use first snapshot for payout meta (status/ref)
      const snapshotStatus = merchantSnapshots[0].payoutStatus || 'Pending';

      const payoutReferenceId = merchantSnapshots[0].payoutReferenceId || null;

      for (const item of lineItems) {
        const variantId = item.variantId || item.variant_id;

        // 🔥 Match snapshot by variantId
        const snapshot = merchantSnapshots.find(
          (snap) => String(snap.variantId) === String(variantId)
        );

        if (!snapshot) continue;

        const price = Number(item.price) || 0;
        const qty = Number(item.quantity || item.current_quantity) || 0;
        const total = price * qty;

        const status = item.fulfillment_status;

        let merchantId = snapshot.merchantId;
        let merchantName = 'Unknown';
        let merchantEmail = 'Unknown';

        const merchant = await authModel.findById(merchantId);

        if (merchant) {
          merchantName =
            `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
          merchantEmail = merchant.email || 'N/A';
          merchantCommissionRate = Number(merchant.comissionRate || 0);
        }

        if (status === 'fulfilled') {
          fulfilledCount++;
        } else if (status !== 'cancelled') {
          unfulfilledCount++;
        }

        enrichedLineItems.push({
          ...item,
          merchantId,
          merchantName,
          merchantEmail,
          commissionRate: merchantCommissionRate,
          isCancelled: status === 'cancelled',
        });

        if (status === 'cancelled') {
          refundAmount += total;
        } else {
          payoutAmount += total;
          commissionAmount += (total * merchantCommissionRate) / 100;
        }
      }

      if (enrichedLineItems.length === 0) continue;

      const netPayoutAmount = payoutAmount - commissionAmount;

      totalPayoutAmount += netPayoutAmount;
      totalRefundAmount += refundAmount;

      updates.push({
        orderId: order._id,
        shopifyOrderId: order.orderId,
        shopifyOrderNo: order.shopifyOrderNo || 'N/A',
        eligibleDate: order.eligibleDate,
        scheduledPayoutDate: order.scheduledPayoutDate,
        payoutReferenceId,
        payoutStatus:
          snapshotStatus === 'Deposited'
            ? 'Deposited'
            : snapshotStatus === 'Due'
              ? 'Due'
              : 'Pending',
        payoutAmount: netPayoutAmount,
        refundAmount,
        commissionAmount,
        createdAt: order.createdAt,
        lineItems: enrichedLineItems,
        fulfillmentSummary: {
          fulfilled: fulfilledCount,
          unfulfilled: unfulfilledCount,
        },
      });
    }

    // ================= GROUPING =================

    const grouped = {};

    updates.forEach((order) => {
      const key = `${dayjs(order.scheduledPayoutDate).format(
        'YYYY-MM-DD'
      )}__${order.payoutStatus}`;

      if (!grouped[key]) {
        grouped[key] = {
          payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
          status: order.payoutStatus,
          createdAts: [],
          totalAmount: 0,
          totalRefundAmount: 0,
          totalFulfilled: 0,
          totalUnfulfilled: 0,
          orders: [],
          sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
        };
      }

      grouped[key].createdAts.push(dayjs(order.createdAt));
      grouped[key].totalAmount += order.payoutAmount;
      grouped[key].totalRefundAmount += order.refundAmount;
      grouped[key].totalFulfilled += order.fulfillmentSummary.fulfilled;
      grouped[key].totalUnfulfilled += order.fulfillmentSummary.unfulfilled;

      grouped[key].orders.push({
        orderId: order.orderId,
        shopifyOrderId: order.shopifyOrderId,
        shopifyOrderNo: order.shopifyOrderNo,
        amount: order.payoutAmount,
        refund: order.refundAmount,
        commissionAmount: order.commissionAmount,
        status: order.payoutStatus,
        createdAt: order.createdAt,
        fulfillmentSummary: order.fulfillmentSummary,
        lineItems: order.lineItems,
        payoutReferenceId: order.payoutReferenceId,
      });
    });

    const payouts = Object.values(grouped)
      .map((group) => {
        const minDate = dayjs.min(group.createdAts);
        const maxDate = dayjs.max(group.createdAts);

        return {
          payoutDate: group.payoutDate,
          transactionDates: `${minDate.format(
            'MMM D'
          )} – ${maxDate.format('MMM D, YYYY')}`,
          status: group.status,
          amount: `$${group.totalAmount.toFixed(2)} AUD`,
          totalRefundAmount: `$${group.totalRefundAmount.toFixed(2)} AUD`,
          totalFulfilled: group.totalFulfilled,
          totalUnfulfilled: group.totalUnfulfilled,
          orders: group.orders,
          sortKey: group.sortKey,
        };
      })
      .sort((a, b) => {
        const orderPriority = {
          Pending: 1,
          Due: 2,
          Deposited: 3,
        };

        if (a.status !== b.status) {
          return orderPriority[a.status] - orderPriority[b.status];
        }

        return b.sortKey - a.sortKey;
      });

    res.json({
      message: 'Payouts calculated',
      totalAmount: totalPayoutAmount,
      totalRefundAmount,
      payouts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error while calculating payouts',
    });
  }
};

// export const getPayoutOrders = async (req, res) => {
//   try {
//     const { payoutDate, status, userId } = req.query;

//     if (!userId) {
//       return res.status(400).json({ error: 'Missing userId' });
//     }

//     const config = await PayoutConfig.findOne({});
//     if (!config) {
//       return res.status(400).json({ error: 'Payout config not found.' });
//     }

//     const merchant = await authModel.findById(userId);
//     const merchantAccount = merchant
//       ? {
//           paypalAccount: merchant.paypalAccount || '',
//           paypalAccountNo: merchant.paypalAccountNo || '',
//           paypalReferenceNo: merchant.paypalReferenceNo || '',
//           bankDetails: merchant.bankDetails || {},
//         }
//       : null;

//     const commissionRate = Number(merchant?.comissionRate || 0);

//     // ❌ REMOVE payoutStatus query filter
//     const orders = await orderModel.find({});

//     const updates = [];
//     let totalPayoutAmount = 0;

//     for (const order of orders) {
//       const createdAt = dayjs(order.createdAt);
//       const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
//       const payoutDateObj = getNextPayoutDate(eligibleDate.toDate(), config);

//       order.eligibleDate = eligibleDate.toDate();
//       order.scheduledPayoutDate = payoutDateObj.toDate();

//       const lineItems = order.lineItems || [];

//       let grossAmount = 0;
//       let refundAmount = 0;
//       let commissionAmount = 0;
//       const products = [];

//       // 🔥 GET SNAPSHOT FOR THIS MERCHANT
//       const merchantSnapshots = (order.ProductSnapshot || []).filter(
//         (snap) => String(snap.merchantId) === String(userId)
//       );

//       if (merchantSnapshots.length === 0) continue;

//       const snapshotStatus = merchantSnapshots[0]?.payoutStatus || 'pending';

//       const snapshotReferenceNo = merchantSnapshots[0]?.referenceNo || '';

//       const snapshotPaymentMethod = merchantSnapshots[0]?.paymentMethod || '';

//       const snapshotDepositedDate = merchantSnapshots[0]?.depositedDate || null;

//       for (const item of lineItems) {
//         const price = Number(item.price) || 0;
//         const qty = Number(item.quantity || item.current_quantity) || 0;

//         const total = price * qty;

//         const variantId = item.variantId || item.variant_id;

//         const listing = await listingModel.findOne({
//           'variants.id': String(variantId),
//         });

//         if (!listing || String(listing.userId) !== String(userId)) {
//           continue;
//         }

//         const cancelled = item.fulfillment_status === 'cancelled';

//         if (cancelled) {
//           refundAmount += total;
//         } else {
//           grossAmount += total;
//           commissionAmount += (total * commissionRate) / 100;
//         }

//         products.push({
//           title: item.title || '',
//           variantTitle: item.variant_title || '',
//           price,
//           quantity: qty,
//           total,
//           fulfillment_status: item.fulfillment_status || 'Unfulfilled',
//           cancelled,
//         });
//       }

//       if (products.length === 0) continue;

//       const netPayoutAmount = grossAmount - commissionAmount;

//       totalPayoutAmount += netPayoutAmount;

//       updates.push({
//         orderId: order.orderId,
//         shopifyOrderNo: order.shopifyOrderNo || 'N/A',
//         eligibleDate: order.eligibleDate,
//         scheduledPayoutDate: order.scheduledPayoutDate,

//         // ✅ STATUS FROM SNAPSHOT
//         payoutStatus:
//           snapshotStatus === 'Deposited'
//             ? 'Deposited'
//             : snapshotStatus === 'Due'
//               ? 'Due'
//               : 'Pending',

//         payoutAmount: netPayoutAmount,
//         refundAmount,
//         commissionAmount,
//         createdAt: order.createdAt,

//         // ✅ FROM SNAPSHOT
//         referenceNo: snapshotReferenceNo,
//         paymentMethod: snapshotPaymentMethod,
//         depositedDate: snapshotDepositedDate,

//         products,
//       });
//     }

//     // ================= GROUPING =================

//     const grouped = {};

//     updates.forEach((order) => {
//       const key = `${dayjs(order.scheduledPayoutDate).format(
//         'YYYY-MM-DD'
//       )}__${order.payoutStatus}`;

//       if (!grouped[key]) {
//         grouped[key] = {
//           payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
//           status: order.payoutStatus,
//           createdAts: [],
//           totalAmount: 0,
//           totalRefundAmount: 0,
//           orders: [],
//           sortKey: dayjs(order.scheduledPayoutDate).valueOf(),

//           referenceNo: order.referenceNo,
//           paymentMethod: order.paymentMethod,
//           depositedDate: order.depositedDate,
//         };
//       }

//       grouped[key].createdAts.push(dayjs(order.createdAt));

//       grouped[key].totalAmount += order.payoutAmount || 0;

//       grouped[key].totalRefundAmount += order.refundAmount || 0;

//       grouped[key].orders.push({
//         orderId: order.orderId,
//         shopifyOrderNo: order.shopifyOrderNo,
//         amount: order.payoutAmount,
//         refund: order.refundAmount,
//         commissionAmount: order.commissionAmount,
//         status: order.payoutStatus,
//         createdAt: order.createdAt,
//         referenceNo: order.referenceNo,
//         paymentMethod: order.paymentMethod,
//         depositedDate: order.depositedDate,
//         products: order.products || [],
//       });
//     });

//     let payouts = Object.values(grouped)
//       .map((group) => {
//         const minDate = dayjs.min(group.createdAts);
//         const maxDate = dayjs.max(group.createdAts);

//         return {
//           payoutDate: group.payoutDate,
//           transactionDates: `${minDate.format(
//             'MMM D'
//           )} – ${maxDate.format('MMM D, YYYY')}`,
//           status: group.status,
//           amount: `$${group.totalAmount.toFixed(2)} AUD`,
//           totalRefundAmount: `$${group.totalRefundAmount.toFixed(2)} AUD`,
//           orders: group.orders,
//           sortKey: group.sortKey,
//           referenceNo: group.referenceNo,
//           paymentMethod: group.paymentMethod,
//           depositedDate: group.depositedDate,
//         };
//       })
//       .sort((a, b) => {
//         const orderPriority = {
//           Pending: 1,
//           Due: 2,
//           Deposited: 3,
//         };

//         if (a.status !== b.status) {
//           return orderPriority[a.status] - orderPriority[b.status];
//         }

//         return b.sortKey - a.sortKey;
//       });

//     if (payoutDate && status) {
//       payouts = payouts.filter(
//         (p) =>
//           p.payoutDate === payoutDate &&
//           p.status.toLowerCase() === status.toLowerCase()
//       );
//     }

//     res.json({
//       message: 'Payouts calculated',
//       totalAmount: totalPayoutAmount,
//       payouts,
//       merchantAccount,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       error: 'Server error while calculating payouts',
//     });
//   }
// };

export const getPayoutOrders = async (req, res) => {
  try {
    const { payoutDate, status, userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const config = await PayoutConfig.findOne({});
    if (!config) {
      return res.status(400).json({ error: 'Payout config not found.' });
    }

    const merchant = await authModel.findById(userId);
    const merchantAccount = merchant
      ? {
        paypalAccount: merchant.paypalAccount || '',
        paypalAccountNo: merchant.paypalAccountNo || '',
        paypalReferenceNo: merchant.paypalReferenceNo || '',
        bankDetails: merchant.bankDetails || {},
      }
      : null;

    const commissionRate = Number(merchant?.comissionRate || 0);

    const orders = await orderModel.find({});

    const updates = [];
    let totalPayoutAmount = 0;

    for (const order of orders) {
      const createdAt = dayjs(order.createdAt);
      const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
      const payoutDateObj = getNextPayoutDate(eligibleDate.toDate(), config);

      order.eligibleDate = eligibleDate.toDate();
      order.scheduledPayoutDate = payoutDateObj.toDate();

      const lineItems = order.lineItems || [];
      const snapshots = order.ProductSnapshot || [];

      let grossAmount = 0;
      let refundAmount = 0;
      let commissionAmount = 0;
      const products = [];

      // 🔥 Find all snapshots of this merchant
      const merchantSnapshots = snapshots.filter(
        (snap) => String(snap.merchantId) === String(userId)
      );

      if (merchantSnapshots.length === 0) continue;

      // Use first snapshot for payout meta
      const snapshotStatus = merchantSnapshots[0].payoutStatus || 'pending';

      const snapshotReferenceNo = merchantSnapshots[0].payoutReferenceId || '';

      const snapshotPaymentMethod = merchantSnapshots[0].paymentMethod || '';

      const snapshotDepositedDate = merchantSnapshots[0].depositedDate || null;

      for (const item of lineItems) {
        const variantId = item.variantId || item.variant_id;

        // 🔥 Match snapshot by variantId
        const snapshot = merchantSnapshots.find(
          (snap) => String(snap.variantId) === String(variantId)
        );

        if (!snapshot) continue;

        const price = Number(item.price) || 0;
        const qty = Number(item.quantity || item.current_quantity) || 0;

        const total = price * qty;

        const cancelled = item.fulfillment_status === 'cancelled';

        if (cancelled) {
          refundAmount += total;
        } else {
          grossAmount += total;
          commissionAmount += (total * commissionRate) / 100;
        }

        products.push({
          title: item.title || '',
          variantTitle: item.variant_title || '',
          price,
          quantity: qty,
          total,
          fulfillment_status: item.fulfillment_status || 'Unfulfilled',
          cancelled,
        });
      }

      if (products.length === 0) continue;

      const netPayoutAmount = grossAmount - commissionAmount;
      totalPayoutAmount += netPayoutAmount;

      updates.push({
        orderId: order.orderId,
        shopifyOrderNo: order.shopifyOrderNo || 'N/A',
        eligibleDate: order.eligibleDate,
        scheduledPayoutDate: order.scheduledPayoutDate,

        payoutStatus:
          snapshotStatus === 'Deposited'
            ? 'Deposited'
            : snapshotStatus === 'Due'
              ? 'Due'
              : 'Pending',

        payoutAmount: netPayoutAmount,
        refundAmount,
        commissionAmount,
        createdAt: order.createdAt,

        referenceNo: snapshotReferenceNo,
        paymentMethod: snapshotPaymentMethod,
        depositedDate: snapshotDepositedDate,

        products,
      });
    }

    // ================= GROUPING =================

    const grouped = {};

    updates.forEach((order) => {
      const key = `${dayjs(order.scheduledPayoutDate).format(
        'YYYY-MM-DD'
      )}__${order.payoutStatus}`;

      if (!grouped[key]) {
        grouped[key] = {
          payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
          status: order.payoutStatus,
          createdAts: [],
          totalAmount: 0,
          totalRefundAmount: 0,
          orders: [],
          sortKey: dayjs(order.scheduledPayoutDate).valueOf(),

          referenceNo: order.referenceNo,
          paymentMethod: order.paymentMethod,
          depositedDate: order.depositedDate,
        };
      }

      grouped[key].createdAts.push(dayjs(order.createdAt));

      grouped[key].totalAmount += order.payoutAmount || 0;
      grouped[key].totalRefundAmount += order.refundAmount || 0;

      grouped[key].orders.push({
        orderId: order.orderId,
        shopifyOrderNo: order.shopifyOrderNo,
        amount: order.payoutAmount,
        refund: order.refundAmount,
        commissionAmount: order.commissionAmount,
        status: order.payoutStatus,
        createdAt: order.createdAt,
        referenceNo: order.referenceNo,
        paymentMethod: order.paymentMethod,
        depositedDate: order.depositedDate,
        products: order.products || [],
      });
    });

    let payouts = Object.values(grouped)
      .map((group) => {
        const minDate = dayjs.min(group.createdAts);
        const maxDate = dayjs.max(group.createdAts);

        return {
          payoutDate: group.payoutDate,
          transactionDates: `${minDate.format(
            'MMM D'
          )} – ${maxDate.format('MMM D, YYYY')}`,
          status: group.status,
          amount: `$${group.totalAmount.toFixed(2)} AUD`,
          totalRefundAmount: `$${group.totalRefundAmount.toFixed(2)} AUD`,
          orders: group.orders,
          sortKey: group.sortKey,
          referenceNo: group.referenceNo,
          paymentMethod: group.paymentMethod,
          depositedDate: group.depositedDate,
        };
      })
      .sort((a, b) => {
        const orderPriority = {
          Pending: 1,
          Due: 2,
          Deposited: 3,
        };

        if (a.status !== b.status) {
          return orderPriority[a.status] - orderPriority[b.status];
        }

        return b.sortKey - a.sortKey;
      });

    if (payoutDate && status) {
      payouts = payouts.filter(
        (p) =>
          p.payoutDate === payoutDate &&
          p.status.toLowerCase() === status.toLowerCase()
      );
    }

    res.json({
      message: 'Payouts calculated',
      totalAmount: totalPayoutAmount,
      payouts,
      merchantAccount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error while calculating payouts',
    });
  }
};

export const getPayoutForAllOrders = async (req, res) => {
  try {
    const { payoutDate, status } = req.query;

    const config = await PayoutConfig.findOne({});
    if (!config) {
      return res.status(400).json({ error: 'Payout config not found.' });
    }

    const orders = await orderModel.find({});
    const updates = [];
    let totalPayoutAmount = 0;

    const allUserIds = new Set();
    const grouped = {};

    // 🔹 FIRST PASS: collect all merchantIds
    orders.forEach((order) => {
      (order.lineItems || []).forEach((item) => {
        if (item.variant_id) {
          allUserIds.add(String(item.variant_id));
        }
      });
    });

    // 🔹 FETCH MERCHANTS WITH COMMISSION
    const merchants = await authModel
      .find({})
      .select('_id comissionRate referenceNo paypalAccount bankDetails');

    const merchantMap = {};
    merchants.forEach((m) => {
      merchantMap[m._id.toString()] = {
        commissionRate: Number(m.comissionRate || 0),
        referenceNo: m.referenceNo || '',
        paypalAccount: m.paypalAccount || '',
        bankDetails: m.bankDetails || {},
      };
    });

    // ================= PROCESS ORDERS =================
    for (const order of orders) {
      const createdAt = dayjs(order.createdAt);

      if (!order.scheduledPayoutDate || !order.eligibleDate) {
        const eligibleDate = createdAt.add(config.graceTime ?? 7, 'day');
        const payoutDateObj = getNextPayoutDate(eligibleDate.toDate(), config);

        order.eligibleDate ??= eligibleDate.toDate();
        order.scheduledPayoutDate ??= payoutDateObj.toDate();
      }

      const lineItems = order.lineItems ?? [];
      let netPayoutAmount = 0;
      let refundAmount = 0;
      const products = [];

      for (const item of lineItems) {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity || item.current_quantity) || 0;
        const gross = price * qty;
        const cancelled = item.fulfillment_status === 'cancelled';

        let userId = null;
        let commissionRate = 0;

        if (item.variant_id) {
          const listing = await listingModel
            .findOne({ 'variants.id': String(item.variant_id) })
            .select('userId');

          userId = listing?.userId?.toString() || null;

          if (userId && merchantMap[userId]) {
            commissionRate = merchantMap[userId].commissionRate;
          }
        }

        const commissionAmount = cancelled ? 0 : (gross * commissionRate) / 100;

        const netAmount = cancelled ? 0 : gross - commissionAmount;

        if (cancelled) {
          refundAmount += gross;
        } else {
          netPayoutAmount += netAmount;
        }

        products.push({
          title: item.title || '',
          variantTitle: item.variant_title || '',
          price,
          quantity: qty,
          total: gross,
          commissionRate,
          commissionAmount,
          netAmount,
          fulfillment_status: item.fulfillment_status || 'Unfulfilled',
          cancelled,
          userId,
        });
      }

      order.payoutAmount = netPayoutAmount; // ✅ NET
      order.refundAmount = refundAmount;
      await order.save();

      totalPayoutAmount += netPayoutAmount;

      updates.push({
        orderId: order.orderId,
        shopifyOrderNo: order.shopifyOrderNo || 'N/A',
        eligibleDate: order.eligibleDate,
        scheduledPayoutDate: order.scheduledPayoutDate,
        payoutStatus: order.payoutStatus || 'pending',
        payoutAmount: netPayoutAmount, // ✅ NET
        refundAmount,
        createdAt: order.createdAt,
        products,
        referenceNo: order.referenceNo || '',
        paymentMethod: order.paymentMethod || '',
        depositedDate: order.depositedDate || null,
      });
    }

    // ================= GROUPING (UNCHANGED) =================
    updates.forEach((order) => {
      const key = `${dayjs(order.scheduledPayoutDate).format(
        'YYYY-MM-DD'
      )}__${order.payoutStatus}`;

      if (!grouped[key]) {
        grouped[key] = {
          payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
          status: order.payoutStatus,
          createdAts: [],
          totalAmount: 0,
          totalRefundAmount: 0,
          orders: [],
          sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
          referenceNo: order.referenceNo || '',
          paymentMethod: order.paymentMethod || '',
          depositedDate: order.depositedDate || null,
        };
      }

      grouped[key].createdAts.push(dayjs(order.createdAt));
      grouped[key].totalAmount += order.payoutAmount || 0;
      grouped[key].totalRefundAmount += order.refundAmount || 0;

      grouped[key].orders.push({
        orderId: order.orderId,
        shopifyOrderNo: order.shopifyOrderNo,
        amount: order.payoutAmount, // ✅ NET
        refund: order.refundAmount,
        status: order.payoutStatus,
        createdAt: order.createdAt,
        products: order.products || [],
      });
    });

    let payouts = Object.values(grouped)
      .map((group) => {
        const minDate = dayjs.min(group.createdAts);
        const maxDate = dayjs.max(group.createdAts);
        return {
          payoutDate: group.payoutDate,
          transactionDates: `${minDate.format(
            'MMM D'
          )} – ${maxDate.format('MMM D, YYYY')}`,
          status: group.status,
          amount: `$${group.totalAmount.toFixed(2)} AUD`,
          totalRefundAmount: `$${group.totalRefundAmount.toFixed(2)} AUD`,
          orders: group.orders,
          sortKey: group.sortKey,
          referenceNo: group.referenceNo,
          paymentMethod: group.paymentMethod,
          depositedDate: group.depositedDate,
        };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
        return b.sortKey - a.sortKey;
      });

    if (payoutDate && status) {
      payouts = payouts.filter(
        (p) =>
          p.payoutDate === payoutDate &&
          p.status.toLowerCase() === status.toLowerCase()
      );
    }

    res.json({
      message: 'Payouts calculated',
      totalAmount: totalPayoutAmount,
      payouts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while calculating payouts' });
  }
};

export const updateTrackingInShopify = async (req, res) => {
  try {
    const { fulfillmentId, tracking_number, tracking_company } = req.body;

    if (!fulfillmentId || !tracking_number || !tracking_company) {
      return res.status(400).json({
        error:
          'Missing required fields: fulfillmentId, tracking_number, tracking_company',
      });
    }

    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

    const endpoint = `${shopifyStoreUrl}/admin/api/2024-01/fulfillments/${fulfillmentId}/update_tracking.json`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopifyAccessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fulfillment: {
          tracking_info: {
            number: tracking_number,
            company: tracking_company,
          },
          notify_customer: true,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: 'Shopify API error',
        details: data,
      });
    }

    return res.status(200).json({
      message: '✅ Tracking info updated in Shopify',
      data,
    });
  } catch (error) {
    console.error('❌ Server Error:', error);
    return res.status(500).json({
      error: 'Server error while updating tracking info.',
    });
  }
};
export const cancelShopifyOrder = async (req, res) => {
  try {
    const { orderId, reason, lineItemIds } = req.body;
    console.log('📩 Incoming cancel request for Order ID:', orderId);
    console.log('🔢 Line Item IDs to cancel:', lineItemIds);

    if (!orderId || !Array.isArray(lineItemIds)) {
      console.warn('⚠️ Missing required cancel params');
      return res.status(400).json({
        error: 'Shopify Order ID and lineItemIds array are required.',
      });
    }

    const config = await shopifyConfigurationModel.findOne();
    if (!config) {
      console.error('❌ Shopify configuration not found');
      return res.status(404).json({ error: 'Shopify config not found.' });
    }

    const { shopifyAccessToken, shopifyStoreUrl } = config;
    console.log('🔐 Shopify credentials loaded');

    const cancelEndpoint = `${shopifyStoreUrl}/admin/api/2024-01/orders/${orderId}/cancel.json`;
    console.log('🌐 Shopify cancel endpoint:', cancelEndpoint);

    const cancelRes = await fetch(cancelEndpoint, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopifyAccessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: true,
        reason: reason || 'customer',
      }),
    });

    const cancelData = await cancelRes.json();
    console.log('🛒 Shopify Cancel Response:', cancelData);

    if (!cancelRes.ok) {
      console.error('❌ Shopify cancel failed:', cancelData);
      return res.status(500).json({
        error: 'Failed to cancel order in Shopify',
        details: cancelData,
      });
    }

    const dbOrder = await orderModel.findOne({ orderId });
    if (!dbOrder) {
      console.error('❌ Order not found in DB');
      return res.status(404).json({ error: 'Order not found in DB' });
    }

    const normalizedLineItemIds = lineItemIds.map((id) => String(id));
    console.log('✅ Normalized Line Item IDs:', normalizedLineItemIds);

    dbOrder.lineItems = dbOrder.lineItems.map((item) => {
      const isMatch = normalizedLineItemIds.includes(String(item.id));
      if (isMatch) console.log(`✅ Cancelling lineItem ID: ${item.id}`);
      return {
        ...item,
        fulfillment_status: isMatch ? 'cancelled' : item.fulfillment_status,
      };
    });

    dbOrder.cancelledAt = new Date();

    await dbOrder.save();
    console.log('💾 DB updated successfully');

    return res.status(200).json({
      message:
        'Order cancelled in Shopify. Selected line items marked as cancelled.',
      shopifyStatus: cancelData.order.financial_status,
      updatedLineItems: normalizedLineItemIds,
      orderId,
      cancelledAt: dbOrder.cancelledAt,
    });
  } catch (err) {
    console.error('❌ Cancel Order Error:', err);
    return res
      .status(500)
      .json({ error: 'Server error while canceling order.' });
  }
};

export const cancelFulfillment = async (req, res) => {
  try {
    const { fulfillmentId } = req.body;

    if (!fulfillmentId) {
      return res.status(400).json({ error: 'Fulfillment ID is required.' });
    }

    const config = await shopifyConfigurationModel.findOne();
    if (!config) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyAccessToken, shopifyStoreUrl } = config;

    const cancelFulfillmentUrl = `${shopifyStoreUrl}/admin/api/2024-01/fulfillments/${fulfillmentId}/cancel.json`;

    const cancelRes = await fetch(cancelFulfillmentUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopifyAccessToken,
        'Content-Type': 'application/json',
      },
    });

    const cancelData = await cancelRes.json();

    if (!cancelRes.ok) {
      return res.status(500).json({
        error: 'Failed to cancel fulfillment in Shopify',
        details: cancelData,
      });
    }

    // Optional: update local DB if needed
    // await orderModel.updateOne({ fulfillmentId }, { $set: { fulfillment_status: 'cancelled' } });

    return res.status(200).json({
      message: '✅ Fulfillment cancelled successfully',
      data: cancelData,
    });
  } catch (error) {
    console.error('❌ Cancel Fulfillment Error:', error);
    return res
      .status(500)
      .json({ error: 'Server error while canceling fulfillment.' });
  }
};

export const getLineItemCountByShopifyOrderId = async (req, res) => {
  try {
    const { shopifyOrderId } = req.params;

    if (!shopifyOrderId) {
      return res.status(400).json({ message: 'Missing order ID' });
    }

    const order = await orderModel.findOne({ orderId: shopifyOrderId });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const lineItems = order.lineItems || [];

    const variantIds = lineItems
      .map((item) => item.variant_id)
      .filter((id) => id !== undefined && id !== null);

    return res.status(200).json({
      shopifyOrderId,
      lineItemCount: variantIds.length,
      variantIds,
    });
  } catch (err) {
    console.error('Error in getLineItem:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAllRequestsGroupedByUser = async (req, res) => {
  try {
    const groupedData = await orderRquestModel.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $unwind: '$userDetails',
      },
      {
        $group: {
          _id: '$userId',
          firstName: { $first: '$userDetails.firstName' },
          lastName: { $first: '$userDetails.lastName' },
          email: { $first: '$userDetails.email' },
          requestCount: { $sum: 1 },
          requests: {
            $push: {
              _id: '$_id',
              orderId: '$orderId',
              orderNo: '$orderNo',
              request: '$request',
              productNames: '$productNames',
              createdAt: '$createdAt',
            },
          },
        },
      },
      {
        $sort: { requestCount: -1 },
      },
    ]);

    return res.status(200).json({
      success: true,
      totalUsers: groupedData.length,
      data: groupedData,
    });
  } catch (error) {
    console.error('Error in getAllRequestsGroupedByUser:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

export const getRequestById = async (req, res) => {
  const { id } = req.params;

  try {
    const request = await orderRquestModel.findById(id).lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'No request found with this ID.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: request.orderId,
        orderNo: request.orderNo,
        request: request.request,
        productNames: request.productNames,
        createdAt: request.createdAt,
        userId: request.userId,
      },
    });
  } catch (error) {
    console.error('Error in getRequestById:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'aydimarketplace@gmail.com',
    pass: 'ijeg fypl llry kftw', // app password
  },
  secure: true,
  tls: {
    rejectUnauthorized: false,
  },
});

export const addReferenceToOrders = async (req, res) => {
  try {
    const { payoutDate, referenceNo, paymentMethod, merchantIds } = req.body;

    const depositDate = new Date();
    let modifiedCount = 0;

    // 🔥 Find only orders of that payout date
    const orders = await orderModel.find({
      scheduledPayoutDate: new Date(payoutDate),
    });

    for (const order of orders) {
      let isUpdated = false;

      for (const snapshot of order.ProductSnapshot || []) {
        if (merchantIds.includes(snapshot.merchantId?.toString())) {
          snapshot.payoutStatus = 'Deposited';
          snapshot.referenceNo = referenceNo;
          snapshot.paymentMethod = paymentMethod;
          snapshot.depositedDate = depositDate;
          isUpdated = true;
        }
      }

      if (isUpdated) {
        await order.save();
        modifiedCount++;
      }
    }

    if (modifiedCount === 0) {
      return res.status(404).json({
        message: 'No matching merchant payouts found.',
      });
    }

    // ================= SEND EMAIL (ALWAYS SEND NOW) =================

    const merchants = await authModel.find(
      { _id: { $in: merchantIds } },
      'email firstName'
    );

    for (const merchant of merchants) {
      if (!merchant.email) continue;

      const mailOptions = {
        from: `"AYDI Marketplace" <${process.env.EMAIL_USER}>`,
        to: merchant.email,
        subject: 'Your payout has been deposited',
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Hello ${merchant.firstName || 'Merchant'},</h2>
            <p>Your payout has been <strong>successfully deposited</strong>.</p>
            <p><strong>Reference Number:</strong> ${referenceNo}</p>
            <p><strong>Payment Method:</strong> ${paymentMethod}</p>
            <p><strong>Deposited Date:</strong> ${depositDate.toDateString()}</p>
            <br/>
            <p>Regards,<br/><strong>AYDI Marketplace Team</strong></p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions).catch((err) => {
        console.error(`Email failed for ${merchant.email}`, err);
      });
    }

    res.status(200).json({
      message: 'Selected merchant payouts marked as Deposited.',
      modifiedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const exportOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const orders = await orderModel.find({}).lean();

    if (!orders.length) {
      return res.status(404).json({ message: 'No orders found' });
    }

    const rows = [];

    for (const order of orders) {
      const base = {
        OrderID: order.orderId || '',
        ShopifyOrderNo: order.shopifyOrderNo || '',
        SerialNumber: order.serialNumber || '',
        PayoutAmount: order.payoutAmount || '',
        PayoutStatus: order.payoutStatus || '',
        EligiblePayoutDate: order.eligibleDate
          ? new Date(order.eligibleDate).toLocaleDateString()
          : '',
        ScheduledPayoutDate: order.scheduledPayoutDate
          ? new Date(order.scheduledPayoutDate).toLocaleDateString()
          : '',
        OrderCreatedAt: order.createdAt
          ? new Date(order.createdAt).toLocaleString()
          : '',
        OrderUpdatedAt: order.updatedAt
          ? new Date(order.updatedAt).toLocaleString()
          : '',
        CustomerEmail: order.customer?.email || '',
        CustomerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`,
        CustomerPhone: order.customer?.phone || '',
        CustomerCreated: order.customer?.created_at || '',
      };
      const today = dayjs();
      const payoutDay = dayjs(order.scheduledPayoutDate);

      if (order.payoutStatus !== 'Deposited') {
        if (today.isBefore(payoutDay, 'day')) {
          order.payoutStatus = 'Pending';
        } else {
          order.payoutStatus = 'Due';
        }
      }

      if (Array.isArray(order.lineItems)) {
        for (const item of order.lineItems) {
          const itemStatus = item.fulfillment_status || 'unfulfilled';

          if (status && status !== itemStatus) continue;

          rows.push({
            ...base,
            LineItemID: item.id || '',
            ProductName: item.name || '',
            SKU: item.sku || '',
            Vendor: item.vendor || '',
            Quantity: item.quantity || '',
            Price: item.price || '',
            FulfillmentStatus: itemStatus,
            VariantTitle: item.variant_title || '',
            ProductID: item.product_id || '',
            VariantID: item.variant_id || '',
          });
        }
      } else {
        if (!status) rows.push(base);
      }
    }

    if (!rows.length) {
      return res
        .status(404)
        .json({ message: 'No matching orders found for the selected filter' });
    }

    const fields = Object.keys(rows[0]);
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    const filename = `orders-export-${Date.now()}.csv`;
    const isVercel = process.env.VERCEL === '1';
    const exportDir = isVercel ? '/tmp' : path.join(process.cwd(), 'exports');

    if (!isVercel && !fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, filename);
    fs.writeFileSync(filePath, csv);

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).send('Error downloading file');
      }
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error('Export Orders Error:', error);
    res.status(500).json({
      message: 'Server error during export.',
      error: error.message,
    });
  }
};

export const exportProductsForUser = async (req, res) => {
  try {
    const userId = req.userId?.toString();
    console.log('🔹 UserId from request:', userId);

    if (!userId) {
      console.log('❌ Missing userId in request');
      return res.status(400).json({ message: 'Missing userId' });
    }

    console.log(`🔹 Fetching orders directly from DB for userId: ${userId}`);

    // ✅ Orders DB se lao (assume aapka model ka naam orderModel hai)
    const orders = await orderModel.find({});
    console.log('🔹 Total orders fetched:', orders.length);

    const rows = [];

    for (const order of orders) {
      console.log('➡️ Checking order:', order.orderId);

      const {
        orderId,
        shopifyOrderNo,
        serialNumber,
        payoutAmount,
        payoutStatus,
        createdAt,
        updatedAt,
        eligibleDate,
        scheduledPayoutDate,
        customer,
        lineItems = [],
      } = order;

      for (const item of lineItems) {
        // ✅ Product check
        const product = await listingModel.findOne({ id: item.product_id });

        if (!product) {
          console.log(
            `⚠️ Product not found for product_id: ${item.product_id}`
          );
          continue;
        }

        if (product.userId?.toString() !== userId) {
          console.log(
            `⚠️ Product ${item.product_id} does not belong to user ${userId}`
          );
          continue;
        }

        rows.push({
          OrderID: orderId,
          ShopifyOrderNo: shopifyOrderNo,
          SerialNumber: serialNumber,
          ProductName: item.name || '',
          SKU: item.sku || '',
          Vendor: item.vendor || '',
          Price: item.price || '',
          Quantity: item.quantity || '',
          FulfillmentStatus: item.fulfillment_status || 'unfulfilled',
          VariantTitle: item.variant_title || '',
          ProductID: item.product_id || '',
          VariantID: item.variant_id || '',
          PayoutAmount: payoutAmount || '',
          PayoutStatus: payoutStatus || '',
          EligiblePayoutDate: eligibleDate
            ? new Date(eligibleDate).toLocaleDateString()
            : '',
          ScheduledPayoutDate: scheduledPayoutDate
            ? new Date(scheduledPayoutDate).toLocaleDateString()
            : '',
          OrderCreatedAt: createdAt ? new Date(createdAt).toLocaleString() : '',
          OrderUpdatedAt: updatedAt ? new Date(updatedAt).toLocaleString() : '',
          CustomerEmail: customer?.email || '',
          CustomerName: `${customer?.first_name || ''} ${customer?.last_name || ''}`,
          CustomerPhone: customer?.phone || '',
          CustomerCreated: customer?.created_at || '',
          CustomerCity: customer?.default_address?.city || '',
          CustomerCountry: customer?.default_address?.country || '',
        });
      }
    }

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'No products found in orders for this user.' });
    }

    const fields = Object.keys(rows[0]);
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    const filename = `export-user-${userId}-${Date.now()}.csv`;
    const isVercel = process.env.VERCEL === '1';
    const exportDir = isVercel ? '/tmp' : path.join(process.cwd(), 'exports');

    if (!isVercel && !fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, filename);
    fs.writeFileSync(filePath, csv);

    res.download(filePath, filename, (err) => {
      if (err) {
        res.status(500).send('Download failed');
      } else {
        console.log('✅ File download initiated:', filename);
      }
      fs.unlinkSync(filePath);
      console.log('🗑️ Temp file deleted:', filePath);
    });
  } catch (err) {
    res.status(500).json({ message: 'Export failed', error: err.message });
  }
};

export const getPendingOrder = async (req, res) => {
  try {
    const orders = await orderModel.aggregate([
      {
        $match: { payoutStatus: 'pending' },
      },
      {
        $project: {
          month: { $month: '$createdAt' },
          year: { $year: '$createdAt' },
          payoutAmount: 1,
        },
      },
      {
        $group: {
          _id: { month: '$month', year: '$year' },
          totalPayoutAmount: { $sum: '$payoutAmount' },
          totalOrders: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.month': 1 },
      },
      {
        $project: {
          month: '$_id.month',
          totalPayoutAmount: 1,
          totalOrders: 1,
          _id: 0,
        },
      },
    ]);

    const formattedData = orders.map((order) => ({
      month: getMonthName(order.month),
      series1: order.totalOrders,
      series2: order.totalPayoutAmount,
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching pending orders: ', error);
    res.status(500).json({ message: 'Server error' });
  }
};

function getMonthName(month) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return months[month - 1];
}

export const getSalesContribution = async (req, res) => {
  try {
    console.log('Fetching sales data for all products.');

    const salesData = await orderModel.aggregate([
      {
        $unwind: '$lineItems',
      },
      {
        $addFields: {
          price: { $toDouble: '$lineItems.price' },
          quantity: { $toInt: '$lineItems.quantity' },
        },
      },
      {
        $group: {
          _id: '$lineItems.product_id',
          totalSales: { $sum: { $multiply: ['$price', '$quantity'] } },
          productName: { $first: '$lineItems.name' },
        },
      },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: 1,
          totalSales: 1,
        },
      },
      { $sort: { totalSales: -1 } },
    ]);

    if (salesData.length === 0) {
      return res.json([]);
    }

    const formattedData = salesData.map((item) => ({
      productName: item.productName,
      totalSales: item.totalSales,
    }));

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching sales data: ', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// export const getMonthlyRevenue = async (req, res) => {
//   try {
//     const allOrders = await orderModel.find({});

//     const revenueByMonth = {};

//     for (const order of allOrders) {
//       for (const item of order.lineItems || []) {
//         const variantId = item.variant_id?.toString();

//         if (!variantId) {
//           continue;
//         }

//         const orderDate = new Date(order.createdAt);
//         const monthKey = `${orderDate.getFullYear()}-${(
//           orderDate.getMonth() + 1
//         )
//           .toString()
//           .padStart(2, '0')}`;

//         const lineRevenue = parseFloat(item.price || 0) * (item.quantity || 1);

//         if (!revenueByMonth[monthKey]) {
//           revenueByMonth[monthKey] = 0;
//         }
//         revenueByMonth[monthKey] += lineRevenue;
//       }
//     }

//     if (Object.keys(revenueByMonth).length > 0) {
//       return res.status(200).json({
//         message: 'Monthly revenue calculated for all users',
//         revenue: revenueByMonth,
//       });
//     } else {
//       return res.status(404).json({ message: 'No revenue data found' });
//     }
//   } catch (error) {
//     res.status(500).json({ message: 'Internal Server Error' });
//   }
// };

export const getMonthlyRevenue = async (req, res) => {
  try {
    console.log('🚀 getMonthlyRevenue API hit');

    const allOrders = await orderModel.find({});
    console.log('📦 Total Orders:', allOrders.length);

    const revenueByMonth = {};

    for (const order of allOrders) {
      const orderDate = new Date(order.createdAt);

      const monthKey = `${orderDate.getFullYear()}-${(orderDate.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;

      const snapshots = order.ProductSnapshot || [];

      console.log(
        `\n🧾 Processing Order: ${order.orderId} | Snapshots: ${snapshots.length}`
      );

      for (const snap of snapshots) {
        if (!snap.variantId) {
          console.log('⛔ Skipped snapshot: No variantId');
          continue;
        }

        const price =
          parseFloat(snap.variant?.price || 0) ||
          parseFloat(snap.product?.variants?.[0]?.price || 0);

        const quantity = snap.quantity || 1;

        const lineRevenue = price * quantity;

        if (!revenueByMonth[monthKey]) {
          revenueByMonth[monthKey] = 0;
        }

        revenueByMonth[monthKey] += lineRevenue;

        console.log(`💰 Added Revenue: ${lineRevenue} | Month: ${monthKey}`);
      }
    }

    if (Object.keys(revenueByMonth).length > 0) {
      console.log('✅ Monthly revenue calculated');

      return res.status(200).json({
        message: 'Monthly revenue calculated for all users',
        revenue: revenueByMonth,
      });
    } else {
      console.log('❌ No revenue data found');
      return res.status(404).json({ message: 'No revenue data found' });
    }
  } catch (error) {
    console.error('❌ getMonthlyRevenue error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


// export const createRefund = async (req, res) => {
//   try {
//     const {
//       orderId,
//       merchantId,
//       refundItems = [],
//       reason = '',
//       restock = true,
//       refundShipping = false,
//       shippingAmount = 0,
//       notifyCustomer = true,
//     } = req.body;

//     if (!orderId) {
//       return res.status(400).json({
//         success: false,
//         message: 'orderId is required',
//       });
//     }

//     if (!Array.isArray(refundItems)) {
//       return res.status(400).json({
//         success: false,
//         message: 'refundItems must be an array',
//       });
//     }

//     if (refundItems.length === 0 && !refundShipping) {
//       return res.status(400).json({
//         success: false,
//         message: 'Select at least one item or shipping to refund',
//       });
//     }

//     const order = await orderModel.findOne({
//       orderId: String(orderId),
//     });

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: 'Order not found in database',
//       });
//     }

//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();

//     if (!shopifyConfiguration) {
//       return res.status(404).json({
//         success: false,
//         message: 'Shopify configuration not found',
//       });
//     }

//     const {
//       shopifyApiKey,
//       shopifyAccessToken,
//       shopifyStoreUrl,
//     } = shopifyConfiguration;

//     const shopifyOrderId = order.orderId;

//     const orderLineItems = Array.isArray(order.lineItems)
//       ? order.lineItems
//       : [];

//     const existingRefunds = Array.isArray(order.refunds)
//       ? order.refunds
//       : [];

//     const refundLineItems = [];
//     const refundItemsForDb = [];

//     for (const refundItem of refundItems) {
//       const {
//         lineItemId,
//         productId,
//         variantId,
//         quantity,
//       } = refundItem;

//       if (!lineItemId || !quantity || Number(quantity) <= 0) {
//         return res.status(400).json({
//           success: false,
//           message: 'Each refund item must have lineItemId and valid quantity',
//         });
//       }

//       const matchedLineItem = orderLineItems.find((item) => {
//         const itemLineItemId =
//           item.id ||
//           item.lineItemId ||
//           item.line_item_id;

//         return String(itemLineItemId) === String(lineItemId);
//       });

//       if (!matchedLineItem) {
//         return res.status(404).json({
//           success: false,
//           message: `Line item not found: ${lineItemId}`,
//         });
//       }

//       const orderedQty = Number(matchedLineItem.quantity || 0);

//       const alreadyRefundedQty = existingRefunds.reduce((total, refund) => {
//         const refundedItem = refund.refundItems?.find(
//           (item) => String(item.lineItemId) === String(lineItemId)
//         );

//         return total + Number(refundedItem?.quantity || 0);
//       }, 0);

//       const remainingRefundableQty = orderedQty - alreadyRefundedQty;

//       if (Number(quantity) > remainingRefundableQty) {
//         return res.status(400).json({
//           success: false,
//           message: `Only ${remainingRefundableQty} quantity is refundable for line item ${lineItemId}`,
//         });
//       }

//       const itemPrice = Number(
//         matchedLineItem.price ||
//           matchedLineItem.variant?.price ||
//           matchedLineItem.product?.price ||
//           0
//       );

//       const itemRefundAmount = itemPrice * Number(quantity);

//       refundLineItems.push({
//         line_item_id: Number(lineItemId),
//         quantity: Number(quantity),
//         restock_type: restock ? 'cancel' : 'no_restock',
//       });

//       refundItemsForDb.push({
//         productId: String(productId || matchedLineItem.product_id || ''),
//         variantId: String(variantId || matchedLineItem.variant_id || ''),
//         lineItemId: String(lineItemId),
//         quantity: Number(quantity),
//         amount: Number(itemRefundAmount.toFixed(2)),
//       });
//     }

//     const calculatePayload = {
//       refund: {},
//     };

//     if (refundLineItems.length > 0) {
//       calculatePayload.refund.refund_line_items = refundLineItems;
//     }

//     if (refundShipping) {
//       calculatePayload.refund.shipping = {
//         amount: Number(shippingAmount || 0).toFixed(2),
//       };
//     }

//     if (order?.currency) {
//       calculatePayload.refund.currency = order.currency;
//     }

//     const calculateResponse = await shopifyRequest(
//       `${shopifyStoreUrl}/admin/api/2024-01/orders/${shopifyOrderId}/refunds/calculate.json`,
//       'POST',
//       calculatePayload,
//       shopifyApiKey,
//       shopifyAccessToken
//     );

//     if (!calculateResponse?.refund) {
//       return res.status(400).json({
//         success: false,
//         message: 'Refund calculation failed',
//         data: calculateResponse,
//       });
//     }

//     const calculatedRefund = calculateResponse.refund;

//     const transactions = (calculatedRefund.transactions || []).map(
//       (transaction) => ({
//         ...transaction,
//         kind: 'refund',
//       })
//     );

//     if (!transactions.length) {
//       return res.status(400).json({
//         success: false,
//         message: 'No refundable transaction found',
//         data: calculatedRefund,
//       });
//     }

//     const createRefundPayload = {
//       refund: {
//         notify: notifyCustomer,
//         note: reason || 'Refund created from marketplace',
//         refund_line_items: calculatedRefund.refund_line_items || [],
//         transactions,
//       },
//     };

//     if (order?.currency) {
//       createRefundPayload.refund.currency = order.currency;
//     }

//     if (refundShipping && calculatedRefund.shipping) {
//       createRefundPayload.refund.shipping = {
//         amount: Number(shippingAmount || 0).toFixed(2),
//       };
//     }

//     const refundResponse = await shopifyRequest(
//       `${shopifyStoreUrl}/admin/api/2024-01/orders/${shopifyOrderId}/refunds.json`,
//       'POST',
//       createRefundPayload,
//       shopifyApiKey,
//       shopifyAccessToken
//     );

//     const shopifyRefund = refundResponse?.refund;

//     const transactionRefundAmount = (shopifyRefund?.transactions || []).reduce(
//       (total, transaction) => {
//         return total + Number(transaction.amount || 0);
//       },
//       0
//     );

//     const fallbackRefundAmount =
//       refundItemsForDb.reduce((total, item) => total + Number(item.amount || 0), 0) +
//       (refundShipping ? Number(shippingAmount || 0) : 0);

//     const finalRefundAmount =
//       transactionRefundAmount > 0
//         ? transactionRefundAmount
//         : fallbackRefundAmount;

//     await orderModel.updateOne(
//       { orderId: String(orderId) },
//       {
//         $push: {
//           refunds: {
//             refundId: String(shopifyRefund?.id || ''),
//             status: 'success',
//             refundItems: refundItemsForDb,
//             shippingRefunded: Boolean(refundShipping),
//             shippingAmount: refundShipping ? Number(shippingAmount || 0) : 0,
//             refundAmount: Number(finalRefundAmount.toFixed(2)),
//             reason,
//             restock,
//             notifyCustomer,
//             shopifyRefund: shopifyRefund || {},
//             refundedAt: new Date(),
//           },
//         },
//       }
//     );

//     return res.status(200).json({
//       success: true,
//       message: 'Refund created successfully',
//       refund: shopifyRefund,
//       calculatedRefund,
//       savedRefund: {
//         refundId: String(shopifyRefund?.id || ''),
//         refundItems: refundItemsForDb,
//         shippingRefunded: Boolean(refundShipping),
//         shippingAmount: refundShipping ? Number(shippingAmount || 0) : 0,
//         refundAmount: Number(finalRefundAmount.toFixed(2)),
//       },
//     });
//   } catch (error) {
//     console.error('Create Refund Error:', error);

//     return res.status(500).json({
//       success: false,
//       message: 'Failed to create refund',
//       error: error?.message,
//       details: error?.response?.data || null,
//     });
//   }
// };


export const createRefund = async (req, res) => {
  try {
    const {
      orderId,
      merchantId,
      refundItems = [],
      reason = '',
      restock = true,
      refundShipping = false,
      shippingAmount = 0,
      notifyCustomer = true,
    } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'orderId is required',
      });
    }

    if (!Array.isArray(refundItems)) {
      return res.status(400).json({
        success: false,
        message: 'refundItems must be an array',
      });
    }

    if (refundItems.length === 0 && !refundShipping) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one item or shipping to refund',
      });
    }

    const order = await orderModel.findOne({
      orderId: String(orderId),
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found in database',
      });
    }

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();

    if (!shopifyConfiguration) {
      return res.status(404).json({
        success: false,
        message: 'Shopify configuration not found',
      });
    }

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    const shopifyOrderId = order.orderId;

    const orderLineItems = Array.isArray(order.lineItems)
      ? order.lineItems
      : [];

    const existingRefunds = Array.isArray(order.refunds)
      ? order.refunds
      : [];

    const refundLineItems = [];
    const refundItemsForDb = [];

    for (const refundItem of refundItems) {
      const { lineItemId, productId, variantId, quantity } = refundItem;

      if (!lineItemId || !quantity || Number(quantity) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Each refund item must have lineItemId and valid quantity',
        });
      }

      const matchedLineItem = orderLineItems.find((item) => {
        const itemLineItemId = item.id || item.lineItemId || item.line_item_id;

        return String(itemLineItemId) === String(lineItemId);
      });

      if (!matchedLineItem) {
        return res.status(404).json({
          success: false,
          message: `Line item not found: ${lineItemId}`,
        });
      }

      const orderedQty = Number(matchedLineItem.quantity || 0);

      const alreadyRefundedQty = existingRefunds.reduce((total, refund) => {
        const matchedRefundItems = (refund.refundItems || []).filter(
          (item) => String(item.lineItemId) === String(lineItemId)
        );

        const qty = matchedRefundItems.reduce((sum, item) => {
          return sum + Number(item.quantity || 0);
        }, 0);

        return total + qty;
      }, 0);

      const remainingRefundableQty = orderedQty - alreadyRefundedQty;

      if (Number(quantity) > remainingRefundableQty) {
        return res.status(400).json({
          success: false,
          message: `Only ${remainingRefundableQty} quantity is refundable for line item ${lineItemId}`,
        });
      }

      const itemPrice = Number(
        matchedLineItem.price ||
        matchedLineItem.variant?.price ||
        matchedLineItem.product?.price ||
        0
      );

      const itemRefundAmount = itemPrice * Number(quantity);

      refundLineItems.push({
        line_item_id: Number(lineItemId),
        quantity: Number(quantity),
        restock_type: restock ? 'cancel' : 'no_restock',
      });

      refundItemsForDb.push({
        productId: String(productId || matchedLineItem.product_id || ''),
        variantId: String(variantId || matchedLineItem.variant_id || ''),
        lineItemId: String(lineItemId),
        quantity: Number(quantity),
        amount: Number(itemRefundAmount.toFixed(2)),
      });
    }

    const calculatePayload = {
      refund: {},
    };

    if (refundLineItems.length > 0) {
      calculatePayload.refund.refund_line_items = refundLineItems;
    }

    if (refundShipping) {
      calculatePayload.refund.shipping = {
        amount: Number(shippingAmount || 0).toFixed(2),
      };
    }

    if (order?.currency) {
      calculatePayload.refund.currency = order.currency;
    }

    const calculateResponse = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/orders/${shopifyOrderId}/refunds/calculate.json`,
      'POST',
      calculatePayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!calculateResponse?.refund) {
      return res.status(400).json({
        success: false,
        message: 'Refund calculation failed',
        data: calculateResponse,
      });
    }

    const calculatedRefund = calculateResponse.refund;

    const transactions = (calculatedRefund.transactions || []).map(
      (transaction) => ({
        ...transaction,
        kind: 'refund',
      })
    );

    if (!transactions.length) {
      return res.status(400).json({
        success: false,
        message: 'No refundable transaction found',
        data: calculatedRefund,
      });
    }

    const createRefundPayload = {
      refund: {
        notify: notifyCustomer,
        note: reason || 'Refund created from marketplace',
        refund_line_items: calculatedRefund.refund_line_items || [],
        transactions,
      },
    };

    if (order?.currency) {
      createRefundPayload.refund.currency = order.currency;
    }

    if (refundShipping && calculatedRefund.shipping) {
      createRefundPayload.refund.shipping = {
        amount: Number(shippingAmount || 0).toFixed(2),
      };
    }

    const refundResponse = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/orders/${shopifyOrderId}/refunds.json`,
      'POST',
      createRefundPayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    const shopifyRefund = refundResponse?.refund;

    if (!shopifyRefund?.id) {
      return res.status(400).json({
        success: false,
        message: 'Refund was not created on Shopify',
        data: refundResponse,
      });
    }

    const transactionRefundAmount = (shopifyRefund?.transactions || []).reduce(
      (total, transaction) => {
        return total + Number(transaction.amount || 0);
      },
      0
    );

    const fallbackRefundAmount =
      refundItemsForDb.reduce((total, item) => {
        return total + Number(item.amount || 0);
      }, 0) + (refundShipping ? Number(shippingAmount || 0) : 0);

    const finalRefundAmount =
      transactionRefundAmount > 0
        ? transactionRefundAmount
        : fallbackRefundAmount;

    /*
      Increment local listing inventory only when restock is true.
      If restock false, refund money happens but inventory should not come back.
    */
    const incrementListingInventory = async () => {
      if (!restock) {
        console.log('ℹ️ Restock disabled. Listing inventory increment skipped.');
        return [];
      }

      const inventoryUpdates = [];

      for (const refundItem of refundItemsForDb) {
        const productId = String(refundItem.productId || '');
        const variantId = String(refundItem.variantId || '');
        const refundQty = Number(refundItem.quantity || 0);

        if (!productId || !variantId || refundQty <= 0) {
          console.log('⚠️ Missing productId/variantId/refundQty');
          continue;
        }

        const listing = await listingModel.findOne({
          $or: [{ id: productId }, { shopifyId: productId }],
        });

        if (!listing) {
          console.log(`⚠️ Listing not found for productId: ${productId}`);

          inventoryUpdates.push({
            productId,
            variantId,
            quantity: refundQty,
            updated: false,
            reason: 'Listing not found',
          });

          continue;
        }

        let variantFound = false;
        let oldVariantQty = 0;
        let newVariantQty = 0;

        listing.variants = listing.variants.map((variant) => {
          if (String(variant.id) !== String(variantId)) {
            return variant;
          }

          variantFound = true;

          oldVariantQty = Number(variant.inventory_quantity || 0);
          newVariantQty = oldVariantQty + refundQty;

          return {
            ...variant,
            inventory_quantity: newVariantQty,
          };
        });

        if (!variantFound) {
          console.log(
            `⚠️ Variant not found in listing. productId: ${productId}, variantId: ${variantId}`
          );

          inventoryUpdates.push({
            productId,
            variantId,
            quantity: refundQty,
            updated: false,
            reason: 'Variant not found',
          });

          continue;
        }

        const newTotalQty = listing.variants.reduce((sum, variant) => {
          return sum + Number(variant.inventory_quantity || 0);
        }, 0);

        listing.inventory = {
          ...listing.inventory,
          quantity: newTotalQty,
        };

        listing.totalQuantity = String(newTotalQty);
        listing.updated_at = new Date();

        await listing.save();

        console.log(
          `✅ Listing inventory incremented. Product: ${productId}, Variant: ${variantId}, Qty +${refundQty}, Variant Qty: ${oldVariantQty} -> ${newVariantQty}, New Total: ${newTotalQty}`
        );

        inventoryUpdates.push({
          productId,
          variantId,
          quantity: refundQty,
          oldVariantQty,
          newVariantQty,
          newTotalQty,
          updated: true,
        });
      }

      return inventoryUpdates;
    };

    const inventoryUpdates = await incrementListingInventory();
    let refundEmailStatus = {
      sent: false,
      reason: 'Notification disabled',
    };

    if (notifyCustomer) {
      try {
        const customerEmail =
          order?.customer?.email ||
          order?.customer?.default_address?.email ||
          order?.email ||
          order?.customers?.email ||
          '';

        const customerName =
          `${order?.customer?.first_name || order?.customer?.firstName || ''} ${order?.customer?.last_name || order?.customer?.lastName || ''
            }`.trim() || 'Customer';

        refundEmailStatus = await sendRefundEmail({
          to: customerEmail,
          customerName,
          orderNo: order.shopifyOrderNo || order.orderId,
          refundAmount: finalRefundAmount,
          currency: order.currency || '',
          reason,
        });
      } catch (emailError) {
        console.error('Refund email sending failed:', emailError);

        refundEmailStatus = {
          sent: false,
          reason: emailError.message,
        };
      }
    }
    const savedRefund = {
      refundId: String(shopifyRefund?.id || ''),
      status: 'success',
      emailNotification: refundEmailStatus,

      refundItems: refundItemsForDb,
      shippingRefunded: Boolean(refundShipping),
      shippingAmount: refundShipping ? Number(shippingAmount || 0) : 0,
      refundAmount: Number(finalRefundAmount.toFixed(2)),
      reason,
      restock,
      notifyCustomer,
      shopifyRefund: shopifyRefund || {},
      inventoryRestocked: Boolean(restock),
      inventoryUpdates,
      refundedAt: new Date(),
    };

    await orderModel.updateOne(
      { orderId: String(orderId) },
      {
        $push: {
          refunds: savedRefund,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Refund created successfully',
      refund: shopifyRefund,
      calculatedRefund,
      savedRefund: {
        refundId: savedRefund.refundId,
        refundItems: refundItemsForDb,
        shippingRefunded: savedRefund.shippingRefunded,
        shippingAmount: savedRefund.shippingAmount,
        refundAmount: savedRefund.refundAmount,
        inventoryRestocked: savedRefund.inventoryRestocked,
        inventoryUpdates,
        emailNotification: refundEmailStatus,
      },
    });
  } catch (error) {
    console.error('Create Refund Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create refund',
      error: error?.message,
      details: error?.response?.data || null,
    });
  }
};
