import { createOrder,getOrderById} from "../controller/order.js";
import express from 'express'
const orderRouter=express.Router();
orderRouter.post('/addOrder',createOrder)
orderRouter.get('/order/:email', getOrderById)

export default orderRouter;