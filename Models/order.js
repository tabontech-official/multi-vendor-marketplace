import mongoose from 'mongoose';

// Define nested schemas
const moneySchema = new mongoose.Schema({
    amount: { type: String, required: true },
    currency_code: { type: String, required: true }
});

const addressSchema = new mongoose.Schema({
    first_name: { type: String },
    last_name: { type: String },
    address1: { type: String },
    address2: { type: String },
    city: { type: String },
    province: { type: String },
    country: { type: String },
    zip: { type: String },
    phone: { type: String },
    company: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    name: { type: String },
    country_code: { type: String },
    province_code: { type: String }
});

const lineItemSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    name: { type: String, required: true },
    price: { type: String, required: true },
    quantity: { type: Number, required: true },
    sku: { type: String },
    taxable: { type: Boolean, default: true },
    total_discount: { type: String, default: "0.00" },
    price_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    // Add other relevant fields as necessary
});

// Main order schema
const orderSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    admin_graphql_api_id: { type: String },
    app_id: { type: String },
    browser_ip: { type: String },
    buyer_accepts_marketing: { type: Boolean, default: false },
    cancel_reason: { type: String },
    cancelled_at: { type: Date },
    cart_token: { type: String },
    checkout_id: { type: String },
    checkout_token: { type: String },
    client_details: { type: String },
    closed_at: { type: Date },
    confirmation_number: { type: String },
    confirmed: { type: Boolean, default: false },
    contact_email: { type: String },
    created_at: { type: Date, default: Date.now },
    currency: { type: String, default: 'USD' },
    current_subtotal_price: { type: String },
    current_subtotal_price_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    current_total_additional_fees_set: { type: String },
    current_total_discounts: { type: String },
    current_total_discounts_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    current_total_price: { type: String },
    current_total_price_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    current_total_tax: { type: String },
    current_total_tax_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    customer_locale: { type: String },
    device_id: { type: String },
    discount_codes: { type: [String] },
    email: { type: String },
    estimated_taxes: { type: Boolean, default: false },
    financial_status: { type: String },
    fulfillment_status: { type: String },
    landing_site: { type: String },
    landing_site_ref: { type: String },
    location_id: { type: String },
    merchant_business_entity_id: { type: String },
    name: { type: String },
    note: { type: String },
    note_attributes: { type: [String] },
    number: { type: Number },
    order_number: { type: Number },
    order_status_url: { type: String },
    payment_gateway_names: { type: [String] },
    phone: { type: String },
    po_number: { type: String },
    presentment_currency: { type: String },
    processed_at: { type: Date },
    reference: { type: String },
    referring_site: { type: String },
    source_identifier: { type: String },
    source_name: { type: String },
    subtotal_price: { type: String },
    subtotal_price_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    tags: { type: String },
    tax_exempt: { type: Boolean, default: false },
    taxes_included: { type: Boolean, default: false },
    test: { type: Boolean, default: false },
    token: { type: String },
    total_discounts: { type: String },
    total_discounts_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    total_line_items_price: { type: String },
    total_line_items_price_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    total_price: { type: String },
    total_price_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    total_shipping_price_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    total_tax: { type: String },
    total_tax_set: {
        shop_money: moneySchema,
        presentment_money: moneySchema
    },
    total_tip_received: { type: String },
    total_weight: { type: Number, default: 0 },
    updated_at: { type: Date },
    user_id: { type: String },
    billing_address: addressSchema,
    customer: {
        id: { type: Number },
        email: { type: String },
        first_name: { type: String },
        last_name: { type: String },
        verified_email: { type: Boolean },
        default_address: addressSchema
    },
    discount_applications: { type: [String] },
    fulfillments: { type: [String] },
    line_items: [lineItemSchema],
    payment_terms: { type: String },
    refunds: { type: [String] },
    shipping_address: addressSchema,
    shipping_lines: [{
        id: { type: Number },
        discounted_price: { type: String },
        price: { type: String },
        title: { type: String }
    }]
}, {
    timestamps: true // Automatically manages createdAt and updatedAt fields
});

// Create the model from the schema
export const orderModel = mongoose.model('order', orderSchema);
