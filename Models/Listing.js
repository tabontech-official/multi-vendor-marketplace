import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    body_html: { type: String },
    vendor: { type: String },
    product_type: { type: String },
    created_at: { type: Date },
    handle: { type: String },
    updated_at: { type: Date },
    published_at: { type: Date },
    template_suffix: { type: String },
    tags: {
      type: [String],
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    variants: [
      {
        id: { type: String },
        title: { type: String },
        option1: String,
        option2: String,
        option3: String,
        price: String,
        compare_at_price: String,
        inventory_management: String,
        inventory_quantity: Number,
        sku: String,
        barcode: String,
        location_id: String,
        inventory_item_id: String,
        weight: Number,
        weight_unit: String,
        isParent: { type: Boolean, required: true, default: false },
        image_id: String,
        src: String,
        VariantStatus: {
          type: String,
          enum: ['inactive', 'active'],
          default: 'inactive',
        },
      },
    ],
    variantImages: [
      {
        id: String,
        alt: String,
        position: Number,
        product_id: String,
        created_at: Date,
        updated_at: Date,
        width: Number,
        height: Number,
        src: String,
      },
    ],
    images: [
      {
        id: String,
        product_id: String,
        position: Number,
        created_at: Date,
        updated_at: Date,
        alt: String,
        width: Number,
        height: Number,
        src: String,
      },
    ],
    inventory: {
      track_quantity: {
        type: Boolean,
      },
      quantity: {
        type: Number,
        default: 0,
      },
      continue_selling: {
        type: Boolean,
        // default: false,
      },
      has_sku: {
        type: Boolean,
        // default: false,
      },
      sku: {
        type: String,
      },
      barcode: {
        type: String,
      },
    },
    shipping: {
      track_shipping: {
        type: Boolean,
        // default: false,
      },
      weight: {
        type: Number,
      },
      weight_unit: {
        type: String,
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['active', 'draft'],
      default: 'draft',
    },
    oldPrice: Number,
    promotionStatus: { type: String, default: 'inactive' },
    shopifyId: String,
    promoPrice: String,
    expiresAt: { type: Date },
    credit_required: { type: Number },
    categories:[String],
    options: [
      {
        name: { type: String, required: true },
        values: { type: [String], required: true },
      },
    ],
  },
  {
    timestamps: true,
    optimisticConcurrency: false,
  }
);

export const listingModel = mongoose.model('listings', listingSchema);
