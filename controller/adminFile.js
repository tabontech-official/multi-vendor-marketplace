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

    const latestFile = await AdminFile.findOne({ type })
      .sort({ createdAt: -1 });

    let version = "1.01";

    if (latestFile && latestFile.version) {
      const [major, minor] = latestFile.version.split(".").map(Number);

      let newMajor = major;
      let newMinor = minor + 1;

      if (newMinor > 10) {
        newMajor += 1;
        newMinor = 1;
      }

      version = `${newMajor}.${newMinor.toString().padStart(2, "0")}`;
    }

    const newFile = new AdminFile({
      type,
      category: "downloadable_excel",
      fileName: req.file.originalname,
      fileData: req.file.buffer,
      contentType: req.file.mimetype,
      uploadedBy: req.body.userId,
      version,
      createdAt: new Date(),
    });

    await newFile.save();

    res.json({
      success: true,
      message: "Excel file saved successfully",
      data: newFile,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const getAdminFile = async (req, res) => {
  try {
    const files = await AdminFile.find().sort({ createdAt: -1 });

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
    const file = await AdminFile.findOne({ type: req.params.type })
      .sort({ createdAt: -1 }); 

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
    });

    res.send(file.fileData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const deleteAdminFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await AdminFile.findByIdAndDelete(id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};