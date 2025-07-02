import mongoose from "mongoose";

const userViewSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,  // ✅ For faster lookup by userId
  },
  totalViews: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,  // ✅ Adds createdAt and updatedAt fields
});

export const viewModel = mongoose.model("productTracking", userViewSchema);
