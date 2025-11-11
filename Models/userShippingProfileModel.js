import mongoose from "mongoose";

const userShippingProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    activeProfiles: [
      {
        profileId: {
          type: String, // same as Shopify profileId (e.g., gid://shopify/DeliveryProfile/xxx)
          required: true,
        },
        profileName: {
          type: String,
          required: true,
        },
        rateName: String,
        ratePrice: Number,
        activatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true, collection: "user_shipping_profiles" }
);

export const userShippingProfileModel = mongoose.model(
  "userShippingProfile",
  userShippingProfileSchema
);
