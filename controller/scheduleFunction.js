// import cron from 'node-cron';
// import { listingModel } from '../Models/Listing.js';
// import { PromoModel } from '../Models/Promotions.js';

// export const productSubscriptionExpiration = () => {
//   cron.schedule('* * * * *', async () => {
//     try {
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);

//       const promotionsToUpdate = await PromoModel.find({
//         startDate: { $lte: today },
//       });

//       if (promotionsToUpdate.length > 0) {
//         const promoUpdateResult = await PromoModel.updateMany(
//           { startDate: { $lte: today } },
//           { $set: { status: 'inactive' } }
//         );

//         for (const promo of promotionsToUpdate) {
//           await listingModel.updateOne(
//             { 'variants.sku': promo.productSku },
//             { $set: { promotionStatus: 'inactive' } }
//           );
//         }

//         console.log(
//           `${promoUpdateResult.modifiedCount} promotions and listings activated.`
//         );
//       } else {
//         console.log('No promotions to activate today.');
//       }
//     } catch (error) {
//       console.error('Error in cron job:', error);
//     }
//   });
// };
import cron from 'node-cron';
import { listingModel } from '../Models/Listing.js';
import { PromoModel } from '../Models/Promotions.js';
import { shopifyRequest } from './product.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';

export const productSubscriptionExpiration = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const promotionsToUpdate = await PromoModel.find({
        startDate: { $lte: today },
      });

      if (promotionsToUpdate.length === 0) {
        console.log('📭 No promotions to update today.');
        return;
      }

      const promoUpdateResult = await PromoModel.updateMany(
        { startDate: { $lte: today } },
        { $set: { status: 'inactive' } }
      );
      

      const shopifyConfiguration = await shopifyConfigurationModel.findOne();
      if (!shopifyConfiguration) {
        console.error(' Shopify configuration not found.');
        return;
      }

      const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
      const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
      const SHOP = shopifyConfiguration.shopifyStoreUrl;

      for (const promo of promotionsToUpdate) {
        const product = await listingModel.findOne({
          'variants.sku': promo.productSku,
        });

        if (!product) {
          console.warn(`No listing found for SKU: ${promo.productSku}`);
          continue;
        }

        const variant = product.variants.find(
          (v) => v.sku === promo.productSku
        );

        if (!variant) {
          console.warn(` Variant not found in listing for SKU: ${promo.productSku}`);
          continue;
        }

        const oldPrice = product.oldPrice;

        if (!oldPrice) {
          console.warn(` No compare_at_price found for SKU: ${promo.productSku}`);
          continue;
        }

        variant.price = oldPrice;
        product.promotionStatus = 'inactive';
        await product.save();

        const shopifyURL = `${SHOP}/admin/api/2024-01/variants/${variant.id}.json`;

        try {
          await shopifyRequest(
            shopifyURL,
            'PUT',
            {
              variant: {
                id: variant.id,
                price: oldPrice,
              },
            },
            shopifyApiKey,
            shopifyAccessToken
          );
          console.log(`Shopify updated: SKU ${variant.sku}, price reverted to ${oldPrice}`);
        } catch (shopifyErr) {
          console.error(` Shopify update failed for SKU ${variant.sku}:`, shopifyErr.message);
        }
      }

      console.log(` ${promoUpdateResult.modifiedCount} promotions marked inactive.`);
    } catch (error) {
      console.error(' Cron job error:', error.message || error);
    }
  });
};
