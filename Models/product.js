import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    title: { type: String, required: true },
    body_html: { type: String },
    vendor: { type: String },
    product_type: { type: String },
    created_at: { type: Date },
    handle: { type: String },
    updated_at: { type: Date },
    published_at: { type: Date },
    template_suffix: { type: String },
    tags: { type: String },

    // Variants as an array of objects
    variants: [
      {
        id: { type: Number, required: true },
        product_id: { type: Number, required: true },
        title: { type: String, required: true },
        price: { type: String, required: true },
        sku: { type: String },
        position: { type: Number },
        inventory_policy: { type: String },
        compare_at_price: { type: String },
        fulfillment_service: { type: String },
        inventory_management: { type: String },
        option1: { type: String },
        option2: { type: String },
        option3: { type: String },
        created_at: { type: Date },
        updated_at: { type: Date },
        taxable: { type: Boolean },
        barcode: { type: String },
        grams: { type: Number },
        image_id: { type: Number },
        weight: { type: Number },
        weight_unit: { type: String },
        inventory_item_id: { type: Number },
        inventory_quantity: { type: Number },
        old_inventory_quantity: { type: Number },
        presentment_prices: [
          {
            price: {
              amount: { type: String },
              currency_code: { type: String },
            },
            compare_at_price: {
              amount: { type: String },
              currency_code: { type: String },
            },
          },
        ],
      },
    ],

    // Options as an array of objects
    options: [
      {
        id: { type: Number },
        product_id: { type: Number },
        name: { type: String },
        position: { type: Number },
        values: [{ type: String }],
      },
    ],

    // Images as an array of objects
    images: [
      {
        id: { type: Number, required: true },
        product_id: { type: Number, required: true },
        position: { type: Number },
        created_at: { type: Date },
        updated_at: { type: Date },
        alt: { type: String },
        width: { type: Number },
        height: { type: Number },
        src: { type: String },
      },
    ],

    // A single image object
    image: {
      id: { type: Number },
      product_id: { type: Number },
      position: { type: Number },
      created_at: { type: Date },
      updated_at: { type: Date },
      alt: { type: String },
      width: { type: Number },
      height: { type: Number },
      src: { type: String },
    },

    // Metafields as an array of objects
    metafields: [
      {
        id: { type: Number, required: true },
        namespace: { type: String },
        key: { type: String },
        value: { type: String },
        value_type: { type: String },
        description: { type: String },
        owner_id: { type: Number },
        owner_resource: { type: String },
        created_at: { type: Date },
        updated_at: { type: Date },
      },
    ],
    equipment: {
      location: { type: String },
      name: { type: String },
      brand: { type: String },
      asking_price: { type: Number },
      accept_offers: { type: Boolean },
      equipment_type: { type: String },
      certification: { type: String },
      year_purchased: { type: Number },
      warranty: { type: String },
      reason_for_selling: { type: String },
      shipping: { type: String },
      sale_price: { type: Number },
      year_manufactured: { type: String },
      training: { type: String },
    },
    business: {
      location: String,
      businessDescription: String,
      askingPrice: Number,
      establishedYear: Number,
      numberOfEmployees: Number,
      locationMonthlyRent: Number,
      leaseExpirationDate: Date,
      locationSize: Number,
      grossYearlyRevenue: Number,
      cashFlow: Number,
      productsInventory: Number,
      equipmentValue: Number,
      reasonForSelling: String,
      listOfDevices: [String], // Array of strings for device list
      offeredServices: [String], // Array of strings for services
      supportAndTraining: String // Description of support and training offered
  }},
  {
    timestamps: true,
  }
);

export const productModel = mongoose.model('products', productSchema);
