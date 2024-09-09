import { fetchAndStoreProducts } from "../controller/product.js";
import express from 'express'
const productRouter=express.Router()
productRouter.get('/',fetchAndStoreProducts)

export default productRouter;
