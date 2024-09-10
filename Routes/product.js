import { fetchAndStoreProducts,addProduct,upload } from "../controller/product.js";
import express from 'express'



const productRouter=express.Router()
productRouter.get('/shopify',fetchAndStoreProducts)
productRouter.post('/addProduct',upload.single('image'),addProduct)

export default productRouter;
