import express from 'express';
import {
  createCategory,
  delet,
  deleteCollection,
  exportCsvForCategories,
  getCategory,
  getCollectionData,
  getSingleCategory,
} from '../controller/category.js';
import { cpUpload } from '../middleware/cloudinary.js';
import { verifyToken } from '../middleware/verifyToken.js';

const categoryRouter = express.Router();
categoryRouter.post('/createCategory', verifyToken, cpUpload, createCategory);

categoryRouter.get('/getCategory',verifyToken, getCategory);
categoryRouter.get('/getCollection/:userId',  getCollectionData);
categoryRouter.get('/category/:categoryId', verifyToken, getSingleCategory);
categoryRouter.get('/getCsvForCategories', exportCsvForCategories);
categoryRouter.delete('/deleteCollection', verifyToken, deleteCollection);
categoryRouter.delete('/', delet);
export default categoryRouter;
