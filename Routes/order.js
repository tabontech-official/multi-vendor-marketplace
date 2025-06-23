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
  getLineItemCountByShopifyOrderId,
  getAllRequestsGroupedByUser,
  getRequestById,
  addReferenceToOrders,
  getPayoutByUserId,
  getPayoutForAllOrders,
  addPaypalAccountNo,
  exportOrders,
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
orderRouter.post('/addPaypalAccountNo', addPaypalAccountNo);
orderRouter.post('/addPayOutDates', addPayouts);
orderRouter.get('/getPayoutsDates', getPayoutDate);
orderRouter.get('/getPayout', getPayout);
orderRouter.get('/getPayoutOrders', getPayoutOrders);
orderRouter.post('/updatetrackingShopify', updateTrackingInShopify);
orderRouter.post('/cancelShopifyOrder', cancelShopifyOrder);
orderRouter.get('/getPayoutOrders', getPayoutOrders);
orderRouter.get("/lineItemCount/:shopifyOrderId",getLineItemCountByShopifyOrderId)
orderRouter.get("/getCancellationRequests",getAllRequestsGroupedByUser)
orderRouter.get("/getCancellationRequestsByUserId/:id",getRequestById)
orderRouter.post('/addReferenceNumber', addReferenceToOrders);
orderRouter.get("/getPayoutByUserId",getPayoutByUserId)
orderRouter.get('/getPayoutForAllOrders', getPayoutForAllOrders);
orderRouter.get('/exportAllOrder', exportOrders);

orderRouter.delete('/', deleteUser);
export default orderRouter;
