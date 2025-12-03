import { SizeChartModel } from "../Models/SizeChart.js";



export const createSizeChart = async (req, res) => {
  try {
    console.log("FILES RECEIVED:", req.files);
    console.log("BODY RECEIVED:", req.body);

    const { name, userId } = req.body;

    // Cloudinary field from cpUploads → image = array
    const imageFile = req?.files?.image?.[0];

    if (!imageFile) {
      return res.status(400).json({
        message: "Image is required",
        receivedFiles: req.files,
      });
    }

    // Cloudinary Storage returns:
    // imageFile.path       = secure URL
    // imageFile.filename   = public_id
    const imageUrl = imageFile.path;

    const newChart = await SizeChartModel.create({
      name,
      image: imageUrl,
      userId,
    });

    return res.status(201).json({
      message: "Size chart created successfully",
      data: newChart,
    });

  } catch (error) {
    console.log("🔥 Error creating size chart:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message || error,
    });
  }
};

// GET all for a user
export const getAllSizeCharts = async (req, res) => {
  try {
    const { userId } = req.params;
    const charts = await SizeChartModel.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({ data: charts });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE
export const deleteSizeChart = async (req, res) => {
  try {
    await SizeChartModel.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Size chart deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE
export const updateSizeChart = async (req, res) => {
  try {
    const { name } = req.body;

    const updateData = { name };

    // If new image uploaded
    const imageFile = req?.files?.image?.[0];
    if (imageFile) {
      updateData.image = imageFile.path; // cloudinary URL
    }

    const updated = await SizeChartModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      message: "Size chart updated successfully",
      data: updated,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};
