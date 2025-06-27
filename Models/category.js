
import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  title: { type: String },
  description: { type: String,  },
  catNo: { type: String, unique: true },
  level: { type: String,},  
  parentCatNo: { type: String, default: '' }, 
    imageUrl: { type: String, default: '' }, // Add image URL field
categoryId:{type:String}

});
export const categoryModel = mongoose.model('Category', categorySchema);
