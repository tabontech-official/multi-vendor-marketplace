import mongoose from "mongoose";

const approvalSettingSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  approvalMode: {
    type: String,
      enum: ["Auto", "Manual"],
    default: "Manual",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const approvalModel= mongoose.model("ApprovalSetting", approvalSettingSchema);
