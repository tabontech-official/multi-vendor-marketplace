import express from 'express';
import {
  addAdminFile,
  deleteAdminFile,
  downloadAdminFile,
  downloadFile,
  getAdminFile,
  setActiveFile,
} from '../controller/adminFile.js';
import { Csvuplaods } from '../middleware/multer.js';
import { runWorker } from '../controller/contentController.js';
const adminFilesRouter = express.Router();

adminFilesRouter.post('/upload-downloadable/:type', Csvuplaods, addAdminFile);
adminFilesRouter.get('/get-downloadable', getAdminFile);
adminFilesRouter.get('/download/:type', downloadAdminFile);
adminFilesRouter.delete('/delete/:id', deleteAdminFile);
adminFilesRouter.get('/download-file/:id', downloadFile);
adminFilesRouter.put('/set-active/:id', setActiveFile);
adminFilesRouter.get("/run-worker", runWorker);
export default adminFilesRouter;
