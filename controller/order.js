import { authModel } from '../Models/auth.js';
import { orderModel } from '../Models/order.js';
import axios from 'axios';
import mongoose from 'mongoose';
import { listingModel } from '../Models/Listing.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import dayjs from 'dayjs';
import minMax from 'dayjs/plugin/minMax.js';
dayjs.extend(minMax);
import { PayoutConfig } from '../Models/finance.js';
import { orderRquestModel } from '../Models/OrderRequest.js';
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

export const createOrder = async (req, res) => {
  try {
    const orderData = req.body;
    const orderId = String(orderData.id);
    const shopifyOrderNo = orderData.order_number;

    const productId = orderData.line_items?.[0]?.product_id;

    if (!productId) return res.status(400).send('Missing product ID');

    const productExists = await checkProductExists(productId);
    if (!productExists) {
      return res.status(404).send('Product does not exist');
    }

    const quantity = orderData.line_items[0]?.quantity || 0;

    let existingOrder = await orderModel.findOne({ orderId });

    let serialNumber;

    if (existingOrder) {
      serialNumber = existingOrder.serialNumber;

      await orderModel.updateOne(
        { orderId },
        {
          $set: {
            customer: orderData.customer,
            lineItems: orderData.line_items,
            createdAt: orderData.created_at,
            shopifyOrderNo,
          },
        }
      );
    } else {
      const lastOrder = await orderModel
        .findOne({ serialNumber: { $ne: null } })
        .sort({ serialNumber: -1 });

      const lastSerial =
        typeof lastOrder?.serialNumber === 'number' &&
        !isNaN(lastOrder.serialNumber)
          ? lastOrder.serialNumber
          : 100;

      serialNumber = lastSerial + 1;

      await orderModel.create({
        orderId,
        customer: orderData.customer,
        lineItems: orderData.line_items,
        createdAt: orderData.created_at,
        serialNumber,
        shopifyOrderNo,
      });
    }

    const user = await authModel.findOne({ email: orderData.customer.email });
    if (!user) return res.status(404).send('User not found');

    if (user.subscription) {
      user.subscription.quantity = (user.subscription.quantity || 0) + quantity;
    } else {
      user.subscription = { quantity };
    }

    await user.save();

    res.status(200).json({
      message: 'Order saved (or updated) and user updated',
      orderId,
      shopifyOrderNo,

      serialNumber,
    });
  } catch (error) {
    console.error(' Error saving order:', error);
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

        const product = await listingModel.findOne({
          'variants.id': variantId,
        });

        if (product && product.userId && product.userId.toString() === userId) {
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
            new Map(
              existingOrder.lineItems.map((item) => [item.variant_id, item])
            )
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

export const getOrderDatafromShopify = async (req, res) => {
  const orderId = req.params.id;
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const shopifyConfig = await shopifyConfigurationModel.findOne();

    if (!shopifyConfig) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

    const response = await axios.get(
      `${shopifyStoreUrl}/admin/api/2024-01/orders/${orderId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyAccessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    const order = response.data.order;

    const filteredLineItems = [];
    const variantOwnershipMap = new Map();

    for (const item of order.line_items || []) {
      const variantId = item.variant_id?.toString();
      if (!variantId) continue;

      const product = await listingModel.findOne({ 'variants.id': variantId });

      if (product && product.userId?.toString() === userId) {
        const matchedVariant = product.variants.find((v) => v.id === variantId);

        if (matchedVariant?.image_id && Array.isArray(product.variantImages)) {
          const image = product.variantImages.find(
            (img) => img.id === matchedVariant.image_id
          );

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
        variantOwnershipMap.set(variantId, true);
      }
    }

    const filteredFulfillments = (order.fulfillments || [])
      .map((f) => {
        const ownedItems = (f.line_items || []).filter((item) =>
          variantOwnershipMap.has(item.variant_id?.toString())
        );
        return ownedItems.length > 0 ? { ...f, line_items: ownedItems } : null;
      })
      .filter((f) => f !== null);

    if (filteredLineItems.length === 0 && filteredFulfillments.length === 0) {
      return res.status(404).json({
        message: 'No matching items or fulfillments found for this user.',
      });
    }

    const filteredOrder = {
      ...order,
      line_items: filteredLineItems,
      fulfillments: filteredFulfillments,
    };

    res.json({
      message: 'Filtered Shopify order for user',
      data: filteredOrder,
    });
  } catch (error) {
    console.error(
      'Error fetching filtered order:',
      error.response?.data || error.message
    );
    res.status(500).json({
      message: 'Failed to fetch filtered order',
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
      const merchantGroups = new Map();

      for (const item of order.lineItems || []) {
        const variantId = item.variant_id?.toString();
        if (!variantId) continue;

        const product = await listingModel.findOne({
          'variants.id': variantId,
        });
        if (!product || !product.userId) continue;

        const merchantId = product.userId.toString();

        const matchedVariant = product.variants.find((v) => v.id === variantId);
        if (matchedVariant?.image_id && Array.isArray(product.variantImages)) {
          const image = product.variantImages.find(
            (img) => img.id === matchedVariant.image_id
          );
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

        item.orderId = order.orderId;
        item.customer = [
          {
            first_name: order.customer?.first_name || '',
            last_name: order.customer?.last_name || '',
            email: order.customer?.email || '',
            phone: order.customer?.phone || '',
            created_at: order.customer?.created_at || '',
            default_address: order.customer?.default_address || {},
          },
        ];

        if (!merchantGroups.has(merchantId)) {
          merchantGroups.set(merchantId, []);
        }
        merchantGroups.get(merchantId).push(item);

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
          }
        }

        if (!merchantStatsMap.has(merchantId)) {
          merchantStatsMap.set(merchantId, {
            totalOrdersCount: 0,
            totalOrderValue: 0,
            ordersSeen: new Set(),
          });
        }

        const merchantStats = merchantStatsMap.get(merchantId);

        if (!merchantStats.ordersSeen.has(order.orderId)) {
          merchantStats.ordersSeen.add(order.orderId);
          merchantStats.totalOrdersCount += 1;
        }

        merchantStats.totalOrderValue +=
          (item.price || 0) * (item.quantity || 1);
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

    // if (finalOrders.length > 0) {
    //   return res.status(200).send({
    //     message: 'Orders grouped per order (not merged by merchant)',
    //     data: finalOrders,
    //   });
    if (finalOrders.length > 0) {
      // Sort so latest orders appear on top
      finalOrders.sort((a, b) => b.serialNo - a.serialNo);

      return res.status(200).send({
        message: 'Orders grouped per order (not merged by merchant)',
        data: finalOrders,
      });
    } else {
      return res.status(404).send({
        message: 'No orders found across merchants',
      });
    }
  } catch (error) {
    console.error(' Error in getAllOrdersForAdmin:', error);
    res.status(500).send({ message: 'Internal Server Error' });
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

export const addPayouts = async (req, res) => {
  const {
    payoutFrequency,
    graceTime = 0,
    firstDate,
    secondDate,
    weeklyDay,
  } = req.body;

  if (!payoutFrequency) {
    return res.status(400).json({ message: 'Payout frequency is required.' });
  }

  try {
    let config = await PayoutConfig.findOne();
    if (!config) config = new PayoutConfig();

    config.graceTime = graceTime;
    config.payoutFrequency = payoutFrequency;

    const graceStart = dayjs().add(graceTime, 'day').startOf('day');

    switch (payoutFrequency) {
      case 'daily':
        config.firstPayoutDate = graceStart.toDate();
        config.secondPayoutDate = null;
        config.weeklyDay = null;
        break;

      case 'weekly':
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
        let nextWeekly = graceStart;

        while (nextWeekly.day() !== targetDay) {
          nextWeekly = nextWeekly.add(1, 'day');
        }

        config.firstPayoutDate = nextWeekly.toDate();
        config.secondPayoutDate = null;
        config.weeklyDay = weeklyDay;
        break;

      case 'once':
        if (!firstDate) {
          return res
            .status(400)
            .json({ message: 'First date is required for monthly payout.' });
        }

        config.firstPayoutDate = new Date(firstDate);
        config.secondPayoutDate = null;
        config.weeklyDay = null;
        break;

      case 'twice':
        if (!firstDate || !secondDate) {
          return res
            .status(400)
            .json({ message: 'Both dates are required for twice a month.' });
        }

        config.firstPayoutDate = new Date(firstDate);
        config.secondPayoutDate = new Date(secondDate);
        config.weeklyDay = null;
        break;

      default:
        return res
          .status(400)
          .json({ message: 'Invalid payout frequency selected.' });
    }

    await config.save();

    return res.json({ message: ' Payout config saved successfully.' });
  } catch (error) {
    console.error(' Error saving payout config:', error);
    return res.status(500).json({ message: 'Failed to save payout config.' });
  }
};
export const getPayoutDate = async (req, res) => {
  const config = await PayoutConfig.findOne();
  if (!config)
    return res.status(404).json({ message: 'No payout dates found' });

  res.json({
    firstDate: config.firstPayoutDate,
    secondDate: config.secondPayoutDate,
    payoutFrequency: config.payoutFrequency,
    graceTime: config.graceTime,
    weeklyDay: config.weeklyDay,
  });
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
    return base.isBefore(possible[0]) ? possible[0] : possible[2]; // d1 next month
  }

  const next = possible.find((d) => d.isAfter(base));
  return next || possible[0];
}

export const getPayout = async (req, res) => {
  try {
    const config = await PayoutConfig.findOne({});
    if (!config) {
      return res.status(400).json({ error: 'Payout config not found.' });
    }

    const orders = await orderModel.find({});
    const updates = [];
    let totalPayoutAmount = 0;

    for (const order of orders) {
      const createdAt = dayjs(order.createdAt);
      const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
      const payoutDate = getNextPayoutDate(eligibleDate.toDate(), config);

      order.eligibleDate = eligibleDate.toDate();
      order.scheduledPayoutDate = payoutDate.toDate();

      const lineItems = order.lineItems || [];
      let payoutAmount = 0;
      const enrichedLineItems = [];

      for (const item of lineItems) {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        const total = price * qty;
        payoutAmount += total;

        let merchantName = 'Unknown';
        let merchantEmail = 'Unknown';
        let merchantId = null;

        const variantId = item.variantId || item.variant_id;
        if (variantId) {
          const listing = await listingModel.findOne({
            'variants.id': String(variantId),
          });

          if (listing && listing.userId) {
            const merchant = await authModel.findById(listing.userId);
            if (merchant) {
              merchantName =
                `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
              merchantEmail = merchant.email || 'N/A';
              merchantId = merchant._id;
            }
          }
        }

        enrichedLineItems.push({
          ...item,
          merchantName,
          merchantEmail,
          merchantId,
        });
      }

      order.payoutAmount = payoutAmount;
      await order.save();

      totalPayoutAmount += payoutAmount;

      updates.push({
        orderId: order._id,
        shopifyOrderId: order.orderId,
        shopifyOrderNo: order.shopifyOrderNo || 'N/A',
        eligibleDate: order.eligibleDate,
        scheduledPayoutDate: order.scheduledPayoutDate,
        payoutStatus: order.payoutStatus || 'pending',
        payoutAmount,
        createdAt: order.createdAt,
        lineItems: enrichedLineItems,
      });
    }

    const grouped = {};

    updates.forEach((order) => {
      const key = `${dayjs(order.scheduledPayoutDate).format('YYYY-MM-DD')}__${order.payoutStatus}`;
      if (!grouped[key]) {
        grouped[key] = {
          payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
          status: order.payoutStatus === 'Deposited' ? 'Deposited' : 'Pending',
          createdAts: [],
          totalAmount: 0,
          orders: [],
          sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
        };
      }

      grouped[key].createdAts.push(dayjs(order.createdAt));
      grouped[key].totalAmount += order.payoutAmount || 0;

      grouped[key].orders.push({
        orderId: order.orderId,
        shopifyOrderId: order.shopifyOrderId,
        shopifyOrderNo: order.shopifyOrderNo,
        amount: order.payoutAmount,
        status: order.payoutStatus,
        createdAt: order.createdAt,
        lineItems: order.lineItems || [],
      });
    });

    const payouts = Object.values(grouped)
      .map((group) => {
        const minDate = dayjs.min(group.createdAts);
        const maxDate = dayjs.max(group.createdAts);
        return {
          payoutDate: group.payoutDate,
          transactionDates: `${minDate.format('MMM D')} – ${maxDate.format('MMM D, YYYY')}`,
          status: group.status,
          amount: `$${group.totalAmount.toFixed(2)} AUD`,
          orders: group.orders,
          sortKey: group.sortKey,
        };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
        return b.sortKey - a.sortKey;
      });

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

//     for (const order of orders) {
//       const createdAt = dayjs(order.createdAt);
//       const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
//       const payoutDate = getNextPayoutDate(eligibleDate.toDate(), config);

//       order.eligibleDate = eligibleDate.toDate();
//       order.scheduledPayoutDate = payoutDate.toDate();

//       const lineItems = order.lineItems || [];
//       let payoutAmount = 0;
//       const enrichedLineItems = [];

//       for (const item of lineItems) {
//         const price = Number(item.price) || 0;
//         const qty = Number(item.quantity) || 0;
//         const total = price * qty;

//         let merchantName = 'Unknown';
//         let merchantEmail = 'Unknown';
//         let merchantId = null;

//         const variantId = item.variantId || item.variant_id;
//         if (variantId) {
//           const listing = await listingModel.findOne({
//             'variants.id': String(variantId),
//           });

//           if (listing && listing.userId) {
//             merchantId = String(listing.userId); // convert to string for comparison

//             if (userId && merchantId !== String(userId)) {
//               continue; // skip this item, not matching userId
//             }

//             const merchant = await authModel.findById(listing.userId);
//             if (merchant) {
//               merchantName =
//                 `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
//               merchantEmail = merchant.email || 'N/A';
//             }
//           }
//         }

//         enrichedLineItems.push({
//           ...item,
//           merchantName,
//           merchantEmail,
//           merchantId,
//         });

//         payoutAmount += total;
//       }

//       if (enrichedLineItems.length === 0) {
//         continue; // skip if no items matched the user
//       }

//       order.payoutAmount = payoutAmount;
//       await order.save();

//       totalPayoutAmount += payoutAmount;

//       updates.push({
//         orderId: order._id,
//         shopifyOrderId: order.orderId,
//         shopifyOrderNo: order.shopifyOrderNo || 'N/A',
//         eligibleDate: order.eligibleDate,
//         scheduledPayoutDate: order.scheduledPayoutDate,
//         payoutStatus: order.payoutStatus || 'pending',
//         payoutAmount,
//         createdAt: order.createdAt,
//         lineItems: enrichedLineItems,
//       });
//     }

//     // group by payoutDate + status
//     const grouped = {};

//     updates.forEach((order) => {
//       const key = `${dayjs(order.scheduledPayoutDate).format('YYYY-MM-DD')}__${order.payoutStatus}`;
//       if (!grouped[key]) {
//         grouped[key] = {
//           payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
//           status: order.payoutStatus === 'Deposited' ? 'Deposited' : 'Pending',
//           createdAts: [],
//           totalAmount: 0,
//           orders: [],
//           sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
//         };
//       }

//       grouped[key].createdAts.push(dayjs(order.createdAt));
//       grouped[key].totalAmount += order.payoutAmount || 0;

//       grouped[key].orders.push({
//         orderId: order.orderId,
//         shopifyOrderId: order.shopifyOrderId,
//         shopifyOrderNo: order.shopifyOrderNo,
//         amount: order.payoutAmount,
//         status: order.payoutStatus,
//         createdAt: order.createdAt,
//         lineItems: order.lineItems || [],
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
      let payoutAmount = 0;
      let refundAmount = 0;
      const enrichedLineItems = [];

      for (const item of lineItems) {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        const total = price * qty;
        const isCancelled = item.fulfillment_status === 'cancelled';

        let merchantName = 'Unknown';
        let merchantEmail = 'Unknown';
        let merchantId = null;

        const variantId = item.variantId || item.variant_id;
        if (variantId) {
          const listing = await listingModel.findOne({
            'variants.id': String(variantId),
          });

          if (listing && listing.userId) {
            merchantId = String(listing.userId);

            if (userId && merchantId !== String(userId)) {
              continue;
            }

            const merchant = await authModel.findById(listing.userId);
            if (merchant) {
              merchantName =
                `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
              merchantEmail = merchant.email || 'N/A';
            }
          }
        }

        enrichedLineItems.push({
          ...item,
          merchantName,
          merchantEmail,
          merchantId,
          isCancelled,
        });

        if (isCancelled) {
          refundAmount += total;
        } else {
          payoutAmount += total;
        }
      }

      if (enrichedLineItems.length === 0) {
        continue;
      }

      order.payoutAmount = payoutAmount;
      order.refundAmount = refundAmount;
      await order.save();

      totalPayoutAmount += payoutAmount;
      totalRefundAmount += refundAmount;

      updates.push({
        orderId: order._id,
        shopifyOrderId: order.orderId,
        shopifyOrderNo: order.shopifyOrderNo || 'N/A',
        eligibleDate: order.eligibleDate,
        scheduledPayoutDate: order.scheduledPayoutDate,
        payoutStatus: order.payoutStatus || 'pending',
        payoutAmount,
        refundAmount,
        createdAt: order.createdAt,
        lineItems: enrichedLineItems,
      });
    }

    const grouped = {};

    updates.forEach((order) => {
      const key = `${dayjs(order.scheduledPayoutDate).format('YYYY-MM-DD')}__${order.payoutStatus}`;
      if (!grouped[key]) {
        grouped[key] = {
          payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
          status: order.payoutStatus === 'Deposited' ? 'Deposited' : 'Pending',
          createdAts: [],
          totalAmount: 0,
          totalRefundAmount: 0,
          orders: [],
          sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
        };
      }

      grouped[key].createdAts.push(dayjs(order.createdAt));
      grouped[key].totalAmount += order.payoutAmount || 0;
      grouped[key].totalRefundAmount += order.refundAmount || 0;

      grouped[key].orders.push({
        orderId: order.orderId,
        shopifyOrderId: order.shopifyOrderId,
        shopifyOrderNo: order.shopifyOrderNo,
        amount: order.payoutAmount,
        refund: order.refundAmount,
        status: order.payoutStatus,
        createdAt: order.createdAt,
        lineItems: order.lineItems || [],
      });
    });

    const payouts = Object.values(grouped)
      .map((group) => {
        const minDate = dayjs.min(group.createdAts);
        const maxDate = dayjs.max(group.createdAts);
        return {
          payoutDate: group.payoutDate,
          transactionDates: `${minDate.format('MMM D')} – ${maxDate.format('MMM D, YYYY')}`,
          status: group.status,
          amount: `$${group.totalAmount.toFixed(2)} AUD`,
          totalRefundAmount: `$${group.totalRefundAmount.toFixed(2)} AUD`,
          orders: group.orders,
          sortKey: group.sortKey,
        };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
        return b.sortKey - a.sortKey;
      });

    res.json({
      message: 'Payouts calculated',
      totalAmount: totalPayoutAmount,
      totalRefundAmount: totalRefundAmount,
      payouts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while calculating payouts' });
  }
};

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
    const referenceNo = merchant?.referenceNo || 'N/A';
    const paypalAccount = merchant.paypalAccount || 'N/A';

    const orderQuery = {};
    if (status) {
      orderQuery.payoutStatus = new RegExp(`^${status}$`, 'i');
    }

    const orders = await orderModel.find(orderQuery);
    const updates = [];
    let totalPayoutAmount = 0;

    for (const order of orders) {
      const createdAt = dayjs(order.createdAt);
      const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
      const payoutDateObj = getNextPayoutDate(eligibleDate.toDate(), config);

      order.eligibleDate = eligibleDate.toDate();
      order.scheduledPayoutDate = payoutDateObj.toDate();

      const lineItems = order.lineItems || [];
      let payoutAmount = 0;
      let refundAmount = 0;
      const products = [];

      for (const item of lineItems) {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        const total = price * qty;

        const variantId = item.variantId || item.variant_id;
        const listing = await listingModel.findOne({
          'variants.id': String(variantId),
        });

        if (!listing || String(listing.userId) !== String(userId)) {
          continue;
        }

        const productData = {
          title: item.title || '',
          variantTitle: item.variant_title || '',
          price,
          quantity: qty,
          total,
          fulfillment_status: item.fulfillment_status || 'fulfilled',
          cancelled: item.fulfillment_status === 'cancelled',
        };

        if (productData.cancelled) {
          refundAmount += total;
        } else {
          payoutAmount += total;
        }

        products.push(productData);
      }

      if (products.length === 0) {
        continue;
      }

      order.payoutAmount = payoutAmount;
      order.refundAmount = refundAmount;
      await order.save();

      totalPayoutAmount += payoutAmount;

      updates.push({
        orderId: order.orderId,
        shopifyOrderNo: order.shopifyOrderNo || 'N/A',
        eligibleDate: order.eligibleDate,
        scheduledPayoutDate: order.scheduledPayoutDate,
        payoutStatus: order.payoutStatus || 'pending',
        payoutAmount,
        refundAmount,
        createdAt: order.createdAt,
        referenceNo,
        paypalAccount,

        products,
      });
    }

    const grouped = {};

    updates.forEach((order) => {
      const key = `${dayjs(order.scheduledPayoutDate).format('YYYY-MM-DD')}__${order.payoutStatus}`;
      if (!grouped[key]) {
        grouped[key] = {
          payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
          status: order.payoutStatus === 'Deposited' ? 'Deposited' : 'Pending',
          createdAts: [],
          totalAmount: 0,
          totalRefundAmount: 0,
          orders: [],
          sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
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
        status: order.payoutStatus,
        createdAt: order.createdAt,
        referenceNo: order.referenceNo || '',
        paypalAccount: order.paypalAccount || '',

        products: order.products || [],
      });
    });

    let payouts = Object.values(grouped)
      .map((group) => {
        const minDate = dayjs.min(group.createdAts);
        const maxDate = dayjs.max(group.createdAts);
        return {
          payoutDate: group.payoutDate,
          transactionDates: `${minDate.format('MMM D')} – ${maxDate.format('MMM D, YYYY')}`,
          status: group.status,
          amount: `$${group.totalAmount.toFixed(2)} AUD`,
          totalRefundAmount: `$${group.totalRefundAmount.toFixed(2)} AUD`,
          orders: group.orders,
          sortKey: group.sortKey,
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

    for (const order of orders) {
      const createdAt = dayjs(order.createdAt);
      const eligibleDate = createdAt.add(config.graceTime ?? 7, 'day');
      const payoutDateObj = getNextPayoutDate(eligibleDate.toDate(), config);

      order.eligibleDate = eligibleDate.toDate();
      order.scheduledPayoutDate = payoutDateObj.toDate();

      const lineItems = order.lineItems ?? [];
      let payoutAmount = 0;
      let refundAmount = 0;
      const products = [];

      for (const item of lineItems) {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        const total = price * qty;
        const cancelled = item.fulfillment_status === 'cancelled';

        let userId = null;

        if (item.variant_id) {
          const listing = await listingModel
            .findOne({
              'variants.id': String(item.variant_id),
            })
            .select('userId');

          userId = listing?.userId?.toString() || null;

          if (userId) allUserIds.add(userId);
        }

        const productData = {
          title: item.title || '',
          variantTitle: item.variant_title || '',
          price,
          quantity: qty,
          total,
          fulfillment_status: item.fulfillment_status || 'fulfilled',
          cancelled,
          userId,
        };

        if (cancelled) {
          refundAmount += total;
        } else {
          payoutAmount += total;
        }

        products.push(productData);
      }

      order.payoutAmount = payoutAmount;
      order.refundAmount = refundAmount;
      await order.save();

      totalPayoutAmount += payoutAmount;

      updates.push({
        orderId: order.orderId,
        shopifyOrderNo: order.shopifyOrderNo || 'N/A',
        eligibleDate: order.eligibleDate,
        scheduledPayoutDate: order.scheduledPayoutDate,
        payoutStatus: order.payoutStatus || 'pending',
        payoutAmount,
        refundAmount,
        createdAt: order.createdAt,
        products,
      });
    }

    const userDataMap = {};
    const userList = await authModel
      .find({
        _id: { $in: Array.from(allUserIds) },
      })
      .select('_id referenceNo paypalAccount');

    userList.forEach((user) => {
      userDataMap[user._id.toString()] = {
        referenceNo: user.referenceNo || '',
        paypalAccount: user.paypalAccount || '',
      };
    });

    updates.forEach((order) => {
      order.products.forEach((product) => {
        if (product.userId) {
          const userData = userDataMap[product.userId] || {};
          product.referenceNo = userData.referenceNo || '';
          product.paypalAccount = userData.paypalAccount || '';
        }
      });

      const userRef = order.products.find(
        (p) => p.userId && userDataMap[p.userId]
      );
      order.referenceNo = userRef?.userId
        ? userDataMap[userRef.userId].referenceNo
        : '';

      order.paypalAccount = userRef?.userId
        ? userDataMap[userRef.userId].paypalAccount
        : '';
    });

    updates.forEach((order) => {
      const key = `${dayjs(order.scheduledPayoutDate).format('YYYY-MM-DD')}__${order.payoutStatus}`;
      if (!grouped[key]) {
        grouped[key] = {
          payoutDate: dayjs(order.scheduledPayoutDate).format('MMM D, YYYY'),
          status: order.payoutStatus === 'Deposited' ? 'Deposited' : 'Pending',
          createdAts: [],
          totalAmount: 0,
          totalRefundAmount: 0,
          orders: [],
          sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
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
        status: order.payoutStatus,
        createdAt: order.createdAt,
        referenceNo: order.referenceNo || '',
        paypalAccount: order.paypalAccount || '',
        products: order.products || [],
      });
    });

    let payouts = Object.values(grouped)
      .map((group) => {
        const minDate = dayjs.min(group.createdAts);
        const maxDate = dayjs.max(group.createdAts);
        return {
          payoutDate: group.payoutDate,
          transactionDates: `${minDate.format('MMM D')} – ${maxDate.format('MMM D, YYYY')}`,
          status: group.status,
          amount: `$${group.totalAmount.toFixed(2)} AUD`,
          totalRefundAmount: `$${group.totalRefundAmount.toFixed(2)} AUD`,
          orders: group.orders,
          sortKey: group.sortKey,
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

export const addReferenceToOrders = async (req, res) => {
  try {
    const { UserIds, referenceNo } = req.body;

    if (!Array.isArray(UserIds) || UserIds.length === 0 || !referenceNo) {
      return res.status(400).json({
        message: 'UserIds (array) and referenceNo are required.',
      });
    }

    const result = await authModel.updateMany(
      { _id: { $in: UserIds } },
      { $set: { referenceNo } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        message: 'No users found or reference not updated.',
      });
    }

    res.status(200).json({
      message: 'Reference number added to all specified users.',
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error('Error updating user references:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
