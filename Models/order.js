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



import mongoose from 'mongoose';

const { Schema } = mongoose;

const LineItemSchema = new Schema({
    id: { type: Number, required: true },
    admin_graphql_api_id: { type: String },
    current_quantity: { type: Number, required: true },
    fulfillable_quantity: { type: Number },
    fulfillment_service: { type: String },
    fulfillment_status: { type: String },
    gift_card: { type: Boolean },
    grams: { type: Number },
    name: { type: String, required: true },
    price: { type: String, required: true },
    product_exists: { type: Boolean },
    product_id: { type: Number, required: true },
    quantity: { type: Number, required: true },
    requires_shipping: { type: Boolean },
    sku: { type: String },
    taxable: { type: Boolean },
    title: { type: String, required: true },
    variant_id: { type: Number },
    vendor: { type: String },
    // Add any additional fields as necessary
});

const FulfillmentSchema = new Schema({
    id: { type: Number, required: true },
    admin_graphql_api_id: { type: String },
    created_at: { type: Date },
    status: { type: String },
    tracking_number: { type: String },
    tracking_url: { type: String },
    line_items: [LineItemSchema],
    // Add any additional fields as necessary
});

const CustomerSchema = new Schema({
    id: { type: Number, required: true },
    email: { type: String },
    first_name: { type: String },
    last_name: { type: String },
    verified_email: { type: Boolean },
    // Add any additional fields as necessary
});

const OrderSchema = new Schema({
    id: { type: Number, required: true },
    admin_graphql_api_id: { type: String },
    contact_email: { type: String, required: true },
    created_at: { type: Date, required: true },
    currency: { type: String, required: true },
    current_subtotal_price: { type: String, required: true },
    current_total_price: { type: String, required: true },
    customer: CustomerSchema,
    fulfillments: [FulfillmentSchema],
    line_items: [LineItemSchema],
    order_number: { type: Number, required: true },
    total_price: { type: String, required: true },
    // Add any additional fields as necessary
});

export const orderModel = mongoose.model('Order', OrderSchema);
