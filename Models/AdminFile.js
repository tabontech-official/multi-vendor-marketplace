import mongoose from 'mongoose';

const adminFileSchema = new mongoose.Schema({
  type: {
    type: String, // products / inventory
    required: true,
  },
  category: {
    type: String, // normal | downloadable_excel
    default: 'normal',
  },
  fileName: String,
  fileData: Buffer,
  contentType: String,
  uploadedBy: String,
  version: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const AdminFile = mongoose.model('AdminFile', adminFileSchema);
