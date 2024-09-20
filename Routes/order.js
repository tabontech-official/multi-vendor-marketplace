import { createOrder,getOrder,deleteOrder,updateOrder,getOnProductId,getOrderUserId } from "../controller/order.js";
import express from 'express'
const orderRouter=express.Router();
orderRouter.post('/addOrder',createOrder)
orderRouter.get('/getOrder/:shopifyUserId ',getOrder)
orderRouter.get('/product/:productId',getOnProductId)
orderRouter.post('/get/:userId',getOrderUserId)
orderRouter.put('/update/:id',updateOrder)
orderRouter.delete('/delete/:id',deleteOrder)

export default orderRouter;