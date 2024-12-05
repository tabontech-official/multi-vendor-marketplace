import {
  fetchAndStoreProducts,
  // addProduct,
  addUsedEquipments,
  addNewEquipments,
  addNewBusiness,
  addNewJobListing,
  addNewProviderListing,
  addRoomListing,
  getProduct,
  updateListing,
  publishProduct,
  deleteProduct,
  getSearchProduct,
  productDelete,
  deletAllProduct,
  unpublishProduct,
  productUpdate,
  updateCredits,
  updateProductPrice,
  updateNewPrice,
  fetchPricePerCredit,
  fetchRequireCredits,
  lookingFor,
  getAllProductData
} from '../controller/product.js';
import {  cpUpload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';
import express from 'express';
import { uploadImage } from '../middleware/upload.js';

const productRouter = express.Router();
productRouter.get('/shopify', fetchAndStoreProducts);
// productRouter.post('/addProduct', upload.single('image'), addProduct);
productRouter.post('/addEquipment', cpUpload, addUsedEquipments);
productRouter.post('/addRoom', cpUpload, addRoomListing);
productRouter.post('/addNewEquipments', cpUpload, addNewEquipments);
productRouter.post('/addJob', cpUpload, addNewJobListing);
productRouter.post('/addBusiness', cpUpload, addNewBusiness);
productRouter.post('/addProvider', cpUpload, addNewProviderListing);
productRouter.post('/webhooks/delete', productDelete);
productRouter.post('/webhook/product/update', productUpdate);
productRouter.get('/search/:userId', verifyShopifyWebhook, getSearchProduct);
productRouter.get('/getProduct/:userId', getProduct);
productRouter.get('/getAllData',getAllProductData)
productRouter.put('/updateListing/:id', cpUpload, updateListing);
productRouter.put('/publishedProduct/:productId', publishProduct);
productRouter.put('/unpublished/:productId', unpublishProduct);
productRouter.post('/updatePrice',updateProductPrice)
productRouter.put('/updateId/',updateNewPrice)
productRouter.get('/getPrice',fetchPricePerCredit)
productRouter.delete('/deleteProduct/:id', deleteProduct);
productRouter.delete('/', deletAllProduct);
productRouter.put('/credits', updateCredits);
productRouter.get('/fetchRequireCredits',fetchRequireCredits)
productRouter.post('/lookingFor',uploadImage,lookingFor)
export default productRouter;
