import {
  fetchAndStoreProducts,
  addProduct,
  upload,
  imageUpload,
  addUsedEquipments,
  addNewEquipments,
} from '../controller/product.js';
import express from 'express';

const productRouter = express.Router();
productRouter.get('/shopify', fetchAndStoreProducts);
productRouter.post('/upload', upload.single('image'), imageUpload);
productRouter.post('/addProduct', upload.single('image'), addProduct);
productRouter.post('/addEquipment',upload.single('image'),addUsedEquipments)
productRouter.post('/addNewEquipments',upload.single('image'),addNewEquipments)
export default productRouter;
