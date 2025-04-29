import {
  createOrder,
  getOrderById,
  deleteUser,
  getFinanceSummary,
} from '../controller/order.js';
import express from 'express';
const orderRouter = express.Router();
orderRouter.post('/addOrder', createOrder);
// orderRouter.get('/order/:email', getOrderById)
orderRouter.get('/order', getOrderById);
orderRouter.get('/recurringFinance', getFinanceSummary);

orderRouter.delete('/', deleteUser);
export default orderRouter;
