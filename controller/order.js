import { authModel } from '../Models/auth.js';
import { orderModel } from '../Models/order.js';
import axios from 'axios';
import mongoose from 'mongoose';
import { listingModel } from '../Models/Listing.js';
// export const createOrder = async (req, res) => {
//     const orderData = req.body;
//     console.log("Incoming order data:", JSON.stringify(orderData, null, 2));

//     const { customer_email, customerName, line_items, shipping_address, shipping_lines } = orderData;

//     // Validate required fields
//     if (!customerName || !customer_email || !Array.isArray(line_items) || line_items.length === 0 || !orderData.id) {
//         return res.status(400).send({ message: 'Customer name, email, line items, and order ID are required' });
//     }

//     // Check if line items have correct structure
//     for (const item of line_items) {
//         if (!item.product_id || typeof item.quantity !== 'number') {
//             return res.status(400).send({ message: 'Each line item must have a valid product_id and quantity' });
//         }
//     }

//     try {
//         const productIds = line_items.map(item => item.product_id.toString());
//         const validItems = [];

//         const shopifyApiKey = process.env.SHOPIFY_API_KEY;
//         const shopifyPassword = process.env.SHOPIFY_ACCESS_TOKEN;
//         const shopifyStore = process.env.SHOPIFY_STORE_URL;

//         for (const productId of productIds) {
//             try {
//                 const response = await fetch(`https://${shopifyStore}/admin/api/2023-04/products/${productId}.json`, {
//                     method: 'GET',
//                     headers: {
//                         'Authorization': `Basic ${Buffer.from(`${shopifyApiKey}:${shopifyPassword}`).toString('base64')}`,
//                     }
//                 });

//                 if (response.ok) {
//                     const data = await response.json();
//                     if (data.product) {
//                         const item = line_items.find(item => item.product_id.toString() === productId);
//                         validItems.push({
//                             productId: productId,
//                             name: data.product.title, // Fetching product name
//                             quantity: item.quantity,
//                             price: parseFloat(item.price),
//                             sku: data.product.variants[0].sku || null, // SKU from the first variant
//                             // Add more fields as necessary
//                         });
//                     }
//                 } else {
//                     console.error(`Product ID ${productId} not found: ${response.statusText}`);
//                 }
//             } catch (error) {
//                 console.error(`Error fetching product ID ${productId}: ${error.message}`);
//             }
//         }

//         if (validItems.length === 0) {
//             return res.status(400).send({ message: 'No valid product IDs found in Shopify' });
//         }

//         const totalAmount = validItems.reduce((total, item) => total + item.price * item.quantity, 0);

//         const newOrder = new orderModel({
//             orderId: orderData.id.toString(),
//             customerEmail: customer_email,
//             customerName: customerName,
//             items: validItems,
//             totalAmount,
//             shippingAddress: {
//                 firstName: shipping_address.first_name,
//                 lastName: shipping_address.last_name,
//                 address1: shipping_address.address1,
//                 address2: shipping_address.address2 || null,
//                 city: shipping_address.city,
//                 province: shipping_address.province,
//                 country: shipping_address.country,
//                 zip: shipping_address.zip,
//                 phone: shipping_address.phone,
//                 company: shipping_address.company,
//                 latitude: shipping_address.latitude || null,
//                 longitude: shipping_address.longitude || null,
//             },
//             shippingLines: shipping_lines.map(line => ({
//                 title: line.title,
//                 price: parseFloat(line.price),
//                 discountedPrice: parseFloat(line.discounted_price || line.price),
//                 discount: parseFloat(line.discount || 0),
//                 currentDiscountedPriceSet: {
//                     shopMoney: {
//                         amount: parseFloat(line.current_discounted_price_set?.shop_money?.amount || 0),
//                         currency_code: 'USD'
//                     },
//                     presentmentMoney: {
//                         amount: parseFloat(line.current_discounted_price_set?.presentment_money?.amount || 0),
//                         currency_code: 'USD'
//                     }
//                 },
//                 isRemoved: line.is_removed || false,
//                 carrierIdentifier: line.carrier_identifier || null,
//                 code: line.code || null
//             })),
//             // Add any other fields you want to set
//         });

//         // Calculate subscription end date based on item quantities
//         newOrder.subscriptionEndDate = new Date();
//         validItems.forEach(item => {
//             if (item.quantity > 0) {
//                 newOrder.subscriptionEndDate.setMonth(newOrder.subscriptionEndDate.getMonth() + item.quantity);
//             }
//         });

//         await newOrder.save();

//         // Update inventory based on purchased items
//         for (const item of validItems) {
//             const product = await productModel.findOne({ shopifyId: item.productId });
//             if (product) {
//                 product.inventory_quantity -= item.quantity;
//                 product.status = product.inventory_quantity > 0 ? 'active' : 'inactive';
//                 if (product.inventory_quantity === 0) {
//                     product.subscriptionEndDate = null;
//                 }
//                 await product.save();
//             }
//         }

//         // Send response with order details
//         res.status(201).send({
//             message: 'Order saved successfully',
//             orderId: newOrder.orderId,
//             createdAt: newOrder.createdAt,
//             subscriptionEndDate: newOrder.subscriptionEndDate,
//             totalAmount: totalAmount,
//             items: validItems,
//         });
//     } catch (error) {
//         console.error('Error saving order:', error);
//         res.status(500).send({ message: 'Error saving order', error: error.message });
//     }
// };

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
    const productId = orderData.line_items[0].product_id;

    const productExists = await checkProductExists(productId);
    if (!productExists) {
      return res.status(404).send('Product does not exist');
    }

    const quantity = orderData.line_items[0].quantity;

    const order = new orderModel({
      orderId: orderData.id,
      customer: orderData.customer,
      lineItems: orderData.line_items,
      createdAt: orderData.created_at,
    });

    await order.save();

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
      message: 'Order saved and user updated',
      orderId: orderData.id,
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
//     const { email } = req.params;

//     try {
//         const orders = await orderModel.find({ 'customer.email': email });

//         if (orders.length > 0) {
//             res.status(200).send({
//                 message: 'Successfully fetched orders',
//                 data: orders
//             });
//         } else {
//             res.status(404).send({ message: 'No orders found for this email' });
//         }
//     } catch (error) {
//         console.error('Error fetching orders:', error);
//         res.status(500).send({ message: 'Error fetching orders' });
//     }
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
    console.log('🔍 Total Orders Found:', allOrders.length);

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
          filteredLineItems.push(item);
        }
      }

      if (filteredLineItems.length > 0) {
        const orderForUser = order.toObject();
        orderForUser.lineItems = filteredLineItems;

        if (ordersGroupedByOrderId.has(order.orderId)) {
          const existingOrder = ordersGroupedByOrderId.get(order.orderId);
          existingOrder.lineItems.push(...filteredLineItems);

          // Remove duplicate lineItems by variant_id
          existingOrder.lineItems = Array.from(
            new Map(existingOrder.lineItems.map(item => [item.variant_id, item]))
          ).map(([_, item]) => item);
        } else {
          ordersGroupedByOrderId.set(order.orderId, orderForUser);
        }
      }
    }

    const matchedOrders = Array.from(ordersGroupedByOrderId.values());

    console.log('✅ Total matched orders for user:', matchedOrders.length);

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
    console.error('❌ Error fetching user orders:', error);
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
