import mongoose from "mongoose";


const shopifyStoreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    storeUrl: {
      type: String,
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    apiKey: {
      type: String,
      required: true,
    },
   
  },
  { timestamps: true }
);


export const ShopifyModel=mongoose.model('credits',shopifyStoreSchema)