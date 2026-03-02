import mongoose from "mongoose";

const contentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    files: [
      {
        originalName: String,
        url: String,
        public_id: String,
        format: String,
        resource_type: String,
        bytes: Number,
      },
    ],
  },
  { timestamps: true }
);

export const ContentUpload = mongoose.model("ContentUpload", contentSchema);