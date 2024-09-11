import {
  fetchAndStoreProducts,
  addProduct,
  upload,
  imageUpload,
  addUsedEquipments,
} from '../controller/product.js';
import express from 'express';

const productRouter = express.Router();
productRouter.get('/shopify', fetchAndStoreProducts);
productRouter.post('/upload', upload.single('image'), imageUpload);
productRouter.post('/addProduct', upload.single('image'), addProduct);
productRouter.post('/addEquipment',upload.single('image'),addUsedEquipments)
export default productRouter;
