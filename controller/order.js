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

export const getFinanceSummary = async (req, res) => {
  try {
    const allOrders = await orderModel.find();

    const totalOrdersInDb = allOrders.length;

    const getOrderIncome = (order) => {
      return order.lineItems.reduce((total, item) => {
        const price = parseFloat(item.price || '0');
        const qty = parseFloat(item.quantity || '1');
        total += price * qty;
        return total;
      }, 0);
    };

    let totalIncome = 0;
    let paidIncome = 0;
    let unpaidIncome = 0;
    let fulfilledOrdersCount = 0;
    let unfulfilledOrdersCount = 0;

    allOrders.forEach((order) => {
      const income = getOrderIncome(order);
      totalIncome += income;

      const allFulfilled = order.lineItems.every(
        (item) => item.fulfillment_status === 'fulfilled'
      );

      if (allFulfilled) {
        fulfilledOrdersCount += 1;
        paidIncome += income;
      } else {
        unfulfilledOrdersCount += 1;
        unpaidIncome += income;
      }
    });

    const netProfit = totalIncome;

    const mrr = allOrders
      .filter((order) => {
        const item = order.lineItems[0];
        return (
          item.name?.toLowerCase()?.includes('subscription') ||
          item.title?.toLowerCase()?.includes('subscription') ||
          item.vendor?.toLowerCase()?.includes('recurring')
        );
      })
      .reduce((sum, order) => sum + getOrderIncome(order), 0);

    res.status(200).json({
      totalIncome: totalIncome.toFixed(2),
      netProfit: netProfit.toFixed(2),
      mrr: mrr.toFixed(2),
      totalOrdersInDb,
      paidIncome: paidIncome.toFixed(2),
      unpaidIncome: unpaidIncome.toFixed(2),
      fulfilledOrders: fulfilledOrdersCount,
      unfulfilledOrders: unfulfilledOrdersCount,
    });
  } catch (error) {
    console.error('Finance summary error:', error);
    res.status(500).json({ message: 'Error calculating finance summary' });
  }
};

export const getFinanceSummaryForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const allOrders = await orderModel.find();

    let totalIncome = 0;
    let netProfit = 0;

    let totalOrders = 0;
    let fulfilledOrdersCount = 0;
    let unfulfilledOrdersCount = 0;
    let paidIncome = 0;
    let unpaidIncome = 0;

    const getOrderIncome = (order) => {
      return order.lineItems.reduce((total, item) => {
        const price = parseFloat(item.price || '0');
        const qty = parseFloat(item.quantity || '1');
        return total + price * qty;
      }, 0);
    };

    for (const order of allOrders) {
      let userLineItems = [];
      let orderIncome = 0;
      let orderCost = 0;

      for (const item of order.lineItems) {
        const variantId = item.variant_id;

        const product = await listingModel.findOne({
          'variants.id': variantId,
        });

        if (product && product.userId.toString() === userId) {
          userLineItems.push(item);

          const price = parseFloat(item.price || '0');
          const qty = parseFloat(item.quantity || '1');
          const cost = parseFloat(item.cost || '0');

          orderIncome += price * qty;
          orderCost += cost * qty;
        }
      }

      if (userLineItems.length > 0) {
        totalOrders += 1;
        totalIncome += orderIncome;
        netProfit += orderIncome - orderCost;

        const allFulfilled = userLineItems.every(
          (item) => item.fulfillment_status === 'fulfilled'
        );

        if (allFulfilled) {
          fulfilledOrdersCount += 1;
          paidIncome += orderIncome;
        } else {
          unfulfilledOrdersCount += 1;
          unpaidIncome += orderIncome;
        }
      }
    }

    const mrr = allOrders
      .filter((order) => {
        const item = order.lineItems[0];
        return (
          item.name?.toLowerCase()?.includes('subscription') ||
          item.title?.toLowerCase()?.includes('subscription') ||
          item.vendor?.toLowerCase()?.includes('recurring')
        );
      })
      .reduce((sum, order) => {
        let userIncome = 0;
        for (const item of order.lineItems) {
          const product = listingModel.findOne({
            'variants.id': item.variant_id,
          });

          if (product && product.userId.toString() === userId) {
            const price = parseFloat(item.price || '0');
            const qty = parseFloat(item.quantity || '1');
            userIncome += price * qty;
          }
        }
        return sum + userIncome;
      }, 0);

    res.status(200).json({
      totalIncome: totalIncome.toFixed(2),
      netProfit: netProfit.toFixed(2),
      mrr: mrr.toFixed(2),
      totalOrdersInDb: totalOrders,
      paidIncome: paidIncome.toFixed(2),
      unpaidIncome: unpaidIncome.toFixed(2),
      fulfilledOrders: fulfilledOrdersCount,
      unfulfilledOrders: unfulfilledOrdersCount,
    });
  } catch (error) {
    console.error('Finance summary error for user:', error);
    res
      .status(500)
      .json({ message: 'Error calculating finance summary for user' });
  }
};

// export const getOrderById = async (req, res) => {
//   try {
//     const userId = req.userId?.toString();

//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).send({ message: 'Invalid user ID' });
//     }

//     const allOrders = await orderModel.find({});
//     const ordersGrouped = new Map();

//     for (const order of allOrders) {
//       const filteredLineItems = [];

//       for (const item of order.lineItems || []) {
//         const variantId = item.variant_id?.toString();
//         if (!variantId) continue;

//         // 🔍 Find product by variant
//         const product = await listingModel
//           .findOne({ 'variants.id': variantId })
//           .lean();

//         // 🚫 Product hi nahi mila
//         if (!product) continue;

//         // 🚫 Product merchant ka nahi
//         if (product.userId?.toString() !== userId) continue;

//         // ✅ IMAGE RESOLUTION
//         let imageData = null;

//         const matchedVariant = product.variants.find(
//           (v) => v.id.toString() === variantId
//         );

//         if (matchedVariant?.image_id && product.variantImages?.length) {
//           const img = product.variantImages.find(
//             (i) => i.id.toString() === matchedVariant.image_id.toString()
//           );
//           if (img) {
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

//         if (!imageData && product.images?.length) {
//           const img = product.images[0];
//           imageData = {
//             id: img.id,
//             src: img.src,
//             alt: img.alt || '',
//             position: img.position,
//             width: img.width,
//             height: img.height,
//           };
//         }

//         // 🚫 image bhi nahi mili
//         if (!imageData) continue;

//         filteredLineItems.push({
//           ...item,
//           image: imageData,
//         });
//       }

//       // 🚫 Is order mein merchant ka koi item hi nahi
//       if (!filteredLineItems.length) continue;

//       const orderData = order.toObject();
//       orderData.lineItems = filteredLineItems;

//       if (ordersGrouped.has(order.orderId)) {
//         const existing = ordersGrouped.get(order.orderId);
//         existing.lineItems.push(...filteredLineItems);

//         // 🔁 dedupe by variant
//         existing.lineItems = Array.from(
//           new Map(existing.lineItems.map((li) => [li.variant_id, li])).values()
//         );
//       } else {
//         ordersGrouped.set(order.orderId, orderData);
//       }
//     }

//     const finalOrders = Array.from(ordersGrouped.values());

//     if (!finalOrders.length) {
//       return res.status(404).send({ message: 'No orders found' });
//     }

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
    const userId = req.userId?.toString();

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send({ message: 'Invalid user ID' });
    }

    const allOrders = await orderModel.find({});
    const ordersGrouped = new Map();

    for (const order of allOrders) {
      const filteredLineItems = [];

      for (const item of order.lineItems || []) {
        const variantId = item.variant_id?.toString();
        if (!variantId) continue;

        // 🔍 Find product by variant
        const product = await listingModel
          .findOne({ 'variants.id': variantId })
          .lean();

        // 🚫 Product hi nahi mila
        if (!product) continue;

        // 🚫 Product merchant ka nahi
        if (product.userId?.toString() !== userId) continue;

        // ✅ IMAGE RESOLUTION
        let imageData = null;

        // const matchedVariant = product.variants.find(
        //   (v) => v.id.toString() === variantId
        // );
const matchedVariant = product.variants?.find(
  (v) => v?.id && v.id.toString() === variantId
);

        if (matchedVariant?.image_id && product.variantImages?.length) {
          // const img = product.variantImages.find(
          //   (i) => i.id.toString() === matchedVariant.image_id.toString()
          // );
          const img = product.variantImages?.find(
  (i) =>
    i?.id &&
    matchedVariant?.image_id &&
    i.id.toString() === matchedVariant.image_id.toString()
);

          if (img) {
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

        if (!imageData && product.images?.length) {
          const img = product.images[0];
          imageData = {
            id: img.id,
            src: img.src,
            alt: img.alt || '',
            position: img.position,
            width: img.width,
            height: img.height,
          };
        }

        // 🚫 image bhi nahi mili
        if (!imageData) continue;

        filteredLineItems.push({
          ...item,
          image: imageData,
        });
      }

      // 🚫 Is order mein merchant ka koi item hi nahi
      if (!filteredLineItems.length) continue;

      const orderData = order.toObject();
      orderData.lineItems = filteredLineItems;

      if (ordersGrouped.has(order.orderId)) {
        const existing = ordersGrouped.get(order.orderId);
        existing.lineItems.push(...filteredLineItems);

        // 🔁 dedupe by variant
        existing.lineItems = Array.from(
          new Map(existing.lineItems.map((li) => [li.variant_id, li])).values()
        );
      } else {
        ordersGrouped.set(order.orderId, orderData);
      }
    }

    const finalOrders = Array.from(ordersGrouped.values());

    if (!finalOrders.length) {
      return res.status(404).send({ message: 'No orders found' });
    }

    return res.status(200).send({
      message: 'Orders found',
      data: finalOrders,
    });
  } catch (error) {
    console.error('❌ getOrderById error:', error);
    return res.status(500).send({ message: 'Internal Server Error' });
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

export const fulfillOrder = async (req, res) => {
  try {
    const { orderId, itemsToFulfill, trackingInfo } = req.body;

    if (!orderId || !Array.isArray(itemsToFulfill)) {
      return res
        .status(400)
        .json({ error: 'Order ID and fulfillment items are required.' });
    }

    const shopifyConfig = await shopifyConfigurationModel.findOne();

    if (!shopifyConfig) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

    const order = await orderModel.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ error: 'Order not found in MongoDB.' });
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
      return res
        .status(400)
        .json({ error: 'No fulfillment order found for this order.' });
    }

    const fulfillmentLineItems = [];

    itemsToFulfill.forEach((itemToFulfill) => {
      const fulfillable = fulfillmentOrder.line_items.find(
        (f) => Number(f.line_item_id) === Number(itemToFulfill.lineItemId)
      );

      if (!fulfillable) {
        return;
      }

      const remainingQty = fulfillable.fulfillable_quantity || 0;
      const requestedQty = itemToFulfill.quantity;

      if (requestedQty > 0 && requestedQty <= remainingQty) {
        fulfillmentLineItems.push({
          fulfillmentOrderLineItemId: fulfillable.id,
          quantity: requestedQty,
        });
      } else {
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

    const newFulfillment = result.data.fulfillmentCreateV2.fulfillment;

    order.lineItems = order.lineItems.map((item) => {
      const fulfilled = itemsToFulfill.find(
        (fulfilledItem) => Number(fulfilledItem.lineItemId) === Number(item.id)
      );

      if (fulfilled && fulfilled.quantity > 0) {
        const alreadyFulfilled = item.fulfilled_quantity || 0;
        const totalFulfilled = alreadyFulfilled + fulfilled.quantity;

        const updatedItem = {
          ...item,
          fulfilled_quantity: totalFulfilled,
        };

        if (totalFulfilled >= item.quantity) {
          updatedItem.fulfillment_status = 'fulfilled';
        }

        console.log(
          `📌 Updating DB: item ${item.id}, fulfilled ${fulfilled.quantity}, total fulfilled ${totalFulfilled}, status: ${updatedItem.fulfillment_status || 'partial'}`
        );
        return updatedItem;
      }

      return item;
    });

    order.shopifyFulfillments = order.shopifyFulfillments || [];
    const alreadyExists = order.shopifyFulfillments.some(
      (f) => f.id === newFulfillment.id
    );

    if (!alreadyExists) {
      order.shopifyFulfillments.push(newFulfillment);
    } else {
    }

    await order.save();

    return res.status(200).json({
      message: 'Order partially fulfilled successfully and MongoDB updated.',
      data: newFulfillment,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: 'Server error while fulfilling order.' });
  }
};

// export const getOrderDatafromShopify = async (req, res) => {
//   const orderId = req.params.id;
//   const userId = req.params.userId;

//   if (!userId) {
//     return res.status(400).json({ error: 'User ID is required.' });
//   }

//   try {
//     const shopifyConfig = await shopifyConfigurationModel.findOne();

//     if (!shopifyConfig) {
//       return res
//         .status(404)
//         .json({ error: 'Shopify configuration not found.' });
//     }

//     const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

//     const response = await axios.get(
//       `${shopifyStoreUrl}/admin/api/2024-01/orders/${orderId}.json`,
//       {
//         headers: {
//           'X-Shopify-Access-Token': shopifyAccessToken,
//           'Content-Type': 'application/json',
//         },
//       }
//     );

//     const order = response.data.order;

//     const filteredLineItems = [];
//     const variantOwnershipMap = new Map();

//     for (const item of order.line_items || []) {
//       const variantId = item.variant_id?.toString();
//       if (!variantId) continue;

//       const product = await listingModel.findOne({ 'variants.id': variantId });

//       if (product && product.userId?.toString() === userId) {
//         const matchedVariant = product.variants.find((v) => v.id === variantId);

//         if (matchedVariant?.image_id && Array.isArray(product.variantImages)) {
//           const image = product.variantImages.find(
//             (img) => img.id === matchedVariant.image_id
//           );

//           if (image) {
//             item.image = {
//               id: image.id,
//               src: image.src,
//               alt: image.alt,
//               position: image.position,
//               width: image.width,
//               height: image.height,
//             };
//           }
//         }

//         filteredLineItems.push(item);
//         variantOwnershipMap.set(variantId, true);
//       }
//     }

//     const filteredFulfillments = (order.fulfillments || [])
//       .map((f) => {
//         const ownedItems = (f.line_items || []).filter((item) =>
//           variantOwnershipMap.has(item.variant_id?.toString())
//         );
//         return ownedItems.length > 0 ? { ...f, line_items: ownedItems } : null;
//       })
//       .filter((f) => f !== null);

//     if (filteredLineItems.length === 0 && filteredFulfillments.length === 0) {
//       return res.status(404).json({
//         message: 'No matching items or fulfillments found for this user.',
//       });
//     }

//     const filteredOrder = {
//       ...order,
//       line_items: filteredLineItems,
//       fulfillments: filteredFulfillments,
//     };

//     res.json({
//       message: 'Filtered Shopify order for user',
//       data: filteredOrder,
//     });
//   } catch (error) {
//     console.error(
//       'Error fetching filtered order:',
//       error.response?.data || error.message
//     );
//     res.status(500).json({
//       message: 'Failed to fetch filtered order',
//       error: error.response?.data || error.message,
//     });
//   }
// };

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
       MAP LINE ITEMS (CRITICAL LOGIC)
    =============================== */
    const dbLineItems = dbOrder.lineItems || [];

    const enrichedProducts = merchantProducts.map((item) => {
      const matchedLineItem = dbLineItems.find(
        (li) => String(li.variant_id) === String(item.variantId)
      );

      const totalQty = matchedLineItem?.quantity ?? item.quantity;
      const fulfilledQty = matchedLineItem?.fulfilled_quantity ?? 0;

      // ✅ REAL remaining qty (Shopify-safe)
      const remainingQty = Math.max(totalQty - fulfilledQty, 0);

      return {
        productId: item.productId,
        variantId: item.variantId,

        // ✅ THIS IS WHAT SHOPIFY NEEDS
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
       FINAL RESPONSE (NO STRUCTURE CHANGE)
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

      serialNumber: dbOrder.serialNumber,
      payoutStatus: dbOrder.payoutStatus,
      dbCreatedAt: dbOrder.createdAt,
    };

    return res.status(200).json({
      message: 'Order fetched with correct lineItemId & quantities',
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

export const getAllOrdersForAdmin = async (req, res) => {
  try {
    const allOrders = await orderModel.find({});

    const finalOrders = [];
    const merchantDetailsMap = new Map();
    const merchantStatsMap = new Map();

    for (const order of allOrders) {
      console.log(
        '\n Processing Order:',
        order.shopifyOrderNo,
        'Order ID:',
        order.orderId
      );
      const merchantGroups = new Map();

      const snapshot = order.ProductSnapshot;

      for (const item of order.lineItems || []) {
        const variantId = item.variant_id?.toString();
        let merchantId = snapshot?.userId?.toString() || null;
        let imageData = null;

        if (snapshot) {
          if (snapshot?.images?.length > 0) {
            const img = snapshot.images[0];
            imageData = {
              id: img.id,
              src: img.src,
              alt: img.alt || 'Product image',
              position: img.position,
              width: img.width,
              height: img.height,
            };
          }
        }

        if (variantId) {
          const product = await listingModel
            .findOne({ 'variants.id': variantId })
            .lean();

          if (product) {
            merchantId = product.userId?.toString() || merchantId;

            const matchedVariant = product.variants.find(
              (v) => v.id === variantId
            );

            if (
              matchedVariant?.image_id &&
              Array.isArray(product.variantImages)
            ) {
              const image = product.variantImages.find(
                (img) => img.id === matchedVariant.image_id
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
              Array.isArray(product.images) &&
              product.images.length > 0
            ) {
              const defaultImage = product.images[0];
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
        }

        if (!merchantId) {
          console.log(
            '⚠️ Skipped item because merchantId could not be determined'
          );
          continue;
        }

        const enrichedItem = {
          ...item,
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
            ordersSeen: new Set(),
          });
        }

        const stats = merchantStatsMap.get(merchantId);
        if (!stats.ordersSeen.has(order.orderId)) {
          stats.ordersSeen.add(order.orderId);
          stats.totalOrdersCount += 1;
        }
        const amount = (item.price || 0) * (item.quantity || 1);
        stats.totalOrderValue += amount;
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
          totalOrderValue: stats?.totalOrderValue || 0,
        });

        lineItemsByMerchant[merchantId] = items;
      });

      finalOrders.push({
        serialNo: order.shopifyOrderNo,
        merchants: merchantsArray,
        lineItemsByMerchant,
      });
    }

    if (finalOrders.length > 0) {
      finalOrders.sort((a, b) => b.serialNo - a.serialNo);
      return res.status(200).send({
        message: 'Orders grouped per order (not merged by merchant)',
        data: finalOrders,
      });
    } else {
      return res
        .status(404)
        .send({ message: 'No orders found across merchants' });
    }
  } catch (error) {
    console.error('❌ Error in getAllOrdersForAdmin:', error);
    return res.status(500).send({ message: 'Internal Server Error' });
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
//     let totalPayoutAmount = 0;
//     const currentDate = dayjs().startOf('day');

//     for (const order of orders) {
//       let createdAt = dayjs(order.createdAt);

//       if (dayjs(order.scheduledPayoutDate).isSame(currentDate, 'day')) {
//         const lineItems = order.lineItems || [];
//         const isAnyItemUnfulfilled = lineItems.some(
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

//       if (!order.scheduledPayoutDate || !order.eligibleDate) {
//         const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
//         const payoutDate = getNextPayoutDate(eligibleDate.toDate(), config);

//         if (!order.eligibleDate) order.eligibleDate = eligibleDate.toDate();
//         if (!order.scheduledPayoutDate)
//           order.scheduledPayoutDate = payoutDate.toDate();
//       }

//       const enrichedLineItems = [];
//       let payoutAmount = 0;

//       for (const item of order.lineItems || []) {
//         const price = Number(item.price) || 0;
//         const qty = Number(item.quantity || item.current_quantity) || 0;
//         const itemTotal = price * qty;

//         payoutAmount += itemTotal;

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

//         enrichedLineItems.push({
//           ...item,
//           merchantId,
//           merchantName,
//           merchantEmail,
//           commissionRate,
//           itemTotal,
//         });
//       }

//       order.payoutAmount = payoutAmount;
//       await order.save();

//       totalPayoutAmount += payoutAmount;

//       updates.push({
//         orderId: order._id,
//         scheduledPayoutDate: order.scheduledPayoutDate,
//         payoutStatus: order.payoutStatus || 'N/A',
//         createdAt: order.createdAt,
//         lineItems: enrichedLineItems,
//       });
//     }

//     // ================= GROUPING =================

//     const grouped = {};

//     updates.forEach((order) => {
//       const key = `${dayjs(order.scheduledPayoutDate).format(
//         'YYYY-MM-DD'
//       )}__${order.payoutStatus}`;

//       if (!grouped[key]) {
//         let normalizedStatus = 'Pending';

//         if (order.payoutStatus?.toLowerCase() === 'deposited') {
//           normalizedStatus = 'Deposited';
//         } else if (order.payoutStatus?.toLowerCase() === 'due') {
//           normalizedStatus = 'Due';
//         }

//         grouped[key] = {
//           payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
//           status: normalizedStatus,
//           createdAts: [],
//           orders: {},
//           sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
//         };
//       }

//       grouped[key].createdAts.push(dayjs(order.createdAt));

//       order.lineItems.forEach((line) => {
//         if (!line.merchantId) return;

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
//     res.status(500).json({ error: 'Server error while calculating payouts' });
//   }
// };

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
//       let payoutAmount = 0;
//       let refundAmount = 0;

//       const enrichedLineItems = [];
//       let fulfilledCount = 0;
//       let unfulfilledCount = 0;

//       for (const item of lineItems) {
//         const price = Number(item.price) || 0;
//         const qty = Number(item.quantity) || 0;
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

//             if (userId && merchantId !== String(userId)) continue;

//             const merchant = await authModel.findById(listing.userId);
//             if (merchant) {
//               merchantName =
//                 `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
//               merchantEmail = merchant.email || 'N/A';
//             }
//           }
//         }

//         // Count fulfillment ONLY if not cancelled
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
//           isCancelled: status === 'cancelled',
//         });

//         if (status === 'cancelled') {
//           refundAmount += total;
//         } else {
//           payoutAmount += total;
//         }
//       }

//       if (enrichedLineItems.length === 0) continue;

//       order.payoutAmount = payoutAmount;
//       order.refundAmount = refundAmount;
//       await order.save();

//       totalPayoutAmount += payoutAmount;
//       totalRefundAmount += refundAmount;

//       updates.push({
//         orderId: order._id,
//         shopifyOrderId: order.orderId,
//         shopifyOrderNo: order.shopifyOrderNo || 'N/A',
//         eligibleDate: order.eligibleDate,
//         scheduledPayoutDate: order.scheduledPayoutDate,
//         payoutStatus: order.payoutStatus || 'pending',
//         payoutAmount,
//         refundAmount,
//         createdAt: order.createdAt,
//         lineItems: enrichedLineItems,
//         fulfillmentSummary: {
//           fulfilled: fulfilledCount,
//           unfulfilled: unfulfilledCount,
//         },
//       });
//     }

//     const grouped = {};

//     updates.forEach((order) => {
//       const key = `${dayjs(order.scheduledPayoutDate).format('YYYY-MM-DD')}__${order.payoutStatus}`;
//       if (!grouped[key]) {
//         grouped[key] = {
//           payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
//           status: order.payoutStatus === 'Deposited' ? 'Deposited' : 'Pending',
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
//         status: order.payoutStatus,
//         createdAt: order.createdAt,
//         fulfillmentSummary: order.fulfillmentSummary,
//         lineItems: order.lineItems,
//       });
//     });

//     const payouts = Object.values(grouped)
//       .map((group) => {
//         const minDate = dayjs.min(group.createdAts);
//         const maxDate = dayjs.max(group.createdAts);
//         return {
//           payoutDate: group.payoutDate,
//           transactionDates: `${minDate.format('MMM D')} – ${maxDate.format('MMM D, YYYY')}`,
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
//         if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
//         return b.sortKey - a.sortKey;
//       });

//     res.json({
//       message: 'Payouts calculated',
//       totalAmount: totalPayoutAmount,
//       totalRefundAmount: totalRefundAmount,
//       payouts,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Server error while calculating payouts' });
//   }
// };

export const getPayout = async (req, res) => {
  try {
    const config = await PayoutConfig.findOne({});
    if (!config) {
      return res.status(400).json({ error: 'Payout config not found.' });
    }

    const orders = await orderModel.find({});
    const updates = [];
    const currentDate = dayjs().startOf('day');

    for (const order of orders) {
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
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity || item.current_quantity) || 0;

        const itemTotal = price * qty;

        let merchantName = 'Unknown';
        let merchantEmail = 'Unknown';
        let merchantId = null;
        let commissionRate = 0;

        const variantId = item.variantId || item.variant_id;

        if (variantId) {
          const listing = await listingModel.findOne({
            'variants.id': String(variantId),
          });

          if (listing?.userId) {
            const merchant = await authModel.findById(listing.userId);
            if (merchant) {
              merchantName =
                `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
              merchantEmail = merchant.email || 'N/A';
              merchantId = merchant._id;
              commissionRate = Number(merchant.comissionRate || 0);
            }
          }
        }

        // ================= 🔥 GET PAYOUT STATUS FROM ProductSnapshot =================
        const snapshot = order.ProductSnapshot?.find(
          (p) =>
            String(p.productId) === String(item.product_id) &&
            String(p.variantId) === String(item.variant_id)
        );

        const payoutStatus = snapshot?.payoutStatus;
        const payoutReferenceId = snapshot?.payoutReferenceId;

        enrichedLineItems.push({
          ...item,
          merchantId,
          merchantName,
          merchantEmail,
          commissionRate,
          itemTotal,
          payoutStatus,
          payoutReferenceId, // ✅ FROM ProductSnapshot
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

    // ================= GROUPING (MERCHANT + STATUS BASED) =================

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

    // ================= COMMISSION CALC =================

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
          orders: Object.values(group.orders),
          sortKey: group.sortKey,
        };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
        return b.sortKey - a.sortKey;
      });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    res.json({
      message: 'Payouts calculated',
      totalPayouts: allPayouts.length,
      page,
      limit,
      payouts: allPayouts.slice(startIndex, startIndex + limit),
    });
  } catch (err) {
    console.error(err);
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
//       let payoutAmount = 0;
//       let refundAmount = 0;
//       let commissionAmount = 0;

//       const enrichedLineItems = [];
//       let fulfilledCount = 0;
//       let unfulfilledCount = 0;

//       let merchantCommissionRate = 0;

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

//             if (userId && merchantId !== String(userId)) continue;

//             const merchant = await authModel.findById(listing.userId);
//             if (merchant) {
//               merchantName =
//                 `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
//               merchantEmail = merchant.email || 'N/A';
//               merchantCommissionRate = Number(merchant.comissionRate || 0);
//             }
//           }
//         }

//         // Fulfillment count (ignore cancelled)
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

//           // ✅ COMMISSION CALCULATION (ONLY ADDITION)
//           commissionAmount += (total * merchantCommissionRate) / 100;
//         }
//       }

//       if (enrichedLineItems.length === 0) continue;

//       const netPayoutAmount = payoutAmount - commissionAmount;

//       order.payoutAmount = netPayoutAmount; // ✅ net amount stored
//       order.refundAmount = refundAmount;
//       await order.save();

//       totalPayoutAmount += netPayoutAmount;
//       totalRefundAmount += refundAmount;

//       updates.push({
//         orderId: order._id,
//         shopifyOrderId: order.orderId,
//         shopifyOrderNo: order.shopifyOrderNo || 'N/A',
//         eligibleDate: order.eligibleDate,
//         scheduledPayoutDate: order.scheduledPayoutDate,
//         payoutStatus: order.payoutStatus || 'pending',

//         payoutAmount: netPayoutAmount, // ✅ net
//         refundAmount,
//         commissionAmount, // ✅ added safely

//         createdAt: order.createdAt,
//         lineItems: enrichedLineItems,
//         fulfillmentSummary: {
//           fulfilled: fulfilledCount,
//           unfulfilled: unfulfilledCount,
//         },
//       });
//     }

//     // ================= GROUPING (UNCHANGED STRUCTURE) =================

//     const grouped = {};

//     updates.forEach((order) => {
//       const key = `${dayjs(order.scheduledPayoutDate).format(
//         'YYYY-MM-DD'
//       )}__${order.payoutStatus}`;

//       if (!grouped[key]) {
//         grouped[key] = {
//           payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
//           status: order.payoutStatus || 'Pending',
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
//         amount: order.payoutAmount, // ✅ net
//         refund: order.refundAmount,
//         commissionAmount: order.commissionAmount, // ✅ extra info
//         status: order.payoutStatus,
//         createdAt: order.createdAt,
//         fulfillmentSummary: order.fulfillmentSummary,
//         lineItems: order.lineItems,
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
//         if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
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
//     res.status(500).json({ error: 'Server error while calculating payouts' });
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

      // 🔥 Get merchant snapshot
      const merchantSnapshot = snapshots.find(
        (snap) => String(snap.merchantId) === String(userId)
      );

      if (!merchantSnapshot) continue;

      const snapshotStatus = merchantSnapshot.payoutStatus || 'pending';
const payoutReferenceId = merchantSnapshot.payoutReferenceId; // ✅ ADD THIS

      for (const item of lineItems) {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity || item.current_quantity) || 0;
        const total = price * qty;
        const status = item.fulfillment_status;

        let merchantId = null;
        let merchantName = 'Unknown';
        let merchantEmail = 'Unknown';

        const variantId = item.variantId || item.variant_id;

        if (variantId) {
          const listing = await listingModel.findOne({
            'variants.id': String(variantId),
          });

          if (listing?.userId) {
            merchantId = String(listing.userId);

            if (merchantId !== String(userId)) continue;

            const merchant = await authModel.findById(listing.userId);

            if (merchant) {
              merchantName =
                `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
              merchantEmail = merchant.email || 'N/A';
              merchantCommissionRate = Number(merchant.comissionRate || 0);
            }
          }
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
        // ✅ SNAPSHOT STATUS
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
//     const commissionRate = Number(merchant?.comissionRate || 0);

//     const orderQuery = {};
//     if (status) {
//       orderQuery.payoutStatus = new RegExp(`^${status}$`, 'i');
//     }

//     const orders = await orderModel.find(orderQuery);

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

//       order.payoutAmount = netPayoutAmount;
//       order.refundAmount = refundAmount;
//       await order.save();

//       totalPayoutAmount += netPayoutAmount;

//       updates.push({
//         orderId: order.orderId,
//         shopifyOrderNo: order.shopifyOrderNo || 'N/A',
//         eligibleDate: order.eligibleDate,
//         scheduledPayoutDate: order.scheduledPayoutDate,
//         payoutStatus: order.payoutStatus || 'Pending',

//         payoutAmount: netPayoutAmount,
//         refundAmount,
//         commissionAmount,

//         createdAt: order.createdAt,

//         // ✅ NEW FIELDS ADDED
//         referenceNo: order.referenceNo || '',
//         paymentMethod: order.paymentMethod || '',
//         depositedDate: order.depositedDate || null,

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

//           // ✅ SUPPORT Pending / Due / Deposited
//           status:
//             order.payoutStatus === 'Deposited'
//               ? 'Deposited'
//               : order.payoutStatus === 'Due'
//                 ? 'Due'
//                 : 'Pending',

//           createdAts: [],
//           totalAmount: 0,
//           totalRefundAmount: 0,
//           orders: [],
//           sortKey: dayjs(order.scheduledPayoutDate).valueOf(),

//           // ✅ NEW FIELDS
//           referenceNo: order.referenceNo || '',
//           paymentMethod: order.paymentMethod || '',
//           depositedDate: order.depositedDate || null,
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

//         // ✅ PASS TO FRONTEND
//         referenceNo: order.referenceNo || '',
//         paymentMethod: order.paymentMethod || '',
//         depositedDate: order.depositedDate || null,

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

//           // ✅ FINAL RETURN
//           referenceNo: group.referenceNo,
//           paymentMethod: group.paymentMethod,
//           depositedDate: group.depositedDate,
//         };
//       })
//       .sort((a, b) => {
//         const orderPriority = { Pending: 1, Due: 2, Deposited: 3 };

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
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Server error while calculating payouts' });
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

    // ❌ REMOVE payoutStatus query filter
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

      let grossAmount = 0;
      let refundAmount = 0;
      let commissionAmount = 0;
      const products = [];

      // 🔥 GET SNAPSHOT FOR THIS MERCHANT
      const merchantSnapshots = (order.ProductSnapshot || []).filter(
        (snap) => String(snap.merchantId) === String(userId)
      );

      if (merchantSnapshots.length === 0) continue;

      const snapshotStatus = merchantSnapshots[0]?.payoutStatus || 'pending';

      const snapshotReferenceNo = merchantSnapshots[0]?.referenceNo || '';

      const snapshotPaymentMethod = merchantSnapshots[0]?.paymentMethod || '';

      const snapshotDepositedDate = merchantSnapshots[0]?.depositedDate || null;

      for (const item of lineItems) {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity || item.current_quantity) || 0;

        const total = price * qty;

        const variantId = item.variantId || item.variant_id;

        const listing = await listingModel.findOne({
          'variants.id': String(variantId),
        });

        if (!listing || String(listing.userId) !== String(userId)) {
          continue;
        }

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

        // ✅ STATUS FROM SNAPSHOT
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

        // ✅ FROM SNAPSHOT
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

// export const getPayoutForAllOrders = async (req, res) => {
//   try {
//     const { payoutDate, status } = req.query;

//     const config = await PayoutConfig.findOne({});
//     if (!config) {
//       return res.status(400).json({ error: 'Payout config not found.' });
//     }

//     const orders = await orderModel.find({});
//     const updates = [];
//     let totalPayoutAmount = 0;

//     const allUserIds = new Set();
//     const grouped = {};

//     // 🔹 FIRST PASS: collect all merchantIds
//     orders.forEach((order) => {
//       (order.lineItems || []).forEach((item) => {
//         if (item.variant_id) {
//           allUserIds.add(String(item.variant_id));
//         }
//       });
//     });

//     // 🔹 FETCH MERCHANTS WITH COMMISSION
//     const merchants = await authModel
//       .find({})
//       .select('_id comissionRate referenceNo paypalAccount bankDetails');

//     const merchantMap = {};
//     merchants.forEach((m) => {
//       merchantMap[m._id.toString()] = {
//         commissionRate: Number(m.comissionRate || 0),
//         referenceNo: m.referenceNo || '',
//         paypalAccount: m.paypalAccount || '',
//         bankDetails: m.bankDetails || {},
//       };
//     });

//     // ================= PROCESS ORDERS =================
//     for (const order of orders) {
//       const createdAt = dayjs(order.createdAt);

//       if (!order.scheduledPayoutDate || !order.eligibleDate) {
//         const eligibleDate = createdAt.add(config.graceTime ?? 7, 'day');
//         const payoutDateObj = getNextPayoutDate(eligibleDate.toDate(), config);

//         order.eligibleDate ??= eligibleDate.toDate();
//         order.scheduledPayoutDate ??= payoutDateObj.toDate();
//       }

//       const lineItems = order.lineItems ?? [];
//       let netPayoutAmount = 0;
//       let refundAmount = 0;
//       const products = [];

//       for (const item of lineItems) {
//         const price = Number(item.price) || 0;
//         const qty = Number(item.quantity || item.current_quantity) || 0;
//         const gross = price * qty;
//         const cancelled = item.fulfillment_status === 'cancelled';

//         let userId = null;
//         let commissionRate = 0;

//         if (item.variant_id) {
//           const listing = await listingModel
//             .findOne({ 'variants.id': String(item.variant_id) })
//             .select('userId');

//           userId = listing?.userId?.toString() || null;

//           if (userId && merchantMap[userId]) {
//             commissionRate = merchantMap[userId].commissionRate;
//           }
//         }

//         const commissionAmount = cancelled ? 0 : (gross * commissionRate) / 100;

//         const netAmount = cancelled ? 0 : gross - commissionAmount;

//         if (cancelled) {
//           refundAmount += gross;
//         } else {
//           netPayoutAmount += netAmount;
//         }

//         products.push({
//           title: item.title || '',
//           variantTitle: item.variant_title || '',
//           price,
//           quantity: qty,
//           total: gross,
//           commissionRate,
//           commissionAmount,
//           netAmount,
//           fulfillment_status: item.fulfillment_status || 'Unfulfilled',
//           cancelled,
//           userId,
//         });
//       }

//       order.payoutAmount = netPayoutAmount; // ✅ NET
//       order.refundAmount = refundAmount;
//       await order.save();

//       totalPayoutAmount += netPayoutAmount;

//       updates.push({
//         orderId: order.orderId,
//         shopifyOrderNo: order.shopifyOrderNo || 'N/A',
//         eligibleDate: order.eligibleDate,
//         scheduledPayoutDate: order.scheduledPayoutDate,
//         payoutStatus: order.payoutStatus || 'pending',
//         payoutAmount: netPayoutAmount, // ✅ NET
//         refundAmount,
//         createdAt: order.createdAt,
//         products,
//       });
//     }

//     // ================= GROUPING (UNCHANGED) =================
//     updates.forEach((order) => {
//       const key = `${dayjs(order.scheduledPayoutDate).format(
//         'YYYY-MM-DD'
//       )}__${order.payoutStatus}`;

//       if (!grouped[key]) {
//         grouped[key] = {
//           payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
//           status: order.payoutStatus === 'Deposited' ? 'Deposited' : 'Pending',
//           createdAts: [],
//           totalAmount: 0,
//           totalRefundAmount: 0,
//           orders: [],
//           sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
//         };
//       }

//       grouped[key].createdAts.push(dayjs(order.createdAt));
//       grouped[key].totalAmount += order.payoutAmount || 0;
//       grouped[key].totalRefundAmount += order.refundAmount || 0;

//       grouped[key].orders.push({
//         orderId: order.orderId,
//         shopifyOrderNo: order.shopifyOrderNo,
//         amount: order.payoutAmount, // ✅ NET
//         refund: order.refundAmount,
//         status: order.payoutStatus,
//         createdAt: order.createdAt,
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
//         };
//       })
//       .sort((a, b) => {
//         if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
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
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Server error while calculating payouts' });
//   }
// };

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

export const getMonthlyRevenue = async (req, res) => {
  try {
    const allOrders = await orderModel.find({});

    const revenueByMonth = {};

    for (const order of allOrders) {
      for (const item of order.lineItems || []) {
        const variantId = item.variant_id?.toString();

        if (!variantId) {
          continue;
        }

        const orderDate = new Date(order.createdAt);
        const monthKey = `${orderDate.getFullYear()}-${(
          orderDate.getMonth() + 1
        )
          .toString()
          .padStart(2, '0')}`;

        const lineRevenue = parseFloat(item.price || 0) * (item.quantity || 1);

        if (!revenueByMonth[monthKey]) {
          revenueByMonth[monthKey] = 0;
        }
        revenueByMonth[monthKey] += lineRevenue;
      }
    }

    if (Object.keys(revenueByMonth).length > 0) {
      return res.status(200).json({
        message: 'Monthly revenue calculated for all users',
        revenue: revenueByMonth,
      });
    } else {
      return res.status(404).json({ message: 'No revenue data found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
