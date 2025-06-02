import mongoose from 'mongoose';
const orderSchema = new mongoose.Schema(
  {
    orderId: String,
    customer: Object,
    lineItems: Array,
    createdAt: Date,
    expiresAt: Date,
    serialNumber: Number,
    shopifyOrderNo: Number,
  },
  {
    timestamps: true,
  }
);
export const orderModel = mongoose.model('orders', orderSchema);
