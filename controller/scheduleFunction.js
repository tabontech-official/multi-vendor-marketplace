import { productModel } from "../Models/product.js"
import cron from 'node-cron';
export const productSubscriptionExpiration = () => {
    cron.schedule('* * * * *', async () => {
      try {
        const currentDate = new Date();
  
        // Update products with expired subscriptions
        const result = await productModel.updateMany(
          { expiresAt: { $lte: currentDate }, status: 'active' }, // Check for active products only
          { $set: { status: 'draft' } }
        );
  
        console.log(`Updated ${result.modifiedCount} products to inactive status.`);
      } catch (error) {
        console.error('Error updating product statuses:', error);
      }
    });
  };