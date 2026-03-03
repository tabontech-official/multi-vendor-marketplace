import { ContentUpload } from '../Models/contentModel.js';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from 'cloudinary';
import multer from 'multer';
import mongoose from 'mongoose';
export const uploadContent = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploadedFiles = [];

    for (const field in req.files) {
      for (const file of req.files[field]) {
        uploadedFiles.push({
          originalName: file.originalname || '',
          url: file.path || file.secure_url || '',
          public_id: file.filename || file.public_id || '',
          format: file.format || '',
          resource_type: file.resource_type || '',
          bytes: file.size || 0,
        });
      }
    }

    const newUpload = await ContentUpload.create({
      userId,
      files: uploadedFiles,
    });

    return res.status(201).json({
      success: true,
      message: 'Files uploaded successfully',
      data: newUpload,
    });
  } catch (error) {
    console.error('🔥 Upload error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Upload failed',
    });
  }
};

export const getUserFiles = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log("👉 Requested userId:", userId);

    const data = await ContentUpload.find({ userId }).sort({
      createdAt: -1,
    });

    console.log("📦 Raw DB Data:", data);

    const flattened = data.flatMap((doc) => doc.files);

    console.log("📂 Flattened Files:", flattened);

    res.json({ success: true, data: flattened });

  } catch (error) {
    console.error("❌ Error in getUserFiles:", error);
    res.status(500).json({ message: "Error fetching files" });
  }
};

export const deleteUserFile = async (req, res) => {
  try {
    const { id } = req.body; // file._id

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'File ID required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID',
      });
    }

    const updated = await ContentUpload.findOneAndUpdate(
      { 'files._id': id },
      { $pull: { files: { _id: id } } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({
      success: false,
      message: 'Delete failed',
    });
  }
};

export const getAllFiles = async (req, res) => {
  try {
    const data = await ContentUpload.find().sort({ createdAt: -1 });

    const flattened = data.flatMap((doc) => doc.files);

    res.json({ success: true, data: flattened });
  } catch (error) {
    console.error('🔥 Fetch all files error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching files',
    });
  }
};
