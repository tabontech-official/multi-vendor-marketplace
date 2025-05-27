import mongoose from 'mongoose';
const orderSchema = new mongoose.Schema({
  orderId: String,
  customer: Object,
  lineItems: Array,
  createdAt: Date,
  expiresAt: Date,
  shopifyFulfillments: [
  {
    id: String,
    status: String,
    createdAt: String,
    updatedAt: String,
    trackingInfo: {
      number: String,
      url: String,
      company: String,
    }
  }
],
serialNumber: Number,

},{
  timestamps:true
});
export const orderModel = mongoose.model('orders', orderSchema);
