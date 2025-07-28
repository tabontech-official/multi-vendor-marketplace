// import { shopifyConfigurationModel } from "../Models/buyCredit.js";
// import { listingModel } from "../Models/Listing.js";
// import cron from 'node-cron';
// import { shopifyRequest } from "./product.js";

// export const deleteOrphanedProducts = () => {
//   setInterval(async () => {
//     try {
//       const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//       if (!shopifyConfiguration) {
//         console.error('❌ Shopify configuration not found.');
//         return;
//       }

//       const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = shopifyConfiguration;

//       const orphanedProducts = await listingModel.aggregate([
//         {
//           $match: {
//             $expr: {
//               $or: [
//                 { $eq: [{ $type: "$userId" }, "missing"] },
//                 { $eq: ["$userId", null] },
//                 { $eq: [{ $type: "$userId" }, "string"] },
//                 {
//                   $and: [
//                     { $eq: [{ $type: "$userId" }, "string"] },
//                     { $ne: [{ $strLenBytes: "$userId" }, 24] }
//                   ]
//                 },
//                 { $not: { $eq: [{ $type: "$userId" }, "objectId"] } }
//               ]
//             }
//           }
//         }
//       ]);

//       if (!orphanedProducts.length) {
//         console.log('📭 No orphaned products to delete right now.');
//         return;
//       }

//       for (const product of orphanedProducts) {
//         const productId = product.shopifyId;

//         if (!productId) {
//           console.warn(`⚠️ Skipping product "${product.handle}" with no Shopify ID.`);
//           continue;
//         }

//         try {
//           const shopifyURL = `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`;

//           await shopifyRequest(
//             shopifyURL,
//             'DELETE',
//             null,
//             shopifyApiKey,
//             shopifyAccessToken
//           );

//           console.log(`🗑️ Deleted from Shopify: ${product.handle}`);
//           await listingModel.findByIdAndDelete(product._id);
//           console.log(`✅ Deleted from DB: ${product.handle}`);
//         } catch (err) {
//           console.error(`❌ Failed to delete "${product.handle}":`, err.message);
//         }
//       }

//       console.log(`🎯 ${orphanedProducts.length} orphaned products processed.`);
//     } catch (error) {
//       console.error('🔥 Error in deleteOrphanedProducts:', error.message || error);
//     }
//   }, 2000);
// };
