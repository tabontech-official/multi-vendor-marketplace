import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    title: { type: String, required: true },
    body_html: { type: String },
    vendor: { type: String },
    product_type: { type: String },
    created_at: { type: Date },
    handle: { type: String },
    updated_at: { type: Date },
    published_at: { type: Date },
    template_suffix: { type: String },
    tags: { type: String },

    // Variants as an array of objects
    variants: [
      {
        id: { type: Number, required: true },
        product_id: { type: Number, required: true },
        title: { type: String, required: true },
        price: { type: String, required: true },
        sku: { type: String },
        position: { type: Number },
        inventory_policy: { type: String },
        compare_at_price: { type: String },
        fulfillment_service: { type: String },
        inventory_management: { type: String },
        option1: { type: String },
        option2: { type: String },
        option3: { type: String },
        taxable: { type: Boolean },
        barcode: { type: String },
        grams: { type: Number },
        image_id: { type: Number },
        weight: { type: Number },
        weight_unit: { type: String },
        inventory_item_id: { type: Number },
        inventory_quantity: { type: Number },
        old_inventory_quantity: { type: Number },
        presentment_prices: [
          {
            price: {
              amount: { type: String },
              currency_code: { type: String },
            },
            compare_at_price: {
              amount: { type: String },
              currency_code: { type: String },
            },
          },
        ],
      },
    ],

    // Options as an array of objects
    options: [
      {
        id: { type: Number },
        product_id: { type: Number },
        name: { type: String },
        position: { type: Number },
        values: [{ type: String }],
      },
    ],

    // Images as an array of objects
    images: [
      {
        id: { type: Number, required: true },
        product_id: { type: Number, required: true },
        position: { type: Number },
        created_at: { type: Date },
        updated_at: { type: Date },
        alt: { type: String },
        width: { type: Number },
        height: { type: Number },
        src: { type: String },
      },
    ],
    files:[
      {
        type:String
      }
    ],

    metafields: [
      {
        id: { type: Number, required: true },
        namespace: { type: String },
        key: { type: String },
        value: { type: String },
        type: { type: String },
        description: { type: String },
        owner_id: { type: Number },
        owner_resource: { type: String },
        created_at: { type: Date },
        updated_at: { type: Date },
      },
    ],
    equipment: {
      location: { type: String },
      zip: { type: Number },
      name: { type: String },
      brand: { type: String },
      asking_price: { type: Number },
      accept_offers: { type: Boolean },
      equipment_type: { type: String },
      certification: { type: String },
      year_purchased: { type: String },
      warranty: { type: String },
      reason_for_selling: { type: String },
      shipping: { type: String },
      sale_price: { type: Number },
      year_manufactured: { type: String },
      training: { type: String },
      description: { type: String },
      city:{type:String},
      shopifyId: String,
    },
    business: {
      name: String,
      location: String,
      zip: { type: Number },
      businessDescription: String,
      askingPrice: Number,
      establishedYear: Number,
      numberOfEmployees: Number,
      locationMonthlyRent: Number,
      leaseExpirationDate: Date,
      locationSize: Number,
      grossYearlyRevenue: Number,
      cashFlow: Number,
      productsInventory: Number,
      equipmentValue: Number,
      reasonForSelling: String,
      listOfDevices: { type: String, default: '' },
      offeredServices: { type: String, default: '' }, // Array of strings for services
      supportAndTraining: String, // Description of support and training offered
    },
    jobListings: [
      {
        location: { type: String },
        zip: { type: Number },

        name: { type: String },
        qualification: { type: String },
        positionRequestedDescription: { type: String },
        experience: { type: Number },
        availability: { type: String },
        requestedYearlySalary: { type: Number },
        image: { type: String }, // URL to the uploaded image
        availableToWorkAs:String,
        jobType: { type: String },

      },
    ],
    providerListings: [
      {
        location: { type: String },
        zip: { type: Number },
        qualificationRequested: { type: String },
        jobType: { type: String },
        typeOfJobOffered: { type: String },
        offeredYearlySalary: { type: Number },
        offeredPositionDescription: { type: String },
        city:{type:String},
        image: { type: String }, // Store the image URL
      },
    ],
    roomListing: [
      {
        location: { type: String, required: true },
        zip: { type: Number },
        roomSize: { type: Number, required: true }, // Square feet
        monthlyRent: { type: Number, required: true },
        deposit: { type: Number, required: true },
        minimumInsuranceRequested: { type: Number, required: true },
        typeOfUseAllowed: {
          type: String,
        },
        rentalTerms: {
          type: String,
        },
        wifiAvailable: { type: Boolean, required: true },
        otherDetails: { type: String },
        image: { type: String }, // Path or URL to the image
      },
    ],
    shopifyId: String,
    userId: mongoose.Schema.Types.ObjectId,
    status: {
      type: String,
      enum: ['draft', 'active', 'inactive'],
    },
    expiresAt: { type: Date },
    credit_required: { type: Number },
    buy_credits:{
      price:Number
    },
    looking: {
      location: { type: String },
      zip: { type: Number },
      name: { type: String },
      brand: { type: String },
      sale_price: { type: Number },
      description: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

export const productModel = mongoose.model('products', productSchema);
