import express from 'express';
import {
  createCategory,
  delet,
  exportCsvForCategories,
  getCategory,
  getCollectionData,
  getSingleCategory,
} from '../controller/category.js';
import { cpUpload } from '../middleware/cloudinary.js';

const categoryRouter = express.Router();
categoryRouter.post('/createCategory', cpUpload, createCategory);

categoryRouter.get('/getCategory', getCategory);
categoryRouter.get('/getCollection/:userId', getCollectionData);
categoryRouter.get('/category/:categoryId', getSingleCategory);
categoryRouter.get('/getCsvForCategories', exportCsvForCategories);

categoryRouter.delete('/', delet);
export default categoryRouter;
