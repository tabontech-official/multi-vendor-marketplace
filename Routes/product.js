import { fetchAndStoreProducts,handleShopifyWebhook,addProduct,imageUploader,updateProduct, } from "../controller/product.js";
import express from 'express'

const productRouter=express.Router()
productRouter.get('/shopify',fetchAndStoreProducts)
productRouter.post('/webhook',handleShopifyWebhook)
productRouter.post('/addProduct',imageUploader.single('image'),addProduct)
productRouter.put('/update/:id',upload.single('image'),updateProduct)

export default productRouter;
