import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
import { getAllAlerts, getUserAlerts } from '../controller/alertController.js';

const alertRouter = express.Router();
alertRouter.get('/', getAllAlerts);

// User
alertRouter.get('/alerts',verifyToken, getUserAlerts);
export default alertRouter;
