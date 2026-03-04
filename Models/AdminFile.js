import mongoose from 'mongoose';

const adminFileSchema = new mongoose.Schema({
  type: {
    type: String, 
    required: true,
  },
  category: {
    type: String, 
    default: 'normal',
  },
  fileName: String,
  fileData: Buffer,
  contentType: String,
  uploadedBy: String,
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "inactive",
  },
  version: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const AdminFile = mongoose.model('AdminFile', adminFileSchema);
