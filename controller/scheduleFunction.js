import cron from 'node-cron';
import { listingModel } from '../Models/Listing.js';
import { PromoModel } from '../Models/Promotions.js';

export const productSubscriptionExpiration = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const promotionsToUpdate = await PromoModel.find({
        startDate: { $lte: today },
      });

      if (promotionsToUpdate.length > 0) {
        const promoUpdateResult = await PromoModel.updateMany(
          { startDate: { $lte: today } },
          { $set: { status: 'inactive' } }
        );

        for (const promo of promotionsToUpdate) {
          await listingModel.updateOne(
            { sku: promo.productSku },
            { $set: { promotionStatus: 'inactive' } }
          );
        }

        console.log(
          `${promoUpdateResult.modifiedCount} promotions and listings activated.`
        );
      } else {
        console.log('No promotions to activate today.');
      }
    } catch (error) {
      console.error('Error in cron job:', error);
    }
  });
};
