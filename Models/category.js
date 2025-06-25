// import mongoose from 'mongoose';
// const Level3Schema = new mongoose.Schema({
//   catNo: String,
//   name: String,
//   level: Number
// }, { _id: false });

// const Level2Schema = new mongoose.Schema({
//   catNo: String,
//   name: String,
//   level: Number,
//   children: [Level3Schema]
// }, { _id: false });

// const Level1Schema = new mongoose.Schema({
//   catNo: String,
//   name: String,
//   level: Number,
//   children: [Level2Schema]
// }, { _id: false });

// const CategoryTreeSchema = new mongoose.Schema({
//   description: String,
//   categories: [Level1Schema]
// }, { timestamps: true });

// export const categoryModel = mongoose.model('Category', CategoryTreeSchema);
import mongoose from 'mongoose';

const Level3Schema = new mongoose.Schema({
  catNo: String,
  name: String,
  level: Number
}, { _id: false });

const Level2Schema = new mongoose.Schema({
  catNo: String,
  name: String,
  level: Number,
  children: [Level3Schema]
}, { _id: false });

const Level1Schema = new mongoose.Schema({
  catNo: String,
  name: String,
  level: Number,
  children: [Level2Schema]
}, { _id: false });

const CategoryTreeSchema = new mongoose.Schema({
  description: String,
  categories: [Level1Schema]
}, { timestamps: true });

export const categoryModel = mongoose.model('Category', CategoryTreeSchema);
