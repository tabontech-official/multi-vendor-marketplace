import { fetchAndStoreProducts,addProduct,upload,newAddProduct,imageUpload } from "../controller/product.js";
import express from 'express'



const productRouter=express.Router()
productRouter.get('/shopify',fetchAndStoreProducts)
productRouter.post('/upload',upload.single('image'),imageUpload)
productRouter.post('/addProduct',upload.single('image'),addProduct)
productRouter.post('/addNewProduct',upload.single('image'),newAddProduct)
export default productRouter;
