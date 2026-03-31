import mongoose from 'mongoose';

// const csvImportBatchSchema = new mongoose.Schema(
//   {
//     batchNo: { type: String, unique: true, required: true },
//     userId: { type: mongoose.Schema.Types.ObjectId, required: true },

//     fileName: { type: String, required: true },
//     mimeType: String,
//     fileSize: Number,

//     fileBuffer: { type: Buffer },

//     status: {
//       type: String,
//       enum: ['pending', 'processing', 'completed', 'failed'],
//       default: 'pending',
//     },

//     lockedAt: Date,

//     results: [
//       {
//         handle: String, // product batch
//         sku: String, // inventory batch

//         status: {
//           type: String,
//           enum: ['success', 'error'],
//         },

//         shopifyId: String,

//         variantId: String,
//         quantityUpdated: Number,
//         priceUpdated: Number,
//         compareAtPriceUpdated: Number,
//         productStatusUpdated: String,

//         message: String,
//         warnings: [String],
//         // 🔥 NEW: Per Item Logs
//         logs: [
//           {
//             step: String,
//             message: String,
//             createdAt: { type: Date, default: Date.now },
//           },
//         ],

//         startedAt: Date,
//         completedAt: Date,
//       },
//     ],

//     summary: {
//       total: { type: Number, default: 0 },
//       success: { type: Number, default: 0 },
//       failed: { type: Number, default: 0 },
//     },
//     currentIndex: {
//       type: Number,
//       default: 0,
//     },
//     error: String,

//     // 🔥 NEW: Batch Level Logs
//     batchLogs: [
//       {
//         message: String,
//         createdAt: { type: Date, default: Date.now },
//       },
//     ],
//   },
//   { timestamps: true }
// );

const csvImportBatchSchema = new mongoose.Schema(
  {
    batchNo: { type: String, unique: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },

    fileName: { type: String, required: true },
    mimeType: String,
    fileSize: Number,
    fileUrl: String,
    fileBuffer: {
      type: Buffer,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'queued'],
      default: 'pending',
    },

    isProcessing: {
      type: Boolean,
      default: false,
    },

    lockedAt: Date,
    lockExpiresAt: Date,

    retryCount: {
      type: Number,
      default: 0,
    },

    maxRetries: {
      type: Number,
      default: 3,
    },

    currentIndex: {
      type: Number,
      default: 0,
    },

    summary: {
      total: { type: Number, default: 0 },
      success: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },

    results: [
      /* keep as-is */
    ],
    handles: { type: [String], default: [] },
    groupedProducts: { type: mongoose.Schema.Types.Mixed, default: {} },
    queuedHandles: { type: [String], default: [] },
    processedHandles: { type: [String], default: [] },
    error: String,
    lastProcessedAt: Date,
    schedulerLocked: { type: Boolean, default: false },
    batchLogs: [
      {
        message: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

csvImportBatchSchema.index({ status: 1, isProcessing: 1 });

export default mongoose.model('CsvImportBatch', csvImportBatchSchema);
