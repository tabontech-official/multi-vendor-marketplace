import { orderModel } from "../Models/order.js";


export const createOrder = async (req, res) => {
    const orderData = req.body;

    try {
        const lineItems = orderData.line_items.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: parseFloat(item.price),
        }));

        const newOrder = new orderModel({
            order_id: orderData.id,
            customer_name: orderData.customer ? `${orderData.customer.first_name} ${orderData.customer.last_name}` : 'Guest',
            total_price: parseFloat(orderData.total_price),
            line_items: lineItems,
        });

        await newOrder.save();
        res.status(200).send('Order saved to MongoDB');
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).send('Internal Server Error');
    }
};

export const getOrder = async (req, res) => {
    try {
        const userId = req.params.userId;

        // Validate userId
         const products = await orderModel.find({ userId: userId });

        // Check if products were found
        if (products.length === 0) {
          return res
            .status(404)
            .json({ message: 'No products found for this user.' });
        }
    
        // Send the found products as a response
        res.status(200).json({ products });
    } catch (error) {
        console.error('Error in getOrder function:', error);
        res.status(500).json({ error: error.message });
    }
};

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