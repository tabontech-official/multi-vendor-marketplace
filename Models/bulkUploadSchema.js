import mongoose from 'mongoose';

const bulkUploadSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
    },

    fileSize: {
      type: Number, // bytes
    },

    totalProducts: {
      type: Number,
      required: true,
    },

    successCount: {
      type: Number,
      default: 0,
    },

    failedCount: {
      type: Number,
      default: 0,
    },

    shopifyStoreUrl: {
      type: String,
      required: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId, // agar user system hai
      ref: 'User',
      required: false,
    },

    results: [
      {
        handle: String,
        productId: String,
        title: String,
        success: Boolean,
        error: String,
      },
    ],

    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
  },
  { timestamps: true }
);

export const BulkUpload = mongoose.model(
  'BulkUpload',
  bulkUploadSchema
);
