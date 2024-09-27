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
export const scheduleUnpublish = (productId, userId) => {
  const task = cron.schedule('0 0 * * *', async () => { // Run once a day at midnight
    const product = await productModel.findOne({ id: productId });
    const user = await authModel.findById(userId);

    if (product && user && user.subscription.expiresAt <= new Date()) {
      // Update product status to inactive
      await productModel.findOneAndUpdate(
        { id: productId },
        { status: 'inactive' }
      );

      // Optionally, stop the task if you don't need it anymore
      task.stop();
    }
  });
};