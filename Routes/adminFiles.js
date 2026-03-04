import express from 'express';
import { addAdminFile, deleteAdminFile, downloadAdminFile, getAdminFile } from '../controller/adminFile.js';
import { Csvuplaods } from '../middleware/multer.js';
const adminFilesRouter = express.Router();

adminFilesRouter.post('/upload-downloadable/:type', Csvuplaods, addAdminFile);
adminFilesRouter.get('/get-downloadable', getAdminFile);
adminFilesRouter.get("/download/:type", downloadAdminFile);
adminFilesRouter.delete("/delete/:id", deleteAdminFile);
export default adminFilesRouter;
