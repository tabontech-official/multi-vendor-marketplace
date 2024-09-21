// import mongoose from "mongoose";

// const orderItemSchema = new mongoose.Schema({
//     productId: { type: String, required: true }, // Product ID as a string (e.g., from Shopify)
//     name: { type: String, required: true }, // Product name
//     quantity: { type: Number, required: true }, // Quantity of the product ordered
//     price: { type: Number, required: true } // Price of the product at the time of order
// });

// const orderSchema = new mongoose.Schema({
//     orderId: { type: String, required: true, unique: true }, // Unique order ID from Shopify
//     customerEmail: { type: String, required: true }, // Customer's email address
//     customerName: { type: String, required: true }, // Customer's name
//     items: [orderItemSchema], // Array of order items
//     totalAmount: { type: Number, required: true }, // Total amount for the order
//     createdAt: { type: Date, default: Date.now }, // Order creation date
//     subscriptionEndDate: { type: Date }, // Subscription end date
// }, {
//     timestamps: true // Automatically manages createdAt and updatedAt fields
// });

// // Create the model from the schema
// export const orderModel = mongoose.model('orders', orderSchema);

import mongoose from "mongoose";

// Define the schema for individual order items
const orderItemSchema = new mongoose.Schema({
    productId: { type: String, required: true }, // Product ID as a string (e.g., from Shopify)
    name: { type: String, required: true }, // Product name
    quantity: { type: Number, required: true }, // Quantity of the product ordered
    price: { type: Number, required: true }, // Price of the product at the time of order
    sku: { type: String }, // SKU of the product
    variantId: { type: String }, // Variant ID if applicable
    vendor: { type: String }, // Vendor name
    totalDiscount: { type: Number, default: 0 }, // Total discount applied to this item
});

// Define the main order schema
const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true }, // Unique order ID from Shopify
    customerEmail: { type: String, required: true }, // Customer's email address
    customerName: { type: String, required: true }, // Customer's name
    shippingAddress: { 
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        address1: { type: String, required: true },
        address2: { type: String },
        city: { type: String, required: true },
        province: { type: String, required: true },
        country: { type: String, required: true },
        zip: { type: String, required: true },
        phone: { type: String },
    }, // Shipping address details
    items: [orderItemSchema], // Array of order items
    totalAmount: { type: Number, required: true }, // Total amount for the order
    createdAt: { type: Date, default: Date.now }, // Order creation date
    subscriptionEndDate: { type: Date }, // Subscription end date
    activeStatus: { type: String, enum: ['active', 'inactive'], default: 'inactive' }, // Active status of the subscription
}, {
    timestamps: true // Automatically manages createdAt and updatedAt fields
});

// Create the model from the schema
export const orderModel = mongoose.model('orders', orderSchema);
