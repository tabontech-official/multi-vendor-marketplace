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

    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    eligibleDate: {
      type: Date,
    },
    scheduledPayoutDate: {
      type: Date,
    },
    payoutStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    paidAt: Date,
    payoutAmount: Number,
    payoutNotes: String,
    payPal: {
      type:String,
    },
  },
  {
    timestamps: true,
  }
);

export const orderModel = mongoose.model('orders', orderSchema);
