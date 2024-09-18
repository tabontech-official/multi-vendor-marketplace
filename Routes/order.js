import { createOrder,getOrder } from "../controller/order.js";
import express from 'express'
const orderRouter=express.Router();
orderRouter.post('/addOrder/:userId',createOrder)
orderRouter.get('/getOrder/:userId',getOrder)

export default orderRouter;