import express from 'express';
import { cpUpload } from '../middleware/cloudinary.js';
import {
  deleteUserFile,
  getAllFiles,
  getUserFiles,
  uploadContent,
} from '../controller/contentController.js';
import { cpUpload2 } from '../middleware/sendEmail.js';

const contentRoutes = express.Router();

contentRoutes.post('/upload-content', cpUpload2, uploadContent);
contentRoutes.get('/get-by-user/:userId', getUserFiles);
contentRoutes.delete('/delete-file', deleteUserFile);
contentRoutes.get('/get-all-files', getAllFiles);
export default contentRoutes;
