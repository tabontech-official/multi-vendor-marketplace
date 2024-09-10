import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  image: {
    type: Object, // Change from String to Object
    properties: {
      id: String,
      alt: String,
      position: Number,
      product_id: String,
      created_at: String,
      updated_at: String,
      admin_graphql_api_id: String,
      width: Number,
      height: Number,
      src: String,
      variant_ids: [String]
    }
  },
  shopifyId: String,
}, {
  timestamps: true
});

export const productModel = mongoose.model('products', productSchema);
