import {
  fetchAndStoreProducts,
  addProduct,
  addUsedEquipments,
  addNewEquipments,
  addNewBusiness,
  addNewJobListing,
  addNewProviderListing,
  addRoomListing,
} from '../controller/product.js';
import { upload } from '../middleware/cloudinary.js';
import express from 'express';

const productRouter = express.Router();
productRouter.get('/shopify', fetchAndStoreProducts);
productRouter.post('/addProduct', upload.single('image'), addProduct);
productRouter.post('/addEquipment', upload.single('image'), addUsedEquipments);
productRouter.post('/addRoom', upload.single('image'), addRoomListing);
productRouter.post(
  '/addNewEquipments',
  upload.single('image'),
  addNewEquipments
);
productRouter.post('/addJob', upload.single('image'), addNewJobListing);
productRouter.post('/addBusiness', upload.single('image'), addNewBusiness);
productRouter.post(
  '/addProvider',
  upload.single('image'),
  addNewProviderListing
);
export default productRouter;
