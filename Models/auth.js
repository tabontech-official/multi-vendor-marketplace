import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
const authSchema = new mongoose.Schema({
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  userName:{
    type:String
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
  avatar: { type: [String], default: [] }, 
  token: String,
  shopifyAccessToken: String,
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
      default: 'inactive',
    },
    startDate: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    quantity:{
      type:Number,
      default:0
    }
  },
});
authSchema.pre('save', async function (next) {
  const user = this;
  if (!user.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(user.password, salt);
    next();
  } catch (err) {
    return next(err);
  }
});
authSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error(error);
  }
};
export const authModel = mongoose.model('users', authSchema);
