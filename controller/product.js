import { productModel } from '../Models/product.js';
import fetch from 'node-fetch';
import { authModel } from '../Models/auth.js';
import mongoose from 'mongoose';
import { listingModel } from '../Models/Listing.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import fs from 'fs';
import csv from 'csv-parser';
import { imageGalleryModel } from '../Models/imageGallery.js';
import { Readable } from 'stream';
import Papa from 'papaparse';
import { PromoModel } from '../Models/Promotions.js';
import { Parser } from 'json2csv';
import path from 'path';
import moment from 'moment';
import { viewModel } from '../Models/viewModel.js';
import { categoryModel } from '../Models/category.js';
import { approvalModel } from '../Models/ApprovalSetting.js';
import XLSX from 'xlsx';
import { brandAssetModel } from '../Models/brandAsset.js';
import ExcelJS from 'exceljs';
import { shippingProfileModel } from '../Models/shippingProfileModel.js';
import { v4 as uuidv4 } from 'uuid';
import csvImportBatchSchema from '../Models/csvImportBatchSchema.js';
export const shopifyRequest = async (
  url,
  method,
  body,
  apiKey,
  accessToken
) => {
  const base64Credentials = Buffer.from(`${apiKey}:${accessToken}`).toString(
    'base64'
  );

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${base64Credentials}`,
    },
    body: body ? JSON.stringify(body) : null,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed: ${errorText}`);
  }

  return response.json();
};

function cleanSellerName(name) {
  if (!name) return '';

  return name
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const generateVariantCombinations = (options, index = 0, current = {}) => {
  if (index === options.length) return [current];
  const key = options[index].name;
  let variants = [];
  options[index].values.forEach((value) => {
    variants = variants.concat(
      generateVariantCombinations(options, index + 1, {
        ...current,
        [key]: value,
      })
    );
  });
  return variants;
};
const getAllParentCategoryNos = async (selectedCategories = []) => {
  const allCatNos = new Set();

  for (const catNo of selectedCategories) {
    let current = await categoryModel.findOne({ catNo });

    while (current) {
      allCatNos.add(current.catNo);

      if (!current.parentCatNo) break;

      current = await categoryModel.findOne({
        catNo: current.parentCatNo,
      });
    }
  }

  return Array.from(allCatNos);
};

export const addUsedEquipments = async (req, res) => {
  let productId;
  try {
    console.log(req.body);
    const userId = req.userId;
    const user = await authModel.findById(userId);
    let sellerTag = '';

    if (user?.shopifyCollectionId) {
      const brandAsset = await brandAssetModel.findOne({
        shopifyCollectionId: user.shopifyCollectionId,
      });

      if (brandAsset?.sellerName) {
        const cleanedName = cleanSellerName(brandAsset.sellerName);
        sellerTag = cleanedName ? `col_${cleanedName}` : '';
      }
    }

    if (!user) return res.status(404).json({ error: 'User not found' });
    const {
      title,
      description = '',
      price = '0.00',
      compare_at_price = '0.00',
      track_quantity = false,
      trackQuantity,
      quantity = 0,
      continue_selling = true,
      has_sku = false,
      sku = '',
      barcode = '',
      track_shipping = false,
      weight = 0,
      weight_unit = 'kg',
      status = 'draft',
      // userId = '',
      productType = '',
      vendor = '',
      keyWord = '',
      options = [],
      variantPrices = [],
      variantCompareAtPrices = [],
      variantQuantites = [],
      variantSku = [],
      categories = [],
      metafields = [],
      shippingProfileData = null,
      size_chart_image,
      size_chart_id,
      seoTitle = '',
      seoDescription = '',
      seoHandle = '',
    } = req.body;
    console.log('==========================================');
    console.log('🟢 NEW PRODUCT CREATION REQUEST STARTED');
    console.log('📦 Incoming Body:', JSON.stringify(req.body, null, 2));
    console.log('==========================================');

    let productStatus =
      status === 'publish' || status === 'active' ? 'active' : 'draft';
    let approvalStatus = 'approved';

    if (user.role === 'Merchant') {
      const approvalSetting = await approvalModel.findOne();

      if (approvalSetting?.approvalMode === 'Manual') {
        productStatus = 'draft';
        approvalStatus = 'pending';
      }
    }
    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration)
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    let parsedOptions =
      typeof options === 'string' ? JSON.parse(options) : options;
    if (!Array.isArray(parsedOptions) || parsedOptions.length === 0) {
      parsedOptions = [{ name: 'Title', values: ['Default'] }];
    }

    const shopifyOptions = parsedOptions.map((option) => ({
      name: option.name,
      values: option.values,
    }));

    const variantCombinations = generateVariantCombinations(parsedOptions);
    const formatPrice = (value) => {
      if (!value) return '0.00';
      const num = parseFloat(value);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    };
    const formatCompareAtPrice = (value) => {
      if (!value) return '0.00';
      const num = parseFloat(value);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    };
    // const shopifyVariants = variantCombinations.map((variant, index) => {
    //   const variantPrice = variantPrices?.[index] || price;
    //   const variantCompareAtPrice = formatCompareAtPrice(
    //     variantCompareAtPrices?.[index] || compare_at_price
    //   );

    //   return {
    //     option1: variant[parsedOptions[0].name] || null,
    //     option2: parsedOptions[1] ? variant[parsedOptions[1].name] : null,
    //     option3: parsedOptions[2] ? variant[parsedOptions[2].name] : null,
    //     price: formatPrice(variantPrice),
    //     compare_at_price: variantCompareAtPrice,
    //     inventory_management: track_quantity ? 'shopify' : null,
    //     inventory_quantity:
    //       track_quantity && !isNaN(parseInt(variantQuantites?.[index]))
    //         ? parseInt(variantQuantites?.[index])
    //         : 0,
    //     sku: has_sku ? `${sku}-${index + 1}` : null,
    //     barcode: has_sku ? `${barcode}-${index + 1}` : null,
    //     weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
    //     weight_unit: track_shipping ? weight_unit : null,
    //     isParent: index === 0,
    //   };
    // });

    const shopifyVariants = variantCombinations.map((variant, index) => {
      const variantPrice = variantPrices?.[index] || price;
      const variantCompareAtPrice = formatCompareAtPrice(
        variantCompareAtPrices?.[index] || compare_at_price
      );

      const variantQuantity =
        track_quantity && !isNaN(parseInt(variantQuantites?.[index]))
          ? parseInt(variantQuantites?.[index])
          : 0;

      const variantSKU = has_sku
        ? variantSku?.[index] || `${sku}-${index + 1}`
        : null;

      return {
        option1: variant[parsedOptions[0].name] || null,
        option2: parsedOptions[1] ? variant[parsedOptions[1].name] : null,
        option3: parsedOptions[2] ? variant[parsedOptions[2].name] : null,
        price: formatPrice(variantPrice),
        compare_at_price: variantCompareAtPrice,
        inventory_management: track_quantity ? 'shopify' : null,
        inventory_quantity: variantQuantity,
        sku: variantSKU,
        barcode: has_sku ? `${barcode}-${index + 1}` : null,
        weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
        weight_unit: track_shipping ? weight_unit : null,
        isParent: index === 0,
      };
    });
    // const tagsArray = [
    //   ...(keyWord ? keyWord.split(',').map((tag) => tag.trim()) : []),
    //   ...(categories ? categories : []),
    // ];
    const safeVendor =
      typeof vendor === 'string'
        ? vendor
        : Array.isArray(vendor) && vendor.length > 0
          ? vendor[0]
          : '';

    const safeProductType =
      typeof productType === 'string'
        ? productType
        : Array.isArray(productType) && productType.length > 0
          ? productType[0]
          : '';
    const selectedCategories = Array.isArray(categories)
      ? categories
      : [categories];

    const categoryTagNos = await getAllParentCategoryNos(selectedCategories);

    const tagsArray = [
      ...(keyWord ? keyWord.split(',').map((t) => t.trim()) : []),
      ...categoryTagNos,
    ];
    const generateHandle = (value) => {
      return value
        ?.toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-') // spaces + special chars → -
        .replace(/^-+|-+$/g, ''); // remove starting/ending -
    };

    const finalHandle =
      seoHandle && seoHandle.trim() !== ''
        ? generateHandle(seoHandle)
        : generateHandle(title);
    const shopifyPayload = {
      product: {
        title,
        body_html: description || '',
        vendor: safeVendor,
        product_type: safeProductType,
        status: productStatus,
        options: shopifyOptions,
        variants: shopifyVariants,
        // handle: seoHandle
        //   ? seoHandle
        //       .toLowerCase()
        //       .replace(/[^a-z0-9]+/g, '-')
        //       .replace(/(^-|-$)/g, '')
        //   : undefined,
        handle: finalHandle,

        metafields_global_title_tag: seoTitle || title,
        metafields_global_description_tag: seoDescription || '',
        // tags: [...(keyWord ? keyWord.split(',') : []),]
        tags: [
          ...tagsArray,
          `user_${userId}`,
          `vendor_${vendor}`,
          ...(sellerTag ? [sellerTag] : []),
        ],
      },
    };

    const productResponse = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
      'POST',
      shopifyPayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!productResponse?.product?.id)
      throw new Error('Shopify product creation failed.');

    productId = productResponse.product.id;
    console.log('🛒 Shopify Product Created:');
    console.log('Product ID:', productResponse?.product?.id);
    console.log(
      'Variants Returned:',
      productResponse?.product?.variants?.length
    );
    console.log(
      'Full Shopify Response:',
      JSON.stringify(productResponse, null, 2)
    );

    const isDefaultVariantOnly =
      parsedOptions.length === 1 &&
      parsedOptions[0]?.name === 'Title' &&
      parsedOptions[0]?.values?.length === 1 &&
      parsedOptions[0]?.values[0] === 'Default';

    /* =========================================================
   UNIVERSAL INVENTORY SYNC (DEFAULT + MULTI SAFE)
========================================================= */

    if (track_quantity && productResponse?.product?.variants?.length) {
      try {
        console.log('🔄 Starting inventory sync...');

        for (let i = 0; i < productResponse.product.variants.length; i++) {
          const variant = productResponse.product.variants[i];
          const inventoryItemId = variant.inventory_item_id;

          if (!inventoryItemId) continue;

          // 🔹 Default variant fallback logic
          const variantQty =
            parsedOptions.length === 1 && parsedOptions[0]?.name === 'Title'
              ? parseInt(quantity) || 0
              : !isNaN(parseInt(variantQuantites?.[i]))
                ? parseInt(variantQuantites[i])
                : 0;

          console.log(`📦 Variant ${variant.id} → Setting Qty: ${variantQty}`);

          // 🔎 Get correct location (VERY IMPORTANT)
          const inventoryLevelsRes = await shopifyRequest(
            `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
            'GET',
            null,
            shopifyApiKey,
            shopifyAccessToken
          );

          const existingLevel = inventoryLevelsRes?.inventory_levels?.[0];
          if (!existingLevel?.location_id) continue;

          await shopifyRequest(
            `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels/set.json`,
            'POST',
            {
              location_id: existingLevel.location_id,
              inventory_item_id: inventoryItemId,
              available: variantQty,
            },
            shopifyApiKey,
            shopifyAccessToken
          );

          // ✅ ALSO update DB variant quantity
          productResponse.product.variants[i].inventory_quantity = variantQty;
        }

        console.log('✅ Inventory synced successfully.');
      } catch (err) {
        console.error(
          '❌ Inventory sync error:',
          err?.response?.data || err.message
        );
      }
    }

    /* =========================================================
   SHIPPING PROFILE ASSIGN (FIXED & WORKING)
========================================================= */

    if (
      shippingProfileData?.profileId &&
      productResponse?.product?.variants?.length > 0
    ) {
      try {
        console.log('==========================================');
        console.log('🚀 SHIPPING PROFILE ASSIGNMENT STARTED');
        console.log('Profile GID:', shippingProfileData.profileId);

        const profileGID = shippingProfileData.profileId;

        const variantGIDs = productResponse.product.variants.map(
          (v) => `gid://shopify/ProductVariant/${v.id}`
        );

        console.log('🧬 Variant GIDs:', variantGIDs);

        const graphqlUrl = `${shopifyStoreUrl}/admin/api/2024-01/graphql.json`;

        const graphqlQuery = {
          query: `
        mutation deliveryProfileUpdate($id: ID!, $profile: DeliveryProfileInput!) {
          deliveryProfileUpdate(id: $id, profile: $profile) {
            profile {
              id
              name
              productVariantsCount {
                count
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
          variables: {
            id: profileGID,
            profile: {
              variantsToAssociate: variantGIDs,
            },
          },
        };

        console.log('📡 Sending GraphQL Mutation...');
        console.log(
          'Mutation Variables:',
          JSON.stringify(graphqlQuery.variables, null, 2)
        );

        const assignResponse = await shopifyRequest(
          graphqlUrl,
          'POST',
          graphqlQuery,
          shopifyApiKey,
          shopifyAccessToken
        );

        console.log('📩 GraphQL Raw Response:');
        console.log(JSON.stringify(assignResponse, null, 2));

        const userErrors =
          assignResponse?.data?.deliveryProfileUpdate?.userErrors || [];

        if (userErrors.length > 0) {
          console.error('❌ SHIPPING PROFILE ASSIGN FAILED:');
          console.error(userErrors);
        } else {
          console.log('✅ SHIPPING PROFILE SUCCESSFULLY ASSIGNED!');
          console.log(
            '📊 Updated Product Count:',
            assignResponse?.data?.deliveryProfileUpdate?.profile
              ?.productVariantsCount?.count
          );
        }

        console.log('==========================================');
      } catch (err) {
        console.error('❌ SHIPPING PROFILE ERROR:');
        console.error(err);
      }
    }

    if (size_chart_image) {
      const sizeChartMetafield = {
        metafield: {
          namespace: 'custom',
          key: 'size-chart',
          value: size_chart_image,
          type: 'single_line_text_field',
        },
      };

      try {
        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
          'POST',
          sizeChartMetafield,
          shopifyApiKey,
          shopifyAccessToken
        );
        console.log('✅ Size chart metafield added');
      } catch (err) {
        console.error('❌ Error adding size chart metafield:', err.message);
      }
    }
    if (Array.isArray(metafields) && metafields.length > 0) {
      const limitedMetafields = metafields.slice(0, 4);

      for (let i = 0; i < 4; i++) {
        const field = limitedMetafields[i];
        if (!field) continue;

        const label = field.label?.trim();
        const value = field.value?.trim();

        if (!label || !value) continue;

        const metafieldKey = `custom_${i + 1}`;
        const metafieldValue = `${label}_${value}`;

        const metafieldObject = {
          metafield: {
            namespace: 'custom',
            key: metafieldKey,
            value: metafieldValue,
            type: 'single_line_text_field',
          },
        };

        try {
          await shopifyRequest(
            `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
            'POST',
            metafieldObject,
            shopifyApiKey,
            shopifyAccessToken
          );
        } catch (metaErr) {
          console.error(
            `Error creating metafield ${metafieldKey}:`,
            metaErr.message
          );
        }
      }
    }
    console.log(productResponse.product.variants);
    const newProduct = new listingModel({
      id: productId,
      title,
      body_html: description,
      vendor: safeVendor,
      approvalStatus,
      product_type: safeProductType,
      options: shopifyOptions,
      created_at: new Date(),
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      custom: {
        size_chart: size_chart_image || null,
        size_chart_id: size_chart_id || null,
      },
      seo: {
        title: seoTitle || title,
        description: seoDescription || '',
        handle: finalHandle,
      },
      inventory: {
        track_quantity: !!track_quantity || false,
        quantity:
          track_quantity && !isNaN(parseInt(quantity)) ? parseInt(quantity) : 0,
        continue_selling: continue_selling || true,
        has_sku: !!has_sku || false,
        sku: sku,
        barcode: barcode,
      },
      shipping: (() => {
        const shippingData = {
          track_shipping: track_shipping || false,
          weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
          weight_unit: weight_unit || 'kg',
        };

        // ===============================
        // CASE 1️⃣ – Free Shipping
        // ===============================
        if (
          shippingProfileData?.profileName
            ?.toLowerCase()
            .includes('free shipping')
        ) {
          shippingData.freeShipping = true;

          shippingData.profile = {
            shortId: shippingProfileData?.shortId || null,
            profileId: null,
            profileName: 'Free Shipping',
            rateName: 'Free Shipping',
            ratePrice: 0,
          };
        }

        // ===============================
        // CASE 2️⃣ – Paid Shipping Profile
        // ===============================
        else if (shippingProfileData?.profileId) {
          shippingData.freeShipping = false;

          shippingData.profile = {
            shortId: shippingProfileData?.shortId || null,
            profileId: shippingProfileData?.profileId || null,
            profileName: shippingProfileData?.profileName || '',
            rateName: shippingProfileData?.rateName || '',
            ratePrice: shippingProfileData?.ratePrice || 0,
          };
        }

        // ===============================
        // CASE 3️⃣ – Nothing Selected
        // ===============================
        else {
          shippingData.freeShipping = true;
          shippingData.profile = null;
        }

        return shippingData;
      })(),

      userId,
      status: productStatus,
      shopifyId: productId,
      categories: Array.isArray(categories) ? categories : [categories],
      metafields: metafields,
    });

    await newProduct.save();
    console.log('💾 PRODUCT SAVED IN DATABASE:');
    console.log('Saved Product ID:', newProduct.id);
    console.log('Saved Shipping Data:', newProduct.shipping);
    console.log('==========================================');
    console.log('🎉 PRODUCT CREATION COMPLETED SUCCESSFULLY');
    console.log('==========================================');

    return res.status(201).json({
      message: 'Product successfully created.',
      product: newProduct,
    });
  } catch (error) {
    console.error('Error in addUsedEquipments function:', error);

    if (productId) {
      try {
        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
          'DELETE',
          null,
          shopifyApiKey,
          shopifyAccessToken
        );
      } catch (deleteError) {
        console.error('Error deleting product from Shopify:', deleteError);
      }
    }

    res.status(500).json({ error: error.message });
  }
};

export const duplicateProduct = async (req, res) => {
  let newShopifyProductId;

  try {
    const userId = req.userId;
    const { productId } = req.params;
    const { title: customTitle } = req.body;

    // 1️⃣ User
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 2️⃣ Shopify Config
    const config = await shopifyConfigurationModel.findOne();
    if (!config)
      return res.status(404).json({ error: 'Shopify config missing' });

    const { shopifyStoreUrl, shopifyApiKey, shopifyAccessToken } = config;

    // 3️⃣ Fetch product from Shopify
    const shopifyRes = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
      'GET',
      null,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!shopifyRes?.product)
      return res.status(404).json({ error: 'Product not found on Shopify' });

    const originalShopifyProduct = shopifyRes.product;
    const finalTitle = customTitle
      ? customTitle
      : `${originalShopifyProduct.title} Copy`;

    // 4️⃣ Create product on Shopify (NO images yet)
    const createPayload = {
      product: {
        title: finalTitle,
        body_html: originalShopifyProduct.body_html,
        vendor: originalShopifyProduct.vendor,
        product_type: originalShopifyProduct.product_type,
        options: originalShopifyProduct.options,
        tags: originalShopifyProduct.tags,
        status: 'draft',
        variants: originalShopifyProduct.variants.map((v) => ({
          option1: v.option1,
          option2: v.option2,
          option3: v.option3,
          price: v.price,
          sku: v.sku,
          barcode: v.barcode,
          inventory_management: v.inventory_management,
          inventory_quantity: v.inventory_quantity,
          weight: v.weight,
          weight_unit: v.weight_unit,
        })),
      },
    };

    const createRes = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
      'POST',
      createPayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!createRes?.product?.id)
      throw new Error('Failed to create product on Shopify');

    newShopifyProductId = createRes.product.id;

    // 5️⃣ Upload images
    const uploadedImages = [];
    for (const img of originalShopifyProduct.images) {
      const imgRes = await shopifyRequest(
        `${shopifyStoreUrl}/admin/api/2024-01/products/${newShopifyProductId}/images.json`,
        'POST',
        { image: { src: img.src, alt: img.alt } },
        shopifyApiKey,
        shopifyAccessToken
      );

      if (imgRes?.image) uploadedImages.push(imgRes.image);
    }

    // 6️⃣ Map OLD image_id → NEW image_id
    const imageIdMap = {};
    originalShopifyProduct.images.forEach((oldImg, index) => {
      if (uploadedImages[index]) {
        imageIdMap[oldImg.id] = uploadedImages[index].id;
      }
    });

    // 7️⃣ Assign variant images
    for (const newVariant of createRes.product.variants) {
      const oldVariant = originalShopifyProduct.variants.find(
        (v) =>
          v.option1 === newVariant.option1 &&
          v.option2 === newVariant.option2 &&
          v.option3 === newVariant.option3
      );

      if (!oldVariant?.image_id) continue;

      const newImageId = imageIdMap[oldVariant.image_id];
      if (!newImageId) continue;

      await shopifyRequest(
        `${shopifyStoreUrl}/admin/api/2024-01/variants/${newVariant.id}.json`,
        'PUT',
        { variant: { id: newVariant.id, image_id: newImageId } },
        shopifyApiKey,
        shopifyAccessToken
      );
    }

    // 8️⃣ Clone MongoDB product
    const originalDbProduct = await listingModel
      .findOne({ id: productId })
      .lean();

    if (!originalDbProduct) throw new Error('Original product not found in DB');

    delete originalDbProduct._id;
    delete originalDbProduct.__v;

    const clonedDbProduct = {
      ...originalDbProduct,
      id: newShopifyProductId,
      shopifyId: newShopifyProductId,
      title: createRes.product.title,
      status: 'draft',
      approvalStatus: 'approved',
      userId,
      created_at: new Date(),
    };

    const newDbProduct = new listingModel(clonedDbProduct);
    await newDbProduct.save();

    return res.status(201).json({
      message: '✅ Product duplicated successfully with images & variants',
      product: newDbProduct,
    });
  } catch (error) {
    console.error('❌ Duplicate failed:', error.message);

    // 🧹 Rollback Shopify product
    if (newShopifyProductId) {
      try {
        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${newShopifyProductId}.json`,
          'DELETE',
          null,
          shopifyApiKey,
          shopifyAccessToken
        );
      } catch (err) {
        console.error('Rollback failed:', err.message);
      }
    }

    return res.status(500).json({ error: error.message });
  }
};

export const getProduct = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const objectIdUserId = new mongoose.Types.ObjectId(userId);

    const products = await listingModel.aggregate([
      {
        $match: {
          userId: objectIdUserId,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: { created_at: -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
      // {
      //   $addFields: {
      //     images: {
      //       $filter: {
      //         input: '$images',
      //         as: 'img',
      //         cond: {
      //           $regexMatch: {
      //             input: '$$img.alt',
      //             regex: /^image-/,
      //           },
      //         },
      //       },
      //     },
      //   },
      // },
      {
        $project: {
          _id: 1,
          id: 1,
          title: 1,
          body_html: 1,
          vendor: 1,
          product_type: 1,
          created_at: 1,
          tags: 1,
          variants: 1,
          options: 1,
          images: 1,
          seo: 1,
          inventory: 1,
          variantImages: 1,
          shipping: 1,
          status: 1,
          userId: 1,
          categories: 1,
          oldPrice: 1,
          shopifyId: 1,
          custom: 1,
          approvalStatus: 1,
          metafields: 1,
          username: {
            $concat: [
              { $ifNull: ['$user.firstName', ''] },
              ' ',
              { $ifNull: ['$user.lastName', ''] },
            ],
          },
          email: '$user.email',
        },
      },
    ]);

    const totalProducts = await listingModel.countDocuments({
      userId: objectIdUserId,
    });

    if (products.length === 0) {
      return res
        .status(404)
        .json({ message: 'No products found for this user.' });
    }

    res.status(200).json({
      products,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
    });
  } catch (error) {
    console.error('Error in getProductsByUserId function:', error);
    res.status(500).json({ error: error.message });
  }
};

export const productUpdate = async (req, res) => {
  const { id, updateData } = req.body;

  if (!id || !updateData) {
    return res.status(400).send('Product ID and update data are required');
  }

  try {
    const result = await productModel.updateOne({ id }, { $set: updateData });

    if (result.nModified === 0) {
      console.log(
        `Product with ID ${id} not found or data is the same in MongoDB.`
      );
      return res
        .status(404)
        .send('Product not found or no changes made in MongoDB');
    }

    console.log(`Successfully updated product with ID ${id} in MongoDB.`);
    res.status(200).send('Product updated successfully');
  } catch (error) {
    console.error('Error updating product in MongoDB:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const updateProductData = async (req, res) => {
  const { id } = req.params;
  const product = await listingModel.findById(id);
  const productOwnerId = product.userId;

  try {
    if (!id) {
      return res
        .status(400)
        .json({ error: 'Product ID is required for updating.' });
    }

    const userId = req.userId;
    const {
      title,
      description,
      price,
      compare_at_price,
      track_quantity,
      quantity,
      has_sku,
      sku,
      barcode,
      track_shipping,
      weight,
      weight_unit,
      status,
      productType,
      seoTitle = '',
      seoDescription = '',
      seoHandle = '',
      vendor,
      keyWord,
      options,
      variantPrices,
      variantCompareAtPrices,
      variantQuantites,
      variantQuantities,
      variantSku,
      categories,
      metafields = [],
      shippingProfileData = null,
      size_chart_image,
      size_chart_id,
    } = req.body;
    const generateHandle = (value) => {
      return value
        ?.toString()
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-') // spaces + special chars → -
        .replace(/^-+|-+$/g, ''); // remove starting/ending hyphen
    };

    const finalHandle =
      seoHandle && seoHandle.trim() !== ''
        ? generateHandle(seoHandle)
        : generateHandle(title || product.title);
    const variantQtyArray = variantQuantites || variantQuantities || [];
    // const productStatus = status === 'publish' ? 'active' : 'draft';

    const parsedOptions =
      typeof options === 'string' ? JSON.parse(options) : options || [];
    const shopifyOptions = parsedOptions.map((option) => ({
      name: option.name,
      values: option.values,
    }));

    const shopifyConfig = await shopifyConfigurationModel.findOne();
    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfig;

    const product = await listingModel.findById(id);
    const shopifyProductId = product.id;
    const productUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyProductId}.json`;
    const productStatus =
      status === 'publish'
        ? 'active'
        : status === 'draft'
          ? 'draft'
          : product.status;

    const finalCategories =
      Array.isArray(categories) && categories.length > 0
        ? categories
        : product.categories || [];
    const existingProduct = await shopifyRequest(
      productUrl,
      'GET',
      null,
      shopifyApiKey,
      shopifyAccessToken
    );
    const existingVariants = existingProduct?.product?.variants || [];

    const variantCombinations = generateVariantCombinations(parsedOptions);

    const formatPrice = (v) => (v ? parseFloat(v).toFixed(2) : '0.00');
    const formatCompareAtPrice = (v) => (v ? parseFloat(v).toFixed(2) : '0.00');

    const shopifyVariants = variantCombinations.map((comb, i) => {
      const variantPrice = formatPrice(variantPrices?.[i] || price);
      const variantCompareAtPrice = formatCompareAtPrice(
        variantCompareAtPrices?.[i] || compare_at_price
      );
      const variantSKU = has_sku ? variantSku?.[i] || `${sku}-${i + 1}` : null;
      const combinationTitle = Object.values(comb)
        .filter(Boolean)
        .join(' / ')
        .trim();

      const existingVariant = existingVariants.find(
        (v) => v.title.trim().toLowerCase() === combinationTitle.toLowerCase()
      );

      const existingQuantity = existingVariant?.inventory_quantity || 0;
      const incomingQuantity = variantQtyArray[i];
      const finalQuantity =
        track_quantity && !isNaN(incomingQuantity)
          ? parseInt(incomingQuantity)
          : existingVariant
            ? existingQuantity
            : parseInt(quantity) || 0;

      console.log(`💰 [VARIANT ${i + 1}]`, {
        title: combinationTitle,
        variantPrice,
        variantCompareAtPrice,
        variantSKU,
        existingQuantity,
        incomingQuantity,
        finalQuantity,
      });

      return {
        option1: comb[parsedOptions[0]?.name] || null,
        option2: parsedOptions[1] ? comb[parsedOptions[1]?.name] : null,
        option3: parsedOptions[2] ? comb[parsedOptions[2]?.name] : null,
        price: variantPrice,
        compare_at_price: variantCompareAtPrice,
        inventory_management: track_quantity ? 'shopify' : null,
        fulfillment_service: 'manual',
        sku: variantSKU,
        barcode: has_sku ? `${barcode}-${i + 1}` : null,
        weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
        weight_unit: track_shipping ? weight_unit : null,
        inventory_quantity: finalQuantity,
      };
    });

    console.log(
      '🔹 [Prepared Shopify Variants]:',
      JSON.stringify(shopifyVariants, null, 2)
    );
    const selectedCategories = Array.isArray(finalCategories)
      ? finalCategories
      : [finalCategories];

    const categoryTagNos = await getAllParentCategoryNos(selectedCategories);

    const finalTags = [
      ...(keyWord ? keyWord.split(',').map((t) => t.trim()) : []),
      ...categoryTagNos,
      `user_${productOwnerId}`,
      `vendor_${vendor}`,
    ];

    const updatePayload = {
      product: {
        title,
        body_html: description,
        vendor,
        product_type: productType,
        status: productStatus,
        options: shopifyOptions,
        variants: shopifyVariants,
        // handle: seoHandle
        //   ? seoHandle
        //       .toLowerCase()
        //       .replace(/[^a-z0-9]+/g, '-')
        //       .replace(/(^-|-$)/g, '')
        handle: finalHandle,

        metafields_global_title_tag: seoTitle || title,
        metafields_global_description_tag: seoDescription || '',
        // tags: [
        //   `user_${userId}`,
        //   `vendor_${vendor}`,
        //   ...(keyWord ? keyWord.split(',') : []),
        // ],
        tags: finalTags,
      },
    };

    const updateResponse = await shopifyRequest(
      productUrl,
      'PUT',
      updatePayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!updateResponse?.product?.id) {
      console.log('❌ [ERROR] Shopify product update failed');
      return res.status(500).json({ error: 'Shopify product update failed.' });
    }
    if (updateResponse?.product?.variants?.length > 0) {
      try {
        console.log('==========================================');
        console.log('🚀 SHIPPING PROFILE UPDATE STARTED');

        const variantGIDs = updateResponse.product.variants.map(
          (v) => `gid://shopify/ProductVariant/${v.id}`
        );

        // 🔥 CASE 1: Free Shipping (Do Nothing In Shopify)
        if (
          shippingProfileData?.profileName
            ?.toLowerCase()
            .includes('free shipping') ||
          !shippingProfileData
        ) {
          console.log(
            '🟢 Free Shipping — skipping Shopify profile assignment.'
          );
        }

        // 🔥 CASE 2: Assign to Selected Profile
        else if (shippingProfileData?.profileId) {
          const graphqlUrl = `${shopifyStoreUrl}/admin/api/2024-01/graphql.json`;

          const graphqlQuery = {
            query: `
          mutation deliveryProfileUpdate($id: ID!, $profile: DeliveryProfileInput!) {
            deliveryProfileUpdate(id: $id, profile: $profile) {
              profile {
                id
                name
                productVariantsCount {
                  count
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
            variables: {
              id: shippingProfileData.profileId,
              profile: {
                variantsToAssociate: variantGIDs,
              },
            },
          };

          console.log(
            '📡 Assigning to profile:',
            shippingProfileData.profileId
          );

          const assignResponse = await shopifyRequest(
            graphqlUrl,
            'POST',
            graphqlQuery,
            shopifyApiKey,
            shopifyAccessToken
          );

          console.log(
            '📩 GraphQL Response:',
            JSON.stringify(assignResponse, null, 2)
          );

          const userErrors =
            assignResponse?.data?.deliveryProfileUpdate?.userErrors || [];

          if (userErrors.length > 0) {
            console.error('❌ SHIPPING PROFILE ASSIGN FAILED:', userErrors);
          } else {
            console.log('✅ SHIPPING PROFILE UPDATED SUCCESSFULLY!');
          }
        }

        console.log('==========================================');
      } catch (err) {
        console.error('❌ SHIPPING PROFILE UPDATE ERROR:', err);
      }
    }
    if (size_chart_image) {
      const sizeChartMetafield = {
        metafield: {
          namespace: 'custom',
          key: 'size-chart',
          value: size_chart_image,
          type: 'single_line_text_field',
        },
      };

      try {
        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
          'POST',
          sizeChartMetafield,
          shopifyApiKey,
          shopifyAccessToken
        );
        console.log('✅ Size chart metafield added');
      } catch (err) {
        console.error('❌ Error adding size chart metafield:', err.message);
      }
    }

    if (Array.isArray(metafields) && metafields.length > 0) {
      console.log('🧩 Starting metafield sync with Shopify...');

      // Limit to 4 metafields
      const limitedMetafields = metafields.slice(0, 4);

      for (let i = 0; i < 4; i++) {
        const field = limitedMetafields[i];
        if (!field) continue;

        const label = field.label?.trim();
        const value = field.value?.trim();

        // Skip empty entries
        if (!label || !value) continue;

        const metafieldKey = `custom_${i + 1}`;
        const metafieldValue = `${label}_${value}`;

        const metafieldObject = {
          metafield: {
            namespace: 'custom',
            key: metafieldKey,
            value: metafieldValue,
            type: 'single_line_text_field',
          },
        };

        try {
          await shopifyRequest(
            `${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyProductId}/metafields.json`,
            'POST',
            metafieldObject,
            shopifyApiKey,
            shopifyAccessToken
          );

          console.log(`✅ Synced metafield ${metafieldKey} successfully.`);
        } catch (metaErr) {
          console.error(
            `❌ Error syncing metafield ${metafieldKey}:`,
            metaErr.message
          );
        }
      }
    } else {
      console.log(
        'ℹ️ No metafields provided in request — skipping Shopify metafield sync.'
      );
    }

    const updatedFields = {
      title: title || product.title,
      body_html: description || product.body_html,
      vendor: vendor || product.vendor,
      product_type: productType || product.product_type,
      updated_at: new Date(),
      tags: updateResponse?.product?.tags || product.tags,
      variants: updateResponse?.product?.variants || product.variants,
      options: shopifyOptions || product.options,
      userId: productOwnerId,
      status: productStatus || product.status,
      seo: {
        title: seoTitle || product?.seo?.title || title,
        description: seoDescription || product?.seo?.description || '',
        // handle: seoHandle || product?.seo?.handle || product.handle || finalHandle,
        handle: finalHandle,
      },
      custom: {
        size_chart: size_chart_image || product?.custom?.size_chart || null,
        size_chart_id: size_chart_id || product?.custom?.size_chart_id || null,
      },
      // categories: Array.isArray(categories)
      //   ? categories
      //   : product.categories || [],
      categories: finalCategories,

      metafields: Array.isArray(metafields)
        ? metafields.filter((m) => m.label?.trim() && m.value?.trim())
        : product.metafields || [],
      inventory: {
        track_quantity:
          typeof track_quantity !== 'undefined'
            ? track_quantity
            : product.inventory?.track_quantity,

        quantity:
          typeof quantity !== 'undefined'
            ? parseInt(quantity) || 0
            : product.inventory?.quantity,

        continue_selling:
          typeof req.body.continue_selling !== 'undefined'
            ? req.body.continue_selling
            : product.inventory?.continue_selling,

        has_sku:
          typeof has_sku !== 'undefined' ? has_sku : product.inventory?.has_sku,

        sku: typeof sku !== 'undefined' ? sku : product.inventory?.sku,

        barcode:
          typeof barcode !== 'undefined' ? barcode : product.inventory?.barcode,
      },

      shipping: (() => {
        const shippingData = {
          track_shipping: track_shipping || false,
          weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
          weight_unit: weight_unit || 'kg',
        };

        // ===============================
        // CASE 1️⃣ – Free Shipping
        // ===============================
        if (
          shippingProfileData?.profileName
            ?.toLowerCase()
            .includes('free shipping')
        ) {
          shippingData.freeShipping = true;

          shippingData.profile = {
            shortId: shippingProfileData?.shortId || null,
            profileId: null,
            profileName: 'Free Shipping',
            rateName: 'Free Shipping',
            ratePrice: 0,
          };
        }

        // ===============================
        // CASE 2️⃣ – Paid Profile
        // ===============================
        else if (shippingProfileData?.profileId) {
          shippingData.freeShipping = false;

          shippingData.profile = {
            shortId: shippingProfileData?.shortId || null, // ✅ ADDED
            profileId: shippingProfileData?.profileId || null,
            profileName: shippingProfileData?.profileName || '',
            rateName: shippingProfileData?.rateName || '',
            ratePrice: shippingProfileData?.ratePrice || 0,
          };
        }

        // ===============================
        // CASE 3️⃣ – Nothing Selected
        // ===============================
        else {
          shippingData.freeShipping = true;
          shippingData.profile = null;
        }

        return shippingData;
      })(),
    };

    const updatedInDb = await listingModel.findByIdAndUpdate(
      id,
      updatedFields,
      { new: true }
    );

    return res.status(200).json({
      message: 'Product and variant inventories updated successfully!',
      product: updatedInDb,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await listingModel.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!product.id) {
      return res
        .status(400)
        .json({ message: 'Shopify ID is not available for this product' });
    }

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const apiKey = shopifyConfiguration.shopifyApiKey;
    const accessToken = shopifyConfiguration.shopifyAccessToken;
    const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;

    const shopifyUrl = `${shopifyStoreUrl}/admin/api/2023-10/products/${product.id}.json`;

    const response = await fetch(shopifyUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${accessToken}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(500).json({
        message: 'Failed to delete product from Shopify',
        details: await response.text(),
      });
    }

    await listingModel.findByIdAndDelete(id);

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: 'An error occurred', error: error.message });
  }
};

export const productDelete = async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).send('Product ID is required');
  }

  try {
    const result = await listingModel.deleteOne({ id });

    if (result.deletedCount === 0) {
      console.log(`Product with ID ${id} not found in MongoDB.`);
      return res.status(404).send('Product not found in MongoDB');
    }

    console.log(`Successfully deleted product with ID ${id} from MongoDB.`);
    res.status(200).send('Product deleted successfully');
  } catch (error) {
    console.error('Error deleting product from MongoDB:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const publishProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    const localProduct = await listingModel.findById(productId);
    if (!localProduct) {
      return res.status(404).json({ error: 'Product not found in database.' });
    }

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
    const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
    const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;
    const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${localProduct.id}.json`;
    const shopifyPayload = {
      product: {
        id: localProduct.id,
        status: 'active',
        published_scope: 'global',
      },
    };

    const shopifyResponse = await shopifyRequest(
      shopifyUrl,
      'PUT',
      shopifyPayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!shopifyResponse.product) {
      return res
        .status(400)
        .json({ error: 'Failed to update product status in Shopify.' });
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const updatedProduct = await listingModel.findByIdAndUpdate(
      productId,
      { status: 'active', expiresAt },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found in database.' });
    }

    return res.status(200).json({
      message: 'Product successfully published.',
      product: updatedProduct,
      expiresAt,
    });
  } catch (error) {
    console.error('Error in publishProduct function:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const newPublishProduct = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      console.error('Validation Error: Invalid  user ID');
      return res.status(400).send('Invalid  user ID');
    }

    const user = await authModel.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return res.status(404).send('User not found');
    }

    let productStatus = 'draft';
    if (user.subscription && user.subscription.quantity > 0) {
      productStatus = 'active';
    } else {
      console.error(
        `Insufficient quantity: User ID ${userId}, Quantity: ${user.subscription ? user.subscription.quantity : 'undefined'}`
      );
    }

    const id = product.id;
    const shopifyUpdateData = {
      product: {
        id: id,
        title: product.title,
        status: productStatus,
      },
    };

    console.log('Shopify Update Data:', shopifyUpdateData);

    const basicAuth = Buffer.from(
      `${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`
    ).toString('base64');

    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-01/products/${id}.json`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify(shopifyUpdateData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Shopify API error for product ID ${id}: ${errorText}`);
      return res
        .status(response.status)
        .send(`Failed to update in Shopify: ${errorText}`);
    }

    product.status = productStatus;
    await product.save();

    if (productStatus === 'active') {
      user.subscription.quantity -= 1;
      await user.save();
    }

    const expirationDate = user.subscription.expiresAt;

    res.status(200).json({
      message: 'Product published successfully in both database and Shopify',
      expiresAt: expirationDate,
    });
  } catch (error) {
    console.error('Unexpected error while publishing product:', error);
    res.status(500).send('Error publishing product');
  }
};

export const unpublishProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await listingModel.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found in database.' });
    }
    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
    const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
    const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;
    const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${product.id}.json`;
    const shopifyPayload = {
      product: {
        id: product.id,
        status: 'draft',
      },
    };

    const shopifyResponse = await shopifyRequest(
      shopifyUrl,
      'PUT',
      shopifyPayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!shopifyResponse.product) {
      return res
        .status(400)
        .json({ error: 'Failed to update product status in Shopify.' });
    }

    const updatedProduct = await listingModel.findOneAndUpdate(
      { _id: productId },
      { status: 'draft' },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found in database.' });
    }

    return res.status(200).json({
      message: 'Product successfully unpublished.',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Error in unpublishProduct function:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getAllProductData = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const matchStage = { userId: { $exists: true, $ne: null } };

    const totalProducts = await listingModel.countDocuments(matchStage);

    const products = await listingModel.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          userId: {
            $cond: [
              { $eq: [{ $type: '$userId' }, 'string'] },
              {
                $convert: {
                  input: '$userId',
                  to: 'objectId',
                  onError: null,
                  onNull: null,
                },
              },
              '$userId',
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: { created_at: -1 },
      },
      { $skip: (page - 1) * limit },

      {
        $limit: limit,
      },
      // {
      //   $addFields: {
      //     images: {
      //       $filter: {
      //         input: '$images',
      //         as: 'img',
      //         cond: {
      //           $regexMatch: {
      //             input: '$$img.alt',
      //             regex: /^image-/,
      //           },
      //         },
      //       },
      //     },
      //   },
      // },
      {
        $project: {
          _id: 1,
          id: 1,
          title: 1,
          body_html: 1,
          vendor: 1,
          product_type: 1,
          created_at: 1,
          tags: 1,
          variants: 1,
          options: 1,
          images: 1,
          variantImages: 1,
          inventory: 1,
          shipping: 1,
          status: 1,
          userId: 1,
          categories: 1,
          oldPrice: 1,
          shopifyId: 1,
          approvalStatus: 1,
          custom: 1,
          metafields: 1,
          seo: 1,
          username: {
            $concat: [
              { $ifNull: ['$user.firstName', ''] },
              ' ',
              { $ifNull: ['$user.lastName', ''] },
            ],
          },
          email: '$user.email',
        },
      },
    ]);

    res.status(200).json({
      products,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      limit,
    });
  } catch (error) {
    console.error('Aggregation error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateAllProductsStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'draft'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status provided.' });
    }

    const localProducts = await listingModel.find();
    if (!localProducts.length) {
      return res
        .status(404)
        .json({ error: 'No products found in the database.' });
    }

    const updateProductStatus = async (product) => {
      const productId = product.id;
      const userId = product.userId;

      if (!productId) return { error: 'Missing Shopify Product ID', product };

      try {
        const shopifyConfiguration = await shopifyConfigurationModel.findOne();
        if (!shopifyConfiguration) {
          return res
            .status(404)
            .json({ error: 'Shopify configuration not found.' });
        }

        const apiKey = shopifyConfiguration.shopifyApiKey;
        const accessToken = shopifyConfiguration.shopifyAccessToken;
        const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;
        const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`;

        const shopifyPayload = {
          product: {
            id: productId,
            status,
            published_scope: status === 'active' ? 'global' : 'web',
          },
        };

        const shopifyResponse = await shopifyRequest(
          shopifyUrl,
          'PUT',
          shopifyPayload,
          apiKey,
          accessToken
        );

        if (!shopifyResponse?.product) {
          return { error: `Failed to update product ${productId} in Shopify.` };
        }

        const updatedProduct = await listingModel.findOneAndUpdate(
          { id: productId },
          { status },
          { new: true }
        );

        return { success: true, product: updatedProduct };
      } catch (error) {
        console.error(`Error updating product ${productId}:`, error);
        return { error: error.message, productId };
      }
    };

    const results = await Promise.all(localProducts.map(updateProductStatus));

    return res.status(200).json({
      message: `All products updated to "${status}".`,
      results,
    });
  } catch (error) {
    console.error('Error in updateAllProductsStatus function:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const fetchProductCount = async (req, res) => {
  try {
    const result = await listingModel.aggregate([
      {
        $match: {
          userId: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    let total = 0;
    let active = 0;
    let inactive = 0;

    result.forEach((item) => {
      total += item.count;
      if (item._id === 'active') active = item.count;
      if (item._id === 'draft') inactive = item.count;
    });

    const response = [
      { status: 'Total', count: total },
      { status: 'Active', count: active },
      { status: 'Inactive', count: inactive },
    ];

    res.status(200).json(response);
  } catch (error) {
    console.error(' Error in fetchProductCount:', error);
    res.status(500).json({ message: 'Failed to fetch product counts.' });
  }
};

export const fetchProductCountForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await listingModel.aggregate([
      { $match: { status: 'active', userId: userId } },
      { $count: 'totalProducts' },
    ]);

    const count = result[0]?.totalProducts || '0';
    res.status(200).send({ count });
  } catch (error) {
    console.error('Error in fetchProductCountForUser:', error);
    res
      .status(500)
      .json({ message: 'Failed to fetch product count for user.' });
  }
};

export const getProductDataFromShopify = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await listingModel.findById(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found in DB' });
    }

    const shopifyProductId = product.id;

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    // const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
    // const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;

    // if (!shopifyApiKey || !shopifyAccessToken) {
    //   return res.status(400).json({ error: 'Missing Shopify credentials' });
    // }

    // const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${shopifyProductId}.json`;
    // const shopifyResponse = await shopifyRequest(
    //   shopifyUrl,
    //   'GET',
    //   null,
    //   shopifyApiKey,
    //   shopifyAccessToken
    // );

    // if (!shopifyResponse?.product) {
    //   return res.status(404).json({ error: 'Product not found on Shopify' });
    // }

    return res.status(200).json({
      message: 'Product fetched from Shopify successfully',
      product: product,
    });
  } catch (error) {
    console.error('Error in getProductDataFromShopify:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getAllProductPromotionStatus = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const allProducts = await listingModel.find({}, { variants: 1 });

    const allVariants = allProducts.flatMap((product) =>
      (product.variants || []).map((variant) => ({
        id: (variant.id || variant._id)?.toString(),
        productId: product._id.toString(),
        variant,
      }))
    );

    const allVariantIds = allVariants.map((v) => v.id);

    const promos = await PromoModel.find(
      { variantId: { $in: allVariantIds } },
      { variantId: 1, status: 1 }
    );

    const promoStatusMap = new Map();
    promos.forEach((promo) => {
      promoStatusMap.set(promo.variantId?.toString(), promo.status);
    });

    const productVariantMap = new Map();

    for (const { id, productId, variant } of allVariants) {
      const promoStatus = promoStatusMap.get(id);

      if (promoStatus === 'active') continue;
      if (!promoStatus || promoStatus === 'inactive') {
        if (!productVariantMap.has(productId)) {
          productVariantMap.set(productId, []);
        }
        productVariantMap.get(productId).push(variant);
      }
    }

    const matchingProductIds = Array.from(productVariantMap.keys()).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    if (matchingProductIds.length === 0) {
      return res
        .status(404)
        .json({ message: 'No products with valid variants found.' });
    }

    const products = await listingModel.aggregate([
      {
        $match: {
          _id: { $in: matchingProductIds },
        },
      },
      {
        $addFields: {
          userId: { $toObjectId: '$userId' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          body_html: 1,
          vendor: 1,
          product_type: 1,
          created_at: 1,
          tags: 1,
          options: 1,
          images: 1,
          inventory: 1,
          shipping: 1,
          status: 1,
          oldPrice: 1,
          userId: 1,
          username: {
            $concat: [
              { $ifNull: ['$user.firstName', ''] },
              ' ',
              { $ifNull: ['$user.lastName', ''] },
            ],
          },
          email: '$user.email',
        },
      },
      { $sort: { created_at: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]);

    const finalProducts = products.map((product) => ({
      ...product,
      variants: productVariantMap.get(product._id.toString()) || [],
    }));

    res.status(200).json({
      products: finalProducts,
      currentPage: page,
      totalPages: Math.ceil(matchingProductIds.length / limit),
      totalProducts: matchingProductIds.length,
    });
  } catch (error) {
    console.error('Aggregation error:', error);
    return res.status(500).send({ error: error.message });
  }
};

export const getPromotionProduct = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const objectIdUserId = new mongoose.Types.ObjectId(userId);

    const userProducts = await listingModel.find(
      { userId: objectIdUserId },
      { variants: 1 }
    );

    const allVariants = userProducts.flatMap((product) =>
      (product.variants || []).map((variant) => ({
        id: (variant.id || variant._id)?.toString(),
        productId: product._id.toString(),
        variant,
      }))
    );

    const allVariantIds = allVariants.map((v) => v.id);

    const promos = await PromoModel.find(
      { variantId: { $in: allVariantIds } },
      { variantId: 1, status: 1 }
    );

    const promoStatusMap = new Map();
    promos.forEach((promo) => {
      promoStatusMap.set(promo.variantId?.toString(), promo.status);
    });

    const productVariantMap = new Map();

    for (const { id, productId, variant } of allVariants) {
      const promoStatus = promoStatusMap.get(id);

      if (promoStatus === 'active') continue;
      if (!promoStatus || promoStatus === 'inactive') {
        if (!productVariantMap.has(productId)) {
          productVariantMap.set(productId, []);
        }
        productVariantMap.get(productId).push(variant);
      }
    }

    const matchingProductIds = Array.from(productVariantMap.keys()).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    if (matchingProductIds.length === 0) {
      return res.status(404).json({ message: 'No matching variants found.' });
    }

    const products = await listingModel.aggregate([
      {
        $match: {
          _id: { $in: matchingProductIds },
          userId: objectIdUserId,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          body_html: 1,
          vendor: 1,
          product_type: 1,
          created_at: 1,
          tags: 1,
          options: 1,
          images: 1,
          inventory: 1,
          shipping: 1,
          status: 1,
          userId: 1,
          oldPrice: 1,
          username: {
            $concat: [
              { $ifNull: ['$user.firstName', ''] },
              ' ',
              { $ifNull: ['$user.lastName', ''] },
            ],
          },
          email: '$user.email',
        },
      },
      { $sort: { created_at: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const finalProducts = products.map((product) => ({
      ...product,
      variants: productVariantMap.get(product._id.toString()) || [],
    }));

    res.status(200).json({
      products: finalProducts,
      currentPage: page,
      totalPages: Math.ceil(matchingProductIds.length / limit),
      totalProducts: matchingProductIds.length,
    });
  } catch (error) {
    console.error('Error in getPromotionProduct:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateImages = async (req, res) => {
  const { id } = req.params;
  const { groupImages } = req.body;

  console.log('\n🟦 ===== updateImages START =====');
  console.log('🆔 Product ID:', id);
  console.log('🔘 groupImages:', groupImages);

  const imageUrls = Array.isArray(req.body.images) ? req.body.images : [];
  const variantImages = Array.isArray(req.body.variantImages)
    ? req.body.variantImages
    : [];

  /* =======================
     INPUT AUDIT
  ======================= */
  console.log('\n📥 INPUT AUDIT');
  console.log('🟢 Media images count:', imageUrls.length);
  imageUrls.forEach((url, i) => console.log(`   [MEDIA ${i + 1}] ${url}`));

  console.log('🟣 Variant image groups count:', variantImages.length);
  variantImages.forEach((v, i) => {
    console.log(`   [VARIANT GROUP ${i + 1}]`);
    console.log('      URL:', v.url);
    console.log('      Variant IDs:', v.variantIds);
  });

  try {
    /* =======================
       1. LOAD PRODUCT
    ======================= */
    const product = await listingModel.findOne({ id });
    if (!product) {
      console.log('❌ Product not found');
      return res.status(404).json({ error: 'Product not found' });
    }

    const oldMediaImages = product.images || [];

    /* =======================
       2. SHOPIFY CONFIG
    ======================= */
    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      return res.status(404).json({ error: 'Shopify config not found' });
    }

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfig;

    /* =======================
       3. FETCH SHOPIFY PRODUCT
    ======================= */
    const shopifyProduct = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products/${id}.json`,
      'GET',
      null,
      shopifyApiKey,
      shopifyAccessToken
    );

    const shopifyImages = shopifyProduct?.product?.images || [];
    const shopifyVariants = shopifyProduct?.product?.variants || [];
    const productOptions = shopifyProduct?.product?.options || [];

    /* =======================
       3.5 CLEAN SLATE
    ======================= */
    console.log('\n🧨 Deleting ALL Shopify images');
    for (const img of shopifyImages) {
      await shopifyRequest(
        `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images/${img.id}.json`,
        'DELETE',
        null,
        shopifyApiKey,
        shopifyAccessToken
      );
    }

    const shopifyImageMap = {}; // reuse ONLY for groupImages=false

    /* =======================
       4. MEDIA IMAGES
    ======================= */
    console.log('\n⬆️ MEDIA IMAGE UPLOAD');

    const variantUrlSet = new Set(
      variantImages.map((v) => v.url).filter(Boolean)
    );

    const uploadedMediaImages = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const src = imageUrls[i];
      if (!src) continue;
      if (variantUrlSet.has(src)) continue;

      const upload = await shopifyRequest(
        `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
        'POST',
        {
          image: {
            src,
            alt: `image-${i + 1}`,
            position: i + 1,
          },
        },
        shopifyApiKey,
        shopifyAccessToken
      );

      uploadedMediaImages.push({
        src,
        alt: upload.image.alt,
        position: upload.image.position,
        created_at: new Date(),
      });

      shopifyImageMap[src] = upload.image;
    }

    /* =======================
       5. VARIANT IMAGES
    ======================= */
    console.log('\n🧩 VARIANT IMAGE PROCESSING');

    const GROUP_BY_OPTION_INDEX = 0;

    const getT4Alt = (variant) => {
      const option = productOptions[GROUP_BY_OPTION_INDEX];
      if (!option) return 'variant-image';

      const value = variant[`option${GROUP_BY_OPTION_INDEX + 1}`];
      const index = option.values.findIndex(
        (v) => v.toLowerCase() === value?.toLowerCase()
      );

      return index === -1
        ? 'variant-image'
        : `t4option${GROUP_BY_OPTION_INDEX}_${index}`;
    };

    const variantImageMap = {};
    const uploadedVariantUrlMap = {}; // 🔥 important

    for (const { url, variantIds } of variantImages) {
      if (!url || !variantIds?.length) continue;

      let imageId;
      let uploadedImageAlt; // ✅ new line add karo
      // ✅ If already uploaded once, reuse
      if (uploadedVariantUrlMap[url]) {
        imageId = uploadedVariantUrlMap[url].id;
        uploadedImageAlt = uploadedVariantUrlMap[url].alt;

        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images/${imageId}.json`,
          'PUT',
          {
            image: {
              id: imageId,
              variant_ids: variantIds,
            },
          },
          shopifyApiKey,
          shopifyAccessToken
        );

        console.log(`♻️ Reused image for variants:`, variantIds);
      } else {
        // ✅ Upload only ONCE per unique URL
        const upload = await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
          'POST',
          {
            image: {
              src: url,
              alt: groupImages
                ? getT4Alt(shopifyVariants.find((v) => v.id == variantIds[0]))
                : 'variant-image',
              variant_ids: variantIds,
            },
          },
          shopifyApiKey,
          shopifyAccessToken
        );

        imageId = upload.image.id;
        uploadedVariantUrlMap[url] = upload.image;
        uploadedImageAlt = upload.image.alt;
        console.log(`⬆️ Uploaded once for variants:`, variantIds);
      }

      // Mongo mapping
      for (const variantId of variantIds) {
        if (!variantImageMap[variantId]) {
          variantImageMap[variantId] = [];
        }

        variantImageMap[variantId].push({
          src: url,
          imageId,
          alt: uploadedImageAlt,
          position: variantImageMap[variantId].length + 1,
          created_at: new Date(),
        });

        const variant = shopifyVariants.find((v) => v.id == variantId);

        console.log(
          `   🔗 ${variant?.option1} → images: ${variantImageMap[variantId].length}`
        );
      }
    }

    /* =======================
       6. FINAL MONGO SYNC
    ======================= */
    const finalImages = imageUrls.map((src, index) => {
      const existing =
        uploadedMediaImages.find((img) => img.src === src) ||
        oldMediaImages.find((img) => img.src === src);

      return {
        src,
        alt: existing?.alt || `image-${index + 1}`,
        position: index + 1,
        created_at: existing?.created_at || new Date(),
      };
    });

    const finalVariantImages = Object.entries(variantImageMap).map(
      ([variantId, images]) => ({
        variantId,
        images,
      })
    );

    const updatedProduct = await listingModel.findOneAndUpdate(
      { id },
      { images: finalImages, variantImages: finalVariantImages },
      { new: true }
    );

    console.log('\n✅ Shopify + Mongo fully synced');
    console.log('🟦 ===== updateImages END =====\n');

    return res.status(200).json({
      message: 'Images synced successfully',
      product: updatedProduct,
    });
  } catch (err) {
    console.error('❌ updateImages ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
};

// export const updateImages = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { groupImages } = req.body;

//     console.log('\n🟦 ===== updateImages START =====');
//     console.log('🆔 Product ID:', id);
//     console.log('🔘 groupImages:', groupImages);
// console.log("📦 Connected DB:", mongoose.connection.db.databaseName);
// console.log("📦 Collection:", listingModel.collection.name);

// const productId = id.toString();

//     const imageUrls = Array.isArray(req.body.images) ? req.body.images : [];
//     const variantImages = Array.isArray(req.body.variantImages)
//       ? req.body.variantImages
//       : [];

//     console.log('\n📥 INPUT AUDIT');
//     console.log('🟢 Media images:', imageUrls.length);
//     console.log('🟣 Variant groups:', variantImages.length);

//     /* =======================
//        1. LOAD PRODUCT
//     ======================= */
//     const product = await listingModel.findOne({ id: productId });
//     if (!product) {
//       console.log('❌ Product not found in Mongo');
//       return res.status(404).json({ error: 'Product not found' });
//     }

//     console.log('✅ Mongo product found');

//     const oldMediaImages = product.images || [];

//     /* =======================
//        2. SHOPIFY CONFIG
//     ======================= */
//     const shopifyConfig = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfig) {
//       return res.status(404).json({ error: 'Shopify config not found' });
//     }

//     const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
//       shopifyConfig;

//     /* =======================
//        3. FETCH SHOPIFY PRODUCT
//     ======================= */
//     const shopifyProduct = await shopifyRequest(
//       `${shopifyStoreUrl}/admin/api/2024-01/products/${id}.json`,
//       'GET',
//       null,
//       shopifyApiKey,
//       shopifyAccessToken
//     );

//     const shopifyImages = shopifyProduct?.product?.images || [];
//     const shopifyVariants = shopifyProduct?.product?.variants || [];
//     const productOptions = shopifyProduct?.product?.options || [];

//     console.log('📦 Shopify images existing:', shopifyImages.length);

//     /* =======================
//        4. DELETE ALL SHOPIFY IMAGES
//     ======================= */
//     console.log('\n🧨 Deleting old Shopify images...');
//     for (const img of shopifyImages) {
//       await shopifyRequest(
//         `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images/${img.id}.json`,
//         'DELETE',
//         null,
//         shopifyApiKey,
//         shopifyAccessToken
//       );
//     }

//     const shopifyImageMap = {};
//     const uploadedMediaImages = [];

//     /* =======================
//        5. UPLOAD MEDIA IMAGES
//     ======================= */
//     console.log('\n⬆️ Uploading Media Images...');

//     const variantUrlSet = new Set(
//       variantImages.map((v) => v.url).filter(Boolean)
//     );

//     for (let i = 0; i < imageUrls.length; i++) {
//       const src = imageUrls[i];
//       if (!src) continue;
//       if (variantUrlSet.has(src)) continue;

//       const upload = await shopifyRequest(
//         `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
//         'POST',
//         {
//           image: {
//             src,
//             alt: `image-${i + 1}`,
//             position: i + 1,
//           },
//         },
//         shopifyApiKey,
//         shopifyAccessToken
//       );

//       shopifyImageMap[src] = upload.image;

//       const imageData = {
//         src,
//         alt: upload.image.alt,
//         position: upload.image.position,
//         created_at: new Date(),
//       };

//       uploadedMediaImages.push(imageData);

//       console.log(`🖼 Uploaded media image ${i + 1}`);
//     }

//     /* =======================
//        6. VARIANT IMAGE PROCESSING
//     ======================= */
//     console.log('\n🧩 Processing Variant Images...');

//     const variantImageMap = {};

//     const GROUP_BY_OPTION_INDEX = 0;

//     const getT4Alt = (variant) => {
//       const option = productOptions[GROUP_BY_OPTION_INDEX];
//       if (!option) return 'variant-image';

//       const value = variant?.[`option${GROUP_BY_OPTION_INDEX + 1}`];
//       const index = option.values.findIndex(
//         (v) => v.toLowerCase() === value?.toLowerCase()
//       );

//       return index === -1
//         ? 'variant-image'
//         : `t4option${GROUP_BY_OPTION_INDEX}_${index}`;
//     };

//     for (const { url, variantIds } of variantImages) {
//       if (!url || !variantIds?.length) continue;

//       for (const variantId of variantIds) {
//         const variant = shopifyVariants.find(
//           (v) => v.id == variantId
//         );

//         const altText = groupImages
//           ? getT4Alt(variant)
//           : 'variant-image';

//         const upload = await shopifyRequest(
//           `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
//           'POST',
//           {
//             image: {
//               src: url,
//               alt: altText,
//               variant_ids: [variantId],
//             },
//           },
//           shopifyApiKey,
//           shopifyAccessToken
//         );

//         if (!variantImageMap[variantId]) {
//           variantImageMap[variantId] = [];
//         }

//         variantImageMap[variantId].push({
//           src: url,
//           imageId: upload.image.id,
//           alt: altText,
//           position: variantImageMap[variantId].length + 1,
//           created_at: new Date(),
//         });

//         console.log(
//           `🔗 Variant ${variantId} image linked`
//         );
//       }
//     }

//     /* =======================
//        7. FINAL MONGO SYNC
//     ======================= */

//     console.log('\n💾 Syncing to MongoDB...');

//     const finalImages = imageUrls.map((src, index) => {
//       const existing =
//         uploadedMediaImages.find((img) => img.src === src) ||
//         oldMediaImages.find((img) => img.src === src);

//       const imageObj = {
//         src,
//         alt: existing?.alt || `image-${index + 1}`,
//         position: index + 1,
//         created_at: existing?.created_at || new Date(),
//       };

//       console.log(`🖼 Mongo media image ${index + 1}`, imageObj);

//       return imageObj;
//     });

//     const finalVariantImages = Object.entries(variantImageMap).map(
//       ([variantId, images]) => {
//         console.log(
//           `🧩 Mongo variant ${variantId} images:`,
//           images.length
//         );
//         return {
//           variantId,
//           images,
//         };
//       }
//     );
//     console.log("🔎 Finding product with id:", productId);

// const checkProduct = await listingModel.findOne({ id: productId });
// console.log("🧠 Found Product:", checkProduct ? "YES" : "NO");

//     const updatedProduct = await listingModel.findOneAndUpdate(
//       { id: productId },
//       {
//         $set: {
//           images: finalImages,
//           variantImages: finalVariantImages,
//         },
//       },
//       { new: true }
//     );

//     console.log('\n📊 Mongo Updated Result:');
//     console.log(
//       '🟢 Saved media images:',
//       updatedProduct?.images?.length
//     );
//     console.log(
//       '🟣 Saved variant groups:',
//       updatedProduct?.variantImages?.length
//     );

//     console.log('\n✅ Shopify + Mongo fully synced');
//     console.log('🟦 ===== updateImages END =====\n');

//     return res.status(200).json({
//       message: 'Images synced successfully',
//       product: updatedProduct,
//     });
//   } catch (err) {
//     console.error('❌ updateImages ERROR:', err);
//     return res.status(500).json({
//       error: err.message,
//     });
//   }
// };

export const updateVariantImages = async (req, res) => {
  const { id } = req.params;
  const { variantImages } = req.body;

  try {
    const product = await listingModel.findOne({ id });
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration)
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    if (!variantImages || Object.keys(variantImages).length === 0) {
      return res
        .status(400)
        .json({ error: 'No variant images provided to update.' });
    }

    const imagesDataToPush = [];
    for (const [variantId, url] of Object.entries(variantImages)) {
      const imagePayload = {
        image: {
          src: url,
          alt: `Variant Image for ${variantId}`,
          variant_id: variantId,
        },
      };

      const imageUrl = `${shopifyStoreUrl}/admin/api/2024-01/variants/${variantId}/images.json`;

      const imageResponse = await shopifyRequest(
        imageUrl,
        'POST',
        imagePayload,
        shopifyApiKey,
        shopifyAccessToken
      );

      if (imageResponse && imageResponse.image) {
        imagesDataToPush.push({
          id: imageResponse.image.id,
          variant_id: variantId,
          position: imageResponse.image.position,
          created_at: imageResponse.image.created_at,
          updated_at: imageResponse.image.updated_at,
          alt: imageResponse.image.alt,
          width: imageResponse.image.width,
          height: imageResponse.image.height,
          src: imageResponse.image.src,
        });
      }
    }

    if (imagesDataToPush.length > 0) {
      res.status(200).json({
        message: 'Variant images successfully updated in Shopify.',
        shopifyResponse: imagesDataToPush,
      });
    } else {
      res
        .status(500)
        .json({ error: 'Failed to upload variant images to Shopify.' });
    }
  } catch (error) {
    console.error('Error updating variant images:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getSingleVariantData = async (req, res) => {
  try {
    const { productId, variantId } = req.params;

    const result = await listingModel.aggregate([
      {
        $match: {
          id: productId,
        },
      },
      {
        $unwind: '$variants',
      },
      {
        $match: {
          'variants.id': variantId,
        },
      },
      {
        $project: {
          'variants.id': 1,
          'variants.title': 1,
          'variants.option1': 1,
          'variants.option2': 1,
          'variants.option3': 1,
          'variants.price': 1,
          'variants.compare_at_price': 1,
          'variants.inventory_quantity': 1,
          'variants.sku': 1,
          'variants.barcode': 1,
          'variants.weight': 1,
          'variants.weight_unit': 1,
          options: {
            $map: {
              input: '$options',
              as: 'option',
              in: '$$option.name',
            },
          },
          images: 1,
          _id: 0,
        },
      },
    ]);

    if (!result.length) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    const responseData = {
      ...result[0].variants,
      options: result[0].options,
    };

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching variant data:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateSingleVariant = async (req, res) => {
  let shopifyStoreUrl, shopifyApiKey, shopifyAccessToken;

  try {
    console.log('\n==============================');
    console.log('🔵 UPDATE SINGLE VARIANT START');
    console.log('==============================');

    const { productId, variantId } = req.params;
    const variantBody = req.body.variant || {};

    console.log('📌 Product ID:', productId);
    console.log('📌 Variant ID:', variantId);
    console.log('📦 Incoming Body:', variantBody);

    const {
      price,
      inventory_quantity,
      sku,
      option1,
      option2,
      option3,
      weight,
      compare_at_price,
      barcode,
      inventory_policy,
    } = variantBody;

    /* ============================================
       STEP 1: LOAD SHOPIFY CONFIG
    ============================================ */

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res.status(404).json({ error: 'Shopify config missing' });
    }

    shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;
    shopifyApiKey = shopifyConfiguration.shopifyApiKey;
    shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;

    console.log('✅ Shopify Config Loaded');

    /* ============================================
       STEP 2: UPDATE VARIANT ON SHOPIFY
    ============================================ */

    const variantUpdateRes = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/variants/${variantId}.json`,
      'PUT',
      {
        variant: {
          id: variantId,
          price: price?.toString(),
          compare_at_price: compare_at_price?.toString(),
          sku,
          barcode,
          option1,
          option2,
          option3,
          weight,
          inventory_policy,
          inventory_management: 'shopify',
        },
      },
      shopifyApiKey,
      shopifyAccessToken
    );

    const updatedVariant = variantUpdateRes?.variant;

    if (!updatedVariant) {
      return res.status(400).json({ error: 'Shopify variant update failed' });
    }

    console.log('✅ Shopify Variant Updated');

    /* ============================================
       STEP 3: UPDATE INVENTORY ON SHOPIFY
    ============================================ */

    if (inventory_quantity !== undefined && updatedVariant.inventory_item_id) {
      console.log('📦 Updating Shopify Inventory...');

      // Get location
      const inventoryLevelsRes = await shopifyRequest(
        `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${updatedVariant.inventory_item_id}`,
        'GET',
        null,
        shopifyApiKey,
        shopifyAccessToken
      );

      const locationId = inventoryLevelsRes?.inventory_levels?.[0]?.location_id;

      if (!locationId) {
        console.log('❌ No location found for inventory');
      } else {
        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels/set.json`,
          'POST',
          {
            location_id: locationId,
            inventory_item_id: updatedVariant.inventory_item_id,
            available: parseInt(inventory_quantity) || 0,
          },
          shopifyApiKey,
          shopifyAccessToken
        );

        console.log('✅ Shopify Inventory Updated');
      }
    }

    /* ============================================
       STEP 4: UPDATE MONGODB FROM BODY
    ============================================ */

    console.log('🔄 Updating MongoDB...');

    const updateFields = {};

    if (price !== undefined)
      updateFields['variants.$.price'] = price.toString();

    if (compare_at_price !== undefined)
      updateFields['variants.$.compare_at_price'] = compare_at_price.toString();

    if (inventory_quantity !== undefined)
      updateFields['variants.$.inventory_quantity'] =
        parseInt(inventory_quantity) || 0;

    if (sku !== undefined) updateFields['variants.$.sku'] = sku;

    if (barcode !== undefined) updateFields['variants.$.barcode'] = barcode;

    if (option1 !== undefined) updateFields['variants.$.option1'] = option1;

    if (option2 !== undefined) updateFields['variants.$.option2'] = option2;

    if (option3 !== undefined) updateFields['variants.$.option3'] = option3;

    if (weight !== undefined) updateFields['variants.$.weight'] = weight;

    const dbUpdate = await listingModel.findOneAndUpdate(
      {
        shopifyId: productId,
        'variants.id': variantId,
      },
      { $set: updateFields },
      { new: true }
    );

    if (!dbUpdate) {
      return res.status(404).json({
        success: false,
        error: 'Variant not found in Mongo',
      });
    }

    console.log('✅ Mongo Updated Successfully');

    console.log('==============================');
    console.log('🟢 UPDATE SINGLE VARIANT END');
    console.log('==============================\n');

    return res.status(200).json({
      success: true,
      message: 'Variant updated successfully',
    });
  } catch (error) {
    console.error('🔴 ERROR:', error?.response?.data || error);

    return res.status(500).json({
      success: false,
      message: 'Error updating variant',
      error: error.message,
    });
  }
};

export const syncProductVariants = async (req, res) => {
  try {
    console.log('\n==============================');
    console.log('🔄 SYNC PRODUCT VARIANTS START');
    console.log('==============================');

    const { productId } = req.params;

    console.log('📌 Product ID:', productId);

    /* ============================================
       STEP 1: LOAD SHOPIFY CONFIG
    ============================================ */

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();

    if (!shopifyConfiguration) {
      return res.status(404).json({ error: 'Shopify config missing' });
    }

    const { shopifyStoreUrl, shopifyApiKey, shopifyAccessToken } =
      shopifyConfiguration;

    /* ============================================
       STEP 2: FETCH PRODUCT FROM SHOPIFY
    ============================================ */

    console.log('🚀 Fetching Product From Shopify...');

    const productRes = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
      'GET',
      null,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!productRes?.product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found on Shopify',
      });
    }

    const shopifyProduct = productRes.product;

    console.log('📦 Shopify Variants Count:', shopifyProduct.variants.length);

    /* ============================================
       STEP 3: FORMAT VARIANTS FOR MONGO
    ============================================ */

    const formattedVariants = shopifyProduct.variants.map((v) => ({
      id: v.id.toString(),
      title: v.title,
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
      price: v.price,
      compare_at_price: v.compare_at_price,
      inventory_management: v.inventory_management,
      inventory_quantity: v.inventory_quantity,
      sku: v.sku,
      barcode: v.barcode,
      inventory_item_id: v.inventory_item_id?.toString(),
      weight: v.weight,
      weight_unit: v.weight_unit,
      isParent: false,
      image_id: v.image_id,
      VariantStatus: 'inactive',
    }));

    /* ============================================
       STEP 4: REPLACE VARIANTS IN MONGODB
    ============================================ */

    console.log('🔄 Updating MongoDB Variants...');

    const updatedListing = await listingModel.findOneAndUpdate(
      { shopifyId: productId },
      { $set: { variants: formattedVariants } },
      { new: true }
    );

    if (!updatedListing) {
      return res.status(404).json({
        success: false,
        error: 'Product not found in MongoDB',
      });
    }

    console.log('✅ MongoDB Variants Synced Successfully');

    console.log('==============================');
    console.log('🟢 SYNC PRODUCT VARIANTS END');
    console.log('==============================\n');

    return res.status(200).json({
      success: true,
      message: 'Product variants synced successfully',
      variantCount: formattedVariants.length,
    });
  } catch (error) {
    console.error('🔴 ERROR:', error?.response?.data || error);

    return res.status(500).json({
      success: false,
      message: 'Error syncing product variants',
      error: error.message,
    });
  }
};

export const getsingleProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await listingModel.aggregate([
      {
        $match: {
          id: productId,
        },
      },
      {
        $project: {
          _id: 1,
          id: 1,
          title: 1,
          body_html: 1,
          vendor: 1,
          product_type: 1,
          created_at: 1,
          tags: 1,
          variants: 1,
          options: 1,
          images: 1,
          inventory: 1,
          shipping: 1,
          status: 1,
          variantImages: 1,
          userId: 1,
          oldPrice: 1,
          shopifyId: 1,
          username: {
            $concat: [
              { $ifNull: ['$user.firstName', ''] },
              ' ',
              { $ifNull: ['$user.lastName', ''] },
            ],
          },
          email: '$user.email',
        },
      },
    ]);

    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const fetchVariantsWithImages = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await listingModel.findOne({ id });
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const variants = product.variants || [];
    const variantImages = product.variantImages || [];

    const mappedVariants = variants.map((variant) => {
      const matchedImage = variantImages.find(
        (image) => image.id === variant.image_id
      );

      return {
        id: variant.id,
        title: variant.title,
        image: matchedImage
          ? {
              id: matchedImage.id,
              src: matchedImage.src,
              alt: matchedImage.alt,
            }
          : null,
      };
    });

    const variantsWithImages = mappedVariants.filter(
      (variant) => variant.image
    );

    res.status(200).json({
      message: 'Variants with images fetched successfully.',
      variants: variantsWithImages,
    });
  } catch (error) {
    console.error('Error fetching variant images:', error);
    res.status(500).json({ error: error.message });
  }
};

export const addImagesGallery = async (req, res) => {
  const { images: imageUrls } = req.body;
  const userId = req.userId;
  if (!Array.isArray(imageUrls)) {
    return res
      .status(400)
      .json({ error: 'userId and valid image array are required.' });
  }

  try {
    const imagesData = imageUrls.map((url, index) => ({
      src: url,
      position: index + 1,
      alt: `Image ${index + 1}`,
    }));

    let product = await imageGalleryModel.findOne({ userId });

    if (product) {
      const existingSrcs = product.images.map((img) => img.src);
      const newImages = imagesData.filter(
        (img) => !existingSrcs.includes(img.src)
      );

      const updatedImages = [...product.images, ...newImages];

      product = await imageGalleryModel.findOneAndUpdate(
        { userId },
        { images: updatedImages },
        { new: true }
      );

      return res.status(200).json({
        message: 'Images updated for user.',
        product,
      });
    } else {
      const newProduct = new imageGalleryModel({
        userId,
        images: imagesData,
      });

      await newProduct.save();

      return res.status(201).json({
        message: 'New image gallery created.',
        product: newProduct,
      });
    }
  } catch (error) {
    console.error('Error adding images:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getImageGallery = async (req, res) => {
  const { productId } = req.params;
  const userId = req.userId;

  try {
    const result = await imageGalleryModel.aggregate([
      {
        $match: {
          userId: userId,
        },
      },
      {
        $project: {
          id: '$_id',
          _id: 0,
          images: {
            $filter: {
              input: '$images',
              as: 'image',
              cond: {
                $or: [
                  ...(productId && productId !== 'null'
                    ? [
                        { $eq: ['$$image.productId', productId] },
                        { $not: ['$$image.productId'] },
                      ]
                    : [
                        {
                          $regexMatch: {
                            input: '$$image.src',
                            regex:
                              '^https://(res\\.cloudinary\\.com|cdn\\.shopify\\.com)',
                          },
                        },
                      ]),
                ],
              },
            },
          },
        },
      },
    ]);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching image gallery:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteImageGallery = async (req, res) => {
  try {
    const result = await imageGalleryModel.deleteMany();
    res.send('successfully deleted');
  } catch (error) {}
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getCategoryHierarchyFlexible = async (categoryValues = []) => {
  console.log('\n🔎 CATEGORY HIERARCHY LOOKUP START');
  console.log('📥 Incoming Category Values:', categoryValues);

  const allCatNos = new Set();
  const allCategoryTitles = new Set();

  for (const value of categoryValues) {
    let category = null;

    if (/^cat_/i.test(value)) {
      category = await categoryModel.findOne({ catNo: value });
    } else {
      category = await categoryModel.findOne({ title: value });
    }

    if (!category) continue;

    let current = category;
    let pathParts = [];

    while (current) {
      allCatNos.add(current.catNo);
      pathParts.unshift(current.title); // build full path

      if (!current.parentCatNo) break;

      current = await categoryModel.findOne({
        catNo: current.parentCatNo,
      });
    }

    // 🔥 Save full path version
    const fullPath = pathParts.join(' > ');
    allCategoryTitles.add(fullPath);

    // 🔥 Also ensure parent root alone saved
    if (pathParts.length > 1) {
      allCategoryTitles.add(pathParts[0]);
    }
  }

  const result = {
    catNos: Array.from(allCatNos),
    titles: Array.from(allCategoryTitles),
  };

  console.log('🎯 Final Category Result:', result);
  console.log('🔎 CATEGORY HIERARCHY LOOKUP END\n');

  return result;
};

// export const addCsvfileForProductFromBody = async (req, res) => {
//   const file = req.file;
//   const userId = req.userId;

//   console.log('\n================ CSV IMPORT START ================\n');

//   if (!file || !file.buffer)
//     return res.status(400).json({ error: 'No file uploaded.' });

//   try {
//     const config = await shopifyConfigurationModel.findOne();
//     if (!config) throw new Error('Shopify config missing');

//     const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = config;

//     const workbook = XLSX.read(file.buffer, { type: 'buffer' });
//     const rows = XLSX.utils.sheet_to_json(
//       workbook.Sheets[workbook.SheetNames[0]],
//       { defval: '' }
//     );

//     /* ================= GROUP BY HANDLE ================= */

//     const grouped = {};
//     rows.forEach((row) => {
//       const handle = row['Product URL']?.trim();
//       if (!handle) return;
//       if (!grouped[handle]) grouped[handle] = [];
//       grouped[handle].push(row);
//     });

//     const results = [];

//     for (const handle in grouped) {
//       console.log('\n================ PRODUCT START ================');

//       const productRows = grouped[handle];
//       const firstRow = productRows[0];
//       const generateHandle = (value) => {
//         return value
//           ?.toString()
//           .toLowerCase()
//           .trim()
//           .replace(/[^a-z0-9]+/g, '-') // spaces + special chars → -
//           .replace(/^-+|-+$/g, ''); // remove start/end hyphen
//       };

//       const cleanHandle = generateHandle(handle);
//       console.log('🔗 HANDLE:', handle);
//       console.log('🔗 CLEAN HANDLE:', cleanHandle);
//       console.log('📦 ROW COUNT FOR THIS PRODUCT:', productRows.length);
//       try {
//         console.log('🟢 Processing:', handle);

//         const trackQuantity =
//           String(firstRow['Track Quantity']).toUpperCase() === 'TRUE';

//         const shippingShortId = firstRow['Shipping Profile ID'] || null;
//         const isPhysical = !!shippingShortId;

//         /* ================= VARIANTS ================= */

//         /* ================= OPTIONS + VARIANTS (FIXED) ================= */

//         const optionNamesRaw = [
//           firstRow['Option1 Name'],
//           firstRow['Option2 Name'],
//           firstRow['Option3 Name'],
//         ].filter(Boolean);

//         const hasRealOptions = optionNamesRaw.length > 0;
//         console.log('\n🎛 OPTION NAMES RAW:', optionNamesRaw);
//         console.log('🎛 HAS REAL OPTIONS:', hasRealOptions);
//         let options = [];
//         let variants = [];

//         /* ================= NO OPTIONS CASE ================= */

//         if (!hasRealOptions) {
//           // ✅ Shopify requires only ONE default variant
//           options = [{ name: 'Title', values: ['Default Title'] }];

//           variants = [
//             {
//               sku: firstRow['SKU'] || null,
//               barcode: firstRow['Barcode'] || null,
//               price: firstRow['Price'] || '0.00',
//               compare_at_price: firstRow['Compare At Price'] || null,
//               inventory_management: trackQuantity ? 'shopify' : null,
//               inventory_quantity: trackQuantity
//                 ? parseInt(firstRow['Inventory Qty']) || 0
//                 : 0,
//               requires_shipping: isPhysical,
//               taxable: isPhysical,
//               weight: isPhysical ? parseFloat(firstRow['Weight']) || 0 : 0,
//               weight_unit: isPhysical ? firstRow['Weight Unit'] || 'kg' : null,
//               option1: 'Default Title',
//             },
//           ];
//         } else {

//         /* ================= OPTIONS EXIST CASE ================= */
//           // ✅ Build options dynamically
//           options = optionNamesRaw.map((name, index) => ({
//             name,
//             values: [
//               ...new Set(
//                 productRows
//                   .map((r) => r[`Option${index + 1} Value`]?.trim())
//                   .filter((v) => v && v !== '')
//               ),
//             ],
//           }));

//           const seenCombinations = new Set();

//           variants = productRows
//             .map((row) => {
//               const option1 = row['Option1 Value']?.trim();
//               const option2 = row['Option2 Value']?.trim() || null;
//               const option3 = row['Option3 Value']?.trim() || null;

//               // ❌ SKIP ROW IF REQUIRED OPTION IS MISSING
//               if (!option1) {
//                 console.log('⚠️ Skipping row due to missing option1:', row);
//                 return null;
//               }

//               const combinationKey = `${option1}-${option2}-${option3}`;

//               if (seenCombinations.has(combinationKey)) {
//                 console.log(
//                   '⚠️ Duplicate combination skipped:',
//                   combinationKey
//                 );
//                 return null;
//               }

//               seenCombinations.add(combinationKey);

//               return {
//                 sku: row['SKU'] || null,
//                 barcode: row['Barcode'] || null,
//                 price: row['Price'] || '0.00',
//                 compare_at_price: row['Compare At Price'] || null,
//                 inventory_management: trackQuantity ? 'shopify' : null,
//                 inventory_quantity: trackQuantity
//                   ? parseInt(row['Inventory Qty']) || 0
//                   : 0,
//                 requires_shipping: isPhysical,
//                 taxable: isPhysical,
//                 weight: isPhysical ? parseFloat(row['Weight']) || 0 : 0,
//                 weight_unit: isPhysical ? row['Weight Unit'] || 'kg' : null,
//                 option1,
//                 option2,
//                 option3,
//               };
//             })
//             .filter(Boolean);
//         }
//         console.log('\n================ VARIANT DEBUG ================');
//         console.log('🧪 FINAL OPTIONS:', JSON.stringify(options, null, 2));
//         console.log('🧪 FINAL VARIANTS:', JSON.stringify(variants, null, 2));
//         console.log('🧪 VARIANT COUNT:', variants.length);

//         if (!variants || variants.length === 0) {
//           console.log('❌ ERROR: VARIANTS ARRAY IS EMPTY BEFORE SHOPIFY CALL');
//         }
//         /* ================= OPTIONS ================= */
//         const metafieldsArray = [];

//         for (let i = 1; i <= 4; i++) {
//           const label = firstRow[`Custom Label ${i}`];
//           const value = firstRow[`Custom Value ${i}`];

//           if (label && value) {
//             metafieldsArray.push({
//               label: label.trim(),
//               value: value.trim(),
//               key: `custom_${i}`,
//             });
//           }
//         }

//         console.log('🧩 CSV Custom Fields:', metafieldsArray);
//         const optionNames = [
//           firstRow['Option1 Name'],
//           firstRow['Option2 Name'],
//           firstRow['Option3 Name'],
//         ].filter(Boolean);

//         /* ================= CATEGORIES ================= */

//         // const categoriesRaw = firstRow['Categories'];
//         // const categoryArray = categoriesRaw
//         //   ? categoriesRaw.split(',').map((c) => c.trim())
//         //   : [];

//         // const tagsArray = [
//         //   ...categoryArray,
//         //   `user_${userId}`,
//         //   `vendor_${firstRow['Vendor']}`,
//         // ];
//         /* ================= CATEGORIES ================= */

//         console.log('\n📂 PROCESSING CSV CATEGORIES');

//         const categoriesRaw = firstRow['Categories'];

//         const categoryNames = categoriesRaw
//           ? categoriesRaw.split(',').map((c) => c.trim())
//           : [];

//         console.log('📥 CSV Category Names:', categoryNames);

//         // 🔥 Get catNo hierarchy
//         const categoryResult =
//           await getCategoryHierarchyFlexible(categoryNames);

//         const categoryTagNos = categoryResult.catNos;
//         const categoryTitles = categoryResult.titles;
//         const tagsArray = [
//           ...categoryTagNos,
//           `user_${userId}`,
//           `vendor_${firstRow['Vendor']}`,
//         ];

//         console.log('🏷 Final Shopify Tags:', tagsArray);

//         console.log('\n💾 SAVING TO MONGO');
//         console.log('📦 Categories (Names):', categoryNames);
//         console.log('🏷 Tags (CatNos + user + vendor):', tagsArray);
//         /* ================= CREATE PRODUCT ================= */

//         const createRes = await shopifyRequest(
//           `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
//           'POST',
//           {
//             product: {
//               title: firstRow['Title'],
//               body_html: firstRow['Description'] || '',
//               vendor: firstRow['Vendor'] || '',
//               product_type: firstRow['Product Type'] || '',
//               status:
//                 String(firstRow['Status']).toLowerCase() === 'active'
//                   ? 'active'
//                   : 'draft',
//               handle: cleanHandle,
//               options,
//               variants,
//               tags: tagsArray,
//             },
//           },
//           shopifyApiKey,
//           shopifyAccessToken
//         );

//         const createdProduct = createRes.product;

//         console.log('✅ Shopify Product Created:', createdProduct.id);

//         for (const field of metafieldsArray) {
//           try {
//             await shopifyRequest(
//               `${shopifyStoreUrl}/admin/api/2024-01/products/${createdProduct.id}/metafields.json`,
//               'POST',
//               {
//                 metafield: {
//                   namespace: 'custom',
//                   key: field.key,
//                   value: `${field.label}_${field.value}`,
//                   type: 'single_line_text_field',
//                 },
//               },
//               shopifyApiKey,
//               shopifyAccessToken
//             );

//             console.log(`✅ Shopify Metafield Created: ${field.key}`);
//           } catch (err) {
//             console.log('❌ Metafield Error:', err.message);
//           }
//         }

//         if (trackQuantity && createdProduct?.variants?.length) {
//           for (let i = 0; i < createdProduct.variants.length; i++) {
//             const variant = createdProduct.variants[i];
//             const inventoryItemId = variant.inventory_item_id;

//             const inventoryLevelsRes = await shopifyRequest(
//               `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
//               'GET',
//               null,
//               shopifyApiKey,
//               shopifyAccessToken
//             );

//             const locationId =
//               inventoryLevelsRes?.inventory_levels?.[0]?.location_id;

//             if (locationId) {
//               await shopifyRequest(
//                 `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels/set.json`,
//                 'POST',
//                 {
//                   location_id: locationId,
//                   inventory_item_id: inventoryItemId,
//                   available: parseInt(productRows[i]['Inventory Qty']) || 0,
//                 },
//                 shopifyApiKey,
//                 shopifyAccessToken
//               );
//             }
//           }
//         }

//         /* ================= SHIPPING PROFILE ================= */

//         let shippingProfileData = null;

//         if (shippingShortId) {
//           const profile = await shippingProfileModel.findOne({
//             shortId: shippingShortId,
//           });

//           if (profile?.profileId) {
//             const variantGIDs = createdProduct.variants.map(
//               (v) => `gid://shopify/ProductVariant/${v.id}`
//             );

//             await shopifyRequest(
//               `${shopifyStoreUrl}/admin/api/2024-01/graphql.json`,
//               'POST',
//               {
//                 query: `
//                   mutation deliveryProfileUpdate($id: ID!, $profile: DeliveryProfileInput!) {
//                     deliveryProfileUpdate(id: $id, profile: $profile) {
//                       profile { id }
//                       userErrors { field message }
//                     }
//                   }
//                 `,
//                 variables: {
//                   id: profile.profileId,
//                   profile: { variantsToAssociate: variantGIDs },
//                 },
//               },
//               shopifyApiKey,
//               shopifyAccessToken
//             );

//             shippingProfileData = profile;
//             console.log('🚚 Shipping Profile Attached');
//           }
//         }

//         /* ================= IMAGE HANDLING (LIKE updateImages) ================= */

//         console.log('\n🖼 CSV IMAGE PROCESSING START');

//         const groupImages =
//           String(firstRow['Variant Grouped Images']).toUpperCase() === 'TRUE';

//         const productId = createdProduct.id;
//         /* ================= CLEAN IMAGE LOGIC ================= */

//         console.log('\n🖼 CSV IMAGE PROCESSING START');

//         const imageMap = {};

//         /* 1️⃣ Collect ALL images (media + variant together) */

//         productRows.forEach((row, index) => {
//           const variant = createdProduct.variants[index];

//           // Featured Image
//           if (row['Featured Image']) {
//             const url = row['Featured Image'].trim();

//             if (!imageMap[url]) {
//               imageMap[url] = { variantIds: [] };
//             }
//           }

//           // Variant Images
//           const variantImageUrls = [
//             row['Variant Image 1'],
//             row['Variant Image 2'],
//             row['Variant Image 3'],
//             row['Variant Image 4'],
//             row['Variant Image 5'],
//           ].filter(Boolean);

//           variantImageUrls.forEach((url) => {
//             const cleanUrl = url.trim();

//             if (!imageMap[cleanUrl]) {
//               imageMap[cleanUrl] = { variantIds: [] };
//             }

//             imageMap[cleanUrl].variantIds.push(variant.id);
//           });
//         });

//         console.log('🧩 Final Image Map:', imageMap);

//         /* 2️⃣ Delete Existing Shopify Images */

//         const existingShopify = await shopifyRequest(
//           `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
//           'GET',
//           null,
//           shopifyApiKey,
//           shopifyAccessToken
//         );

//         for (const img of existingShopify.product.images) {
//           await shopifyRequest(
//             `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/images/${img.id}.json`,
//             'DELETE',
//             null,
//             shopifyApiKey,
//             shopifyAccessToken
//           );
//         }

//         console.log('🧨 Old Shopify Images Deleted');

//         /* 3️⃣ Upload Each URL ONLY ONCE */

//         const variantImageMap = {};
//         const uploadedImages = [];

//         const GROUP_BY_OPTION_INDEX = 0; // color grouping

//         const getGroupedAlt = (variant) => {
//           const option = createdProduct.options[GROUP_BY_OPTION_INDEX];
//           if (!option) return 'variant-image';

//           const value = variant[`option${GROUP_BY_OPTION_INDEX + 1}`];

//           const index = option.values.findIndex(
//             (v) => v.toLowerCase() === value?.toLowerCase()
//           );

//           return index === -1
//             ? 'variant-image'
//             : `t4option${GROUP_BY_OPTION_INDEX}_${index}`;
//         };

//         for (const [url, data] of Object.entries(imageMap)) {
//           let altText = 'variant-image';

//           if (groupImages && data.variantIds.length) {
//             const firstVariant = createdProduct.variants.find(
//               (v) => v.id === data.variantIds[0]
//             );

//             altText = getGroupedAlt(firstVariant);
//           }

//           const upload = await shopifyRequest(
//             `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/images.json`,
//             'POST',
//             {
//               image: {
//                 src: url,
//                 alt: altText,
//                 variant_ids: data.variantIds,
//               },
//             },
//             shopifyApiKey,
//             shopifyAccessToken
//           );

//           uploadedImages.push(upload.image);

//           data.variantIds.forEach((variantId) => {
//             if (!variantImageMap[variantId]) {
//               variantImageMap[variantId] = [];
//             }

//             variantImageMap[variantId].push({
//               src: url,
//               imageId: upload.image.id,
//               alt: upload.image.alt,
//               position: variantImageMap[variantId].length + 1,
//               created_at: new Date(),
//             });
//           });
//         }
//         const featuredImageUrls = [
//           ...new Set(
//             productRows
//               .map((row) => row['Featured Image']?.trim())
//               .filter(Boolean)
//           ),
//         ];
//         console.log('🎯 Featured Only URLs:', featuredImageUrls);

//         // const featuredImageObject = uploadedImages.find(
//         //   (img) => img.src === featuredImageUrl
//         // );

//         console.log('✅ Shopify Images Synced Correctly');

//         /* ===== 1️⃣ Collect Media Images ===== */

//         /* ================= FETCH FULL PRODUCT ================= */

//         const fullProductRes = await shopifyRequest(
//           `${shopifyStoreUrl}/admin/api/2024-01/products/${createdProduct.id}.json`,
//           'GET',
//           null,
//           shopifyApiKey,
//           shopifyAccessToken
//         );

//         const fullProduct = fullProductRes.product;

//         /* ================= SAVE CLEAN STRUCTURE TO DB ================= */
//         const hasSku = productRows.some(
//           (row) => row['SKU'] && row['SKU'].trim() !== ''
//         );

//         const baseSku = hasSku ? productRows[0]['SKU'] : null;
//         const baseBarcode = hasSku ? productRows[0]['Barcode'] : null;
//         const dbProduct = {
//           id: fullProduct.id,
//           shopifyId: fullProduct.id,
//           title: fullProduct.title,
//           body_html: fullProduct.body_html,
//           vendor: fullProduct.vendor,
//           product_type: fullProduct.product_type,
//           created_at: fullProduct.created_at,
//           status: fullProduct.status,
//           metafields: metafieldsArray.map((m) => ({
//             label: m.label,
//             value: m.value,
//           })),

//           tags: fullProduct.tags
//             ? fullProduct.tags.split(',').map((t) => t.trim())
//             : [],

//           categories: categoryTitles,

//           options: fullProduct.options.map((opt) => ({
//             name: opt.name,
//             values: opt.values,
//           })),

//           variants: fullProduct.variants.map((v) => ({
//             id: v.id,
//             title: v.title,
//             option1: v.option1,
//             option2: v.option2,
//             option3: v.option3,
//             price: v.price,
//             compare_at_price: v.compare_at_price,
//             inventory_management: v.inventory_management,
//             inventory_quantity: v.inventory_quantity,
//             sku: v.sku,
//             barcode: v.barcode,
//             inventory_item_id: v.inventory_item_id,
//             weight: v.weight,
//             weight_unit: v.weight_unit,
//             image_id: v.image_id,
//             isParent: false,
//             VariantStatus: 'inactive',
//           })),
//           approvalStatus: 'approved',

//           // images: uploadedImages
//           //   .filter((img) => {
//           //     const fileName = img.src.split('/').pop().split('?')[0];

//           //     return featuredImageUrls.some(
//           //       (url) => url.split('/').pop().split('?')[0] === fileName
//           //     );
//           //   })
//           //   .map((img, index) => ({
//           //     id: img.id?.toString(),
//           //     product_id: fullProduct.id?.toString(),
//           //     position: index + 1,
//           //     created_at: new Date(),
//           //     updated_at: new Date(),
//           //     alt: img.alt || null,
//           //     width: img.width || null,
//           //     height: img.height || null,
//           //     src: img.src,
//           //   })),

//           images: fullProduct.images.map((img) => ({
//             id: img.id?.toString(),
//             product_id: fullProduct.id?.toString(),
//             position: img.position,
//             created_at: new Date(img.created_at),
//             updated_at: new Date(img.updated_at || new Date()),
//             alt: img.alt || null,
//             width: img.width || null,
//             height: img.height || null,
//             src: img.src, // ✅ Shopify CDN URL
//           })),
//           variantImages: Object.entries(variantImageMap).map(
//             ([variantId, images]) => ({
//               variantId,
//               images,
//             })
//           ),

//           inventory: {
//             track_quantity: trackQuantity,
//             quantity: trackQuantity
//               ? parseInt(productRows[0]['Inventory Qty']) || 0
//               : 0,
//             continue_selling: true,
//             has_sku: hasSku,
//             sku: baseSku,
//             barcode: baseBarcode,
//           },
//           shipping: {
//             track_shipping: isPhysical,
//             weight: isPhysical ? parseFloat(productRows[0]['Weight']) || 0 : 0,
//             weight_unit: productRows[0]['Weight Unit'] || 'kg',
//             freeShipping: false,
//             profile: shippingProfileData || null,
//           },
//           seo: {
//             title: fullProduct.title,
//             description: '',
//             handle: cleanHandle,
//           },
//           userId,
//           shopifyResponse: fullProductRes,
//         };

//         await listingModel.findOneAndUpdate(
//           { shopifyId: fullProduct.id },
//           {
//             ...dbProduct,
//             metafields: metafieldsArray.map((m) => ({
//               label: m.label,
//               value: m.value,
//             })),
//           },
//           { upsert: true, new: true }
//         );

//         console.log('💾 Product Saved Correctly');

//         results.push({ success: true, handle });
//       } catch (err) {
//         console.log('❌ Error:', err.message);
//         results.push({ success: false, handle, error: err.message });
//       }
//     }

//     console.log('\n================ CSV IMPORT DONE ================\n');

//     return res.status(200).json({ success: true, results });
//   } catch (err) {
//     console.log('🔥 SERVER ERROR:', err.message);
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };
const generateBatchId = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};
export const addCsvfileForProductFromBody = async (req, res) => {
  const file = req.file;
  const userId = req.userId;

  if (!file || !file.buffer) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    const batchNo = `BATCH-${generateBatchId()}`;
    const batch = await csvImportBatchSchema.create({
      batchNo,
      userId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      fileBuffer: file.buffer, // 🔥 full file saved
      status: 'pending',
    });

    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully. Processing will start shortly.',
      batchNo: batch.batchNo,
      status: batch.status,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

export const getAllBatches = async (req, res) => {
  try {
    const batches = await csvImportBatchSchema
      .find()
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getSingleBatch = async (req, res) => {
  try {
    const batch = await csvImportBatchSchema.findById(req.params.id).lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    res.status(200).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBatchesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('Received userId:', userId);
    // Validate first
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId',
      });
    }

    // Convert string to ObjectId
    const objectUserId = new mongoose.Types.ObjectId(userId);

    const batches = await csvImportBatchSchema
      .find({ userId: objectUserId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProductWebhook = async (req, res) => {
  try {
    const productData = req.body;

    const existingProduct = await listingModel.findOne({ id: productData.id });

    if (existingProduct) {
      existingProduct.title = productData.title;
      existingProduct.body_html = productData.body_html;
      existingProduct.vendor = productData.vendor;
      existingProduct.product_type = productData.product_type;
      existingProduct.handle = productData.handle;
      existingProduct.updated_at = productData.updated_at;
      existingProduct.published_at = productData.published_at;
      existingProduct.template_suffix = productData.template_suffix;
      existingProduct.tags = productData.tags
        ? productData.tags.split(',').map((tag) => tag.trim())
        : [];
      existingProduct.variants = productData.variants.map((variant) => ({
        id: variant.id,
        title: variant.title,
        option1: variant.option1,
        option2: variant.option2,
        option3: variant.option3,
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        inventory_management: variant.inventory_management,
        inventory_quantity: variant.inventory_quantity,
        sku: variant.sku,
        barcode: variant.barcode,
        weight: variant.weight,
        weight_unit: variant.weight_unit,
        isParent: false,
        image_id: variant.image_id,
        src: null,
      }));
      existingProduct.images = productData.images;
      existingProduct.variantImages = productData.images;
      existingProduct.options = productData.options.map((option) => ({
        name: option.name,
        values: option.values,
      }));

      await existingProduct.save();
    } else {
      const newProduct = new listingModel({
        id: productData.id,
        title: productData.title,
        body_html: productData.body_html,
        vendor: productData.vendor,
        product_type: productData.product_type,
        handle: productData.handle,
        created_at: productData.created_at,
        updated_at: productData.updated_at,
        published_at: productData.published_at,
        template_suffix: productData.template_suffix,
        tags: productData.tags
          ? productData.tags.split(',').map((tag) => tag.trim())
          : [],
        variants: productData.variants.map((variant) => ({
          id: variant.id,
          title: variant.title,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3,
          price: variant.price,
          compare_at_price: variant.compare_at_price,
          inventory_management: variant.inventory_management,
          inventory_quantity: variant.inventory_quantity,
          sku: variant.sku,
          barcode: variant.barcode,
          weight: variant.weight,
          weight_unit: variant.weight_unit,
          isParent: false,
          image_id: variant.image_id,
          src: null,
        })),
        images: productData.images,
        variantImages: productData.images,
        options: productData.options.map((option) => ({
          name: option.name,
          values: option.values,
        })),
      });

      await newProduct.save();
    }

    res.status(200).json({
      message: 'Product saved/updated successfully in database',
      productId: productData.id,
    });
  } catch (error) {
    console.error('Error saving/updating product:', error);
    res.status(500).send('Error saving/updating product');
  }
};

export const updateInventoryPrice = async (req, res) => {
  try {
    const variantId = req.params.id;
    const { price, compareAtPrice } = req.body;

    const product = await listingModel.findOneAndUpdate(
      { 'variants.id': variantId },
      {
        $set: {
          'variants.$.price': price,
          'variants.$.compare_at_price': compareAtPrice,
        },
      },
      { new: true }
    );

    if (!product) {
      return res
        .status(404)
        .json({ message: 'Product with this variant not found.' });
    }

    const variant = product.variants.find((v) => String(v.id) === variantId);
    if (!variant) {
      return res
        .status(404)
        .json({ message: 'Variant not found after update.' });
    }

    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfig;

    const updatedPayload = {
      variant: {
        id: variant.id,
        price,
        compare_at_price: compareAtPrice,
        sku: variant.sku,
      },
    };

    const shopifyUrl = `${shopifyStoreUrl}/admin/api/2023-10/variants/${variant.id}.json`;
    await shopifyRequest(
      shopifyUrl,
      'PUT',
      updatedPayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    return res.status(200).json({
      message: 'Variant price and compare_at_price updated successfully.',
    });
  } catch (error) {
    console.error('Error in updateInventoryPrice:', error);
    return res
      .status(500)
      .json({ message: 'Server error while updating price.' });
  }
};

export const updateInventoryQuantity = async (req, res) => {
  try {
    const variantId = req.params.id;
    const { quantity } = req.body;

    const product = await listingModel.findOne({ 'variants.id': variantId });
    if (!product) {
      return res
        .status(404)
        .json({ message: 'Product with this variant not found.' });
    }

    const variant = product.variants.find((v) => String(v.id) === variantId);
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found.' });
    }

    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfig;

    const variantDetailsUrl = `${shopifyStoreUrl}/admin/api/2023-10/variants/${variant.id}.json`;
    const variantResponse = await shopifyRequest(
      variantDetailsUrl,
      'GET',
      null,
      shopifyApiKey,
      shopifyAccessToken
    );

    const inventoryItemId = variantResponse?.variant?.inventory_item_id;
    if (!inventoryItemId) {
      return res
        .status(400)
        .json({ message: 'Missing inventory_item_id for variant.' });
    }

    const inventoryLevelsUrl = `${shopifyStoreUrl}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${inventoryItemId}`;
    const inventoryLevelsRes = await shopifyRequest(
      inventoryLevelsUrl,
      'GET',
      null,
      shopifyApiKey,
      shopifyAccessToken
    );

    const currentInventoryLevel = inventoryLevelsRes?.inventory_levels?.[0];
    if (!currentInventoryLevel) {
      return res
        .status(400)
        .json({ message: 'No inventory level found for this item.' });
    }

    const locationId = currentInventoryLevel.location_id;

    const inventorySetUrl = `${shopifyStoreUrl}/admin/api/2023-10/inventory_levels/set.json`;
    const inventoryPayload = {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: quantity,
    };

    const shopifyRes = await shopifyRequest(
      inventorySetUrl,
      'POST',
      inventoryPayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    const updatedProduct = await listingModel.findOneAndUpdate(
      { 'variants.id': variantId },
      {
        $set: {
          'variants.$.inventory_quantity': quantity,
          'variants.$.inventory_item_id': inventoryItemId,
          'variants.$.location_id': locationId,
        },
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res
        .status(404)
        .json({ message: 'Failed to update product inventory in DB.' });
    }

    res.status(200).json({
      message: 'Inventory quantity updated successfully.',
      shopifyResponse: shopifyRes,
    });
  } catch (error) {
    console.error(
      'Error in updateInventoryQuantity:',
      error?.response?.data || error.message
    );
    res.status(500).json({ message: 'Server error while updating quantity.' });
  }
};

export const exportProducts = async (req, res) => {
  try {
    const { userId, type, page = 1, limit = 10, productIds } = req.query;

    if (!userId || !type)
      return res.status(400).json({ message: 'Missing parameters' });

    let products = [];

    /* =========================
       FETCH PRODUCTS BASED ON TYPE
    ========================== */

    if (type === 'selected') {
      if (!productIds)
        return res.status(400).json({ message: 'No product IDs provided' });

      const idsArray = productIds.split(',');
      products = await listingModel.find({
        _id: { $in: idsArray },
        userId,
      });
    } else if (type === 'current') {
      const skip = (parseInt(page) - 1) * parseInt(limit);

      products = await listingModel
        .find({ userId })
        .skip(skip)
        .limit(parseInt(limit));
    } else if (type === 'all') {
      products = await listingModel.find({ userId });
    } else {
      return res.status(400).json({ message: 'Invalid export type' });
    }

    if (!products.length)
      return res.status(404).json({ message: 'No products found' });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Products Export');

    /* ============================
       HEADERS
    ============================ */

    sheet.columns = [
      { header: 'Product URL', key: 'product_url', width: 40 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Description', key: 'body_html', width: 40 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Product Type', key: 'type', width: 20 },
      { header: 'Categories', key: 'categories', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      // { header: 'Approval Status', key: 'approval', width: 20 },
      { header: 'SEO Title', key: 'seo_title', width: 30 },
      { header: 'SEO Description', key: 'seo_desc', width: 40 },
      { header: 'Track Quantity', key: 'track_qty', width: 15 },
      { header: 'Shipping Profile ID', key: 'shipping_profile', width: 25 },
      // { header: 'Size Chart', key: 'size_chart', width: 40 },
      // { header: 'Size Chart ID', key: 'size_chart_id', width: 25 },

      { header: 'Option1 Name', key: 'opt1_name', width: 20 },
      { header: 'Option1 Value', key: 'opt1_val', width: 20 },
      { header: 'Option2 Name', key: 'opt2_name', width: 20 },
      { header: 'Option2 Value', key: 'opt2_val', width: 20 },
      { header: 'Option3 Name', key: 'opt3_name', width: 20 },
      { header: 'Option3 Value', key: 'opt3_val', width: 20 },

      { header: 'SKU', key: 'sku', width: 20 },
      { header: 'Price', key: 'price', width: 15 },
      { header: 'Compare At Price', key: 'compare_price', width: 15 },
      { header: 'Inventory Qty', key: 'inv_qty', width: 15 },
      { header: 'Barcode', key: 'barcode', width: 20 },
      { header: 'Weight', key: 'weight', width: 15 },
      { header: 'Weight Unit', key: 'weight_unit', width: 15 },

      { header: 'Featured Image', key: 'featured_image', width: 40 },

      { header: 'Variant Image 1', key: 'vimg1', width: 40 },
      { header: 'Variant Image 2', key: 'vimg2', width: 40 },
      { header: 'Variant Image 3', key: 'vimg3', width: 40 },
      { header: 'Variant Image 4', key: 'vimg4', width: 40 },
      { header: 'Variant Image 5', key: 'vimg5', width: 40 },

      { header: 'Variant Grouped Images', key: 'grouped', width: 20 },

      { header: 'Custom Label 1', key: 'c_lbl1', width: 20 },
      { header: 'Custom Value 1', key: 'c_val1', width: 20 },
      { header: 'Custom Label 2', key: 'c_lbl2', width: 20 },
      { header: 'Custom Value 2', key: 'c_val2', width: 20 },
      { header: 'Custom Label 3', key: 'c_lbl3', width: 20 },
      { header: 'Custom Value 3', key: 'c_val3', width: 20 },
      { header: 'Custom Label 4', key: 'c_lbl4', width: 20 },
      { header: 'Custom Value 4', key: 'c_val4', width: 20 },
    ];

    /* ============================
       PROCESS PRODUCTS
    ============================ */

    for (const p of products) {
      const baseHandle =
        p.seo && p.seo.handle && p.seo.handle.trim() !== ''
          ? p.seo.handle
          : p.title || '';
      console.log('========================');
      console.log('PRODUCT:', p.title);
      console.log('IMAGES COUNT:', p.images?.length);
      console.log('IMAGES ARRAY:', p.images);
      console.log('========================');
      const slug = baseHandle
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      const productImages = Array.isArray(p.images)
        ? p.images.map((img) => img.src)
        : [];
      console.log('productImages:', productImages);
      //       (p.variants || []).forEach((variant, index) => {
      //         const variantImageEntry = p.variantImages?.find(
      //           (vi) => String(vi.variantId) === String(variant.id)
      //         );

      //         const vImages = variantImageEntry?.images || [];

      //         const isGrouped = vImages.some((img) =>
      //           img.alt?.toLowerCase().startsWith('t4option')
      //         );

      //         sheet.addRow({
      //           product_url: slug,

      //           title: p.title || '',
      //           body_html: p.body_html || '',
      //           vendor: p.vendor || '',
      //           type: p.product_type || '',
      //           // categories: p.categories?.join(', ') || '',
      //           categories: (() => {
      //             let tagArray = [];

      //             if (Array.isArray(p.tags)) {
      //               // flatten if single string inside array
      //               tagArray = p.tags.flatMap((tag) =>
      //                 typeof tag === 'string'
      //                   ? tag.split(',').map((t) => t.trim())
      //                   : []
      //               );
      //             } else if (typeof p.tags === 'string') {
      //               tagArray = p.tags.split(',').map((t) => t.trim());
      //             }

      //             return tagArray.filter((tag) => /^cat_/i.test(tag)).join(', ');
      //           })(),

      //           status: p.status || '',
      //           // approval: p.approvalStatus || '',

      //           seo_title: p.seo?.title || '',
      //           seo_desc: p.seo?.description || '',

      //           track_qty: p.inventory?.track_quantity ? 'TRUE' : 'FALSE',

      //           shipping_profile: p.shipping?.freeShipping
      //             ? 'FREE'
      //             : p.shipping?.profile?.shortId || '',

      //           // size_chart: p.custom?.size_chart || '',
      //           // size_chart_id: p.custom?.size_chart_id || '',

      //           opt1_name: p.options?.[0]?.name || '',
      //           opt1_val: variant.option1 || '',
      //           opt2_name: p.options?.[1]?.name || '',
      //           opt2_val: variant.option2 || '',
      //           opt3_name: p.options?.[2]?.name || '',
      //           opt3_val: variant.option3 || '',

      //           sku: variant.sku || '',
      //           price: variant.price || '',
      //           compare_price: variant.compare_at_price || '',
      //           inv_qty: variant.inventory_quantity || 0,
      //           barcode: variant.barcode || '',
      //           weight: variant.weight || 0,
      //           weight_unit: variant.weight_unit || '',

      //           // ✅ Featured Image only first row
      // featured_image:
      //   index === 0 && productImages.length > 0
      //     ? productImages[0]
      //     : '',
      //           vimg1: vImages[0]?.src || '',
      //           vimg2: vImages[1]?.src || '',
      //           vimg3: vImages[2]?.src || '',
      //           vimg4: vImages[3]?.src || '',
      //           vimg5: vImages[4]?.src || '',

      //           grouped: isGrouped ? 'TRUE' : 'FALSE',

      //           c_lbl1: p.metafields?.[0]?.label || '',
      //           c_val1: p.metafields?.[0]?.value || '',
      //           c_lbl2: p.metafields?.[1]?.label || '',
      //           c_val2: p.metafields?.[1]?.value || '',
      //           c_lbl3: p.metafields?.[2]?.label || '',
      //           c_val3: p.metafields?.[2]?.value || '',
      //           c_lbl4: p.metafields?.[3]?.label || '',
      //           c_val4: p.metafields?.[3]?.value || '',
      //         });
      //       });
      const variants = p.variants || [];
      const totalRows = Math.max(productImages.length, variants.length, 1);

      for (let i = 0; i < totalRows; i++) {
        const variant = variants[i] || {};
        const image = productImages[i] || '';

        const variantImageEntry = p.variantImages?.find(
          (vi) => String(vi.variantId) === String(variant.id)
        );

        const vImages = variantImageEntry?.images || [];

        const isGrouped = vImages.some((img) =>
          img.alt?.toLowerCase().startsWith('t4option')
        );

        sheet.addRow({
          product_url: slug,
          title: p.title || '',
          body_html: p.body_html || '',
          vendor: p.vendor || '',
          type: p.product_type || '',
          categories: (() => {
            let tagArray = [];

            if (Array.isArray(p.tags)) {
              tagArray = p.tags.flatMap((tag) =>
                typeof tag === 'string'
                  ? tag.split(',').map((t) => t.trim())
                  : []
              );
            } else if (typeof p.tags === 'string') {
              tagArray = p.tags.split(',').map((t) => t.trim());
            }

            return tagArray.filter((tag) => /^cat_/i.test(tag)).join(', ');
          })(),

          status: p.status || '',
          seo_title: p.seo?.title || '',
          seo_desc: p.seo?.description || '',
          track_qty: p.inventory?.track_quantity ? 'TRUE' : 'FALSE',
          shipping_profile: p.shipping?.freeShipping
            ? 'FREE'
            : p.shipping?.profile?.shortId || '',

          opt1_name: p.options?.[0]?.name || '',
          opt1_val: variant.option1 || '',
          opt2_name: p.options?.[1]?.name || '',
          opt2_val: variant.option2 || '',
          opt3_name: p.options?.[2]?.name || '',
          opt3_val: variant.option3 || '',

          sku: variant.sku || '',
          price: variant.price || '',
          compare_price: variant.compare_at_price || '',
          inv_qty: variant.inventory_quantity || 0,
          barcode: variant.barcode || '',
          weight: variant.weight || 0,
          weight_unit: variant.weight_unit || '',

          // ✅ Shopify style → 1 image per row
          featured_image: image,

          vimg1: vImages[0]?.src || '',
          vimg2: vImages[1]?.src || '',
          vimg3: vImages[2]?.src || '',
          vimg4: vImages[3]?.src || '',
          vimg5: vImages[4]?.src || '',

          grouped: isGrouped ? 'TRUE' : 'FALSE',

          c_lbl1: p.metafields?.[0]?.label || '',
          c_val1: p.metafields?.[0]?.value || '',
          c_lbl2: p.metafields?.[1]?.label || '',
          c_val2: p.metafields?.[1]?.value || '',
          c_lbl3: p.metafields?.[2]?.label || '',
          c_val3: p.metafields?.[2]?.value || '',
          c_lbl4: p.metafields?.[3]?.label || '',
          c_val4: p.metafields?.[3]?.value || '',
        });
      }
    }

    const fileName = `products-export-${Date.now()}.xlsx`;
    const tempDir = process.platform === 'win32' ? 'C:\\tmp' : '/tmp';

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    res.download(filePath, fileName, () => {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    });
  } catch (error) {
    console.error('EXPORT ERROR:', error);
    return res.status(500).json({
      message: 'Excel export failed',
      error: error.message,
    });
  }
};

export const updateInventoryFromCsv = async (req, res) => {
  const file = req.file;
  const userId = req.body.userId;

  if (!file || !file.buffer) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid or missing userId.' });
  }

  try {
    const config = await shopifyConfigurationModel.findOne();
    if (!config) {
      return res.status(404).json({ error: 'Shopify config not found.' });
    }

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = config;

    const allRows = [];
    const stream = Readable.from(file.buffer);

    stream
      .pipe(csv())
      .on('data', (row) => {
        allRows.push(row);
      })
      .on('end', async () => {
        const updateResults = [];

        for (const row of allRows) {
          const sku = row['Variant SKU']?.trim();
          const quantity = row['Variant Inventory Qty']?.trim();
          const status = row['Status']?.trim()?.toLowerCase();
          const price = row['Variant Price']?.trim();
          const compareAtPrice = row['Variant Compare At Price']?.trim();

          if (!sku) continue;

          const products = await listingModel.find({
            userId,
            'variants.sku': sku,
          });

          if (!products.length) {
            updateResults.push({ sku, status: 'product_not_found' });
            continue;
          }

          for (const product of products) {
            let variantUpdated = false;
            let statusUpdated = false;

            for (let variant of product.variants) {
              if (variant.sku !== sku) continue;

              try {
                // ✅ Inventory Update
                if (quantity) {
                  const variantDetailsUrl = `${shopifyStoreUrl}/admin/api/2023-10/variants/${variant.id}.json`;
                  const variantResponse = await shopifyRequest(
                    variantDetailsUrl,
                    'GET',
                    null,
                    shopifyApiKey,
                    shopifyAccessToken
                  );

                  const inventoryItemId =
                    variantResponse?.variant?.inventory_item_id;

                  if (!inventoryItemId) {
                    updateResults.push({
                      sku,
                      status: 'missing_inventory_item_id',
                    });
                    continue;
                  }

                  const inventoryLevelsUrl = `${shopifyStoreUrl}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${inventoryItemId}`;
                  const inventoryLevelsRes = await shopifyRequest(
                    inventoryLevelsUrl,
                    'GET',
                    null,
                    shopifyApiKey,
                    shopifyAccessToken
                  );

                  const currentInventoryLevel =
                    inventoryLevelsRes?.inventory_levels?.[0];

                  if (!currentInventoryLevel) {
                    updateResults.push({
                      sku,
                      status: 'no_inventory_level_found',
                    });
                    continue;
                  }

                  const locationId = currentInventoryLevel.location_id;

                  const inventoryPayload = {
                    location_id: locationId,
                    inventory_item_id: inventoryItemId,
                    available: parseInt(quantity),
                  };

                  await shopifyRequest(
                    `${shopifyStoreUrl}/admin/api/2023-10/inventory_levels/set.json`,
                    'POST',
                    inventoryPayload,
                    shopifyApiKey,
                    shopifyAccessToken
                  );

                  variant.inventory_quantity = parseInt(quantity);
                  variant.inventory_item_id = inventoryItemId;
                  variant.location_id = locationId;

                  updateResults.push({
                    sku,
                    variantId: variant.id,
                    status: 'quantity_updated',
                    updatedAt: new Date(),
                  });

                  variantUpdated = true;
                }

                // ✅ Price & Compare at Price Update
                if (price || compareAtPrice) {
                  const variantUpdatePayload = {
                    variant: {
                      id: variant.id,
                      ...(price && { price: parseFloat(price) }),
                      ...(compareAtPrice && {
                        compare_at_price: parseFloat(compareAtPrice),
                      }),
                    },
                  };

                  const variantUpdateUrl = `${shopifyStoreUrl}/admin/api/2023-10/variants/${variant.id}.json`;

                  await shopifyRequest(
                    variantUpdateUrl,
                    'PUT',
                    variantUpdatePayload,
                    shopifyApiKey,
                    shopifyAccessToken
                  );

                  if (price) variant.price = parseFloat(price);
                  if (compareAtPrice)
                    variant.compare_at_price = parseFloat(compareAtPrice);

                  updateResults.push({
                    sku,
                    variantId: variant.id,
                    status: 'price_updated',
                    newPrice: price,
                    newCompareAtPrice: compareAtPrice,
                    updatedAt: new Date(),
                  });

                  variantUpdated = true;
                }
              } catch (err) {
                console.error(
                  `Inventory or price update failed for SKU: ${sku}`,
                  err.message
                );
                updateResults.push({
                  sku,
                  variantId: variant.id,
                  status: 'update_failed',
                  message: err.message,
                });
              }
            }

            // ✅ Status Update
            if (status && ['active', 'draft', 'archived'].includes(status)) {
              try {
                const productUpdateUrl = `${shopifyStoreUrl}/admin/api/2023-10/products/${product.id}.json`;
                const updatePayload = {
                  product: {
                    id: product.id,
                    status: status,
                  },
                };

                await shopifyRequest(
                  productUpdateUrl,
                  'PUT',
                  updatePayload,
                  shopifyApiKey,
                  shopifyAccessToken
                );

                product.status = status;

                updateResults.push({
                  sku,
                  productId: product.id,
                  status: 'status_updated',
                  newStatus: status,
                  updatedAt: new Date(),
                });

                statusUpdated = true;
              } catch (err) {
                console.error(
                  `Status update failed for SKU: ${sku}`,
                  err.message
                );
                updateResults.push({
                  sku,
                  productId: product.id,
                  status: 'status_update_failed',
                  message: err.message,
                });
              }
            }

            // ✅ Safe save with version conflict handling
            if (variantUpdated || statusUpdated) {
              try {
                await product.save({ optimisticConcurrency: false });
              } catch (saveError) {
                console.error(
                  `Failed to save product with SKU: ${sku}`,
                  saveError.message
                );
                updateResults.push({
                  sku,
                  productId: product.id,
                  status: 'local_save_failed',
                  message: saveError.message,
                });
              }
            }
          }
        }

        return res.status(200).json({
          message: 'CSV processing completed.',
          results: updateResults,
        });
      });
  } catch (error) {
    console.error('Server error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unexpected error during CSV update.',
      error: error?.message || 'Unknown error',
    });
  }
};

export const exportInventoryCsv = async (req, res) => {
  try {
    const { userId, variantIds } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'Missing userId parameter.' });
    }

    const variantIdsArray = variantIds ? variantIds.split(',') : [];

    const products = await listingModel.find({ userId });

    if (!products.length) {
      return res.status(404).json({ message: 'No products found.' });
    }

    const rows = [];
    let productCounter = 101; // numbering starts from 101

    for (const product of products) {
      const status = product.status || 'unknown';

      // Map image_id → src
      const imageMap = {};
      (product.images || []).forEach((img) => {
        imageMap[String(img.id)] = img.src;
      });

      (product.variants || []).forEach((variant) => {
        if (
          variantIdsArray.length > 0 &&
          !variantIdsArray.includes(String(variant.id))
        ) {
          return;
        }

        rows.push({
          'Product No': productCounter,
          'Product Title': product.title || '',
          'Variant Title': variant.title || '',
          'Variant SKU': variant.sku || '',
          'Variant Option1': variant.option1 || '',
          'Variant Option2': variant.option2 || '',
          'Variant Option3': variant.option3 || '',
          'Variant Price': variant.price || '',
          'Variant Compare At Price': variant.compare_at_price || '',
          'Variant Inventory Qty': variant.inventory_quantity || 0,
          'Variant Image':
            variant.image_id && imageMap[variant.image_id]
              ? imageMap[variant.image_id]
              : '',
          Status: status,
        });
      });

      productCounter++;
    }

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'No variant data found in database.' });
    }

    const fields = [
      'Product No',
      'Product Title',
      'Variant Title',
      'Variant SKU',
      'Variant Option1',
      'Variant Option2',
      'Variant Option3',
      'Variant Price',
      'Variant Compare At Price',
      'Variant Inventory Qty',
      'Variant Image',
      'Status',
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    const filename = `db-variant-inventory-${Date.now()}.csv`;

    const isVercel = process.env.VERCEL === '1';
    const exportDir = isVercel ? '/tmp' : path.join(process.cwd(), 'exports');

    if (!isVercel && !fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, filename);
    fs.writeFileSync(filePath, csv);

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).send('Error downloading file');
      }
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error('Export Error:', error);
    res
      .status(500)
      .json({ message: 'Server error during export.', error: error.message });
  }
};

export const getAllVariants = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const objectIdUserId = new mongoose.Types.ObjectId(userId);

    let products = await listingModel.aggregate([
      {
        $match: { userId: objectIdUserId },
      },
      {
        $sort: { created_at: -1 },
      },
      {
        $project: {
          title: 1,
          created_at: 1,
          variants: 1,
          images: 1,
          status: 1,
          shopifyId: 1,
          variantImages: 1,
          productId: '$_id',
        },
      },
      {
        $unwind: '$variants',
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$variants',
              {
                productId: '$productId',
                productTitle: '$title',
                productCreatedAt: '$created_at',
                status: '$status',
                shopifyId: '$shopifyId',
                productImages: '$images',
                variantImages: '$variantImages',
              },
            ],
          },
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);

    const productCount = await listingModel.aggregate([
      { $match: { userId: objectIdUserId } },
      { $project: { variantsCount: { $size: '$variants' } } },
      {
        $group: { _id: null, totalVariants: { $sum: '$variantsCount' } },
      },
    ]);

    const totalVariants = productCount[0]?.totalVariants || 0;

    if (products.length === 0) {
      return res
        .status(404)
        .json({ message: 'No variants found for this user.' });
    }

    const normalizeString = (str) =>
      String(str || '')
        .replace(/['"]/g, '')
        .trim()
        .toLowerCase();

    products = products.map((variant) => {
      let variantImagesData = [];

      if (variant.variantImages?.length > 0) {
        const matchedVariant = variant.variantImages.find(
          (vImg) => String(vImg.variantId) === String(variant.id)
        );

        if (matchedVariant?.images?.length > 0) {
          variantImagesData = matchedVariant.images;
        }
      }

      return {
        ...variant,
        images: variantImagesData, // har variant ke sath uski images
      };
    });

    res.status(200).json({
      variants: products,
      currentPage: page,
      totalPages: Math.ceil(totalVariants / limit),
      totalVariants,
    });
  } catch (error) {
    console.error('Error in getAllVariants function:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAllVariantsForAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let products = await listingModel.aggregate([
      { $sort: { created_at: -1 } },
      {
        $project: {
          title: 1,
          created_at: 1,
          variants: 1,
          images: 1,
          status: 1,
          shopifyId: 1,
          variantImages: 1,
          userId: 1,
          productId: '$_id',
        },
      },
      { $unwind: '$variants' },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$variants',
              {
                productId: '$productId',
                productTitle: '$title',
                productCreatedAt: '$created_at',
                status: '$status',
                shopifyId: '$shopifyId',
                productImages: '$images',
                variantImages: '$variantImages',
                userId: '$userId',
              },
            ],
          },
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);

    const productCount = await listingModel.aggregate([
      { $project: { variantsCount: { $size: '$variants' } } },
      { $group: { _id: null, totalVariants: { $sum: '$variantsCount' } } },
    ]);

    const totalVariants = productCount[0]?.totalVariants || 0;

    if (products.length === 0) {
      return res.status(404).json({ message: 'No variants found.' });
    }

    products = products.map((variant) => {
      let variantImagesData = [];

      if (variant.variantImages?.length > 0) {
        const matchedVariant = variant.variantImages.find(
          (vImg) => String(vImg.variantId) === String(variant.id)
        );

        if (matchedVariant?.images?.length > 0) {
          variantImagesData = matchedVariant.images;
        }
      }

      return {
        ...variant,
        images: variantImagesData, // har variant ke sath uski images
      };
    });

    res.status(200).json({
      variants: products,
      currentPage: page,
      totalPages: Math.ceil(totalVariants / limit),
      totalVariants,
    });
  } catch (error) {
    console.error('Error in getAllVariantsForAdmin function:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteAll = async (req, res) => {
  await listingModel.deleteMany();
  res.status(200).send('deleted');
};

export const getProductForCahrts = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const objectId = new mongoose.Types.ObjectId(userId);
    console.log('📥 Fetching data for userId:', objectId);

    const productCounts = await listingModel.aggregate([
      {
        $match: {
          userId: objectId,
        },
      },
      {
        $facet: {
          totalProducts: [{ $count: 'count' }],
          activeProducts: [
            { $match: { status: 'active' } },
            { $count: 'count' },
          ],
          inactiveProducts: [
            { $match: { status: 'inactive' } },
            { $count: 'count' },
          ],
          missingImages: [
            {
              $match: {
                $or: [{ images: { $exists: false } }, { images: { $size: 0 } }],
              },
            },
            { $count: 'count' },
          ],
        },
      },
      {
        $project: {
          totalCount: {
            $ifNull: [{ $arrayElemAt: ['$totalProducts.count', 0] }, 0],
          },
          activeCount: {
            $ifNull: [{ $arrayElemAt: ['$activeProducts.count', 0] }, 0],
          },
          inactiveCount: {
            $ifNull: [{ $arrayElemAt: ['$inactiveProducts.count', 0] }, 0],
          },
          missingImagesCount: {
            $ifNull: [{ $arrayElemAt: ['$missingImages.count', 0] }, 0],
          },
        },
      },
    ]);

    console.log('📊 Product counts:', productCounts);

    const stats = productCounts[0] || {
      totalCount: 0,
      activeCount: 0,
      inactiveCount: 0,
      missingImagesCount: 0,
    };

    const result = [
      { status: 'Total', count: stats.totalCount },
      { status: 'Active', count: stats.activeCount },
      { status: 'Inactive', count: stats.inactiveCount },
      { status: 'Missing Images', count: stats.missingImagesCount },
    ];

    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching product data:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteAllProducts = async (req, res) => {
  try {
    const result = await listingModel.deleteMany();
    if (result) {
      res.status(200).send('deleted');
    }
  } catch (error) {}
};

export const trackProductView = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await listingModel.findOne({ shopifyId: productId });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const userId = product.userId;
    if (!userId) {
      return res
        .status(400)
        .json({ message: 'User ID not found for this product' });
    }

    const now = new Date();

    const existing = await viewModel.findOne({ userId });

    if (!existing) {
      await viewModel.create({
        userId,
        totalViews: 1,
        weeklyViews: 1,
        monthlyViews: 1,
        lastWeeklyReset: now,
        lastMonthlyReset: now,
      });
    } else {
      const lastWeek = new Date(existing.lastWeeklyReset);
      const isNewWeek = now - lastWeek > 1000 * 60 * 60 * 24 * 7;

      const lastMonth = new Date(existing.lastMonthlyReset);
      const isNewMonth = now - lastMonth > 1000 * 60 * 60 * 24 * 30;

      const update = {
        $inc: {
          totalViews: 1,
          weeklyViews: isNewWeek ? 0 : 1,
          monthlyViews: isNewMonth ? 0 : 1,
        },
      };

      if (isNewWeek) {
        update.$set = { ...update.$set, weeklyViews: 1, lastWeeklyReset: now };
      }

      if (isNewMonth) {
        update.$set = {
          ...update.$set,
          monthlyViews: 1,
          lastMonthlyReset: now,
        };
      }

      await viewModel.findOneAndUpdate({ userId }, update);
    }

    res.status(200).json({ message: `View counted for user ${userId}` });
  } catch (error) {
    console.error('Error in tracking product view:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getTrackingCountForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const userViewData = await viewModel.findOne({ userId });

    if (!userViewData) {
      return res.status(404).json({ message: 'User view data not found' });
    }

    res.status(200).json({
      userId,
      totalViews: userViewData.totalViews,
      weeklyViews: userViewData.weeklyViews,
      monthlyViews: userViewData.monthlyViews,
    });
  } catch (error) {
    console.error('Error fetching user view count:', error);
    res.status(500).json({ message: 'Failed to get user view count' });
  }
};

// export const addCsvfileForBulkUploader = async (req, res) => {
//   const file = req.file;
//   const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = req.body;

//   if (!file || !file.buffer) {
//     return res.status(400).json({ error: 'No file uploaded.' });
//   }

//   if (!shopifyApiKey || !shopifyAccessToken || !shopifyStoreUrl) {
//     return res.status(400).json({ error: 'Missing Shopify credentials.' });
//   }

//   try {
//     const allRows = [];
//     const stream = Readable.from(file.buffer);
//     const cleanUrl = (url) => url?.split('?')[0];

//     stream
//       .pipe(csv())
//       .on('data', (row) => allRows.push(row))
//       .on('end', async () => {
//         const groupedProducts = {};
//         allRows.forEach((row) => {
//           const handle = row['Handle']?.trim();
//           if (handle) {
//             if (!groupedProducts[handle]) groupedProducts[handle] = [];
//             groupedProducts[handle].push(row);
//           }
//         });

//         const results = [];

//         for (const handle in groupedProducts) {
//           const rows = groupedProducts[handle];
//           const mainRow = rows[0];

//           const options = ['Option1 Name', 'Option2 Name', 'Option3 Name']
//             .map((opt) => mainRow[opt])
//             .filter(Boolean);
//           const optionValues = [[], [], []];

//           const variants = rows.map((row) => {
//             if (row['Option1 Value'])
//               optionValues[0].push(row['Option1 Value']);
//             if (row['Option2 Value'])
//               optionValues[1].push(row['Option2 Value']);
//             if (row['Option3 Value'])
//               optionValues[2].push(row['Option3 Value']);

//             return {
//               sku: row['Variant SKU'] || '',
//               price: row['Variant Price'] || '0.00',
//               compare_at_price: row['Variant Compare At Price'] || null,
//               inventory_management:
//                 row['Variant Inventory Tracker'] === 'shopify'
//                   ? 'shopify'
//                   : null,
//               inventory_quantity: parseInt(row['Variant Inventory Qty']) || 0,
//               fulfillment_service: 'manual',
//               requires_shipping: row['Variant Requires Shipping'] === 'TRUE',
//               taxable: row['Variant Taxable'] === 'TRUE',
//               barcode: row['Variant Barcode'] || '',
//               weight: parseFloat(row['Variant Grams']) || 0,
//               weight_unit: ['g', 'kg', 'oz', 'lb'].includes(
//                 row['Variant Weight Unit']
//               )
//                 ? row['Variant Weight Unit']
//                 : 'g',
//               option1: row['Option1 Value'] || null,
//               option2: row['Option2 Value'] || null,
//               option3: row['Option3 Value'] || null,
//               variant_image: cleanUrl(row['Variant Image']) || null,
//             };
//           });

//           const uniqueOptions = options
//             .map((name, idx) => ({
//               name,
//               values: [...new Set(optionValues[idx])],
//             }))
//             .filter((opt) => opt.name);

//           const images = [
//             ...new Set(
//               rows.map((r) => cleanUrl(r['Image Src'])).filter(Boolean)
//             ),
//           ].map((src, index) => ({
//             src,
//             position: index + 1,
//             alt:
//               rows.find((r) => cleanUrl(r['Image Src']) === src)?.[
//                 'Image Alt Text'
//               ] || null,
//           }));

//           const payload = {
//             product: {
//               title: mainRow['Title'],
//               handle: handle, // ✅ Correct place
//               body_html: mainRow['Body (HTML)'] || '',
//               vendor: mainRow['Vendor'] || '',
//               product_type: mainRow['Type'] || '',
//               status: mainRow['Published'] === 'TRUE' ? 'active' : 'draft',
//               tags: mainRow['Tags']?.split(',').map((tag) => tag.trim()) || [],
//               options: uniqueOptions,
//               images,
//               variants: variants.map((v) => ({
//                 sku: v.sku,
//                 price: v.price,
//                 compare_at_price: v.compare_at_price,
//                 inventory_management: v.inventory_management,
//                 inventory_quantity: v.inventory_quantity,
//                 fulfillment_service: v.fulfillment_service,
//                 requires_shipping: v.requires_shipping,
//                 taxable: v.taxable,
//                 barcode: v.barcode,
//                 weight: v.weight,
//                 weight_unit: v.weight_unit,
//                 option1: v.option1,
//                 option2: v.option2,
//                 option3: v.option3,
//               })),
//             },
//           };

//           await delay(2000);

//           try {
//             const response = await shopifyRequest(
//               `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
//               'POST',
//               payload,
//               shopifyApiKey,
//               shopifyAccessToken
//             );

//             const productId = response.product?.id;
//             const uploadedVariantImages = [];

//             await Promise.all(
//               variants.map(async (variant) => {
//                 try {
//                   // collect all image URLs for this variant (e.g., Variant Image 1, 2, 3)
//                   const variantImageUrls = Object.keys(mainRow)
//                     .filter((key) =>
//                       key.toLowerCase().startsWith('variant image')
//                     )
//                     .map((key) => cleanUrl(variant[key] || mainRow[key]))
//                     .filter(Boolean);

//                   if (variant.variant_image) {
//                     variantImageUrls.push(cleanUrl(variant.variant_image));
//                   }

//                   // remove duplicates
//                   const uniqueVariantImages = [...new Set(variantImageUrls)];

//                   if (uniqueVariantImages.length === 0) return;

//                   // Create alt text from SKU + variant options
//                   const optionValues = Object.keys(variant)
//                     .filter(
//                       (key) =>
//                         key.toLowerCase().startsWith('option') && variant[key]
//                     )
//                     .map((key) => variant[key]);

//                   const variantAltBase = [variant.sku, ...optionValues]
//                     .filter(Boolean)
//                     .join(' - ');

//                   // Upload all variant images
//                   for (let i = 0; i < uniqueVariantImages.length; i++) {
//                     const imgUrl = uniqueVariantImages[i];
//                     const imageUploadPayload = {
//                       image: {
//                         src: imgUrl,
//                         alt:
//                           uniqueVariantImages.length > 1
//                             ? `${variantAltBase} (Image ${i + 1})`
//                             : variantAltBase,
//                       },
//                     };

//                     const uploadResponse = await shopifyRequest(
//                       `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/images.json`,
//                       'POST',
//                       imageUploadPayload,
//                       shopifyApiKey,
//                       shopifyAccessToken
//                     );

//                     if (uploadResponse?.image) {
//                       const img = uploadResponse.image;
//                       uploadedVariantImages.push({
//                         id: img.id?.toString() || '',
//                         alt: img.alt || '',
//                         position: img.position || 0,
//                         product_id: img.product_id?.toString() || '',
//                         created_at: img.created_at || '',
//                         updated_at: img.updated_at || '',
//                         width: img.width || 0,
//                         height: img.height || 0,
//                         src: img.src || '',
//                         variantSku: variant.sku || '',
//                       });
//                     }
//                   }
//                 } catch (uploadError) {
//                   console.error(
//                     `Image upload error for SKU ${variant.sku}: ${uploadError.message}`
//                   );
//                 }
//               })
//             );

//             const productDetails = await shopifyRequest(
//               `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
//               'GET',
//               null,
//               shopifyApiKey,
//               shopifyAccessToken
//             );
//             const shopifyVariants = productDetails?.product?.variants || [];

//             await Promise.all(
//               shopifyVariants.map(async (variant, i) => {
//                 if (uploadedVariantImages[i]) {
//                   await shopifyRequest(
//                     `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
//                     'PUT',
//                     {
//                       variant: {
//                         id: variant.id,
//                         image_id: uploadedVariantImages[i].image_id,
//                       },
//                     },
//                     shopifyApiKey,
//                     shopifyAccessToken
//                   );
//                 }
//               })
//             );

//             if (
//               mainRow.metafield_namespace &&
//               mainRow.metafield_key &&
//               mainRow.metafield_value &&
//               mainRow.metafield_type
//             ) {
//               const metafieldPayload = {
//                 metafield: {
//                   namespace: mainRow.metafield_namespace,
//                   key: mainRow.metafield_key,
//                   value: mainRow.metafield_value,
//                   type: mainRow.metafield_type,
//                 },
//               };

//               await shopifyRequest(
//                 `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
//                 'POST',
//                 metafieldPayload,
//                 shopifyApiKey,
//                 shopifyAccessToken
//               );
//             }

//             results.push({
//               success: true,
//               productId,
//               title: response.product?.title,
//             });
//           } catch (err) {
//             console.error(`🚨 Failed for handle ${handle}`, err.message);
//             results.push({ success: false, handle, error: err.message });
//           }
//         }

//         return res
//           .status(200)
//           .json({ message: '✅ Upload completed', results });
//       });
//   } catch (error) {
//     console.error('🔥 API Error:', error.message);
//     return res
//       .status(500)
//       .json({ error: 'Internal server error', message: error.message });
//   }
// };

export const addCsvfileForBulkUploader = async (req, res) => {
  const file = req.file;
  const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = req.body;

  if (!file || !file.buffer) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  if (!shopifyApiKey || !shopifyAccessToken || !shopifyStoreUrl) {
    return res.status(400).json({ error: 'Missing Shopify credentials.' });
  }

  try {
    const allRows = [];
    const stream = Readable.from(file.buffer);
    const cleanUrl = (url) => url?.split('?')[0];

    stream
      .pipe(csv())
      .on('data', (row) => allRows.push(row))
      .on('end', async () => {
        const groupedProducts = {};

        allRows.forEach((row) => {
          const handle = row['Handle']?.trim();
          if (handle) {
            if (!groupedProducts[handle]) groupedProducts[handle] = [];
            groupedProducts[handle].push(row);
          }
        });

        const results = [];

        for (const handle in groupedProducts) {
          const rows = groupedProducts[handle];
          const mainRow = rows[0];

          const options = ['Option1 Name', 'Option2 Name', 'Option3 Name']
            .map((opt) => mainRow[opt])
            .filter(Boolean);

          const optionValues = [[], [], []];

          const variants = rows.map((row) => {
            if (row['Option1 Value'])
              optionValues[0].push(row['Option1 Value']);
            if (row['Option2 Value'])
              optionValues[1].push(row['Option2 Value']);
            if (row['Option3 Value'])
              optionValues[2].push(row['Option3 Value']);

            return {
              sku: row['Variant SKU'] || '',
              price: row['Variant Price'] || '0.00',
              compare_at_price: row['Variant Compare At Price'] || null,
              inventory_management:
                row['Variant Inventory Tracker'] === 'shopify'
                  ? 'shopify'
                  : null,
              inventory_quantity: parseInt(row['Variant Inventory Qty']) || 0,
              fulfillment_service: 'manual',
              requires_shipping: row['Variant Requires Shipping'] === 'TRUE',
              taxable: row['Variant Taxable'] === 'TRUE',
              barcode: row['Variant Barcode'] || '',
              weight: parseFloat(row['Variant Grams']) || 0,
              weight_unit: ['g', 'kg', 'oz', 'lb'].includes(
                row['Variant Weight Unit']
              )
                ? row['Variant Weight Unit']
                : 'g',
              option1: row['Option1 Value'] || null,
              option2: row['Option2 Value'] || null,
              option3: row['Option3 Value'] || null,
              variant_image: cleanUrl(row['Variant Image']) || null,
            };
          });

          const uniqueOptions = options
            .map((name, idx) => ({
              name,
              values: [...new Set(optionValues[idx])],
            }))
            .filter((opt) => opt.name);

          // =========================
          // ✅ FIXED IMAGE COLLECTION
          // =========================
          const allImageUrls = [];

          // Always push Featured Image from first row
          if (mainRow['Featured Image']) {
            allImageUrls.push(cleanUrl(mainRow['Featured Image']));
          }

          // Then push all Image Src
          rows.forEach((r) => {
            if (r['Image Src']) {
              allImageUrls.push(cleanUrl(r['Image Src']));
            }
          });

          const uniqueImageUrls = [...new Set(allImageUrls.filter(Boolean))];

          const images = uniqueImageUrls.map((src, index) => ({
            src,
            position: index + 1,
            alt:
              rows.find(
                (r) =>
                  cleanUrl(r['Image Src']) === src ||
                  cleanUrl(r['Featured Image']) === src
              )?.['Image Alt Text'] || null,
          }));

          const payload = {
            product: {
              title: mainRow['Title'],
              handle: handle,
              body_html: mainRow['Body (HTML)'] || '',
              vendor: mainRow['Vendor'] || '',
              product_type: mainRow['Type'] || '',
              status: mainRow['Published'] === 'TRUE' ? 'active' : 'draft',
              tags: mainRow['Tags']?.split(',').map((tag) => tag.trim()) || [],
              options: uniqueOptions,
              images,
              variants: variants.map((v) => ({
                sku: v.sku,
                price: v.price,
                compare_at_price: v.compare_at_price,
                inventory_management: v.inventory_management,
                inventory_quantity: v.inventory_quantity,
                fulfillment_service: v.fulfillment_service,
                requires_shipping: v.requires_shipping,
                taxable: v.taxable,
                barcode: v.barcode,
                weight: v.weight,
                weight_unit: v.weight_unit,
                option1: v.option1,
                option2: v.option2,
                option3: v.option3,
              })),
            },
          };

          await delay(2000);

          try {
            const response = await shopifyRequest(
              `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
              'POST',
              payload,
              shopifyApiKey,
              shopifyAccessToken
            );

            const productId = response.product?.id;

            // =========================
            // ✅ MONGO SAVE (Schema Safe)
            // =========================
            const mongoProduct = new listingModel({
              id: productId?.toString(), // REQUIRED FIELD
              title: mainRow['Title'],
              body_html: mainRow['Body (HTML)'] || '',
              vendor: mainRow['Vendor'] || '',
              product_type: mainRow['Type'] || '',
              handle: handle,
              shopifyId: productId?.toString(),
              status: mainRow['Published'] === 'TRUE' ? 'active' : 'draft',
              tags: mainRow['Tags']?.split(',').map((tag) => tag.trim()) || [],
              options: uniqueOptions,

              images: uniqueImageUrls.map((url, index) => ({
                id: null,
                product_id: productId?.toString(),
                position: index + 1,
                created_at: new Date(),
                updated_at: new Date(),
                alt:
                  rows.find(
                    (r) =>
                      cleanUrl(r['Image Src']) === url ||
                      cleanUrl(r['Featured Image']) === url
                  )?.['Image Alt Text'] || null,
                width: null,
                height: null,
                src: url,
              })),
            });

            await mongoProduct.save();

            results.push({
              success: true,
              productId,
              title: response.product?.title,
            });
          } catch (err) {
            console.error(`🚨 Failed for handle ${handle}`, err.message);
            results.push({ success: false, handle, error: err.message });
          }
        }

        return res.status(200).json({
          message: '✅ Upload completed',
          results,
        });
      });
  } catch (error) {
    console.error('🔥 API Error:', error.message);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

export const getTrackingCountForAdmin = async (req, res) => {
  try {
    const allUsersViewData = await viewModel.find();

    if (!allUsersViewData || allUsersViewData.length === 0) {
      return res.status(404).json({ message: 'No view data found' });
    }

    // Admin dashboard ke liye aggregate totals
    const totalViews = allUsersViewData.reduce(
      (sum, u) => sum + (u.totalViews || 0),
      0
    );
    const weeklyViews = allUsersViewData.reduce(
      (sum, u) => sum + (u.weeklyViews || 0),
      0
    );
    const monthlyViews = allUsersViewData.reduce(
      (sum, u) => sum + (u.monthlyViews || 0),
      0
    );

    res.status(200).json({
      totalViews,
      weeklyViews,
      monthlyViews,
      users: allUsersViewData.map((u) => ({
        userId: u.userId,
        totalViews: u.totalViews,
        weeklyViews: u.weeklyViews,
        monthlyViews: u.monthlyViews,
      })),
    });
  } catch (error) {
    console.error('Error fetching admin view count:', error);
    res.status(500).json({ message: 'Failed to get admin view count' });
  }
};

export const getAllProducts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const userId = req.userId; // Injected by verifyToken middleware

  try {
    const matchStage = {
      userId: userId, // Filter only that user's products
    };

    const products = await listingModel.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          userId: {
            $cond: [
              { $eq: [{ $type: '$userId' }, 'string'] },
              {
                $convert: {
                  input: '$userId',
                  to: 'objectId',
                  onError: null,
                  onNull: null,
                },
              },
              '$userId',
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      { $sort: { created_at: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          id: 1,
          title: 1,
          body_html: 1,
          vendor: 1,
          product_type: 1,
          created_at: 1,
          tags: 1,
          variants: 1,
          options: 1,
          images: 1,
          variantImages: 1,
          inventory: 1,
          shipping: 1,
          status: 1,
          userId: 1,
          oldPrice: 1,
          shopifyId: 1,
          username: {
            $concat: [
              { $ifNull: ['$user.firstName', ''] },
              ' ',
              { $ifNull: ['$user.lastName', ''] },
            ],
          },
          email: '$user.email',
        },
      },
    ]);

    const totalProducts = await listingModel.countDocuments(matchStage);

    if (products.length > 0) {
      res.status(200).send({
        products,
        currentPage: page,
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts,
      });
    } else {
      res.status(400).send('No products found');
    }
  } catch (error) {
    console.error('Aggregation error:', error);
    res.status(500).send({ error: error.message });
  }
};

export const getAllProductWithApprovalStatus = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const matchStage = {
      userId: { $exists: true, $ne: null },
      approvalStatus: 'pending',
    };

    const products = await listingModel.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          userId: {
            $cond: [
              { $eq: [{ $type: '$userId' }, 'string'] },
              {
                $convert: {
                  input: '$userId',
                  to: 'objectId',
                  onError: null,
                  onNull: null,
                },
              },
              '$userId',
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $sort: { created_at: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          id: 1,
          title: 1,
          body_html: 1,
          vendor: 1,
          product_type: 1,
          created_at: 1,
          tags: 1,
          variants: 1,
          options: 1,
          images: 1,
          variantImages: 1,
          inventory: 1,
          shipping: 1,
          status: 1,
          userId: 1,
          oldPrice: 1,
          shopifyId: 1,
          approvalStatus: 1,
          username: {
            $concat: [
              { $ifNull: ['$user.firstName', ''] },
              ' ',
              { $ifNull: ['$user.lastName', ''] },
            ],
          },
          email: '$user.email',
        },
      },
    ]);

    const totalProducts = await listingModel.countDocuments(matchStage);

    if (products.length > 0) {
      res.status(200).send({
        products,
        currentPage: page,
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts,
      });
    } else {
      res.status(404).send('No pending products found');
    }
  } catch (error) {
    console.error('Aggregation error:', error);
    res.status(500).send({ error: error.message });
  }
};

export const approvelProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    const localProduct = await listingModel.findById(productId);
    if (!localProduct) {
      return res.status(404).json({ error: 'Product not found in database.' });
    }

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
    const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
    const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;
    const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${localProduct.id}.json`;
    const shopifyPayload = {
      product: {
        id: localProduct.id,
        status: 'active',
        published_scope: 'global',
      },
    };

    const shopifyResponse = await shopifyRequest(
      shopifyUrl,
      'PUT',
      shopifyPayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!shopifyResponse.product) {
      return res
        .status(400)
        .json({ error: 'Failed to update product status in Shopify.' });
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const updatedProduct = await listingModel.findByIdAndUpdate(
      productId,
      {
        status: 'active',
        approvalStatus: 'approved',
        expiresAt,
      },
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found in database.' });
    }

    return res.status(200).json({
      message: 'Product successfully published.',
      product: updatedProduct,
      expiresAt,
    });
  } catch (error) {
    console.error('Error in publishProduct function:', error);
    return res.status(500).json({ error: error.message });
  }
};
