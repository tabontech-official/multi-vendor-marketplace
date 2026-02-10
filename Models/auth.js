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
    comissionRate:{
      type:Number
    },

    avatar: { type: [String], default: [] },
    token: String,
    hasPaidSubscription: {
      type: Boolean,
      default: false,
    },
    subscription: {
      id: {
        type: String,
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
    dispatchzip: String,
    dispatchCountry: String,
    dispatchCity: String,
    dispatchAddress: String,
    shopifyAccessToken: String,
    shopifyApiKey: String,
    paypalAccount: { type: String, default: '' }, 
    paypalAccountNo: { type: String, default: '' }, 
    paypalReferenceNo: { type: String, default: '' },
    referenceNo:{
      type:String
    },
    bankDetails: {
      accountHolderName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      bankName: { type: String, default: '' },
      branchName: { type: String, default: '' },
      ifscCode: { type: String, default: '' }, 
      swiftCode: { type: String, default: '' }, 
      iban: { type: String, default: '' }, 
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
