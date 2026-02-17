import mongoose from 'mongoose';

const shippingProfileSchema = new mongoose.Schema(
  {
    profileId: {
      type: String,
      required: true,
      unique: true,
    },
    profileName: {
      type: String,
      required: true,
    },
    rateName: {
      type: String,
      required: true,
    },
    ratePrice: {
      type: Number,
      required: true,
    },
    shopifyResponse: {
      type: Object,
      default: {},
    },
    status: {
      type: String,
      enum: ['created', 'failed'],
      default: 'created',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    shortId: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { collection: 'shipping_profiles' }
);

export const shippingProfileModel = mongoose.model(
  'shippingProfile',
  shippingProfileSchema
);
