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
import fs from 'fs';
dayjs.extend(customParseFormat);
dayjs.extend(minMax);

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

//     if (!productId) return res.status(400).send('Missing product ID');

//     const productExists = await checkProductExists(productId);
//     if (!productExists) {
//       return res.status(404).send('Product does not exist');
//     }

//     const quantity = orderData.line_items[0]?.quantity || 0;

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
//         createdAt: orderData.created_at,
//         serialNumber,
//         shopifyOrderNo,
//       });
//     }

//     const user = await authModel.findOne({ email: orderData.customer.email });
//     if (!user) return res.status(404).send('User not found');

//     if (user.subscription) {
//       user.subscription.quantity = (user.subscription.quantity || 0) + quantity;
//     } else {
//       user.subscription = { quantity };
//     }

//     await user.save();

//     res.status(200).json({
//       message: 'Order saved (or updated) and user updated',
//       orderId,
//       shopifyOrderNo,

//       serialNumber,
//     });
//   } catch (error) {
//     console.error(' Error saving order:', error);
//     res.status(500).send('Error saving order');
//   }
// };



export const createOrder = async (req, res) => {
  try {
    const orderData = req.body;
    const orderId = String(orderData.id);
    const shopifyOrderNo = orderData.order_number;

    const productId = orderData.line_items?.[0]?.product_id;
    if (!productId) {
      return res.status(400).send('Missing product ID');
    }

    const product = await listingModel.findOne({ id: productId }).lean();
    if (!product) {
      return res.status(404).send('Product does not exist');
    }

    const quantity = orderData.line_items?.reduce(
      (sum, i) => sum + (i.quantity || 0),
      0
    );

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
            ProductSnapshot: product, 
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
        ProductSnapshot: product, 
        createdAt: orderData.created_at,
        serialNumber,
        shopifyOrderNo,
      });
    }

    const user = await authModel.findOne({ email: orderData.customer.email });
    if (user) {
      if (user.subscription) {
        user.subscription.quantity =
          (user.subscription.quantity || 0) + quantity;
      } else {
        user.subscription = { quantity };
      }
      await user.save();
    }

    res.status(200).json({
      message: 'Order saved (or updated) with product snapshot',
      orderId,
      shopifyOrderNo,
      serialNumber,
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
//     const userId = req.userId.toString();
//     if (!userId) {
//       return res.status(400).send({ message: 'User ID is required' });
//     }

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).send({ message: 'Invalid user ID' });
//     }

//     const allOrders = await orderModel.find({});
//     console.log('📦 Total Orders Found:', allOrders.length);

//     const ordersGroupedByOrderId = new Map();

//     for (const order of allOrders) {
//       const filteredLineItems = [];

//       for (const item of order.lineItems || []) {
//         const variantId = item.variant_id?.toString();
//         if (!variantId) continue;

//         const product = await listingModel.findOne({
//           'variants.id': variantId,
//         });

//         if (product && product.userId && product.userId.toString() === userId) {
//           const matchedVariant = product.variants.find((v) => v.id === variantId);

//           let imageData = null;

//           // ✅ 1) Variant-specific image check
//           if (matchedVariant?.image_id && Array.isArray(product.variantImages)) {
//             const image = product.variantImages.find(
//               (img) => img.id === matchedVariant.image_id
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

//           // ✅ 2) Fallback to first product image
//           if (!imageData && Array.isArray(product.images) && product.images.length > 0) {
//             const fallback = product.images[0]; // first product image
//             imageData = {
//               id: fallback.id,
//               src: fallback.src,
//               alt: fallback.alt || 'Product image',
//               position: fallback.position,
//               width: fallback.width,
//               height: fallback.height,
//             };
//           }

//           if (imageData) {
//             item.image = imageData;
//           }

//           filteredLineItems.push(item);
//         }
//       }

//       if (filteredLineItems.length > 0) {
//         const orderForUser = order.toObject();
//         orderForUser.lineItems = filteredLineItems;

//         if (ordersGroupedByOrderId.has(order.orderId)) {
//           const existingOrder = ordersGroupedByOrderId.get(order.orderId);
//           existingOrder.lineItems.push(...filteredLineItems);

//           existingOrder.lineItems = Array.from(
//             new Map(existingOrder.lineItems.map((item) => [item.variant_id, item]))
//           ).map(([_, item]) => item);
//         } else {
//           ordersGroupedByOrderId.set(order.orderId, orderForUser);
//         }
//       }
//     }

//     const matchedOrders = Array.from(ordersGroupedByOrderId.values());

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
    const userId = req.userId?.toString();
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send({ message: "Invalid user ID" });
    }

    const allOrders = await orderModel.find({});
    console.log("📦 Total Orders Found:", allOrders.length);

    const ordersGroupedByOrderId = new Map();

    for (const order of allOrders) {
      const filteredLineItems = [];

      // ✅ check order.ProductSnapshot to see if this order belongs to current user
      const snapshot = order.ProductSnapshot;
      const belongsToUser =
        snapshot?.userId?.toString?.() === userId ||
        (snapshot?.userId && snapshot.userId.toString() === userId);

      let defaultImage = null;
      if (belongsToUser && snapshot?.images?.length > 0) {
        const img = snapshot.images[0];
        defaultImage = {
          id: img.id,
          src: img.src,
          alt: img.alt || "Product image",
          position: img.position,
          width: img.width,
          height: img.height,
        };
      }

      for (const item of order.lineItems || []) {
        let imageData = defaultImage;
        const variantId = item.variant_id?.toString();

        // 🔄 if product still exists, try to refresh the image
        if (variantId) {
          const product = await listingModel
            .findOne({ "variants.id": variantId })
            .lean();
          if (product && product.userId?.toString() === userId) {
            const matchedVariant = product.variants.find(
              (v) => v.id === variantId
            );

            // variant-specific image
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

            // fallback to first product image
            if (
              !imageData &&
              Array.isArray(product.images) &&
              product.images.length > 0
            ) {
              const fallback = product.images[0];
              imageData = {
                id: fallback.id,
                src: fallback.src,
                alt: fallback.alt || "Product image",
                position: fallback.position,
                width: fallback.width,
                height: fallback.height,
              };
            }
          }
        }

        // ✅ include only if this order belongs to the user
        if (belongsToUser) {
          const enrichedItem = { ...item };
          if (imageData) enrichedItem.image = imageData;
          filteredLineItems.push(enrichedItem);
        }
      }

      if (filteredLineItems.length > 0) {
        const orderForUser = order.toObject();
        orderForUser.lineItems = filteredLineItems;

        if (ordersGroupedByOrderId.has(order.orderId)) {
          const existingOrder = ordersGroupedByOrderId.get(order.orderId);
          existingOrder.lineItems.push(...filteredLineItems);

          // remove duplicates by variant_id
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
        message: "Orders found for user",
        data: matchedOrders,
      });
    } else {
      return res.status(404).send({
        message: "No orders found for this user's products",
      });
    }
  } catch (error) {
    console.error("❌ Error fetching user orders:", error);
    res.status(500).send({ message: "Internal Server Error" });
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

// export const getAllOrdersForAdmin = async (req, res) => {
//   try {
//     const allOrders = await orderModel.find({});
//     console.log('✅ Total orders fetched from DB:', allOrders.length);

//     const finalOrders = [];
//     const merchantDetailsMap = new Map();
//     const merchantStatsMap = new Map();

//     for (const order of allOrders) {
//       console.log(
//         '\n📦 Processing Order:',
//         order.shopifyOrderNo,
//         'Order ID:',
//         order.orderId
//       );
//       const merchantGroups = new Map();

//       for (const item of order.lineItems || []) {
//         const variantId = item.variant_id?.toString();
//         if (!variantId) {
//           console.log('⚠️ Skipped item with no variant_id');
//           continue;
//         }

//         const product = await listingModel.findOne({
//           'variants.id': variantId,
//         });
//         if (!product) {
//           console.log('⚠️ Product not found for variant ID:', variantId);
//           continue;
//         }
//         if (!product.userId) {
//           console.log('⚠️ Product found but has no userId');
//           continue;
//         }

//         const merchantId = product.userId.toString();
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
//             console.log(
//               '🖼️ Matched variant image set for item:',
//               item.title || item.name
//             );
//           }
//         }

//         // ✅ Fallback Product Image (if no variant image was set)
//         if (
//           !item.image &&
//           Array.isArray(product.images) &&
//           product.images.length > 0
//         ) {
//           const defaultImage = product.images[0];
//           item.image = {
//             id: defaultImage.id || null,
//             src: defaultImage.src,
//             alt: defaultImage.alt || '',
//             position: defaultImage.position || 1,
//             width: defaultImage.width || null,
//             height: defaultImage.height || null,
//           };
//           console.log(
//             '🖼️ Default product image set for item:',
//             item.title || item.name
//           );
//         }

//         item.orderId = order.orderId;
//         item.customer = [
//           {
//             first_name: order.customer?.first_name || '',
//             last_name: order.customer?.last_name || '',
//             email: order.customer?.email || '',
//             phone: order.customer?.phone || '',
//             created_at: order.customer?.created_at || '',
//             default_address: order.customer?.default_address || {},
//           },
//         ];

//         if (!merchantGroups.has(merchantId)) {
//           merchantGroups.set(merchantId, []);
//         }
//         merchantGroups.get(merchantId).push(item);

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
//             console.log('👤 Merchant details cached for ID:', merchantId);
//           } else {
//             console.log('⚠️ Merchant not found for ID:', merchantId);
//           }
//         }

//         if (!merchantStatsMap.has(merchantId)) {
//           merchantStatsMap.set(merchantId, {
//             totalOrdersCount: 0,
//             totalOrderValue: 0,
//             ordersSeen: new Set(),
//           });
//         }

//         const merchantStats = merchantStatsMap.get(merchantId);
//         if (!merchantStats.ordersSeen.has(order.orderId)) {
//           merchantStats.ordersSeen.add(order.orderId);
//           merchantStats.totalOrdersCount += 1;
//         }

//         const amount = (item.price || 0) * (item.quantity || 1);
//         merchantStats.totalOrderValue += amount;

//         console.log(
//           `💰 Added amount ${amount} to merchant ${merchantId} | Product: ${item.title || item.name}`
//         );
//       }

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

//       console.log(
//         '✅ Order processed:',
//         order.shopifyOrderNo,
//         'Merchants involved:',
//         merchantsArray.length
//       );
//     }

//     if (finalOrders.length > 0) {
//       finalOrders.sort((a, b) => b.serialNo - a.serialNo);
//       console.log('🚀 Returning', finalOrders.length, 'orders to client.');
//       return res.status(200).send({
//         message: 'Orders grouped per order (not merged by merchant)',
//         data: finalOrders,
//       });
//     } else {
//       console.log('❌ No final orders found.');
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
    console.log("✅ Total orders fetched from DB:", allOrders.length);

    const finalOrders = [];
    const merchantDetailsMap = new Map();
    const merchantStatsMap = new Map();

    for (const order of allOrders) {
      console.log(
        "\n📦 Processing Order:",
        order.shopifyOrderNo,
        "Order ID:",
        order.orderId
      );
      const merchantGroups = new Map();

      const snapshot = order.ProductSnapshot;

      for (const item of order.lineItems || []) {
        const variantId = item.variant_id?.toString();
        let merchantId = snapshot?.userId?.toString() || null;
        let imageData = null;

        // ✅ 1) Use snapshot first
        if (snapshot) {
          if (snapshot?.images?.length > 0) {
            const img = snapshot.images[0];
            imageData = {
              id: img.id,
              src: img.src,
              alt: img.alt || "Product image",
              position: img.position,
              width: img.width,
              height: img.height,
            };
          }
        }

        // ✅ 2) Try to refresh product info if product still exists
        if (variantId) {
          const product = await listingModel
            .findOne({ "variants.id": variantId })
            .lean();

          if (product) {
            merchantId = product.userId?.toString() || merchantId;

            const matchedVariant = product.variants.find(
              (v) => v.id === variantId
            );

            // variant-specific image
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

            // fallback to first product image
            if (
              !imageData &&
              Array.isArray(product.images) &&
              product.images.length > 0
            ) {
              const defaultImage = product.images[0];
              imageData = {
                id: defaultImage.id || null,
                src: defaultImage.src,
                alt: defaultImage.alt || "",
                position: defaultImage.position || 1,
                width: defaultImage.width || null,
                height: defaultImage.height || null,
              };
            }
          }
        }

        // ✅ Skip only if no merchantId found at all
        if (!merchantId) {
          console.log(
            "⚠️ Skipped item because merchantId could not be determined"
          );
          continue;
        }

        const enrichedItem = {
          ...item,
          image: imageData || item.image || null,
          orderId: order.orderId,
          customer: [
            {
              first_name: order.customer?.first_name || "",
              last_name: order.customer?.last_name || "",
              email: order.customer?.email || "",
              phone: order.customer?.phone || "",
              created_at: order.customer?.created_at || "",
              default_address: order.customer?.default_address || {},
            },
          ],
        };

        if (!merchantGroups.has(merchantId)) {
          merchantGroups.set(merchantId, []);
        }
        merchantGroups.get(merchantId).push(enrichedItem);

        // ✅ Merchant details cache
        if (!merchantDetailsMap.has(merchantId)) {
          const merchant = await authModel
            .findById(merchantId)
            .select("-password");
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

        // ✅ Merchant stats
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

      // ✅ Build final object
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
        message: "Orders grouped per order (not merged by merchant)",
        data: finalOrders,
      });
    } else {
      return res
        .status(404)
        .send({ message: "No orders found across merchants" });
    }
  } catch (error) {
    console.error("❌ Error in getAllOrdersForAdmin:", error);
    return res.status(500).send({ message: "Internal Server Error" });
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

    const now = dayjs().add(graceTime, 'day');
    const currentMonth = now.month(); // 0-indexed
    const currentYear = now.year();

    switch (payoutFrequency) {
      case 'daily':
        config.firstPayoutDate = now.startOf('day').toDate();
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
        if (targetDay === undefined) {
          return res.status(400).json({ message: 'Invalid weekly day.' });
        }

        let nextWeekly = now;
        while (nextWeekly.day() !== targetDay) {
          nextWeekly = nextWeekly.add(1, 'day');
        }

        config.firstPayoutDate = nextWeekly.toDate();
        config.secondPayoutDate = null;
        config.weeklyDay = weeklyDay;
        break;

      case 'once':
        if (typeof firstDate !== 'number' || firstDate < 1) {
          return res
            .status(400)
            .json({ message: 'First payout day is required.' });
        }

        config.firstPayoutDate = dayjs()
          .set('date', Math.min(firstDate, 28))
          .set('month', currentMonth)
          .set('year', currentYear)
          .toDate();

        config.secondPayoutDate = null;
        config.weeklyDay = null;
        break;

      case 'twice':
        if (
          typeof firstDate !== 'number' ||
          typeof secondDate !== 'number' ||
          firstDate < 1 ||
          secondDate < 1
        ) {
          return res
            .status(400)
            .json({ message: 'Both payout days required.' });
        }

        config.firstPayoutDate = dayjs()
          .set('date', Math.min(firstDate, 28))
          .set('month', currentMonth)
          .set('year', currentYear)
          .toDate();

        config.secondPayoutDate = dayjs()
          .set('date', Math.min(secondDate, 28))
          .set('month', currentMonth)
          .set('year', currentYear)
          .toDate();

        config.weeklyDay = null;
        break;

      default:
        return res
          .status(400)
          .json({ message: 'Invalid payout frequency selected.' });
    }

    await config.save();

    return res.json({ message: 'Payout config saved successfully.' });
  } catch (error) {
    console.error('❌ Error saving payout config:', error);
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
    return base.isBefore(possible[0]) ? possible[0] : possible[2];
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
    const currentDate = dayjs().startOf('day');

    for (const order of orders) {
      let createdAt = dayjs(order.createdAt);

      if (dayjs(order.scheduledPayoutDate).isSame(currentDate, 'day')) {
        const lineItems = order.lineItems || [];
        const isAnyItemUnfulfilled = lineItems.some(
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

      if (!order.scheduledPayoutDate || !order.eligibleDate) {
        const eligibleDate = createdAt.add(config.graceTime || 7, 'day');
        const payoutDate = getNextPayoutDate(eligibleDate.toDate(), config);

        if (!order.eligibleDate) {
          order.eligibleDate = eligibleDate.toDate();
        }

        if (!order.scheduledPayoutDate) {
          order.scheduledPayoutDate = payoutDate.toDate();
        }
      }

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
          orders: {},
          sortKey: dayjs(order.scheduledPayoutDate).valueOf(),
        };
      }

      grouped[key].createdAts.push(dayjs(order.createdAt));
      grouped[key].totalAmount += order.payoutAmount || 0;

      order.lineItems.forEach((line) => {
        const merchantKey = `${line.merchantId}-${order.scheduledPayoutDate}`;

        if (!grouped[key].orders[merchantKey]) {
          grouped[key].orders[merchantKey] = {
            merchantId: line.merchantId,
            merchantName: line.merchantName || 'Unknown',
            merchantEmail: line.merchantEmail || 'Unknown',
            fulfilledCount: 0,
            unfulfilledCount: 0,
            totalAmount: 0,
            lineItems: [],
          };
        }

        grouped[key].orders[merchantKey].totalAmount +=
          parseFloat(line.price) * line.current_quantity;

        if (line.fulfillment_status === 'fulfilled') {
          grouped[key].orders[merchantKey].fulfilledCount += 1;
        } else if (line.fulfillment_status === null) {
          grouped[key].orders[merchantKey].unfulfilledCount += 1;
        }

        grouped[key].orders[merchantKey].lineItems.push(line);
      });
    });

    const allPayouts = Object.values(grouped)
      .map((group) => {
        const minDate = dayjs.min(group.createdAts);
        const maxDate = dayjs.max(group.createdAts);

        return {
          payoutDate: group.payoutDate,
          transactionDates: `${minDate.format('MMM D')} – ${maxDate.format('MMM D, YYYY')}`,
          status: group.status,
          amount: `$${group.totalAmount.toFixed(2)} AUD`,
          orders: Object.values(group.orders),
          sortKey: group.sortKey,
        };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Pending' ? -1 : 1;
        return b.sortKey - a.sortKey;
      });

    // Pagination logic
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPayouts = allPayouts.slice(startIndex, endIndex);

    res.json({
      message: 'Payouts calculated',
      totalAmount: totalPayoutAmount,
      totalPayouts: allPayouts.length,
      page,
      limit,
      payouts: paginatedPayouts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while calculating payouts' });
  }
};

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
      let fulfilledCount = 0;
      let unfulfilledCount = 0;

      for (const item of lineItems) {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
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

            if (userId && merchantId !== String(userId)) continue;

            const merchant = await authModel.findById(listing.userId);
            if (merchant) {
              merchantName =
                `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim();
              merchantEmail = merchant.email || 'N/A';
            }
          }
        }

        // Count fulfillment ONLY if not cancelled
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
          isCancelled: status === 'cancelled',
        });

        if (status === 'cancelled') {
          refundAmount += total;
        } else {
          payoutAmount += total;
        }
      }

      if (enrichedLineItems.length === 0) continue;

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
        fulfillmentSummary: {
          fulfilled: fulfilledCount,
          unfulfilled: unfulfilledCount,
        },
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
        status: order.payoutStatus,
        createdAt: order.createdAt,
        fulfillmentSummary: order.fulfillmentSummary,
        lineItems: order.lineItems,
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
          totalFulfilled: group.totalFulfilled,
          totalUnfulfilled: group.totalUnfulfilled,
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
          fulfillment_status: item.fulfillment_status || 'Unfullfilled',
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
      if (!order.scheduledPayoutDate || !order.eligibleDate) {
        const eligibleDate = createdAt.add(config.graceTime ?? 7, 'day');
        const payoutDateObj = getNextPayoutDate(eligibleDate.toDate(), config);

        if (!order.eligibleDate) {
          order.eligibleDate = eligibleDate.toDate();
        }
        if (!order.scheduledPayoutDate) {
          order.scheduledPayoutDate = payoutDateObj.toDate();
        }
      }

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
            .findOne({ 'variants.id': String(item.variant_id) })
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
          fulfillment_status: item.fulfillment_status || 'Unfulfilled',
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
      .find({ _id: { $in: Array.from(allUserIds) } })
      .select(
        '_id referenceNo paypalAccount paypalAccountNo paypalReferenceNo bankDetails'
      );

    userList.forEach((user) => {
      userDataMap[user._id.toString()] = {
        referenceNo: user.referenceNo || '',
        paypalAccount: user.paypalAccount || '',
        paypalAccountNo: user.paypalAccountNo || '',
        paypalReferenceNo: user.paypalReferenceNo || '',
        bankDetails: user.bankDetails || {},
      };
    });

    updates.forEach((order) => {
      order.products.forEach((product) => {
        if (product.userId) {
          const userData = userDataMap[product.userId] || {};
          product.referenceNo = userData.referenceNo || '';
          product.paypalAccount = userData.paypalAccount || '';
          product.bankDetails = userData.bankDetails || {};
        }
      });

      const userRef = order.products.find(
        (p) => p.userId && userDataMap[p.userId]
      );

      if (userRef?.userId) {
        order.referenceNo = userDataMap[userRef.userId].referenceNo || '';
        order.paypalAccount = userDataMap[userRef.userId].paypalAccount || '';
        order.bankDetails = userDataMap[userRef.userId].bankDetails || {};
      }
    });

    updates.forEach((order) => {
      const key = `${dayjs(order.scheduledPayoutDate).format(
        'YYYY-MM-DD'
      )}__${order.payoutStatus}`;
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
        bankDetails: order.bankDetails || {},
        products: order.products || [],
      });
    });

    let payouts = Object.values(grouped)
      .map((group) => {
        const minDate = dayjs.min(group.createdAts);
        const maxDate = dayjs.max(group.createdAts);
        return {
          payoutDate: group.payoutDate,
          transactionDates: `${minDate.format('MMM D')} – ${maxDate.format(
            'MMM D, YYYY'
          )}`,
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

// export const exportOrders = async (req, res) => {
//   try {
//     const orders = await orderModel.find({}).lean();

//     if (!orders.length) {
//       return res.status(404).json({ message: 'No orders found' });
//     }

//     const rows = [];

//     for (const order of orders) {
//       const base = {
//         OrderID: order.orderId || '',
//         ShopifyOrderNo: order.shopifyOrderNo || '',
//         SerialNumber: order.serialNumber || '',
//         PayoutAmount: order.payoutAmount || '',
//         PayoutStatus: order.payoutStatus || '',
//         EligiblePayoutDate: order.eligibleDate
//           ? new Date(order.eligibleDate).toLocaleDateString()
//           : '',
//         ScheduledPayoutDate: order.scheduledPayoutDate
//           ? new Date(order.scheduledPayoutDate).toLocaleDateString()
//           : '',
//         OrderCreatedAt: order.createdAt
//           ? new Date(order.createdAt).toLocaleString()
//           : '',
//         OrderUpdatedAt: order.updatedAt
//           ? new Date(order.updatedAt).toLocaleString()
//           : '',
//         CustomerEmail: order.customer?.email || '',
//         CustomerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`,
//         CustomerPhone: order.customer?.phone || '',
//         CustomerCreated: order.customer?.created_at || '',
//       };

//       if (Array.isArray(order.lineItems)) {
//         for (const item of order.lineItems) {
//           rows.push({
//             ...base,
//             LineItemID: item.id || '',
//             ProductName: item.name || '',
//             SKU: item.sku || '',
//             Vendor: item.vendor || '',
//             Quantity: item.quantity || '',
//             Price: item.price || '',
//             FulfillmentStatus: item.fulfillment_status || 'unfulfilled',
//             VariantTitle: item.variant_title || '',
//             ProductID: item.product_id || '',
//             VariantID: item.variant_id || '',
//           });
//         }
//       } else {
//         rows.push(base);
//       }
//     }

//     const fields = Object.keys(rows[0]);
//     const parser = new Parser({ fields });
//     const csv = parser.parse(rows);

//     const filename = `orders-export-${Date.now()}.csv`;
//     const isVercel = process.env.VERCEL === '1';
//     const exportDir = isVercel ? '/tmp' : path.join(process.cwd(), 'exports');

//     if (!isVercel && !fs.existsSync(exportDir)) {
//       fs.mkdirSync(exportDir, { recursive: true });
//     }

//     const filePath = path.join(exportDir, filename);
//     fs.writeFileSync(filePath, csv);

//     res.download(filePath, filename, (err) => {
//       if (err) {
//         console.error('Download error:', err);
//         res.status(500).send('Error downloading file');
//       }
//       fs.unlinkSync(filePath); // Clean up file after sending
//     });
//   } catch (error) {
//     console.error('Export Orders Error:', error);
//     res
//       .status(500)
//       .json({ message: 'Server error during export.', error: error.message });
//   }
// };

export const exportOrders = async (req, res) => {
  try {
    const { status } = req.query; // e.g. 'fulfilled', 'unfulfilled', 'cancelled'
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

      if (Array.isArray(order.lineItems)) {
        for (const item of order.lineItems) {
          const itemStatus = item.fulfillment_status || 'unfulfilled';

          // 🔽 FILTER based on status if provided
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
        // Skip if no lineItems and status is applied
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
      fs.unlinkSync(filePath); // Clean up
    });
  } catch (error) {
    console.error('Export Orders Error:', error);
    res.status(500).json({
      message: 'Server error during export.',
      error: error.message,
    });
  }
};

// export const exportProductsForUser = async (req, res) => {
//   try {
//     const userId = req.userId?.toString();
//     console.log(userId)
//     if (!userId) {
//       return res.status(400).json({ message: 'Missing userId' });
//     }

//     // Replace this with your actual data fetch function for that user
//     const response = await fetch(
//       `https://multi-vendor-marketplace.vercel.app/order/order/${userId}`
//     );
//     const result = await response.json();

//     if (!Array.isArray(result.data) || result.data.length === 0) {
//       return res
//         .status(404)
//         .json({ message: 'No orders found for this user.' });
//     }

//     const rows = [];

//     for (const order of result.data) {
//       const {
//         orderId,
//         shopifyOrderNo,
//         serialNumber,
//         payoutAmount,
//         payoutStatus,
//         createdAt,
//         updatedAt,
//         eligibleDate,
//         scheduledPayoutDate,
//         customer,
//         lineItems = [],
//       } = order;

//       for (const item of lineItems) {
//         rows.push({
//           OrderID: orderId,
//           ShopifyOrderNo: shopifyOrderNo,
//           SerialNumber: serialNumber,
//           ProductName: item.name || '',
//           SKU: item.sku || '',
//           Vendor: item.vendor || '',
//           Price: item.price || '',
//           Quantity: item.quantity || '',
//           FulfillmentStatus: item.fulfillment_status || 'unfulfilled',
//           VariantTitle: item.variant_title || '',
//           ProductID: item.product_id || '',
//           VariantID: item.variant_id || '',
//           PayoutAmount: payoutAmount || '',
//           PayoutStatus: payoutStatus || '',
//           EligiblePayoutDate: eligibleDate
//             ? new Date(eligibleDate).toLocaleDateString()
//             : '',
//           ScheduledPayoutDate: scheduledPayoutDate
//             ? new Date(scheduledPayoutDate).toLocaleDateString()
//             : '',
//           OrderCreatedAt: createdAt ? new Date(createdAt).toLocaleString() : '',
//           OrderUpdatedAt: updatedAt ? new Date(updatedAt).toLocaleString() : '',
//           CustomerEmail: customer?.email || '',
//           CustomerName: `${customer?.first_name || ''} ${customer?.last_name || ''}`,
//           CustomerPhone: customer?.phone || '',
//           CustomerCreated: customer?.created_at || '',
//           CustomerCity: customer?.default_address?.city || '',
//           CustomerCountry: customer?.default_address?.country || '',
//         });
//       }
//     }

//     if (rows.length === 0) {
//       return res.status(404).json({ message: 'No products found in orders.' });
//     }

//     const fields = Object.keys(rows[0]);
//     const parser = new Parser({ fields });
//     const csv = parser.parse(rows);

//     const filename = `export-user-${userId}-${Date.now()}.csv`;
//     const isVercel = process.env.VERCEL === '1';
//     const exportDir = isVercel ? '/tmp' : path.join(process.cwd(), 'exports');

//     if (!isVercel && !fs.existsSync(exportDir)) {
//       fs.mkdirSync(exportDir, { recursive: true });
//     }

//     const filePath = path.join(exportDir, filename);
//     fs.writeFileSync(filePath, csv);

//     res.download(filePath, filename, (err) => {
//       if (err) {
//         console.error('Download error:', err);
//         res.status(500).send('Download failed');
//       }
//       fs.unlinkSync(filePath);
//     });
//   } catch (err) {
//     console.error('Export Error:', err);
//     res.status(500).json({ message: 'Export failed', error: err.message });
//   }
// };

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

        console.log(
          `✅ Adding line item ${item.name} from product ${item.product_id} for user ${userId}`
        );

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
      console.log('⚠️ No products found in orders for user:', userId);
      return res
        .status(404)
        .json({ message: 'No products found in orders for this user.' });
    }

    console.log('✅ Total rows prepared for CSV:', rows.length);

    const fields = Object.keys(rows[0]);
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);
    console.log('✅ CSV data parsed successfully');

    const filename = `export-user-${userId}-${Date.now()}.csv`;
    const isVercel = process.env.VERCEL === '1';
    const exportDir = isVercel ? '/tmp' : path.join(process.cwd(), 'exports');

    if (!isVercel && !fs.existsSync(exportDir)) {
      console.log('📂 Creating export directory:', exportDir);
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, filename);
    console.log('📂 Writing CSV file at:', filePath);
    fs.writeFileSync(filePath, csv);

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('❌ Download error:', err);
        res.status(500).send('Download failed');
      } else {
        console.log('✅ File download initiated:', filename);
      }
      fs.unlinkSync(filePath);
      console.log('🗑️ Temp file deleted:', filePath);
    });
  } catch (err) {
    console.error('❌ Export Error:', err);
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

    // Fetch all orders and calculate sales contribution for each product
    const salesData = await orderModel.aggregate([
      {
        $unwind: '$lineItems', // Unwind the line items to process each product
      },
      {
        $addFields: {
          price: { $toDouble: '$lineItems.price' }, // Convert price to double (numeric)
          quantity: { $toInt: '$lineItems.quantity' }, // Convert quantity to integer
        },
      },
      {
        $group: {
          _id: '$lineItems.product_id', // Group by product_id
          totalSales: { $sum: { $multiply: ['$price', '$quantity'] } }, // Calculate total sales for each product
          productName: { $first: '$lineItems.name' }, // Get the product name
        },
      },
      {
        $project: {
          _id: 0, // Hide _id field
          productId: '$_id', // Include productId
          productName: 1, // Include productName
          totalSales: 1, // Include totalSales
        },
      },
      { $sort: { totalSales: -1 } }, // Sort by total sales (descending)
    ]);

    if (salesData.length === 0) {
      return res.json([]); // If no sales data found, return an empty array
    }

    // Format the result to show total sales contribution for each product
    const formattedData = salesData.map((item) => ({
      productName: item.productName,
      totalSales: item.totalSales,
    }));

    // Return the sales contribution data
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
