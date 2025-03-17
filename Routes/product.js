import {
  addUsedEquipments,
  getProduct,
  publishProduct,
  deleteProduct,
  productDelete,
  unpublishProduct,
  productUpdate,
  getAllProductData,
} from '../controller/product.js';
import { cpUpload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';
import express from 'express';

const productRouter = express.Router();
productRouter.post('/addEquipment',cpUpload, addUsedEquipments);
productRouter.post('/webhooks/delete', productDelete);
productRouter.post('/webhook/product/update', productUpdate);
productRouter.get('/getProduct/:userId', getProduct);
productRouter.get('/getAllData', getAllProductData);
productRouter.put('/publishedProduct/:productId', publishProduct);
productRouter.put('/unpublished/:productId', unpublishProduct);

productRouter.delete('/deleteProduct/:id', deleteProduct);

export default productRouter;
