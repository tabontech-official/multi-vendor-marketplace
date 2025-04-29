import { addListing } from '../controller/equipment.js';
import express from 'express';
const listingRouter = express.Router();
listingRouter.post('/', addListing);

export default listingRouter;
