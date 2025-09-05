import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
const authSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    userName: {
      type: String,
    },
    email: {
      type: String,
    },
    password: {
      type: String,
    },
    passwordConfirmation: {
      type: String,
    },
    tags: {
      type: String,
    },
    shopifyId: { type: String },
    phoneNumber: {
      type: Number,
    },
    address: {
      type: String,
    },
    zip: {
      type: Number,
    },
    country: {
      type: String,
    },
    city: {
      type: String,
    },
    state: {
      type: String,
    },

    avatar: { type: [String], default: [] },
    token: String,
    hasPaidSubscription: {
      type: Boolean,
      default: false,
    },
    subscription: {
      id: {
        type: String, // Subscription ID from payment service
      },
      status: {
        type: String,
        enum: ['active', 'inactive', 'canceled', 'pending'],
      },
      startDate: {
        type: Date,
      },
      expiresAt: {
        type: Date,
      },
      quantity: {
        type: Number,
        default: 0,
      },
    },
    isAdmin: {
      type: Boolean,
    },
    role: {
      type: String,
    },
    modules: [String],
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
    },
    gstRegistered: String,
    sellerGst: String,
    dispatchzip: Number,
    dispatchCountry: String,
    dispatchCity: String,
    dispatchAddress: String,
    shopifyAccessToken: String,
    shopifyApiKey: String,
    // 🟢 PayPal Details
    paypalAccount: { type: String, default: '' },   // PayPal Email / ID
    paypalAccountNo: { type: String, default: '' }, // Optional account number
    paypalReferenceNo: { type: String, default: '' },
    referenceNo:{
      type:String
    },
    bankDetails: {
      accountHolderName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      bankName: { type: String, default: '' },
      branchName: { type: String, default: '' },
      ifscCode: { type: String, default: '' }, // For India
      swiftCode: { type: String, default: '' }, // For International transfers
      iban: { type: String, default: '' }, // For EU transfers
      country: { type: String, default: '' },
    },
     paypalAccountNo: {
      type: String,
      default: '',
    },
    sellerName:{
      type:String
    },
    shopifyCollectionId: { type: String, default: null },

  },

  {
    timestamps: true,
  }
);
authSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

authSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error(error);
  }
};
export const authModel = mongoose.model('users', authSchema);
