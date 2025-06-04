import {
  createOrder,
  getOrderById,
  deleteUser,
  getFinanceSummary,
  getOrderByOrderId,
  fulfillOrder,
  getOrderDatafromShopify,
  getAllOrdersForAdmin,
  addPaypalAccount,
  addPayouts,
  getPayoutDate,
  getPayout,
  getPayoutOrders,
  updateTrackingInShopify,
  cancelShopifyOrder,
} from '../controller/order.js';
import express from 'express';
const orderRouter = express.Router();
orderRouter.post('/addOrder', createOrder);
orderRouter.post('/fullFillOrder', fulfillOrder);

orderRouter.get('/order/:userId', getOrderById);
// orderRouter.get('/order', getOrderById);
orderRouter.get('/recurringFinance', getFinanceSummary);
orderRouter.get('/getOrderByOrderId/:id', getOrderByOrderId);
orderRouter.get('/getOrderFromShopify/:id/:userId', getOrderDatafromShopify);
orderRouter.get('/getAllOrderForMerchants', getAllOrdersForAdmin);
orderRouter.post('/addPaypal', addPaypalAccount);
orderRouter.post('/addPayOutDates', addPayouts);
orderRouter.get('/getPayoutsDates', getPayoutDate);
orderRouter.get('/getPayout', getPayout);
orderRouter.get('/getPayoutOrders', getPayoutOrders);
orderRouter.post('/updatetrackingShopify', updateTrackingInShopify);
orderRouter.post('/cancelShopifyOrder', cancelShopifyOrder);

orderRouter.delete('/', deleteUser);
export default orderRouter;
