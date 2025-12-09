import mongoose from "mongoose";

const sizeChartSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String, 
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "users",
    },
  },
  { timestamps: true }
);

export const SizeChartModel = mongoose.model("SizeChart", sizeChartSchema);
