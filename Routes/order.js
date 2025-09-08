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
  exportProductsForUser,
  getPendingOrder,
  getSalesContribution,
  getFinanceSummaryForUser,
  getMonthlyRevenue,
} from '../controller/order.js';
import express from 'express';
import { verifyToken } from '../middleware/verifyToken.js';
const orderRouter = express.Router();
orderRouter.post('/addOrder', createOrder);
orderRouter.post('/fullFillOrder', fulfillOrder);
orderRouter.get('/monthlyRevenue',verifyToken, getMonthlyRevenue);

orderRouter.get('/order',verifyToken, getOrderById);
// orderRouter.get('/order', getOrderById);
orderRouter.get('/recurringFinance', getFinanceSummary);
orderRouter.get('/getOrderByOrderId/:id', getOrderByOrderId);
orderRouter.get('/getOrderFromShopify/:id/:userId', getOrderDatafromShopify);
orderRouter.get('/getAllOrder',verifyToken, getAllOrdersForAdmin);
orderRouter.post('/addPaypal', addPaypalAccount);
orderRouter.post('/addPaypalAccountNo', addPaypalAccountNo);
orderRouter.post('/addPayOutDates',verifyToken, addPayouts);
orderRouter.get('/getPayoutsDates', verifyToken,getPayoutDate);
orderRouter.get('/getPayout',verifyToken, getPayout);
orderRouter.get('/getPayoutByQuery',verifyToken, getPayoutOrders);
orderRouter.post('/updatetrackingShopify', updateTrackingInShopify);
orderRouter.post('/cancelOrder',verifyToken, cancelShopifyOrder);
orderRouter.get('/getPayoutByQuery',verifyToken, getPayoutOrders);
orderRouter.get("/lineItemCount/:shopifyOrderId",getLineItemCountByShopifyOrderId)
orderRouter.get("/getCancellationRequests",verifyToken,getAllRequestsGroupedByUser)
orderRouter.get("/getCancellationRequestsByUserId/:id",getRequestById)
orderRouter.post('/addReferenceNumber',verifyToken, addReferenceToOrders);
orderRouter.get("/getPayoutByUserId",verifyToken,getPayoutByUserId)
orderRouter.get('/getAllPayouts',verifyToken, getPayoutForAllOrders);
orderRouter.get('/exportAllOrder',verifyToken, exportOrders);
orderRouter.get('/exportOrderByUserId',verifyToken, exportProductsForUser);
orderRouter.get('/getPendingOrder',verifyToken, getPendingOrder);
orderRouter.get('/getSalesContribution', getSalesContribution);
orderRouter.get('/getFinanceSummaryForUser/:userId', getFinanceSummaryForUser);


orderRouter.delete('/', deleteUser);
export default orderRouter;
