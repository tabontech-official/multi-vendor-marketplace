import express from 'express';
import { addConsultation } from '../controller/consultation.js';

const consultationRouter = express.Router();
consultationRouter.post('/', addConsultation);
export default consultationRouter;
