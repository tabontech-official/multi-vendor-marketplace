import { createOrder,getOrder,deleteOrder,updateOrder } from "../controller/order.js";
import express from 'express'
const orderRouter=express.Router();
orderRouter.post('/addOrder/:userId',createOrder)
orderRouter.get('/getOrder/:userId',getOrder)
orderRouter.put('/update/:id',updateOrder)
orderRouter.delete('/delete/:id',deleteOrder)

export default orderRouter;