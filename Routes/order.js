import { createOrder,getOrderById,deleteUser} from "../controller/order.js";
import express from 'express'
const orderRouter=express.Router();
orderRouter.post('/addOrder',createOrder)
// orderRouter.get('/order/:email', getOrderById)
orderRouter.get('/order', getOrderById)
orderRouter.delete('/',deleteUser)
export default orderRouter;