import { timeStamp } from "console";
import mongoose from "mongoose";
const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    items: [
        {
            productId: { type: String, required: true },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true }
        }
    ],
    totalAmount: {
        type: Number,
        required: true
    },
   
    
},{
 timeStamp:true
});
export const orderModel=mongoose.model('orders',orderSchema)