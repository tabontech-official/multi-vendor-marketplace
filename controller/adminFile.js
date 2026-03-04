import mongoose from 'mongoose';
import { AdminFile } from '../Models/AdminFile.js';

// export const addAdminFile = async (req, res) => {
//   try {
//     const { type } = req.params;

//     await AdminFile.findOneAndUpdate(
//       { type, category: 'downloadable_excel' },
//       {
//         fileName: req.file.originalname,
//         fileData: req.file.buffer,
//         contentType: req.file.mimetype,
//         uploadedBy: req.body.userId,
//         createdAt: new Date(),
//       },
//       { upsert: true, new: true }
//     );

//     res.json({ message: 'Excel file saved & replaced' });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

export const addAdminFile = async (req, res) => {
  try {
    const { type } = req.params;

    const latestFile = await AdminFile.findOne({ type }).sort({
      createdAt: -1,
    });

    let version = '1.01';

    if (latestFile && latestFile.version) {
      const [major, minor] = latestFile.version.split('.').map(Number);

      let newMajor = major;
      let newMinor = minor + 1;

      if (newMinor > 10) {
        newMajor += 1;
        newMinor = 1;
      }

      version = `${newMajor}.${newMinor.toString().padStart(2, '0')}`;
    }

    // 🔴 Old files inactive
    await AdminFile.updateMany({ type }, { $set: { status: 'inactive' } });

    const newFile = new AdminFile({
      type,
      category: 'downloadable_excel',
      fileName: req.file.originalname,
      fileData: req.file.buffer,
      contentType: req.file.mimetype,
      uploadedBy: req.body.userId,
      version,
      status: 'active', // 🟢 latest file active
      createdAt: new Date(),
    });

    await newFile.save();

    res.json({
      success: true,
      message: 'Excel file saved successfully',
      data: newFile,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getAdminFile = async (req, res) => {
  try {
    const files = await AdminFile.find().sort({ status: 1, createdAt: -1 });

    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadAdminFile = async (req, res) => {
  try {

    console.log("Download template request:", req.params.type);

    const file = await AdminFile.findOne({
      type: req.params.type,
      status: "active",
    });

    if (!file) {
      console.log("No active file found");
      return res.status(404).json({ message: "Active file not found" });
    }

    console.log("Downloading file:", file.fileName);

    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
    });

    res.send(file.fileData);

  } catch (error) {
    console.error("Download error:", error);

    res.status(500).json({
      error: error.message,
    });
  }
};

export const deleteAdminFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await AdminFile.findByIdAndDelete(id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadFile = async (req, res) => {
  try {
    console.log('Download API called');

    const { id } = req.params;

    console.log('File ID received:', id);

    // invalid id check
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid ObjectId');
      return res.status(400).json({ message: 'Invalid file id' });
    }

    const file = await AdminFile.findById(id);

    console.log('DB result:', file);

    if (!file) {
      console.log('File not found in DB');
      return res.status(404).json({ message: 'File not found in DB' });
    }

    console.log('File found:', {
      name: file.fileName,
      type: file.contentType,
      size: file.fileData?.length,
    });

    res.set({
      'Content-Type': file.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
    });

    console.log('Sending file to client...');

    res.send(file.fileData);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const setActiveFile = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Set active request:', id);

    const file = await AdminFile.findById(id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    console.log('File found:', file.fileName);

    // same type ki sab files inactive
    await AdminFile.updateMany(
      { type: file.type },
      { $set: { status: 'inactive' } }
    );

    console.log('Old files set to inactive');

    // selected file active
    file.status = 'active';
    await file.save();

    console.log('New file activated');

    res.status(200).json({
      success: true,
      message: 'File activated successfully',
      data: file,
    });
  } catch (error) {
    console.error('Set active error:', error);

    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
