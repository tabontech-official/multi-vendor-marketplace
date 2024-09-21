import { authModel } from "../Models/auth.js";
import { orderModel } from "../Models/order.js";
import { productModel } from "../Models/product.js";
import fetch from 'node-fetch';
// export const createOrder = async (req, res) => {
//     const orderData = req.body;

//     // Create a new order object based on Shopify data
//     const newOrder = new orderModel({
//         orderId: orderData.id.toString(), // Ensure the order ID is a string
//         items: orderData.line_items.map(item => ({
//             productId: item.product_id.toString(), // Ensure the product ID is a string
//             quantity: item.quantity,
//             price: item.price
//         })),
//         totalAmount: orderData.total_price // Assuming total price is in the incoming data
//     });

//     try {
//         // Save the new order to MongoDB
//         await newOrder.save();
//         res.status(201).send({ message: 'Order saved successfully', orderId: newOrder.orderId });
//     } catch (error) {
//         console.error('Error saving order:', error);
//         res.status(500).send({ message: 'Error saving order', error });
//     }
// };

// export const createOrder = async (req, res) => {
//     const orderData = req.body;

//     // Create a new order object based on Shopify data
//     const newOrder = new orderModel({
//         orderId: orderData.id.toString(), // Ensure the order ID is a string
//         items: orderData.line_items.map(item => ({
//             productId: item.product_id.toString(), // Ensure the product ID is a string
//             quantity: item.quantity,
//             price: item.price
//         })),
//         totalAmount: orderData.total_price // Assuming total price is in the incoming data
//     });

//     try {
//         // Save the new order to MongoDB
//         await newOrder.save();

//         // Update product quantities and manage subscription status
//         for (const item of newOrder.items) {
//             const product = await productModel.findById(item.productId);

//             if (product) {
//                 // Update product quantity
//                 product.quantity -= item.quantity;

//                 if (item.quantity > 0) {
//                     // If quantity is greater than 0, set subscription end date
//                     product.subscriptionEndDate = new Date(Date.now() + item.quantity * 30 * 24 * 60 * 60 * 1000); // Add months based on quantity
//                     product.status = 'active'; // Set status to active
//                 } else {
//                     // If quantity is 0, mark as inactive
//                     product.status = 'inactive';
//                     product.subscriptionEndDate = null; // Clear the subscription end date
//                 }

//                 // Save the updated product
//                 await product.save();
//             }
//         }

//         res.status(201).send({ message: 'Order saved successfully', orderId: newOrder.orderId });
//     } catch (error) {
//         console.error('Error saving order:', error);
//         res.status(500).send({ message: 'Error saving order', error });
//     }
// };




export const createOrder = async (req, res) => {
    const orderData = req.body;
    console.log("Incoming order data:", orderData);

    // Extract required fields
    const { customer_email, customerName, line_items, id: orderId } = orderData;

    if (!customerName || !customer_email || !Array.isArray(line_items) || line_items.length === 0 || !orderId) {
        return res.status(400).send({ message: 'Customer name, email, line items, and order ID are required' });
    }

    try {
        const validItems = [];

        // Check each line item
        for (const item of line_items) {
            const productId = item.product_id.toString();

            // Check if the product exists in your database
            const product = await productModel.findOne({ shopifyId: productId });
            if (product) {
                validItems.push({
                    productId: productId,
                    name: item.title || product.name,
                    quantity: item.quantity,
                    price: parseFloat(item.price),
                });
            } else {
                console.error(`Product ID ${productId} not found in your database.`);
            }
        }

        if (validItems.length === 0) {
            return res.status(400).send({ message: 'No valid products found' });
        }

        // Calculate total amount
        const totalAmount = validItems.reduce((total, item) => total + item.price * item.quantity, 0);

        // Create new order object
        const newOrder = new orderModel({
            orderId: orderId.toString(),
            customerEmail: customer_email,
            customerName: customerName,
            items: validItems,
            totalAmount,
        });

        // Save the new order
        await newOrder.save();

        // Update inventory
        for (const item of validItems) {
            const product = await productModel.findOne({ shopifyId: item.productId });
            if (product) {
                product.inventory_quantity -= item.quantity;
                product.status = product.inventory_quantity > 0 ? 'active' : 'inactive';
                await product.save();
            }
        }

        res.status(201).send({
            message: 'Order saved successfully',
            orderId: newOrder.orderId,
            createdAt: newOrder.createdAt,
            totalAmount,
            items: validItems,
        });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).send({ message: 'Error saving order', error: error.message });
    }
};


export const getOrderById = async (req, res) => {
    const { shopifyUserId } = req.params; // Get shopifyUserId from URL parameters

    if (!shopifyUserId) {
        return res.status(400).send({ message: 'Shopify User ID is required' });
    }

    try {
        // Fetch orders associated with the shopifyUserId
        const orders = await orderModel.find({ customerEmail: shopifyUserId });

        if (orders.length === 0) {
            return res.status(404).send({ message: 'No subscriptions found for this Shopify user' });
        }

        // Filter orders to return only subscription-related information
        const subscriptionData = orders.map(order => ({
            orderId: order.orderId,
            totalAmount: order.totalAmount,
            subscriptionEndDate: order.subscriptionEndDate,
            items: order.items,
            createdAt: order.createdAt,
        }));

        res.status(200).send({ message: 'Subscriptions fetched successfully', subscriptions: subscriptionData });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).send({ message: 'Error fetching subscriptions', error: error.message });
    }
};


