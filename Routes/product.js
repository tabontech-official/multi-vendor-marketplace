import { fetchAndStoreProducts,handleShopifyWebhook } from "../controller/product.js";
import express from 'express'
const productRouter=express.Router()
productRouter.get('/shopify',fetchAndStoreProducts)
productRouter.post('/webhook',handleShopifyWebhook)
export default productRouter;
