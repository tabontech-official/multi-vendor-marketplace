import { orderModel } from "../Models/order.js";


export const createOrder = async (req, res) => {
    const orderData = req.body;

    // Create a new order object based on Shopify data
    const newOrder = new orderModel({
        orderId: orderData.id.toString(), // Ensure the order ID is a string
        items: orderData.line_items.map(item => ({
            productId: item.product_id.toString(), // Ensure the product ID is a string
            quantity: item.quantity,
            price: item.price
        })),
        totalAmount: orderData.total_price // Assuming total price is in the incoming data
    });

    try {
        // Save the new order to MongoDB
        await newOrder.save();
        res.status(201).send({ message: 'Order saved successfully', orderId: newOrder.orderId });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).send({ message: 'Error saving order', error });
    }
};

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
                    quantity: { 
                        $multiply: ["$items.quantity", { $dayOfMonth: "$createdAt" }] // Multiply quantity by the day of the month
                    }
                }
            }
        ]);

        // Format the response
        const response = result.map(item => ({
            customerEmail: item.customerEmail,
            createdAt: item.createdAt,
            items: [{
                price: item.price,
                quantity: item.quantity
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