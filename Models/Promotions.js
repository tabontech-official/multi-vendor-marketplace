import mongoose from 'mongoose';
import { type } from 'os';

const promotionSchema = new mongoose.Schema({
  promoName: {
    type: String,
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  productSku: {
    type: String,
  },
  promoPrice: {
    type: String,
  },
  productName: {
    type: String,
  },
  currentStock: {
    type: String,
  },
  currentPrice: {
    type: Number,
  },
 status: {
  type: String,
  enum: ['active', 'inactive'],
  default: 'inactive',
  required: true,
},
  userId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  createdRole: {
    type: String,
  },
  restored: {
    type: Boolean,
  },
  oldPrice: {
    type: Number,
  },
  variantId:{
    type:String
  },
  variantName:{
    type:String
  },
  variantQuantity:{
    type:String
  }
});

export const PromoModel = mongoose.model('promotions', promotionSchema);
