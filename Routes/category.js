import express from 'express';
import {
  createCategory,
  delet,
  deleteCollection,
  deleteLevel3Categories,
  exportCsvForCategories,
  getCategory,
  getCategoryForProduct,
  getCollectionData,
  getSingleCategory,
  replaceAndDeleteCategory,
  updateCategory,
  uploadCsvForCategories,
} from '../controller/category.js';
import { cpUpload } from '../middleware/cloudinary.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { Csvuplaods } from '../middleware/multer.js';

const categoryRouter = express.Router();
categoryRouter.post('/createCategory', verifyToken, cpUpload, createCategory);

categoryRouter.get('/getCategory',verifyToken, getCategory);
categoryRouter.get('/getCategoryForProduct',verifyToken, getCategoryForProduct);

categoryRouter.get('/getCollection/:userId',  getCollectionData);
categoryRouter.get('/category/:categoryId', verifyToken, getSingleCategory);
categoryRouter.get('/getCsvForCategories', exportCsvForCategories);
categoryRouter.delete('/deleteCategory', verifyToken, deleteCollection);
categoryRouter.delete('/', delet);
categoryRouter.put('/updateCategoryInsteadDelete', updateCategory);
categoryRouter.post('/uploadCsvForCategories',Csvuplaods,  uploadCsvForCategories);
categoryRouter.put('/replaceAndDeleteCategory', replaceAndDeleteCategory);
categoryRouter.delete("/delete-level3", deleteLevel3Categories)

export default categoryRouter;
