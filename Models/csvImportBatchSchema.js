import mongoose from 'mongoose';

const csvImportBatchSchema = new mongoose.Schema(
  {
    batchNo: { type: String, unique: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },

    fileName: { type: String, required: true },
    mimeType: String,
    fileSize: Number,

    fileBuffer: { type: Buffer },

    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },

    lockedAt: Date,

    results: [
      {
        handle: String,
        status: {
          type: String,
          enum: ['success', 'error'],
        },
        shopifyId: String,
        message: String,
        startedAt: Date,
        completedAt: Date,
      },
    ],

    summary: {
      total: { type: Number, default: 0 },
      success: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },

    error: String,
  },
  { timestamps: true }
);

export default mongoose.model('CsvImportBatch', csvImportBatchSchema);
