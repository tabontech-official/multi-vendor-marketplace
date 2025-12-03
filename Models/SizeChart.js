import mongoose from "mongoose";

const sizeChartSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String, // image URL or filename
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const SizeChartModel = mongoose.model("SizeChart", sizeChartSchema);
