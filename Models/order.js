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
    ProductSnapshot: [
      {
        productId: String,
        variantId: String,
        quantity: Number,
        merchantId: mongoose.Schema.Types.ObjectId,
        product: Object,
        variant: Object,
        payoutStatus: {
          type: String,
          enum: ['pending', 'Deposited', 'Due'],
          default: 'pending',
        },

        depositedDate: Date,
        paymentMethod: String,
        referenceNo: String,
        payoutReferenceId: {
          type: String,
          unique: true,
        },
      },
    ],
    refunds: [
  {
    refundId: String,
    status: {
      type: String,
      default: "success",
    },
    refundItems: [
      {
        productId: String,
        variantId: String,
        lineItemId: String,
        quantity: Number,
        amount: Number,
      },
    ],
    shippingRefunded: {
      type: Boolean,
      default: false,
    },
    shippingAmount: {
      type: Number,
      default: 0,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    reason: String,
    restock: Boolean,
    notifyCustomer: Boolean,
    shopifyRefund: Object,
    refundedAt: {
      type: Date,
      default: Date.now,
    },
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
      enum: ['pending', 'Deposited', 'Due'],
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
    paymentMethod: String,

    depositedDate: Date,
  },
  {
    timestamps: true,
  }
);

export const orderModel = mongoose.model('orders', orderSchema);
