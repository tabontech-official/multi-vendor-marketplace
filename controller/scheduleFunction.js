// import { productModel } from "../Models/product.js"
// import cron from 'node-cron';
// export const productSubscriptionExpiration = () => {
//     cron.schedule('0 */2 * * *', async () => {
//       try {
//         const currentDate = new Date();
  
//         // Update products with expired subscriptions
//         const result = await productModel.updateMany(
//           { expiresAt: { $lte: currentDate }, status: 'active' }, // Check for active products only
//           { $set: { status: 'draft' } }
//         );
  
//         console.log(`Updated ${result.modifiedCount} products to inactive status.`);
//       } catch (error) {
//         console.error('Error updating product statuses:', error);
//       }
//     });
//   };

import cron from 'node-cron';
import { productModel } from '../Models/product.js';
// Schedule unpublishing task
export const scheduleUnpublish = () => {
  cron.schedule('* * * * *', async () => { // Change frequency as needed
    try {
      const products = await productModel.find({ status: 'active' });
      const currentDate = new Date();
      
      for (const product of products) {
        const expiresAt = product.expiresAt;
        if (currentDate >= expiresAt) {
          await productModel.findOneAndUpdate(
            { id: product.id },
            { status: 'draft' }
          );
          console.log(`Product ${product.id} status updated to draft.`);
        }
      }
    } catch (error) {
      console.error(`Error in scheduled unpublish: ${error.message}`);
    }
  });
};

// const testUnpublishProduct = async (productId) => {
//   const product = await productModel.findOne({ id: productId });
//   const currentDate = new Date();
//   const expiresAt = product.expiresAt;

//   console.log(`Current Date: ${currentDate}, Expires At: ${expiresAt}`);
  
//   if (currentDate >= expiresAt) {
//     await productModel.findOneAndUpdate(
//       { id: productId },
//       { status: 'draft' }
//     );
//     console.log(`Product ${productId} status updated to draft.`);
//   } else {
//     console.log(`Product ${productId} not yet expired.`);
//   }
// };

// // Call this function for testing
// testUnpublishProduct('8721557422333');