import {
  fetchAndStoreProducts,
  addProduct,
  upload,
  imageUpload,
  addUsedEquipments,
  addNewEquipments,
  addNewBusiness,
  addNewJobListing,
} from '../controller/product.js';
import express from 'express';

const productRouter = express.Router();
productRouter.get('/shopify', fetchAndStoreProducts);
productRouter.post('/upload', upload.single('image'), imageUpload);
productRouter.post('/addProduct', upload.single('image'), addProduct);
productRouter.post('/addEquipment', upload.single('image'), addUsedEquipments);
productRouter.post(
  '/addNewEquipments',
  upload.single('image'),
  addNewEquipments
);
productRouter.post('/addJob',upload.single('image'),addNewJobListing)
productRouter.post('/addBusiness', upload.single('image'), addNewBusiness);
export default productRouter;
