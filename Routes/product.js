import {
  addUsedEquipments,
  getProduct,
  publishProduct,
  deleteProduct,
  productDelete,
  unpublishProduct,
  productUpdate,
  getAllProductData,
  updateProductData,
  updateAllProductsStatus,
  fetchProductCount,
  getProductDataFromShopify,
  getAllProductPromotionStatus,
  getPromotionProduct,
  updateImages,
  updateVariantImages,
  getSingleVariantData,
  updateSingleVariant,
  getsingleProduct,
  fetchVariantsWithImages,
  addImagesGallery,
  getImageGallery,
  deleteImageGallery,
  addCsvfileForProductFromBody,
  updateProductWebhook,
  updateInventoryPrice,
  updateInventoryQuantity,
  exportProducts,
  updateInventoryFromCsv,
  exportInventoryCsv,
  getAllVariants,
} from '../controller/product.js';
import { cpUpload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';
import express from 'express';
import { Csvuplaods } from '../middleware/multer.js';
import { verifyToken } from '../middleware/verifyToken.js';
const productRouter = express.Router();
productRouter.post('/addEquipment', cpUpload, verifyToken, addUsedEquipments);
productRouter.post('/webhooks/delete', verifyToken, productDelete);
productRouter.post('/holiday', verifyToken, updateAllProductsStatus);
productRouter.post('/webhook/product/update', verifyToken, productUpdate);
productRouter.get('/getProduct/:userId', verifyToken, getProduct);
productRouter.get('/getAllVariants/:userId', verifyToken, getAllVariants);

productRouter.get('/getAllData', verifyToken, getAllProductData);
productRouter.put('/publishedProduct/:productId', verifyToken, publishProduct);
productRouter.put('/unpublished/:productId', verifyToken, unpublishProduct);
productRouter.put(
  '/updateProducts/:id',
  cpUpload,
  verifyToken,
  updateProductData
);
productRouter.put('/updateImages/:id', verifyToken, updateImages);
productRouter.put('/updateVariantImages/:id', verifyToken, updateVariantImages);
productRouter.get('/getProductCount', verifyToken, fetchProductCount);
productRouter.get(
  '/getProductDataFromShopify/:id',
  verifyToken,
  getProductDataFromShopify
);
productRouter.get(
  '/getAllDataForPromotion',
  verifyToken,
  getAllProductPromotionStatus
);
productRouter.get(
  '/getPromotionProduct/:userId',
  verifyToken,
  getPromotionProduct
);
productRouter.delete('/deleteProduct/:id', verifyToken, deleteProduct);
productRouter.get(
  '/getSingleVariant/:productId/variants/:variantId',
  verifyToken,
  getSingleVariantData
);
productRouter.put(
  '/updateVariant/:productId/:variantId',
  verifyToken,
  updateSingleVariant
);
productRouter.get(
  '/getSingleProductForVariants/:productId',
  verifyToken,
  getsingleProduct
);
productRouter.get(
  '/fetchvarinatimages/:id',
  verifyToken,
  fetchVariantsWithImages
);
productRouter.post('/addImageGallery', verifyToken, addImagesGallery);
productRouter.get('/getImageGallery/:userId/:productId', getImageGallery);
productRouter.delete('/', deleteImageGallery);
productRouter.post(
  '/upload-csv-body',
  Csvuplaods,
  addCsvfileForProductFromBody
);
productRouter.post('/productUpdateWebhook', updateProductWebhook);
productRouter.put(
  '/updateInventoryPrice/:id',
  verifyToken,
  updateInventoryPrice
);
productRouter.put(
  '/updateInventoryQuantity/:id',
  verifyToken,
  updateInventoryQuantity
);
productRouter.get('/csvEportFile', exportProducts);
productRouter.get('/csvInventoryEportFile', exportInventoryCsv);

productRouter.post(
  '/upload-csv-for-inventory',
  Csvuplaods,
  updateInventoryFromCsv
);
export default productRouter;
