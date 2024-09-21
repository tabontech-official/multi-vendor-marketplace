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
    console.log("Incoming order data:", orderData); // Log the incoming data

    // Extract customer details
    const { customer_email, customerName, line_items } = orderData;

    if (!customerName) {
        return res.status(400).send({ message: 'Customer name is required' });
    }

    try {
        const productIds = line_items.map(item => item.product_id.toString());
        const validItems = [];
        
        // Basic Auth credentials
        const shopifyApiKey = process.env.SHOPIFY_API_KEY;
        const shopifyPassword = process.env.SHOPIFY_ACCESS_TOKEN;
        const shopifyStore = process.env.SHOPIFY_STORE_URL;

        for (const productId of productIds) {
            try {
                const response = await fetch(`https://${shopifyStore}/admin/api/2023-04/products/${productId}.json`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${shopifyApiKey}:${shopifyPassword}`).toString('base64')}`,
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.product) {
                        const item = line_items.find(item => item.product_id.toString() === productId);
                        validItems.push({
                            productId: productId,
                            name: data.product.title,
                            quantity: item.quantity,
                            price: item.price,
                        });
                    }
                } else {
                    console.error(`Product ID ${productId} not found: ${response.statusText}`);
                }
            } catch (error) {
                console.error(`Error fetching product ID ${productId}: ${error.message}`);
            }
        }

        if (validItems.length === 0) {
            return res.status(400).send({ message: 'No valid product IDs found in Shopify' });
        }

        const totalAmount = validItems.reduce((total, item) => total + item.price * item.quantity, 0);

        const newOrder = new orderModel({
            orderId: orderData.id.toString(),
            customerEmail: customer_email,
            customerName: customerName,
            items: validItems,
            totalAmount,
        });

        // Calculate subscription end date
        let subscriptionEndDate = new Date(); // Start from now

        validItems.forEach(item => {
            if (item.quantity > 0) {
                subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + item.quantity);
            }
        });

        newOrder.subscriptionEndDate = subscriptionEndDate;

        await newOrder.save();

        // Update inventory and subscription status logic...
        for (const item of validItems) {
            const product = await productModel.findOne({ shopifyId: item.productId });

            if (product) {
                product.inventory_quantity -= item.quantity;

                if (product.inventory_quantity > 0) {
                    product.status = 'active';
                } else {
                    product.status = 'inactive';
                    product.subscriptionEndDate = null; // Cancel subscription
                }

                await product.save();
            }
        }

        res.status(201).send({
            message: 'Order saved successfully',
            orderId: newOrder.orderId,
            createdAt: newOrder.createdAt, // Include createdAt date
            subscriptionEndDate: newOrder.subscriptionEndDate, // Include subscription end date
            totalAmount:totalAmount,
            items: validItems
        });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).send({ message: 'Error saving order', error: error.message });
    }
};


;





export const getOrder = async (req, res) => {
    const { shopifyUserId } = req.params;
    console.log(`Fetching orders for Shopify user: ${shopifyUserId}`);
    
    try {
        const orders = await orderModel.find({ shopifyUserId }); // Query based on shopifyUserId
  
        if (orders.length === 0) {
            return res.status(404).json({ message: 'No orders found for this user.' });
        }
  
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: error.message });
    }
};

// export const getOnProductId=async(req,res)=>{
//     const { productId } = req.params;

//     try {
//         // Find orders containing the specified productId
//         const orders = await orderModel.find({ "items.productId": productId });

//         // Map to extract only the required fields
//         const response = orders.map(order => ({
//             customerEmail: order.customerEmail,
//             items: order.items
//                 .filter(item => item.productId === productId) // Filter items for the specific productId
//                 .map(item => ({
//                     price: item.price,
//                     quantity: item.quantity
//                 }))
//         }));

//         res.status(200).json(response);
//     } catch (error) {
//         console.error('Error fetching orders:', error);
//         res.status(500).send({ message: 'Error fetching orders', error });
//     }
// }

export const getOnProductId = async (req, res) => {
    const { productId } = req.params;

    try {
        const result = await orderModel.aggregate([
            { 
                $match: { "items.productId": productId } // Match orders containing the specified productId 
            },
            { 
                $unwind: "$items" // Unwind the items array to work with individual items
            },
            { 
                $match: { "items.productId": productId } // Filter again for the specific productId
            },
            {
                $project: {
                    customerEmail: 1, // Include customerEmail
                    createdAt: 1, // Include createdAt date
                    price: "$items.price", // Include item price
                    quantity: "$items.quantity" // Include item quantity without multiplication
                }
            }
        ]);

        // Format the response
        const response = result.map(item => ({
            customerEmail: item.customerEmail,
            createdAt: item.createdAt,
            items: [{
                price: item.price,
                quantity: item.quantity // Directly using the quantity from the order
            }]
        }));

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send({ message: 'Error fetching orders', error });
    }
};

export const getOrderUserId=async(req,res)=>{
    try {
        const {userId}=req.params
        const data =await orderModel.find(userId).then(result=>{
            if(result){
                res.status(200).send({
                    message:'successfully fetched data',
                    data:data
                })
            }else{
                res.status(400).send('unable to fetch')
            }
        })
    } catch (error) {
        res.status(500).send({message:error.message})
    }
}

export const updateOrder=async(req,res)=>{
    try {
        const {id}=req.paarams
        const query=({$set:req.body})
        const data=await orderModel.findByIdAndUpdate(id,query).then(result=>{
            if(result){
                res.status(200).send({
                    message:"successfully updated",
                    data:data
                })
            }
        })
    } catch (error) {
        
    }
}

export const deleteOrder=async(req,res)=>{
    try {
        const {id}=req.params
       const data= await orderModel.findByIdAndDelete(id).then(result=>{
            if(result){
                res.status(200).send({
                    message:'order deleted successfully',
                    data:data
                })
            }else{
                res.status(400).send('unable to delete order')
            }
        })
    } catch (error) {
        
    }
} 