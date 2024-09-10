import mongoose from 'mongoose'
const listingSchema=new mongoose.Schema({
    location: {
        type: String,
        required: true,
      },
      equipmentName: {
        type: String,
        required: true,
      },
      brandName: {
        type: String,
        required: true,
      },
      askingPrice: {
        type: Number,
        required: true,
      },
      acceptOffers: {
        type: String,
       
        required: true,
      },
      equipmentType: {
        type: String,
        enum: [
          'Skin care',
          'Body shaping',
          'Laser Hair removal',
          'Laser skin care',
          'Laser tattoo removal',
          'Lab equipment',
          'Other aesthetic device',
          'Other Medical device',
          'Furniture', // Fixed typo from "Forniture" to "Furniture"
          'Small tools',
        ],
        required: true,
      },
      certification: {
        type: String,
        enum: [
          'FDA Approved',
          'FDA Registered',
          'No FDA Certification',
        ],
        required: true,
      },
      yearPurchased: {
        type: Number,
        required: true,
      },
      warranty: {
        type: String,
        enum: [
          'No warranty, as it is',
          'Still under manufacturer warranty',
          '6 month warranty',
        ],
        required: true,
      },
      reasonForSelling: {
        type: String,
        required: true,
      },
      shipping: {
        type: String,
        enum: [
          'Available at cost',
          'Free shipping',
          'Pick up only',
        ],
        required: true,
      },
      image:String
})

export const listingModel=mongoose.model('listing',listingSchema)