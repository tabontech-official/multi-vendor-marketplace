import mongoose from 'mongoose';

const buyCreditSchema = new mongoose.Schema({
  creditId: { type: String, required: true },
  price: { type: Number, required: true },
  variantId:{ type: String }
}, { timestamps: true }); // This will add createdAt and updatedAt fields

export const BuyCreditModel = mongoose.model('BuyCredit', buyCreditSchema);

