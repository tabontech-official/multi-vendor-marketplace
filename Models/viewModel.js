// import mongoose from "mongoose";

// const userViewSchema = new mongoose.Schema({
//   userId: {
//     type: String,
//     required: true,
//     index: true,  
//   },
//   totalViews: {
//     type: Number,
//     default: 0,
//   },
// }, {
//   timestamps: true,
// });

// export const viewModel = mongoose.model("productTracking", userViewSchema);
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
  weeklyViews: {
    type: Number,
    default: 0,
  },
  monthlyViews: {
    type: Number,
    default: 0,
  },
  lastWeeklyReset: {
    type: Date,
    default: Date.now,
  },
  lastMonthlyReset: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

export const viewModel = mongoose.model("productTracking", userViewSchema);
