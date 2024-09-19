import mongoose from "mongoose";
import { orderModel } from "../Models/order.js";
import { productModel } from "../Models/product.js";


export const createOrder = async (req, res) => {
    try {
        const userId = req.params.userId;
        const orderProducts = req.body.products; // [{ productId, variantId, quantity }]
        
        let totalPrice = 0;

        for (const orderProduct of orderProducts) {
            const product = await productModel.findById(orderProduct.productId);
            if (!product) {
                return res.status(400).send({ message: `Product not found for ID: ${orderProduct.productId}` });
            }
            
            const variant = product.variants.find(v => v.id === orderProduct.variantId);
            if (!variant) {
                return res.status(400).send({ message: `Variant not found for ID: ${orderProduct.variantId}` });
            }

            const price = parseFloat(variant.price);
            totalPrice += price * orderProduct.quantity; 
        }

        const orderData = new orderModel({
            userId: userId,
            items: orderProducts.map(p => ({ productId: p.productId, quantity: p.quantity })),
            totalPrice: totalPrice
        });

        const savedOrder = await orderData.save();

        res.status(200).send({
            message: 'Order created',
            data: savedOrder
        });
    } catch (error) {
        res.status(400).send({ message: error.message });
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