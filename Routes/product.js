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
const productRouter = express.Router();
productRouter.post('/addEquipment', cpUpload, addUsedEquipments);
productRouter.post('/webhooks/delete', productDelete);
productRouter.post('/holiday', updateAllProductsStatus);
productRouter.post('/webhook/product/update', productUpdate);
productRouter.get('/getProduct/:userId', getProduct);
productRouter.get('/getAllVariants/:userId', getAllVariants);

productRouter.get('/getAllData', getAllProductData);
productRouter.put('/publishedProduct/:productId', publishProduct);
productRouter.put('/unpublished/:productId', unpublishProduct);
productRouter.put('/updateProducts/:id', cpUpload, updateProductData);
productRouter.put('/updateImages/:id', updateImages);
productRouter.put('/updateVariantImages/:id', updateVariantImages);
productRouter.get('/getProductCount', fetchProductCount);
productRouter.get('/getProductDataFromShopify/:id', getProductDataFromShopify);
productRouter.get('/getAllDataForPromotion', getAllProductPromotionStatus);
productRouter.get('/getPromotionProduct/:userId', getPromotionProduct);
productRouter.delete('/deleteProduct/:id', deleteProduct);
productRouter.get(
  '/getSingleVariant/:productId/variants/:variantId',
  getSingleVariantData
);
productRouter.put('/updateVariant/:productId/:variantId', updateSingleVariant);
productRouter.get('/getSingleProductForVariants/:productId', getsingleProduct);
productRouter.get('/fetchvarinatimages/:id', fetchVariantsWithImages);
productRouter.post('/addImageGallery', addImagesGallery);
productRouter.get('/getImageGallery/:userId/:productId', getImageGallery);
productRouter.delete('/', deleteImageGallery);
productRouter.post(
  '/upload-csv-body',
  Csvuplaods,
  addCsvfileForProductFromBody
);
productRouter.post('/productUpdateWebhook',updateProductWebhook)
productRouter.put('/updateInventoryPrice/:id',updateInventoryPrice)
productRouter.put('/updateInventoryQuantity/:id',updateInventoryQuantity)
productRouter.get('/csvEportFile', exportProducts);
productRouter.get('/csvInventoryEportFile', exportInventoryCsv);

productRouter.post(
  '/upload-csv-for-inventory',
  Csvuplaods,
  updateInventoryFromCsv
);
export default productRouter;
