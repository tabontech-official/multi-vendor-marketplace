import mongoose from "mongoose";

const cartNumberSchema = new mongoose.Schema({
  currentNumber: { type: Number, default: 1 }, 
});

export const CartnumberModel=mongoose.model('cartnumbers',cartNumberSchema)