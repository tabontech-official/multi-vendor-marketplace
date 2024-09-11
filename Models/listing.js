import mongoose from 'mongoose'

const listingSchema=new mongoose.Schema({
    location: { type: String, required: true },
  equipmentName: { type: String, required: true },
  brandName: { type: String, required: true },
  askingPrice: { type: String, required: true },
  acceptOffers: { type: Boolean, required: true },
  equipmentType: { type: String, required: true },
  certification: { type: String, required: true },
  yearPurchased: { type: Number, required: true },
  warranty: { type: String, required: true },
  reasonForSelling: { type: String, required: true },
  shipping: { type: String, required: true },
  image: { type: String, required: true }, // Store the path or URL to the image
  shopifyEquipmentId: { type: String } // Shopify equipment ID
  }, {
    timestamps: true // Adds createdAt and updatedAt fields
  
})

export const listingModel=mongoose.model('produ',listingSchema)