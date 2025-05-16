import { PromoModel } from '../Models/Promotions.js';
import { listingModel } from '../Models/Listing.js';
import { authModel } from '../Models/auth.js';
import { shopifyRequest } from './product.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
export const addPromotion = async (req, res) => {
  try {
    const {
      promoName,
      startDate,
      endDate,
      productSku,
      promoPrice,
      status,
      userId,
    } = req.body;

    const product = await listingModel.findOne({ 'variants.sku': productSku });

    if (!product) {
      return res
        .status(404)
        .json({ message: 'Product with this SKU not found.' });
    }

    const variant = product.variants.find((v) => v.sku === productSku);

    const userRole = await authModel.findById(userId);
    const createdRole = userRole.role;

    const newPromotion = new PromoModel({
      promoName,
      startDate,
      endDate,
      productSku,
      promoPrice,
      status,
      productName: product.title || '',
      currentStock: variant?.inventory_quantity?.toString() || '0',
      currentPrice: variant.price,
      userId,
      createdRole,
    });

    await newPromotion.save();

    product.promoPrice = promoPrice;
    await product.save();

    res
      .status(201)
      .json({ message: 'Promotion added and product updated successfully.' });
  } catch (error) {
    console.error('Error in addPromotion:', error);
    res.status(500).json({ message: 'Server error while adding promotion.' });
  }
};

export const getAllPromotions = async (req, res) => {
  try {
    const result = await PromoModel.find();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ message: 'Failed to fetch promotions.' });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedData = await PromoModel.findByIdAndDelete(id);

    if (!deletedData) {
      return res.status(404).json({ message: 'Promotion not found.' });
    }

    res.status(200).json({ message: 'Promotion deleted successfully.' });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ message: 'Server error while deleting promotion.' });
  }
};

// export const addPromotionDataFromProductDb = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { promoPrice, startDate, endDate, userId } = req.body;

//     const product = await listingModel.findById(id);
//     if (!product)
//       return res.status(404).json({ message: 'Product not found.' });
//     const variant = product.variants?.[0];
//     const oldPrice = variant.price;
//     product.oldPrice = oldPrice;
//     product.promotionStatus = 'active';

//     if (!variant)
//       return res
//         .status(400)
//         .json({ message: 'No variants found for this product.' });

//     const user = await authModel.findById(userId);
//     const createdRole = user?.role;
//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfiguration) {
//       return res
//         .status(404)
//         .json({ error: 'Shopify configuration not found.' });
//     }

//     const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
//     const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
//     const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;

//     if (!shopifyApiKey || !shopifyAccessToken || !shopifyStoreUrl) {
//       return res
//         .status(400)
//         .json({ error: 'Missing Shopify credentials for user.' });
//     }

//     const promo = new PromoModel({
//       promoPrice,
//       productName: product.title,
//       productSku: variant.sku,
//       currentStock: variant.inventory_quantity,
//       currentPrice: variant.price,
//       startDate,
//       endDate,
//       status: 'active',
//       createdRole,
//       userId,
//       shopifyProductId: product.id,
//       shopifyVariantId: variant.id,
//       oldPrice: oldPrice,
//     });
//     await promo.save();

//     variant.price = promoPrice;
//     await product.save();

//     const url = `${shopifyStoreUrl}/admin/api/2023-10/variants/${variant.id}.json`;

//     await shopifyRequest(
//       url,
//       'PUT',
//       {
//         variant: {
//           id: variant.id,
//           price: promoPrice,
//         },
//       },
//       shopifyApiKey,
//       shopifyAccessToken
//     );
//     const metafieldsUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${product.id}/metafields.json`;
//     await shopifyRequest(
//       metafieldsUrl,
//       'POST',
//       {
//         metafield: {
//           namespace: 'Fold_Tech',
//           key: 'promo_price',
//           value: String(promoPrice),
//           type: 'single_line_text_field',
//         },
//       },
//       shopifyApiKey,
//       shopifyAccessToken
//     );

//     res.status(201).json({
//       message: 'Promotion applied and Shopify updated.',
//       data: promo,
//     });
//   } catch (error) {
//     console.error('Error in addPromotionDataFromProductDb:', error);
//     res.status(500).json({ message: 'Server error while creating promotion.' });
//   }
// };


export const addPromotionDataFromProductDb = async (req, res) => {
  try {
    const { id: variantId } = req.params;
    const { promoPrice, startDate, endDate, userId } = req.body;

    const product = await listingModel.findOne({
      'variants.id': variantId,
    });

    if (!product)
      return res.status(404).json({ message: 'Product not found for this variant.' });

    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant)
      return res
        .status(400)
        .json({ message: 'Variant not found in product.' });

    const oldPrice = variant.price;
    product.oldPrice = oldPrice;
    product.promotionStatus = 'active';

    const user = await authModel.findById(userId);
    const createdRole = user?.role;

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    if (!shopifyApiKey || !shopifyAccessToken || !shopifyStoreUrl) {
      return res
        .status(400)
        .json({ error: 'Missing Shopify credentials.' });
    }

    const promo = new PromoModel({
      promoPrice,
      productName: product.title,
      productSku: variant.sku,
      currentStock: variant.inventory_quantity,
      currentPrice: variant.price,
      startDate,
      endDate,
      status: 'active',
      createdRole,
      userId,
      shopifyProductId: product.id,
      shopifyVariantId: variant.id,
      oldPrice,
      variantId: variantId,
      variantName:variant.title,
      variantQuantity:variant.inventory_quantity
    });
    await promo.save();

    variant.price = promoPrice;
    variant.VariantStatus = 'active';
    await product.save();

    const variantUpdateUrl = `${shopifyStoreUrl}/admin/api/2023-10/variants/${variant.id}.json`;
    await shopifyRequest(
      variantUpdateUrl,
      'PUT',
      {
        variant: {
          id: variant.id,
          price: promoPrice,
        },
      },
      shopifyApiKey,
      shopifyAccessToken
    );

    const metafieldsUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${product.id}/metafields.json`;
    await shopifyRequest(
      metafieldsUrl,
      'POST',
      {
        metafield: {
          namespace: 'Fold_Tech',
          key: 'promo_price',
          value: String(promoPrice),
          type: 'single_line_text_field',
        },
      },
      shopifyApiKey,
      shopifyAccessToken
    );

    res.status(201).json({
      message: 'Promotion applied and Shopify updated.',
      data: promo,
    });
  } catch (error) {
    console.error('Error in addPromotionDataFromProductDb:', error);
    res.status(500).json({ message: 'Server error while creating promotion.' });
  }
};


export const endPromotions = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPromotion = await PromoModel.findByIdAndDelete(id);
    if (!deletedPromotion) {
      return res.status(404).json({ message: 'Promotion not found.' });
    }

    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      return res
        .status(500)
        .json({ message: 'Shopify configuration missing.' });
    }

    const {
      shopifyApiKey,
      shopifyAccessToken,
      shopifyStoreUrl: SHOP,
    } = shopifyConfig;

    const product = await listingModel.findOne({
      'variants.sku': deletedPromotion.productSku,
    });

    if (!product) {
      console.warn(` No product found for SKU: ${deletedPromotion.productSku}`);
      return res
        .status(404)
        .json({ message: 'Product not found for the promotion SKU.' });
    }

    const variant = product.variants.find(
      (v) => v.sku === deletedPromotion.productSku
    );
    if (!variant) {
      console.warn(
        ` Variant not found in product for SKU: ${deletedPromotion.productSku}`
      );
      return res.status(404).json({ message: 'Variant not found in product.' });
    }

    const oldPrice = product.oldPrice;
    if (!oldPrice) {
      console.warn(
        ` No old price found for SKU: ${deletedPromotion.productSku}`
      );
      return res
        .status(400)
        .json({ message: 'Old price not available for this product.' });
    }

    variant.price = oldPrice;
    product.promotionStatus = 'inactive';
    await product.save();

    const shopifyURL = `${SHOP}/admin/api/2024-01/variants/${variant.id}.json`;

    try {
      await shopifyRequest(
        shopifyURL,
        'PUT',
        { variant: { id: variant.id, price: oldPrice } },
        shopifyApiKey,
        shopifyAccessToken
      );
      console.log(` Shopify variant updated for SKU: ${variant.sku}`);
    } catch (shopifyErr) {
      console.error(
        ` Shopify update failed for SKU ${variant.sku}: ${shopifyErr.message}`
      );
      return res
        .status(500)
        .json({ message: 'Failed to update price on Shopify.' });
    }

    return res.status(200).json({
      message: 'Promotion deleted and product price restored successfully.',
    });
  } catch (error) {
    console.error(' Error in endPromotions API:', error.message || error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};
