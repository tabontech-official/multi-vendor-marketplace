import mongoose from "mongoose";

const userViewSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,  
  },
  totalViews: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

export const viewModel = mongoose.model("productTracking", userViewSchema);
