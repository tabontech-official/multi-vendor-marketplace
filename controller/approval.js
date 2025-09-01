import { approvalModel } from "../Models/ApprovalSetting.js";

export const addApprovalSetting = async (req, res) => {
  try {
    const userId = req.userId; // from middleware
    const { approvalMode } = req.body;

    let setting = await approvalModel.findOne({ adminId: userId });

    if (setting) {
      setting.approvalMode = approvalMode;
      await setting.save();

      return res.status(200).json({
        success: true,
        message: "Approval setting updated successfully",
        data: setting,
      });
    }

    const newSetting = new approvalModel({
      adminId: userId,
      approvalMode,
    });

    await newSetting.save();

    res.status(201).json({
      success: true,
      message: "Approval setting created successfully",
      data: newSetting,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// get current approval mode
export const getApprovalSetting = async (req, res) => {
  try {
    const userId = req.userId;
    const setting = await approvalModel.findOne({ adminId: userId });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: "Approval setting not found",
      });
    }

    res.status(200).json({
      success: true,
      data: setting,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
