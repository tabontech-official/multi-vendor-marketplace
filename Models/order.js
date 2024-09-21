import mongoose from "mongoose";
const orderItemSchema = new mongoose.Schema({
    productId: { type: String, required: true }, // Product ID as a string (e.g., from Shopify)
    name: { type: String, required: true }, // Product name
    quantity: { type: Number, required: true }, // Quantity of the product ordered
    price: { type: Number, required: true } // Price of the product at the time of order
});

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true }, // Unique order ID from Shopify
    customerEmail: { type: String, required: true }, // Customer's email address
    customerName: { type: String, required: true }, // Customer's name
    items: [orderItemSchema], // Array of order items
    totalAmount: { type: Number, required: true }, // Total amount for the order
    createdAt: { type: Date, default: Date.now }, // Order creation date
    subscriptionEndDate: { type: Date },
},{
    timestamps:true
});
export const orderModel=mongoose.model('orders',orderSchema)