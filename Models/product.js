import mongoose from "mongoose"


const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  image: String, // URL to the image
  shopifyId: String, // Shopify ID of the product
  
},{
    timestamps:true
});


export const productModel=mongoose.model('products',productSchema)