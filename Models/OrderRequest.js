import mongoose from 'mongoose';

const orderRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  orderId: {
    type: String,
    required: true,
  },
  request: {
    type: String,
    required: true,
  },
  productNames: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  orderNo:{
    type:String
  }
},
{
    timestamps:true
});

export const orderRquestModel= mongoose.model('OrderRequest', orderRequestSchema);
