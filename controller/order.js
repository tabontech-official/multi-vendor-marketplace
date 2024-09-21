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


export const createOrder = async (req, res) => {
    const orderData = req.body;

    console.log("Incoming order data:", JSON.stringify(orderData, null, 2));

    // Validate required fields
    const { line_items } = orderData;
    if (!Array.isArray(line_items) || line_items.length === 0) {
        return res.status(400).send({ message: 'Line items are required' });
    }

    try {
        const productIds = line_items.map(item => item.product_id.toString());
        
        // Check for existing product IDs in the MongoDB order collection
        const existingProducts = await orderModel.find({
            "items.productId": { $in: productIds }
        });

        const validItems = [];
        
        line_items.forEach(item => {
            const exists = existingProducts.some(product =>
                product.items.some(validItem => validItem.productId === item.product_id.toString())
            );

            if (exists) {
                validItems.push({
                    productId: item.product_id,
                    name: item.name || 'Unknown', // Ensure name is available
                    quantity: item.quantity,
                    price: parseFloat(item.price),
                });
            }
        });

        // If no valid items are found, respond accordingly
        if (validItems.length === 0) {
            return res.status(400).send({ message: 'No valid product IDs found in the database' });
        }

        // Proceed to save the order if at least one valid item exists
        const totalAmount = validItems.reduce((total, item) => total + item.price * item.quantity, 0).toFixed(2);

        const newOrder = new orderModel({
            orderId: orderData.id,
            customerEmail: orderData.email,
            customerName: `${orderData.shipping_address.first_name} ${orderData.shipping_address.last_name}`,
            shippingAddress: {
                firstName: orderData.shipping_address.first_name,
                lastName: orderData.shipping_address.last_name,
                address1: orderData.shipping_address.address1,
                address2: orderData.shipping_address.address2,
                city: orderData.shipping_address.city,
                province: orderData.shipping_address.province,
                country: orderData.shipping_address.country,
                zip: orderData.shipping_address.zip,
                phone: orderData.shipping_address.phone,
            },
            items: validItems,
            totalAmount,
            createdAt: new Date(),
        });

        await newOrder.save();

        res.status(201).send({
            message: 'Order saved successfully',
            orderId: newOrder.orderId,
            totalAmount: newOrder.totalAmount,
            items: validItems,
        });

    } catch (error) {
        console.error('Error processing order:', error);
        res.status(500).send({ message: 'Error processing order', error: error.message });
    }
}
