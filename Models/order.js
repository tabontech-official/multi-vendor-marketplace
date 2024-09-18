import mongoose from "mongoose";
const orderSchema=new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{ productId: String, quantity: Number }],
    totalPrice: { type: Number, required: true },
},{
    timestamps:true
})

export const orderModel=mongoose.model('orders',orderSchema)