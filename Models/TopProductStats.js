// models/TopProductStats.js
import mongoose from 'mongoose';

const topProductStatsSchema = new mongoose.Schema({
  productId: String,
  productName: String,

  date: { type: Date, required: true },

  unitsSold: Number,
  revenue: Number,
  views: Number,

  merchantId: mongoose.Schema.Types.ObjectId, 
});

export const TopProductStats = mongoose.model(
  'TopProductStats',
  topProductStatsSchema
);
