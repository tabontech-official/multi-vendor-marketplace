import { fetchAndStoreProducts ,addProduct,updateProduct, handleShopifyWebhook} from "../controller/product.js";
import upload from "../middlleware/upload.js";
import express from 'express'
const productRouter=express.Router()
productRouter.get('/shopify',fetchAndStoreProducts)
productRouter.post('/addProduct',upload.single('image'),addProduct)
productRouter.put('/update/:id',upload.single('image'),updateProduct)
productRouter.post('/webhook',handleShopifyWebhook )
export default productRouter