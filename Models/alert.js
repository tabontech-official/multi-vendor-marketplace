import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'users',
      required: true,
    },

    productId: {
      type: String,
    },

    type: {
      type: String,
      enum: ['low_stock', 'out_of_stock', 'conversion'],
      required: true,
    },

    message: {
      type: String,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    meta: {
      currentStock: Number,
      threshold: Number,
      conversionRate: Number,
    },
  },
  { timestamps: true }
);

export const alertModel = mongoose.model('alerts', alertSchema);