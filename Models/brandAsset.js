import mongoose from 'mongoose';

const brandAssetSchema = new mongoose.Schema(
  {
    images: {
      type: String,
    },
    description: {
      type: String,
    },
    sellerName: {
      type: String,
    },
    userId:{
      type:mongoose.Schema.Types.ObjectId
    },
    shopifyCollectionId:{
      type:String
    }
  },
  {
    timestamps: true,
  }
);

export const brandAssetModel = mongoose.model(
  'brandCollection',
  brandAssetSchema
);
