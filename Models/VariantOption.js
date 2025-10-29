import mongoose from "mongoose";

const variantOptionSchema = new mongoose.Schema(
  {
    optionName: {
      type: [String], 
      required: true,
      validate: {
        validator: function (arr) {
          return arr.length > 0;
        },
        message: "At least one option name is required",
      },
    },
    optionValues: {
      type: [String],
      required: true,
      default: [],
    },
  },
  { timestamps: true }
);

export const VariantOption = mongoose.model("VariantOption", variantOptionSchema);
