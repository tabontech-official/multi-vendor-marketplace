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
  deleteAll,
  getProductForCahrts,
  deleteAllProducts,
  trackProductView,
  getTrackingCountForUser,
  fetchProductCountForUser,
  addCsvfileForBulkUploader,
  getAllProducts,
  getAllProductWithApprovalStatus,
  approvelProduct,
  duplicateProduct,
  getAllVariantsForAdmin,
  getTrackingCountForAdmin,
  syncProductVariants,
  getBatchesByUser,
  getAllBatches,
  getSingleBatch,
} from '../controller/product.js';
import { cpUpload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';
import express from 'express';
import { Csvuplaods } from '../middleware/multer.js';
import { verifyToken } from '../middleware/verifyToken.js';
const productRouter = express.Router();
productRouter.post('/createProduct', verifyToken, cpUpload, addUsedEquipments);
productRouter.post('/duplicateProduct/:productId', verifyToken,  duplicateProduct);
productRouter.get("/sync-product/:productId", syncProductVariants);

productRouter.post('/webhooks/delete', productDelete);
productRouter.post('/holiday', verifyToken, updateAllProductsStatus);
productRouter.post('/webhook/product/update', verifyToken, productUpdate);
productRouter.get('/getProduct/:userId', verifyToken, getProduct);

productRouter.get('/getProductWithApprovalStatus', verifyToken, getAllProductWithApprovalStatus);

productRouter.get('/getAllVariants/:userId', verifyToken, getAllVariants);
productRouter.get('/getAllVariants', verifyToken, getAllVariantsForAdmin);

productRouter.get('/getAllProducts', verifyToken, getAllProductData);
productRouter.put('/publishedProduct/:productId', verifyToken, publishProduct);
productRouter.put('/approvedProduct/:productId', verifyToken, approvelProduct);

productRouter.put('/unpublished/:productId', verifyToken, unpublishProduct);
productRouter.patch(
  '/updateProducts/:id',
  verifyToken,
  cpUpload,
  updateProductData
);
productRouter.put('/updateImages/:id', verifyToken, updateImages);
productRouter.put('/updateVariantImages/:id', verifyToken, updateVariantImages);
productRouter.get('/getProductCount', verifyToken, fetchProductCount);
productRouter.get('/getProductDataFromShopify/:id', getProductDataFromShopify);
productRouter.get('/getAllDataForPromotion', getAllProductPromotionStatus);
productRouter.get('/getPromotionProduct/:userId', getPromotionProduct);
productRouter.delete('/deleteProduct/:id', verifyToken, deleteProduct);
productRouter.get(
  '/getVariant/:productId/variants/:variantId',
  getSingleVariantData,
  verifyToken
);
productRouter.put(
  '/updateVariant/:productId/:variantId',
  verifyToken,
  updateSingleVariant
);
productRouter.get('/getSingleProductForVariants/:productId', getsingleProduct);
productRouter.get('/fetchvarinatimages/:id', fetchVariantsWithImages);
productRouter.post('/addImageGallery', verifyToken, addImagesGallery);
productRouter.get('/getImageGallery/:productId',verifyToken ,getImageGallery);
productRouter.delete('/', deleteImageGallery);
productRouter.post(
  '/upload-product-csv',
  Csvuplaods,
  verifyToken,

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
productRouter.get('/batches/:userId', getBatchesByUser);
productRouter.get('/batches', getAllBatches);
productRouter.get("/batch/:id", getSingleBatch);

productRouter.get('/csvEportFile', exportProducts);

productRouter.get('/csvInventoryEportFile', exportInventoryCsv);

productRouter.post(
  '/upload-csv-for-inventory',
  Csvuplaods,
  verifyToken,

  updateInventoryFromCsv
);
productRouter.delete('/sel', deleteAll);
productRouter.get('/getProductForCharts/:userId', getProductForCahrts);
productRouter.delete('/deleteAll', deleteAllProducts);
productRouter.post('/trackingProduct', trackProductView);
productRouter.get('/trackingViews/:userId', getTrackingCountForUser);
productRouter.get('/trackingViews/', getTrackingCountForAdmin);

productRouter.get('/getProductCountForUser/:userId', fetchProductCountForUser);
productRouter.post(
  '/upload-csv-for-bulk-upload',
  Csvuplaods,

  addCsvfileForBulkUploader
);




//...............thirdPartRoutes.............//
productRouter.get('/fetchAllProducts',verifyToken,getAllProducts)









export default productRouter;
