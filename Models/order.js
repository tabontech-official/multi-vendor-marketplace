// import mongoose from 'mongoose';

// const orderSchema = new mongoose.Schema(
//   {
//     orderId: String,
//     customer: Object,
//     lineItems: Array,
//     createdAt: Date,
//     expiresAt: Date,
//     serialNumber: Number,
//     shopifyOrderNo: Number,

//     merchantId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User',
//     },
//     eligibleDate: {
//       type: Date,
//     },
//     scheduledPayoutDate: {
//       type: Date,
//     },
//     payoutStatus: {
//       type: String,
//       enum: ['pending', 'Deposited'],
//       default: 'pending',
//     },
//     paidAt: Date,
//     payoutAmount: Number,
//     payoutNotes: String,
//     payPal: {
//       type:String,
//     },
//     referenceNo:{
//       type:String
//     }
//   },
//   {
//     timestamps: true,
//   }
// );

// export const orderModel = mongoose.model('orders', orderSchema);
import mongoose from 'mongoose';

const productSnapshotSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }, // original product id if existed
    title: String,
    description: String,
    images: [
      {
        id: String,
        src: String,
        alt: String,
        position: Number,
        width: Number,
        height: Number,
      },
    ],
    variants: [
      {
        id: String,
        title: String,
        price: Number,
        sku: String,
        inventory_quantity: Number,
        image_id: String,
      },
    ],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // seller id
  },
  { _id: false }
);

const lineItemSchema = new mongoose.Schema(
  {
    variant_id: String,
    product_id: String, // Shopify product id if available
    title: String,
    price: Number,
    quantity: Number,
    sku: String,
    image: {
      src: String,
      alt: String,
      position: Number,
      width: Number,
      height: Number,
    },
    productSnapshot: productSnapshotSchema, // 👈 full product info at time of order
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true }, // Shopify order id
    customer: { type: Object },                // Shopify customer data
    lineItems: [lineItemSchema],               // enriched line items
    createdAt: { type: Date },
    expiresAt: { type: Date },
    serialNumber: { type: Number },
    shopifyOrderNo: { type: Number },

    // --- payout/merchant fields ---
    merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    eligibleDate: { type: Date },
    scheduledPayoutDate: { type: Date },
    payoutStatus: { type: String, enum: ['pending', 'Deposited'], default: 'pending' },
    paidAt: { type: Date },
    payoutAmount: { type: Number },
    payoutNotes: { type: String },
    payPal: { type: String },
    referenceNo: { type: String },
  },
  { timestamps: true }
);

export const orderModel = mongoose.model('orders', orderSchema);
