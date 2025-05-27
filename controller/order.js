import { authModel } from '../Models/auth.js';
import { orderModel } from '../Models/order.js';
import axios from 'axios';
import mongoose from 'mongoose';
import { listingModel } from '../Models/Listing.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
export const shopifyRequest = async (url, method, body, apiKey, accessToken) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken
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
//     const productId = orderData.line_items[0].product_id;

//     const productExists = await checkProductExists(productId);
//     if (!productExists) {
//       return res.status(404).send('Product does not exist');
//     }

//     const quantity = orderData.line_items[0].quantity;

//     const order = new orderModel({
//       orderId: orderData.id,
//       customer: orderData.customer,
//       lineItems: orderData.line_items,
//       createdAt: orderData.created_at,
//     });

//     await order.save();

//     const user = await authModel.findOne({ email: orderData.customer.email });
//     if (!user) {
//       return res.status(404).send('User not found');
//     }

//     if (user.subscription) {
//       user.subscription.quantity = (user.subscription.quantity || 0) + quantity;
//     } else {
//       user.subscription = {
//         quantity,
//       };
//     }

//     await user.save();

//     res.status(200).json({
//       message: 'Order saved and user updated',
//       orderId: orderData.id,
//     });
//   } catch (error) {
//     console.error('Error saving order:', error);
//     res.status(500).send('Error saving order');
//   }
// };

export const createOrder = async (req, res) => {
  try {
    const orderData = req.body;
    const productId = orderData.line_items[0].product_id;

    const productExists = await checkProductExists(productId);
    if (!productExists) {
      return res.status(404).send('Product does not exist');
    }

    const quantity = orderData.line_items[0].quantity;

    // Check if order already exists
    let order = await orderModel.findOne({ orderId: orderData.id });

    let serialNumber = order?.serialNumber;

    // If order does not exist, assign new serial number
    if (!order) {
      const lastOrder = await orderModel.findOne({ serialNumber: { $ne: null } }).sort({ serialNumber: -1 });
      const lastSerial = typeof lastOrder?.serialNumber === 'number' && !isNaN(lastOrder.serialNumber)
        ? lastOrder.serialNumber
        : 100;
      serialNumber = lastSerial + 1;
    }

    // Upsert the order with serialNumber preserved or newly assigned
    await orderModel.updateOne(
      { orderId: orderData.id },
      {
        $set: {
          customer: orderData.customer,
          lineItems: orderData.line_items,
          createdAt: orderData.created_at,
          serialNumber,
        }
      },
      { upsert: true }
    );

    // Update user subscription
    const user = await authModel.findOne({ email: orderData.customer.email });
    if (!user) {
      return res.status(404).send('User not found');
    }

    if (user.subscription) {
      user.subscription.quantity = (user.subscription.quantity || 0) + quantity;
    } else {
      user.subscription = {
        quantity,
      };
    }

    await user.save();

    res.status(200).json({
      message: 'Order saved (or updated) and user updated',
      orderId: orderData.id,
      serialNumber,
    });
  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).send('Error saving order');
  }
};



export const getFinanceSummary = async (req, res) => {
  try {
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startOfLastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const endOfLastYear = new Date(
      now.getFullYear() - 1,
      now.getMonth() + 1,
      0
    );

    const currentOrders = await orderModel.find({
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const lastYearOrders = await orderModel.find({
      createdAt: { $gte: startOfLastYear, $lte: endOfLastYear },
    });
    const totalOrdersInDb = await orderModel.countDocuments();

    const getOrderTotals = (order) => {
      return order.lineItems.reduce(
        (totals, item) => {
          const price = parseFloat(item.price || '0');
          const cost = parseFloat(item.cost || '0');
          d;
          const qty = parseFloat(item.quantity || '1');

          totals.income += price * qty;
          totals.spend += cost * qty;

          return totals;
        },
        { income: 0, spend: 0 }
      );
    };

    let totalIncome = 0;
    let totalSpend = 0;
    currentOrders.forEach((order) => {
      const { income, spend } = getOrderTotals(order);
      totalIncome += income;
      totalSpend += spend;
    });

    let lastYearIncome = 0;
    let lastYearSpend = 0;
    lastYearOrders.forEach((order) => {
      const { income, spend } = getOrderTotals(order);
      lastYearIncome += income;
      lastYearSpend += spend;
    });

    const mrr = currentOrders
      .filter((order) => {
        const item = order.lineItems[0];
        return (
          item.name?.toLowerCase()?.includes('subscription') ||
          item.title?.toLowerCase()?.includes('subscription') ||
          item.vendor?.toLowerCase()?.includes('recurring')
        );
      })
      .reduce((sum, order) => sum + getOrderTotals(order).income, 0);

    const incomeGrowth =
      lastYearIncome > 0
        ? ((totalIncome - lastYearIncome) / lastYearIncome) * 100
        : 100;

    const spendGrowth =
      lastYearSpend > 0
        ? ((totalSpend - lastYearSpend) / lastYearSpend) * 100
        : 100;

    const netProfit = totalIncome - totalSpend;

    res.status(200).json({
      totalIncome: totalIncome.toFixed(2),
      lastYearIncome: lastYearIncome.toFixed(2),
      incomeGrowth: incomeGrowth.toFixed(2),
      spend: totalSpend.toFixed(2),
      lastYearSpend: lastYearSpend.toFixed(2),
      spendGrowth: spendGrowth.toFixed(2),
      netProfit: netProfit.toFixed(2),
      mrr: mrr.toFixed(2),
      totalOrdersInDb,
    });
  } catch (error) {
    console.error('Finance summary error:', error);
    res.status(500).json({ message: 'Error calculating finance summary' });
  }
};


// export const getOrderById = async (req, res) => {
//   try {
//     const userId = req.params.userId;

//     if (!userId) {
//       return res.status(400).send({ message: 'User ID is required' });
//     }

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).send({ message: 'Invalid user ID' });
//     }

//     const allOrders = await orderModel.find({});
//     console.log('🔍 Total Orders Found:', allOrders.length);

//     const ordersGroupedByOrderId = new Map();

//     for (const order of allOrders) {
//       const filteredLineItems = [];

//       for (const item of order.lineItems || []) {
//         const variantId = item.variant_id?.toString();

//         if (!variantId) continue;

//         const product = await listingModel.findOne({ 'variants.id': variantId });

//         if (
//           product &&
//           product.userId &&
//           product.userId.toString() === userId
//         ) {
//           filteredLineItems.push(item);
//         }
//       }

//       if (filteredLineItems.length > 0) {
//         const orderForUser = order.toObject();
//         orderForUser.lineItems = filteredLineItems;

//         if (ordersGroupedByOrderId.has(order.orderId)) {
//           const existingOrder = ordersGroupedByOrderId.get(order.orderId);
//           existingOrder.lineItems.push(...filteredLineItems);

//           // Remove duplicate lineItems by variant_id
//           existingOrder.lineItems = Array.from(
//             new Map(existingOrder.lineItems.map(item => [item.variant_id, item]))
//           ).map(([_, item]) => item);
//         } else {
//           ordersGroupedByOrderId.set(order.orderId, orderForUser);
//         }
//       }
//     }

//     const matchedOrders = Array.from(ordersGroupedByOrderId.values());

//     console.log('✅ Total matched orders for user:', matchedOrders.length);

//     if (matchedOrders.length > 0) {
//       return res.status(200).send({
//         message: 'Orders found for user',
//         data: matchedOrders,
//       });
//     } else {
//       return res.status(404).send({
//         message: "No orders found for this user's products",
//       });
//     }
//   } catch (error) {
//     console.error('❌ Error fetching user orders:', error);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// };


export const getOrderById = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).send({ message: 'User ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send({ message: 'Invalid user ID' });
    }

    const allOrders = await orderModel.find({});
    console.log(' Total Orders Found:', allOrders.length);

    const ordersGroupedByOrderId = new Map();

    for (const order of allOrders) {
      const filteredLineItems = [];

      for (const item of order.lineItems || []) {
        const variantId = item.variant_id?.toString();
        if (!variantId) continue;

        const product = await listingModel.findOne({ 'variants.id': variantId });

        if (
          product &&
          product.userId &&
          product.userId.toString() === userId
        ) {
          const matchedVariant = product.variants.find(v => v.id === variantId);

          if (matchedVariant?.image_id && Array.isArray(product.variantImages)) {
            const image = product.variantImages.find(img => img.id === matchedVariant.image_id);

            if (image) {
              item.image = {
                id: image.id,
                src: image.src,
                alt: image.alt,
                position: image.position,
                width: image.width,
                height: image.height,
              };
            }
          }

          filteredLineItems.push(item);
        }
      }

      if (filteredLineItems.length > 0) {
        const orderForUser = order.toObject();
        orderForUser.lineItems = filteredLineItems;

        if (ordersGroupedByOrderId.has(order.orderId)) {
          const existingOrder = ordersGroupedByOrderId.get(order.orderId);
          existingOrder.lineItems.push(...filteredLineItems);

          existingOrder.lineItems = Array.from(
            new Map(existingOrder.lineItems.map(item => [item.variant_id, item]))
          ).map(([_, item]) => item);
        } else {
          ordersGroupedByOrderId.set(order.orderId, orderForUser);
        }
      }
    }

    const matchedOrders = Array.from(ordersGroupedByOrderId.values());

    if (matchedOrders.length > 0) {
      return res.status(200).send({
        message: 'Orders found for user',
        data: matchedOrders,
      });
    } else {
      return res.status(404).send({
        message: "No orders found for this user's products",
      });
    }
  } catch (error) {
    console.error(' Error fetching user orders:', error);
    res.status(500).send({ message: 'Internal Server Error' });
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
      return res.status(404).json({ error: "Order not found" });
    }
    res.status(200).json({ data: result }); 
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// export const fulfillOrder = async (req, res) => {
//   try {
//     const { orderId } = req.body;

//     if (!orderId) {
//       return res.status(400).json({ error: 'Order ID is required.' });
//     }

//     const shopifyConfig = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfig) {
//       return res.status(404).json({ error: 'Shopify configuration not found.' });
//     }

//     const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

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
//       return res.status(400).json({ error: 'No fulfillment order found for this order.' });
//     }

//     const graphqlUrl = `${shopifyStoreUrl}/admin/api/2024-01/graphql.json`;

//     const query = `
//       mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
//         fulfillmentCreateV2(fulfillment: $fulfillment) {
//           fulfillment {
//             id
//             status
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
//             fulfillmentOrderId: `gid://shopify/FulfillmentOrder/${fulfillmentOrder.id}`
//           }
//         ],
//         notifyCustomer: true,
//         trackingInfo: {
//           number: null,
//           url: null,
//           company: null
//         }
//       }
//     };

//     const response = await fetch(graphqlUrl, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'X-Shopify-Access-Token': shopifyAccessToken
//       },
//       body: JSON.stringify({ query, variables })
//     });

//     const result = await response.json();

//     if (result.errors || result.data?.fulfillmentCreateV2?.userErrors?.length > 0) {
//       return res.status(400).json({
//         error: 'GraphQL fulfillment error.',
//         details: result.errors || result.data.fulfillmentCreateV2.userErrors
//       });
//     }

//     return res.status(200).json({
//       message: 'Order fulfilled successfully.',
//       data: result.data.fulfillmentCreateV2.fulfillment
//     });

//   } catch (error) {
//     console.error(' Error in fulfillOrder:', error.message, error);
//     return res.status(500).json({ error: 'Server error while fulfilling order.' });
//   }
// };

export const fulfillOrder = async (req, res) => {
  try {
    const { orderId, itemsToFulfill, trackingInfo } = req.body;

    console.log("📦 Incoming Fulfillment Request:", {
      orderId,
      trackingInfo,
      itemsToFulfill,
    });

    if (!orderId || !Array.isArray(itemsToFulfill)) {
      return res.status(400).json({ error: 'Order ID and fulfillment items are required.' });
    }

    const shopifyConfig = await shopifyConfigurationModel.findOne();
    console.log("🔑 Shopify Config:", shopifyConfig);

    if (!shopifyConfig) {
      return res.status(404).json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

    const order = await orderModel.findOne({ orderId });
    console.log("📄 MongoDB Order:", order);

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
    console.log("📦 Shopify Fulfillment Order:", fulfillmentOrder);
    console.log("📋 Fulfillment Order Line Items from Shopify:", fulfillmentOrder.line_items);

    if (!fulfillmentOrder?.id) {
      return res.status(400).json({ error: 'No fulfillment order found for this order.' });
    }

    const fulfillmentLineItems = [];

    itemsToFulfill.forEach((itemToFulfill) => {
      const fulfillable = fulfillmentOrder.line_items.find(
        (f) => Number(f.line_item_id) === Number(itemToFulfill.lineItemId)
      );

      if (!fulfillable) {
        console.warn(`⚠️ Line item ${itemToFulfill.lineItemId} not found in Shopify fulfillment order.`);
        return;
      }

      const remainingQty = fulfillable.fulfillable_quantity || 0;
      const requestedQty = itemToFulfill.quantity;

      console.log(`🔍 Checking line item ${itemToFulfill.lineItemId}: requested ${requestedQty}, remaining ${remainingQty}`);

      if (requestedQty > 0 && requestedQty <= remainingQty) {
        fulfillmentLineItems.push({
          fulfillmentOrderLineItemId: fulfillable.id,
          quantity: requestedQty,
        });
        console.log(`✅ Added to fulfillment: lineItemId ${itemToFulfill.lineItemId}`);
      } else {
        console.warn(`⚠️ Skipping line item ${itemToFulfill.lineItemId}: requested ${requestedQty}, remaining ${remainingQty}`);
      }
    });

    console.log("📦 Final fulfillment line items to send:", fulfillmentLineItems);

    if (fulfillmentLineItems.length === 0) {
      return res.status(400).json({ error: 'No valid line items to fulfill. Check remaining quantities.' });
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

    console.log("🚀 Sending GraphQL fulfillment to Shopify:", variables);

    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();
    console.log("🛬 Shopify Response:", result);

    if (result.errors || result.data?.fulfillmentCreateV2?.userErrors?.length > 0) {
      return res.status(400).json({
        error: 'GraphQL fulfillment error.',
        details: result.errors || result.data.fulfillmentCreateV2.userErrors,
      });
    }

    const newFulfillment = result.data.fulfillmentCreateV2.fulfillment;

    // ✅ Update MongoDB with fulfillment quantities
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

        console.log(`📌 Updating DB: item ${item.id}, fulfilled ${fulfilled.quantity}, total fulfilled ${totalFulfilled}, status: ${updatedItem.fulfillment_status || 'partial'}`);
        return updatedItem;
      }

      return item;
    });

    // ✅ Prevent duplicate fulfillment entry
    order.shopifyFulfillments = order.shopifyFulfillments || [];
    const alreadyExists = order.shopifyFulfillments.some(f => f.id === newFulfillment.id);

    if (!alreadyExists) {
      order.shopifyFulfillments.push(newFulfillment);
      console.log(`📥 Saved new fulfillment ID ${newFulfillment.id} to DB`);
    } else {
      console.log(`⚠️ Fulfillment ID ${newFulfillment.id} already exists in DB. Skipped.`);
    }

    await order.save();
    console.log("💾 MongoDB order updated");

    return res.status(200).json({
      message: 'Order partially fulfilled successfully and MongoDB updated.',
      data: newFulfillment,
    });
  } catch (error) {
    console.error('❌ Error in fulfillOrder:', error.message, error);
    return res.status(500).json({ error: 'Server error while fulfilling order.' });
  }
};
