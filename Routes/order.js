import {
  createOrder,
  getOrderById,
  deleteUser,
  getFinanceSummary,
  getOrderByOrderId,
  fulfillOrder,
  getOrderDatafromShopify,
  getAllOrdersForAdmin,
} from '../controller/order.js';
import express from 'express';
const orderRouter = express.Router();
orderRouter.post('/addOrder', createOrder);
orderRouter.post('/fullFillOrder', fulfillOrder);

orderRouter.get('/order/:userId', getOrderById)
// orderRouter.get('/order', getOrderById);
orderRouter.get('/recurringFinance', getFinanceSummary);
orderRouter.get('/getOrderByOrderId/:id', getOrderByOrderId);
orderRouter.get('/getOrderFromShopify/:id/:userId', getOrderDatafromShopify);
orderRouter.get('/getAllOrderForMerchants', getAllOrdersForAdmin);

orderRouter.delete('/', deleteUser);
export default orderRouter;
// export const getAllOrdersForAdmin = async (req, res) => {
//   try {
//     const allOrders = await orderModel.find({});
//     const groupedOrders = new Map(); // keyed by merchantId
//     const merchantDetailsMap = new Map();

//     for (const order of allOrders) {
//       const merchantGroups = new Map();

//       for (const item of order.lineItems || []) {
//         const variantId = item.variant_id?.toString();
//         if (!variantId) continue;

//         const product = await listingModel.findOne({ 'variants.id': variantId });
//         if (!product || !product.userId) continue;

//         const merchantId = product.userId.toString();

//         // Attach variant image if present
//         const matchedVariant = product.variants.find(v => v.id === variantId);
//         if (matchedVariant?.image_id && Array.isArray(product.variantImages)) {
//           const image = product.variantImages.find(img => img.id === matchedVariant.image_id);
//           if (image) {
//             item.image = {
//               id: image.id,
//               src: image.src,
//               alt: image.alt,
//               position: image.position,
//               width: image.width,
//               height: image.height,
//             };
//           }
//         }

//         // Add orderId reference to the item
//         item.orderId = order.orderId;

//         // Group items by merchant
//         if (!merchantGroups.has(merchantId)) {
//           merchantGroups.set(merchantId, []);
//         }
//         merchantGroups.get(merchantId).push(item);

//         // Cache merchant info
//         if (!merchantDetailsMap.has(merchantId)) {
//           const merchant = await authModel.findById(merchantId).select('-password');
//           if (merchant) {
//             merchantDetailsMap.set(merchantId, {
//               _id: merchant._id,
//               name: `${merchant.firstName} ${merchant.lastName}`,
//               email: merchant.email,
//               role: merchant.role,
//               dispatchAddress: merchant.dispatchAddress,
//               dispatchCountry: merchant.dispatchCountry
//             });
//           }
//         }
//       }

//       // Group final structure per merchant
//       merchantGroups.forEach((items, merchantId) => {
//         const existing = groupedOrders.get(merchantId) || {
//           serialNo: order.serialNumber,
//           merchants: [
//             {
//               id: merchantId,
//               info: merchantDetailsMap.get(merchantId) || { id: merchantId },
//             },
//           ],
//           lineItemsByMerchant: {},
//           customersByMerchant: {},
//         };

//         if (!existing.lineItemsByMerchant[merchantId]) {
//           existing.lineItemsByMerchant[merchantId] = [];
//         }

//         existing.lineItemsByMerchant[merchantId].push(...items);
//         existing.customersByMerchant[merchantId] = order.customer;

//         groupedOrders.set(merchantId, existing);
//       });
//     }

//     const responseData = Array.from(groupedOrders.values());

//     if (responseData.length > 0) {
//       return res.status(200).send({
//         message: 'Orders grouped by merchants with details',
//         data: responseData,
//       });
//     } else {
//       return res.status(404).send({
//         message: 'No orders found across merchants',
//       });
//     }
//   } catch (error) {
//     console.error('❌ Error in getAllOrdersForAdmin:', error);
//     res.status(500).send({ message: 'Internal Server Error' });
//   }
// };
