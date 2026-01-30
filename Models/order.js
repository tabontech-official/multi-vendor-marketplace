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
    // ProductSnapshot: Object,
    ProductSnapshot: [
      {
        productId: String,
        variantId: String,
        quantity: Number,
        merchantId: mongoose.Schema.Types.ObjectId,
        product: Object,
        variant: Object,
      },
    ],
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
      enum: ['pending', 'Deposited'],
      default: 'pending',
    },
    paidAt: Date,
    payoutAmount: Number,
    payoutNotes: String,
    payPal: {
      type: String,
    },
    referenceNo: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const orderModel = mongoose.model('orders', orderSchema);
