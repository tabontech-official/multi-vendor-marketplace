import mongoose from "mongoose";
const orderSchema=new mongoose.Schema({
    order_id: Number,
    customer_name: String,
    total_price: Number,
    line_items: [{
        product_id: Number,
        quantity: Number,
        price: Number,
    }],
},{
    timestamps:true
})

export const orderModel=mongoose.model('orders',orderSchema)