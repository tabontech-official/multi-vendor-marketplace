import { fetchAndStoreProducts } from "../controller/product.js";
import express from 'express'
const productRouter=express.Router()
productRouter.get('/shopify',fetchAndStoreProducts)

export default productRouter;
