import {
  fetchAndStoreProducts,
  addProduct,
  addUsedEquipments,
  addNewEquipments,
  addNewBusiness,
  addNewJobListing,
  addNewProviderListing,
  addRoomListing,
  getProduct,
  deleteProduct,
  getSearchProduct,
  productDelete,
  subscriptionEquipments,
} from '../controller/product.js';
import { upload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';
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
productRouter.get('/getProduct/:userId', getProduct);
productRouter.delete('/deleteProduct/:id', deleteProduct);
productRouter.post('/webhooks/products/delete/',productDelete);
productRouter.get('/search/:userId',verifyShopifyWebhook, getSearchProduct);
productRouter.post(
  '/subscription',
  upload.single('image'),
  subscriptionEquipments
);
export default productRouter;
