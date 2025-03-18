import { timeStamp } from 'console';
import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
  id: {
    type: String,
  },
  title: {
    type: String,
  },
  body_html: {
    type: String,
  },
  vendor: {
    type: String,
  },
  product_type: {
    type: String,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  tags: {
    type: [String], // Array of tags
  },
  variants: [
    {
      option1: String,
      option2: String,
      option3: String,
      price: String,
      compare_at_price: String,
      inventory_management: String,
      inventory_quantity: Number,
      sku: String,
      barcode: String,
      weight: Number,
      weight_unit: String,
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
      default: false,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    continue_selling: {
      type: Boolean,
      default: false,
    },
    has_sku: {
      type: Boolean,
      default: false,
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
      default: false,
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
    ref: "User",
  },
  status: {
    type: String,
    enum: ["active", "draft"],
    default: "draft",
  },
  expiresAt: { type: Date },

},
{
  timeStamp:true
}
);


export const listingModel = mongoose.model('listings', listingSchema);
