import {
  createOrder,
  getOrderById,
  deleteUser,
  getFinanceSummary,
  getOrderByOrderId,
  fulfillOrder,
  getOrderDatafromShopify,
} from '../controller/order.js';
import express from 'express';
const orderRouter = express.Router();
orderRouter.post('/addOrder', createOrder);
orderRouter.post('/fullFillOrder', fulfillOrder);

orderRouter.get('/order/:userId', getOrderById)
// orderRouter.get('/order', getOrderById);
orderRouter.get('/recurringFinance', getFinanceSummary);
orderRouter.get('/getOrderByOrderId/:id', getOrderByOrderId);
orderRouter.get('/getOrderFromShopify/:id', getOrderDatafromShopify);

orderRouter.delete('/', deleteUser);
export default orderRouter;
