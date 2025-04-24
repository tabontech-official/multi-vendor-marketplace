import mongoose from 'mongoose';

const imageGallerySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  images: [
    {
      id: String,
      product_id: String,
      position: Number,
      created_at: Date,
      updated_at: Date,
      alt: String,
      width: Number,
      height: Number,
      src: String,
    },
  ],
});

export const imageGalleryModel = mongoose.model(
  'imageGallery',
  imageGallerySchema
);
