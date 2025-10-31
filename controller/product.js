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

// export const addUsedEquipments = async (req, res) => {
//   let productId;
//   try {
//     console.log(req.body);
//     const userId = req.userId;
//     const user = await authModel.findById(userId);
//     if (!user) return res.status(404).json({ error: 'User not found' });
//     const {
//       title,
//       description = '',
//       price = '0.00',
//       compare_at_price = '0.00',
//       track_quantity = false,
//       trackQuantity,
//       quantity = 0,
//       continue_selling = true,
//       has_sku = false,
//       sku = '',
//       barcode = '',
//       track_shipping = false,
//       weight = 0,
//       weight_unit = 'kg',
//       status = 'draft',
//       // userId = '',
//       productType = '',
//       vendor = '',
//       keyWord = '',
//       options = [],
//       variantPrices = [],
//       variantCompareAtPrices = [],
//       variantQuantites = [],
//       variantSku = [],
//       categories = [],
//     } = req.body;
//     let productStatus =
//       status === 'publish' || status === 'active' ? 'active' : 'draft';
//     let approvalStatus = 'approved';

//     if (user.role === 'Merchant') {
//       const approvalSetting = await approvalModel.findOne();

//       if (approvalSetting?.approvalMode === 'Manual') {
//         productStatus = 'draft';
//         approvalStatus = 'pending';
//       }
//     }
//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfiguration)
//       return res
//         .status(404)
//         .json({ error: 'Shopify configuration not found.' });

//     const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
//       shopifyConfiguration;

//     let parsedOptions =
//       typeof options === 'string' ? JSON.parse(options) : options;
//     if (!Array.isArray(parsedOptions) || parsedOptions.length === 0) {
//       parsedOptions = [{ name: 'Title', values: ['Default'] }];
//     }

//     const shopifyOptions = parsedOptions.map((option) => ({
//       name: option.name,
//       values: option.values,
//     }));

//     const variantCombinations = generateVariantCombinations(parsedOptions);
//     const formatPrice = (value) => {
//       if (!value) return '0.00';
//       const num = parseFloat(value);
//       return isNaN(num) ? '0.00' : num.toFixed(2);
//     };
//     const formatCompareAtPrice = (value) => {
//       if (!value) return '0.00';
//       const num = parseFloat(value);
//       return isNaN(num) ? '0.00' : num.toFixed(2);
//     };
//     // const shopifyVariants = variantCombinations.map((variant, index) => {
//     //   const variantPrice = variantPrices?.[index] || price;
//     //   const variantCompareAtPrice = formatCompareAtPrice(
//     //     variantCompareAtPrices?.[index] || compare_at_price
//     //   );

//     //   return {
//     //     option1: variant[parsedOptions[0].name] || null,
//     //     option2: parsedOptions[1] ? variant[parsedOptions[1].name] : null,
//     //     option3: parsedOptions[2] ? variant[parsedOptions[2].name] : null,
//     //     price: formatPrice(variantPrice),
//     //     compare_at_price: variantCompareAtPrice,
//     //     inventory_management: track_quantity ? 'shopify' : null,
//     //     inventory_quantity:
//     //       track_quantity && !isNaN(parseInt(variantQuantites?.[index]))
//     //         ? parseInt(variantQuantites?.[index])
//     //         : 0,
//     //     sku: has_sku ? `${sku}-${index + 1}` : null,
//     //     barcode: has_sku ? `${barcode}-${index + 1}` : null,
//     //     weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
//     //     weight_unit: track_shipping ? weight_unit : null,
//     //     isParent: index === 0,
//     //   };
//     // });
//     const shopifyVariants = variantCombinations.map((variant, index) => {
//       const variantPrice = variantPrices?.[index] || price;
//       const variantCompareAtPrice = formatCompareAtPrice(
//         variantCompareAtPrices?.[index] || compare_at_price
//       );

//       const variantQuantity =
//         track_quantity && !isNaN(parseInt(variantQuantites?.[index]))
//           ? parseInt(variantQuantites?.[index])
//           : 0;

//       const variantSKU = has_sku
//         ? variantSku?.[index] || `${sku}-${index + 1}`
//         : null;

//       return {
//         option1: variant[parsedOptions[0].name] || null,
//         option2: parsedOptions[1] ? variant[parsedOptions[1].name] : null,
//         option3: parsedOptions[2] ? variant[parsedOptions[2].name] : null,
//         price: formatPrice(variantPrice),
//         compare_at_price: variantCompareAtPrice,
//         inventory_management: track_quantity ? 'shopify' : null,
//         inventory_quantity: variantQuantity,
//         sku: variantSKU,
//         barcode: has_sku ? `${barcode}-${index + 1}` : null,
//         weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
//         weight_unit: track_shipping ? weight_unit : null,
//         isParent: index === 0,
//       };
//     });
//     const tagsArray = [
//       ...(keyWord ? keyWord.split(',').map((tag) => tag.trim()) : []),
//       ...(categories ? categories : []),
//     ];
//     const safeVendor =
//       typeof vendor === 'string'
//         ? vendor
//         : Array.isArray(vendor) && vendor.length > 0
//           ? vendor[0]
//           : '';

//     const safeProductType =
//       typeof productType === 'string'
//         ? productType
//         : Array.isArray(productType) && productType.length > 0
//           ? productType[0]
//           : '';

//     const shopifyPayload = {
//       product: {
//         title,
//         body_html: description || '',
//         vendor: safeVendor,
//         product_type: safeProductType,
//         status: productStatus,
//         options: shopifyOptions,
//         variants: shopifyVariants,
//         // tags: [...(keyWord ? keyWord.split(',') : []),]
//         tags: [
//           ...(keyWord ? keyWord.split(',').map((t) => t.trim()) : []),
//           `user_${userId}`,
//           `vendor_${vendor}`,
//         ],
//       },
//     };

//     const productResponse = await shopifyRequest(
//       `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
//       'POST',
//       shopifyPayload,
//       shopifyApiKey,
//       shopifyAccessToken
//     );

//     if (!productResponse?.product?.id)
//       throw new Error('Shopify product creation failed.');
//     productId = productResponse.product.id;
//     const metafieldsPayload = [
//       {
//         namespace: 'Aydi',
//         key: 'Aydi_Information',
//         value: title || 'Not specified',
//         type: 'single_line_text_field',
//       },
//     ];

//     for (const metafield of metafieldsPayload) {
//       const metafieldsUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`;

//       const metafieldResponse = await shopifyRequest(
//         metafieldsUrl,
//         'POST',
//         { metafield },
//         shopifyApiKey,
//         shopifyAccessToken
//       );

//       if (metafieldResponse?.metafield) {
//       } else {
//       }
//     }

//     const newProduct = new listingModel({
//       id: productId,
//       title,
//       body_html: description,
//       vendor: safeVendor,
//       approvalStatus,
//       product_type: safeProductType,
//       options: shopifyOptions,
//       created_at: new Date(),
//       tags: productResponse.product.tags,
//       variants: productResponse.product.variants,
//       inventory: {
//         track_quantity: !!track_quantity || false,
//         quantity:
//           track_quantity && !isNaN(parseInt(quantity)) ? parseInt(quantity) : 0,
//         continue_selling: continue_selling || true,
//         has_sku: !!has_sku || false,
//         sku: sku,
//         barcode: barcode,
//       },
//       shipping: {
//         track_shipping: track_shipping || false,
//         weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
//         weight_unit: weight_unit || 'kg',
//       },
//       userId,
//       status: productStatus,
//       shopifyId: productId,
//       categories: Array.isArray(categories) ? categories : [categories],
//     });

//     await newProduct.save();

//     return res.status(201).json({
//       message: 'Product successfully created.',
//       product: newProduct,
//     });
//   } catch (error) {
//     console.error('Error in addUsedEquipments function:', error);

//     if (productId) {
//       try {
//         await shopifyRequest(
//           `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
//           'DELETE',
//           null,
//           shopifyApiKey,
//           shopifyAccessToken
//         );
//       } catch (deleteError) {
//         console.error('Error deleting product from Shopify:', deleteError);
//       }
//     }

//     res.status(500).json({ error: error.message });
//   }
// };



export const addUsedEquipments = async (req, res) => {
  let productId;
  try {
    console.log(req.body);
    const userId = req.userId;
    const user = await authModel.findById(userId);
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
    } = req.body;
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
    const tagsArray = [
      ...(keyWord ? keyWord.split(',').map((tag) => tag.trim()) : []),
      ...(categories ? categories : []),
    ];
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

    const shopifyPayload = {
      product: {
        title,
        body_html: description || '',
        vendor: safeVendor,
        product_type: safeProductType,
        status: productStatus,
        options: shopifyOptions,
        variants: shopifyVariants,
        // tags: [...(keyWord ? keyWord.split(',') : []),]
        tags: [
          ...(keyWord ? keyWord.split(',').map((t) => t.trim()) : []),
          `user_${userId}`,
          `vendor_${vendor}`,
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
      throw new Error("Shopify product creation failed.");

    productId = productResponse.product.id;

    // 🧩 METAFIELDS HANDLING
    if (Array.isArray(metafields) && metafields.length > 0) {
      for (const field of metafields) {
        const label = field.label?.trim();
        const value = field.value?.trim();

        if (!label || !value) continue;

        try {
          // Check if metafield already exists
          const existingMeta = await shopifyRequest(
            `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
            "GET",
            null,
            shopifyApiKey,
            shopifyAccessToken
          );

          const found = existingMeta?.metafields?.find(
            (mf) => mf.key === label || mf.namespace === label
          );

          if (found) {
            // ✅ Update existing metafield
            await shopifyRequest(
              `${shopifyStoreUrl}/admin/api/2024-01/metafields/${found.id}.json`,
              "PUT",
              {
                metafield: {
                  id: found.id,
                  value,
                  type: "single_line_text_field",
                },
              },
              shopifyApiKey,
              shopifyAccessToken
            );
          } else {
            // ✅ Create new metafield
            await shopifyRequest(
              `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
              "POST",
              {
                metafield: {
                  namespace: "custom",
                  key: label,
                  value,
                  type: "single_line_text_field",
                },
              },
              shopifyApiKey,
              shopifyAccessToken
            );
          }
        } catch (metaErr) {
          console.error(`Metafield error for ${label}:`, metaErr.message);
        }
      }
    }

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
      inventory: {
        track_quantity: !!track_quantity || false,
        quantity:
          track_quantity && !isNaN(parseInt(quantity)) ? parseInt(quantity) : 0,
        continue_selling: continue_selling || true,
        has_sku: !!has_sku || false,
        sku: sku,
        barcode: barcode,
      },
      shipping: {
        track_shipping: track_shipping || false,
        weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
        weight_unit: weight_unit || 'kg',
      },
      userId,
      status: productStatus,
      shopifyId: productId,
      categories: Array.isArray(categories) ? categories : [categories],
      metafields: metafields,
    });

    await newProduct.save();

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
  let newProductId;
  let shopifyStoreUrl, shopifyApiKey, shopifyAccessToken;

  try {
    const userId = req.userId;
    console.log('🔹 Duplicate request by user:', userId);

    const user = await authModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { productId } = req.params;
    console.log('🔹 Product ID to duplicate:', productId);

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    shopifyApiKey = shopifyConfiguration.shopifyApiKey;
    shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
    shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;

    // 1️⃣ Get original product from Shopify
    const shopifyProductRes = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
      'GET',
      null,
      shopifyApiKey,
      shopifyAccessToken
    );
    const shopifyProduct = shopifyProductRes?.product;
    if (!shopifyProduct) {
      return res.status(404).json({ error: 'Product not found on Shopify.' });
    }

    // 2️⃣ Clone product on Shopify (without touching images)
    const clonePayload = {
      product: {
        ...shopifyProduct,
        id: undefined,
        title: `Copy of ${shopifyProduct.title}`,
        handle: `copy-of-${shopifyProduct.handle}-${Date.now()}`,
        status: 'draft',
      },
    };

    const productResponse = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
      'POST',
      clonePayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!productResponse?.product?.id) {
      throw new Error('Failed to clone product on Shopify.');
    }

    newProductId = productResponse.product.id;
    const newVariants = productResponse.product.variants;

    // 3️⃣ Instead of fetching images from Shopify, get from DB
    const originalProductFromDb = await listingModel.findOne({ id: productId });
    if (!originalProductFromDb) {
      throw new Error('Original product not found in DB.');
    }

    const imagesFromDb = originalProductFromDb.images || [];
    const variantImagesFromDb = originalProductFromDb.variantImages || [];
    console.log(
      '🔹 Images taken from DB:',
      imagesFromDb.length,
      variantImagesFromDb.length
    );

    // 4️⃣ Prepare inventory
    const inventory = {
      track_quantity: newVariants.some(
        (v) => v.inventory_management === 'shopify'
      ),
      quantity: newVariants[0]?.inventory_quantity || 0,
      continue_selling: newVariants.some(
        (v) => v.inventory_policy === 'continue'
      ),
      has_sku: newVariants.some((v) => !!v.sku),
      sku: newVariants[0]?.sku || '',
      barcode: newVariants[0]?.barcode || '',
    };

    // 5️⃣ Save duplicate into DB with images from DB
    const duplicateProduct = new listingModel({
      ...productResponse.product,
      shopifyId: newProductId,
      userId,
      status: 'draft',
      approvalStatus: 'approved',
      created_at: new Date(),
      images: imagesFromDb, // ✅ use DB images
      variantImages: variantImagesFromDb, // ✅ use DB variantImages
      inventory,
    });

    await duplicateProduct.save();

    return res.status(201).json({
      message: '✅ Product cloned on Shopify and saved in DB (images from DB).',
      product: duplicateProduct,
    });
  } catch (error) {
    console.error('❌ Error duplicating product:', error);

    if (newProductId && shopifyStoreUrl) {
      try {
        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${newProductId}.json`,
          'DELETE',
          null,
          shopifyApiKey,
          shopifyAccessToken
        );
      } catch (deleteError) {
        console.error('❌ Error rolling back product:', deleteError);
      }
    }

    res.status(500).json({ error: error.message });
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
          variantImages: 1,
          shipping: 1,
          status: 1,
          userId: 1,
          categories: 1,
          oldPrice: 1,
          shopifyId: 1,
          approvalStatus: 1,
          metafields:1,
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
    } = req.body;

    const variantQtyArray = variantQuantites || variantQuantities || [];
    const productStatus = status === 'publish' ? 'active' : 'draft';

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

    const updatePayload = {
      product: {
        title,
        body_html: description,
        vendor,
        product_type: productType,
        status: productStatus,
        options: shopifyOptions,
        variants: shopifyVariants,
        tags: [
          `user_${userId}`,
          `vendor_${vendor}`,
          ...(keyWord ? keyWord.split(',') : []),
        ],
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

if (Array.isArray(metafields) && metafields.length > 0) {
  try {
    console.log("🧩 Starting metafield sync with Shopify...");

    // Fetch all existing metafields once (outside the loop)
    const existingMetafieldsUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyProductId}/metafields.json`;
    console.log(`📡 Fetching existing metafields for product: ${shopifyProductId}`);

    const existingMetafieldsResponse = await shopifyRequest(
      existingMetafieldsUrl,
      "GET",
      null,
      shopifyApiKey,
      shopifyAccessToken
    );

    const existingMetas = existingMetafieldsResponse?.metafields || [];
    console.log(`🧾 Found ${existingMetas.length} existing metafields on Shopify.`);

    // Loop through metafields and create or update
    for (const meta of metafields) {
      if (!meta.label?.trim() || !meta.value?.trim()) {
        console.log(`⚠️ Skipping empty metafield:`, meta);
        continue;
      }

      const key = meta.label.trim().replace(/\s+/g, "_").toLowerCase();
      const value = meta.value.trim();

      const existingMeta = existingMetas.find((m) => m.key === key);

      if (existingMeta) {
        console.log(
          `🟡 Updating existing metafield [${key}] (ID: ${existingMeta.id}) → Value: ${value}`
        );

        // ✅ Update existing metafield (Shopify requires only value + type)
        const updateMetaUrl = `${shopifyStoreUrl}/admin/api/2024-01/metafields/${existingMeta.id}.json`;

        await shopifyRequest(
          updateMetaUrl,
          "PUT",
          {
            metafield: {
              id: existingMeta.id,
              value,
              type: "single_line_text_field",
            },
          },
          shopifyApiKey,
          shopifyAccessToken
        );

        console.log(`✅ Updated metafield successfully: ${key}`);
      } else {
        console.log(`🟢 Creating new metafield [${key}] → Value: ${value}`);

        await shopifyRequest(
          existingMetafieldsUrl,
          "POST",
          {
            metafield: {
              namespace: "Aydi",
              key,
              value,
              type: "single_line_text_field",
            },
          },
          shopifyApiKey,
          shopifyAccessToken
        );

        console.log(` Created new metafield successfully: ${key}`);
      }
    }

    console.log("🎉 Metafields synced successfully with Shopify.");
  } catch (metaError) {
    console.error(" Error syncing metafields to Shopify:", metaError);
  }
} else {
  console.log("ℹ️ No metafields provided in request — skipping Shopify metafield sync.");
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
      userId: userId || product.userId,
      status: productStatus || product.status,
      categories: Array.isArray(categories)
        ? categories
        : product.categories || [],
         metafields: Array.isArray(metafields)
        ? metafields.filter(
            (m) => m.label?.trim() && m.value?.trim()
          )
        : product.metafields || [],
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

    // Match condition
    const matchStage = { userId: { $exists: true, $ne: null } };

    // Total count first (without pagination)
    const totalProducts = await listingModel.countDocuments(matchStage);

    // Aggregation with pagination
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
          approvalStatus: 1,
          metafields:1,
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
      totalPages: Math.ceil(totalProducts / limit), // e.g. 530/50 = 11
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

const transformCloudinaryToShopifyCdn = (url) => {
  try {
    const parts = url.split('/');
    const imageName = parts[parts.length - 1];
    return `https://cdn.shopify.com/s/files/1/0730/5553/5360/files/${imageName}`;
  } catch {
    return url;
  }
};

const updateGalleryUrls = async (cloudinaryUrls, productId) => {
  try {
    console.log('Cloudinary URLs to update:', cloudinaryUrls);
    console.log('Product ID to assign (per image):', productId);

    const shopifyCdnUrl = transformCloudinaryToShopifyCdn(cloudinaryUrls[0]);

    const updateResult = await imageGalleryModel.updateMany(
      {
        'images.src': { $in: cloudinaryUrls },
      },
      {
        $set: {
          'images.$[img].src': shopifyCdnUrl,
          'images.$[img].productId': productId,
        },
      },
      {
        arrayFilters: [
          {
            'img.src': { $in: cloudinaryUrls },
          },
        ],
        multi: true,
      }
    );

    console.log('Image and productId update result:', updateResult);
  } catch (error) {
    console.error(
      ' Failed to update imageGallery images with productId:',
      error
    );
  }
};



export const updateImages = async (req, res) => {
  const { id } = req.params;
  const imageUrls = req.body.images || [];
  const variantImages = req.body.variantImages || [];
  console.log("🟦 ====== updateImages API called ======");

  try {
    const product = await listingModel.findOne({ id });
    if (!product) return res.status(404).json({ error: "Product not found." });

    console.log("Product found:", product.title);
    const oldVariantImages = product.variantImages || [];
    const oldMediaImages = product.images || [];

    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig)
      return res.status(404).json({ error: "Shopify config not found." });
    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

    // 🔹 Upload main media images (normal gallery)
    const uploadedMediaImages = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      if (!url) continue;

      const alreadyExists = oldMediaImages.some((img) => img.src === url);
      if (alreadyExists) continue;

      const altHandle = `image-${i + 1}`; // ✅ simple safe alt for general media

      const payload = {
        image: { src: url, alt: altHandle, position: i + 1 },
      };

      try {
        const uploadRes = await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
          "POST",
          payload,
          shopifyApiKey,
          shopifyAccessToken
        );

        if (uploadRes?.image)
          uploadedMediaImages.push({ ...uploadRes.image, src: url });
      } catch (err) {
        console.log("Media upload failed:", err.message);
      }
    }

    // 🔹 Upload variant-specific images
    const uploadedVariantImages = [];
    for (const variant of variantImages) {
      const { key, url, alt } = variant;
      if (!url) continue;

      const alreadyExists = oldVariantImages.some((img) => img.src === url);
      if (alreadyExists) continue;

      // ✅ Always use clean alt from frontend (handle-based)
      const cleanAlt =
        alt ||
        key?.replace(/\s*\/\s*/g, "-").trim().toLowerCase() ||
        "variant-image";

      const payload = { image: { src: url, alt: cleanAlt } };

      try {
        const uploadRes = await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
          "POST",
          payload,
          shopifyApiKey,
          shopifyAccessToken
        );

        if (uploadRes?.image) {
          uploadedVariantImages.push({
            ...uploadRes.image,
            src: url,
            variantKey: key,
            alt: cleanAlt, // ✅ ensure MongoDB stores proper alt too
          });
        }
      } catch (err) {
        console.log(`Variant [${key}] upload failed:`, err.message);
      }
    }

    // 🔹 Sync variant <-> image IDs
    const shopifyProduct = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products/${id}.json`,
      "GET",
      null,
      shopifyApiKey,
      shopifyAccessToken
    );

    const shopifyVariants = shopifyProduct?.product?.variants || [];
    const updatedVariants = [];

    for (const variant of shopifyVariants) {
      const match = uploadedVariantImages.find(
        (img) =>
          img.variantKey?.toLowerCase() === variant.title?.toLowerCase()
      );

      if (match) {
        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
          "PUT",
          { variant: { id: variant.id, image_id: match.id } },
          shopifyApiKey,
          shopifyAccessToken
        );
        updatedVariants.push({ ...variant, image_id: match.id });
      } else {
        const stillExists = variantImages.some(
          (v) =>
            v.key?.toLowerCase() === variant.title?.toLowerCase() && !!v.url
        );
        if (!stillExists) {
          await shopifyRequest(
            `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
            "PUT",
            { variant: { id: variant.id, image_id: null } },
            shopifyApiKey,
            shopifyAccessToken
          );
          updatedVariants.push({ ...variant, image_id: null });
          console.log(`🧹 Cleared image for variant ${variant.title}`);
        } else {
          const old = product.variants.find((v) => v.id === variant.id);
          updatedVariants.push(old || variant);
        }
      }
    }

    // 🔹 Merge MongoDB image arrays cleanly
    const newVariantUrls = variantImages.map((v) => v.url);
    const syncedVariantImages = oldVariantImages.filter((oldImg) =>
      newVariantUrls.includes(oldImg.src)
    );

    const finalVariantImages = [
      ...syncedVariantImages,
      ...uploadedVariantImages.map(({ variantKey, ...rest }) => rest),
    ];

    const finalImages = imageUrls.map((url, i) => {
      const existing = oldMediaImages.find((img) => img.src === url);
      return (
        existing || {
          src: url,
          alt: `image-${i + 1}`,
          position: i + 1,
          created_at: new Date(),
        }
      );
    });

    console.log(
      "✅ Final Media:",
      finalImages.map((x) => ({ src: x.src, alt: x.alt }))
    );
    console.log(
      " Final Variants:",
      finalVariantImages.map((x) => ({ src: x.src, alt: x.alt }))
    );

    const updatedProduct = await listingModel.findOneAndUpdate(
      { id },
      {
        images: finalImages,
        variantImages: finalVariantImages,
        variants: updatedVariants,
      },
      { new: true }
    );

    console.log("MongoDB updated successfully.");
    res.status(200).json({
      message:
        "Media and Variant images synced successfully with proper alt handles.",
      product: updatedProduct,
    });
  } catch (err) {
    console.error(" updateImages error:", err.message);
    res.status(500).json({ error: err.message });
  }
};


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
  try {
    const { productId, variantId } = req.params;
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
      inventory_policy: inventoryPolicy,
    } = req.body.variant || {};

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    const variantUpdateUrl = `${shopifyStoreUrl}/admin/api/2023-01/variants/${variantId}.json`;

    const variantPayload = {
      variant: {
        id: variantId,
        price: price?.toString(),
        compare_at_price: compare_at_price?.toString(),
        inventory_policy: inventoryPolicy,
        inventory_management: 'shopify',
        sku,
        barcode,
        option1,
        option2,
        option3,
        weight,
      },
    };

    const updatedVariant = await shopifyRequest(
      variantUpdateUrl,
      'PUT',
      variantPayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    const inventoryItemId = updatedVariant?.variant?.inventory_item_id;

    if (!inventoryItemId) {
      return res
        .status(400)
        .json({ error: 'Missing inventory_item_id from variant.' });
    }

    const inventoryLevelsUrl = `${shopifyStoreUrl}/admin/api/2023-01/inventory_levels.json?inventory_item_ids=${inventoryItemId}`;
    const inventoryLevelsRes = await shopifyRequest(
      inventoryLevelsUrl,
      'GET',
      null,
      shopifyApiKey,
      shopifyAccessToken
    );

    const locationId = inventoryLevelsRes?.inventory_levels?.[0]?.location_id;

    if (!locationId) {
      return res.status(400).json({
        error: 'Unable to determine location_id for inventory update.',
      });
    }

    if (inventory_quantity !== undefined) {
      const inventoryUpdateUrl = `${shopifyStoreUrl}/admin/api/2023-01/inventory_levels/set.json`;
      const inventoryPayload = {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: parseInt(inventory_quantity),
      };

      await shopifyRequest(
        inventoryUpdateUrl,
        'POST',
        inventoryPayload,
        shopifyApiKey,
        shopifyAccessToken
      );
    }

    const productUrl = `${shopifyStoreUrl}/admin/api/2023-01/products/${productId}.json`;
    const productResponse = await shopifyRequest(
      productUrl,
      'GET',
      null,
      shopifyApiKey,
      shopifyAccessToken
    );

    const updatedProduct = productResponse.product;
    const updatedProductOptions = updatedProduct.options || [];

    const updatedProductInDb = await listingModel.updateOne(
      { 'variants.id': variantId },
      {
        $set: {
          'variants.$': {
            id: variantId,
            price: updatedVariant.variant.price,
            title: updatedVariant.variant.title,
            inventory_quantity: parseInt(inventory_quantity),
            sku: updatedVariant.variant.sku,
            option1: updatedVariant.variant.option1,
            option2: updatedVariant.variant.option2,
            option3: updatedVariant.variant.option3,
            weight: updatedVariant.variant.weight,
            compare_at_price: updatedVariant.variant.compare_at_price,
            inventory_management: updatedVariant.variant.inventory_policy,
            productId: updatedVariant.variant.product_id,
            barcode: updatedVariant.variant.barcode,
            updatedAt: updatedVariant.variant.updated_at,
          },
          options: updatedProductOptions,
        },
      }
    );

    res.status(200).json({
      success: true,
      message:
        'Variant and inventory updated successfully in Shopify and database.',
      shopifyResponse: updatedVariant,
      dbResponse: updatedProductInDb,
    });
  } catch (error) {
    console.error('Error updating variant:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating variant.',
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


// export const addCsvfileForProductFromBody = async (req, res) => {
//   const file = req.file;
//   const userId = req.userId;

//   if (!file || !file.buffer) {
//     return res.status(400).json({ error: 'No file uploaded.' });
//   }

//   if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//     return res.status(400).json({ error: 'Invalid or missing userId.' });
//   }

//   try {
//     const config = await shopifyConfigurationModel.findOne();
//     if (!config) {
//       return res.status(404).json({ error: 'Shopify config not found.' });
//     }

//     const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = config;
//     const allRows = [];
//     const stream = Readable.from(file.buffer);
//     const cleanUrl = (url) => (url ? url.split('?')[0].trim() : null);

//     const categories = await categoryModel.find();
//     const catNoMap = {};
//     categories.forEach((cat) => {
//       catNoMap[cat.title.trim().toLowerCase()] = cat;
//     });

//     stream
//       .pipe(csv())
//       .on('data', (row) => {
//         allRows.push(row);
//       })
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

//           try {
//             // --- Parse Variants ---
//             const optionValues = [[], [], []];
//             const variantRows = rows.filter(
//               (r) => r['Variant Price'] || r['Variant SKU'] || r['Option1 Value']
//             );

//             let variants = variantRows.map((row) => {
//               if (row['Option1 Value']) optionValues[0].push(row['Option1 Value']);
//               if (row['Option2 Value']) optionValues[1].push(row['Option2 Value']);
//               if (row['Option3 Value']) optionValues[2].push(row['Option3 Value']);

//               return {
//                 sku: row['Variant SKU'] || '',
//                 price: row['Variant Price'] || '0.00',
//                 compare_at_price: row['Variant Compare At Price'] || null,
//                 inventory_management:
//                   row['Variant Inventory Tracker'] === 'shopify' ? 'shopify' : null,
//                 inventory_quantity: parseInt(row['Variant Inventory Qty']) || 0,
//                 fulfillment_service: 'manual',
//                 requires_shipping: row['Variant Requires Shipping'] === 'TRUE',
//                 taxable: row['Variant Taxable'] === 'TRUE',
//                 barcode: row['Variant Barcode'] || '',
//                 weight: parseFloat(row['Variant Grams']) || 0,
//                 weight_unit: ['g', 'kg', 'oz', 'lb'].includes(
//                   row['Variant Weight Unit']
//                 )
//                   ? row['Variant Weight Unit']
//                   : 'g',
//                 option1: row['Option1 Value'] || 'Default',
//                 option2: row['Option2 Value'] || null,
//                 option3: row['Option3 Value'] || null,
//                 // Keep variant image(s)
//                 variant_images: Object.keys(row)
//                   .filter((k) => k.toLowerCase().startsWith('variant image'))
//                   .map((k) => cleanUrl(row[k]))
//                   .filter(Boolean),
//               };
//             });

//             if (variants.length === 0) {
//               variants = [
//                 {
//                   sku: '',
//                   price: '0.00',
//                   compare_at_price: null,
//                   inventory_management: null,
//                   inventory_quantity: 0,
//                   fulfillment_service: 'manual',
//                   requires_shipping: true,
//                   taxable: true,
//                   barcode: '',
//                   weight: 0,
//                   weight_unit: 'g',
//                   option1: 'Default',
//                   option2: null,
//                   option3: null,
//                   variant_images: [],
//                 },
//               ];
//             }

//             const options = ['Option1 Name', 'Option2 Name', 'Option3 Name']
//               .map((opt) => mainRow[opt])
//               .filter(Boolean);

//             let uniqueOptions = options
//               .map((name, idx) => ({
//                 name,
//                 values: [...new Set(optionValues[idx])],
//               }))
//               .filter((opt) => opt.name);

//             if (!uniqueOptions.length || uniqueOptions.every((opt) => !opt.values.length)) {
//               uniqueOptions = [{ name: 'Title', values: ['Default'] }];
//             }

//             const productImages = [
//               ...new Set(rows.map((r) => cleanUrl(r['Image Src'])).filter(Boolean)),
//             ].map((src, index) => ({
//               src,
//               position: index + 1,
//               alt:
//                 rows.find((r) => cleanUrl(r['Image Src']) === src)?.['Image Alt Text'] ||
//                 null,
//             }));

//             const isPublished = mainRow['Published']?.toUpperCase() === 'TRUE';

//             // --- Tags, Categories ---
//             const csvTags =
//               typeof mainRow['Tags'] === 'string'
//                 ? mainRow['Tags']
//                     .split(',')
//                     .map((t) => t.trim())
//                     .filter(Boolean)
//                 : [];

//             const tags = [
//               ...new Set([
//                 ...csvTags,
//                 `user_${userId}`,
//                 `vendor_${mainRow['Vendor'] || ''}`,
//               ]),
//             ];

//             // --- Product Payload ---
//             const productPayload = {
//               title: mainRow['Title'],
//               body_html: mainRow['Body (HTML)'] || '',
//               vendor: mainRow['Vendor'] || '',
//               product_type: mainRow['Type'] || '',
//               status: isPublished ? 'active' : 'draft',
//               published_at: isPublished ? new Date().toISOString() : null,
//               tags: tags,
//               options: uniqueOptions,
//               images: productImages,
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
//             };

//             // --- Create / Update Product ---
//             await delay(2000);

//             let product = null;
//             const existing = await shopifyRequest(
//               `${shopifyStoreUrl}/admin/api/2024-01/products.json?handle=${handle}`,
//               'GET',
//               null,
//               shopifyApiKey,
//               shopifyAccessToken
//             );

//             if (existing?.products?.length > 0) {
//               const existingProduct = existing.products[0];
//               const updateRes = await shopifyRequest(
//                 `${shopifyStoreUrl}/admin/api/2024-01/products/${existingProduct.id}.json`,
//                 'PUT',
//                 { product: { ...productPayload, id: existingProduct.id } },
//                 shopifyApiKey,
//                 shopifyAccessToken
//               );
//               product = updateRes.product;
//             } else {
//               const createRes = await shopifyRequest(
//                 `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
//                 'POST',
//                 { product: productPayload },
//                 shopifyApiKey,
//                 shopifyAccessToken
//               );
//               product = createRes.product;
//             }

//             const productId = product.id;
//             const uploadedVariantImages = [];

//             // --- Upload Variant Images & Link ---
//             for (const variant of variants) {
//               const optionValues = [variant.option1, variant.option2, variant.option3]
//                 .filter(Boolean)
//                 .join(' - ');
//               const altBase = [variant.sku, optionValues].filter(Boolean).join(' - ');

//               for (let i = 0; i < variant.variant_images.length; i++) {
//                 const imgUrl = variant.variant_images[i];
//                 if (!imgUrl) continue;

//                 try {
//                   const uploadPayload = {
//                     image: {
//                       src: imgUrl,
//                       alt:
//                         variant.variant_images.length > 1
//                           ? `${altBase} (Image ${i + 1})`
//                           : altBase,
//                     },
//                   };

//                   const uploadRes = await shopifyRequest(
//                     `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/images.json`,
//                     'POST',
//                     uploadPayload,
//                     shopifyApiKey,
//                     shopifyAccessToken
//                   );

//                   if (uploadRes?.image) {
//                     uploadedVariantImages.push({
//                       variantSku: variant.sku,
//                       image_id: uploadRes.image.id,
//                       src: uploadRes.image.src,
//                     });
//                   }
//                 } catch (err) {
//                   console.error(`Image upload failed for ${variant.sku}: ${err.message}`);
//                 }
//               }
//             }

//             await delay(2000);

//             // --- Get Variants & Link images ---
//             const productDetails = await shopifyRequest(
//               `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
//               'GET',
//               null,
//               shopifyApiKey,
//               shopifyAccessToken
//             );

//             const shopifyVariants = productDetails?.product?.variants || [];

//             for (const variant of shopifyVariants) {
//               const match = uploadedVariantImages.find(
//                 (img) => img.variantSku === variant.sku
//               );
//               if (match?.image_id) {
//                 try {
//                   await shopifyRequest(
//                     `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
//                     'PUT',
//                     {
//                       variant: {
//                         id: variant.id,
//                         image_id: match.image_id,
//                       },
//                     },
//                     shopifyApiKey,
//                     shopifyAccessToken
//                   );
//                 } catch (err) {
//                   console.error(`Error linking variant ${variant.sku}: ${err.message}`);
//                 }
//               }
//             }

//             // --- Save to DB ---
//             await listingModel.findOneAndUpdate(
//               { shopifyId: productId },
//               {
//                 shopifyId: productId,
//                 id: productId,
//                 title: product.title,
//                 body_html: product.body_html,
//                 vendor: product.vendor,
//                 product_type: product.product_type,
//                 status: product.status,
//                 handle: product.handle,
//                 tags,
//                 images: product.images,
//                 variants: shopifyVariants,
//                 options: product.options,
//                 userId: userId,
//                 variantImages: uploadedVariantImages,
//               },
//               { upsert: true, new: true }
//             );

//             await new imageGalleryModel({
//               userId: userId,
//               images: product.images.map((img) => ({
//                 id: img.id?.toString(),
//                 product_id: img.product_id?.toString(),
//                 position: img.position,
//                 alt: img.alt,
//                 src: img.src,
//                 productId: productId.toString(),
//               })),
//             }).save();

//             results.push({
//               success: true,
//               handle,
//               productId,
//               title: product.title,
//             });
//           } catch (err) {
//             console.error(`Failed to process product: ${handle}`, err.message);
//             results.push({ success: false, handle, error: err.message });
//           }
//         }

//         return res.status(200).json({
//           message: 'Products processed successfully.',
//           successCount: results.filter((r) => r.success).length,
//           failedCount: results.filter((r) => !r.success).length,
//           results,
//         });
//       });
//   } catch (error) {
//     console.error('Server error:', error.message);
//     return res.status(500).json({
//       success: false,
//       message: 'Unexpected error during CSV upload.',
//       error: error?.message || 'Unknown error',
//     });
//   }
// };


export const addCsvfileForProductFromBody = async (req, res) => {
  const file = req.file;
  const userId = req.userId;

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
    const cleanUrl = (url) => (url ? url.split('?')[0].trim() : null);

    const categories = await categoryModel.find();
    const catNoMap = {};
    categories.forEach((cat) => {
      catNoMap[cat.title.trim().toLowerCase()] = cat;
    });

    stream
      .pipe(csv())
      .on('data', (row) => {
        allRows.push(row);
      })
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

          try {
            // --- Parse Variants ---
            const optionValues = [[], [], []];
            const variantRows = rows.filter(
              (r) => r['Variant Price'] || r['Variant SKU'] || r['Option1 Value']
            );

            let variants = variantRows.map((row) => {
              if (row['Option1 Value']) optionValues[0].push(row['Option1 Value']);
              if (row['Option2 Value']) optionValues[1].push(row['Option2 Value']);
              if (row['Option3 Value']) optionValues[2].push(row['Option3 Value']);

              return {
                sku: row['Variant SKU'] || '',
                price: row['Variant Price'] || '0.00',
                compare_at_price: row['Variant Compare At Price'] || null,
                inventory_management:
                  row['Variant Inventory Tracker'] === 'shopify' ? 'shopify' : null,
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
                option1: row['Option1 Value'] || 'Default',
                option2: row['Option2 Value'] || null,
                option3: row['Option3 Value'] || null,
                // Keep variant image(s)
                variant_images: Object.keys(row)
                  .filter((k) => k.toLowerCase().startsWith('variant image'))
                  .map((k) => cleanUrl(row[k]))
                  .filter(Boolean),
              };
            });

            if (variants.length === 0) {
              variants = [
                {
                  sku: '',
                  price: '0.00',
                  compare_at_price: null,
                  inventory_management: null,
                  inventory_quantity: 0,
                  fulfillment_service: 'manual',
                  requires_shipping: true,
                  taxable: true,
                  barcode: '',
                  weight: 0,
                  weight_unit: 'g',
                  option1: 'Default',
                  option2: null,
                  option3: null,
                  variant_images: [],
                },
              ];
            }

            const options = ['Option1 Name', 'Option2 Name', 'Option3 Name']
              .map((opt) => mainRow[opt])
              .filter(Boolean);

            let uniqueOptions = options
              .map((name, idx) => ({
                name,
                values: [...new Set(optionValues[idx])],
              }))
              .filter((opt) => opt.name);

            if (!uniqueOptions.length || uniqueOptions.every((opt) => !opt.values.length)) {
              uniqueOptions = [{ name: 'Title', values: ['Default'] }];
            }

            const productImages = [
              ...new Set(rows.map((r) => cleanUrl(r['Image Src'])).filter(Boolean)),
            ].map((src, index) => ({
              src,
              position: index + 1,
              alt:
                rows.find((r) => cleanUrl(r['Image Src']) === src)?.['Image Alt Text'] ||
                null,
            }));

            const isPublished = mainRow['Published']?.toUpperCase() === 'TRUE';

            const csvTags =
              typeof mainRow['Tags'] === 'string'
                ? mainRow['Tags']
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                : [];

            const tags = [
              ...new Set([
                ...csvTags,
                `user_${userId}`,
                `vendor_${mainRow['Vendor'] || ''}`,
              ]),
            ];

            const productPayload = {
              title: mainRow['Title'],
              body_html: mainRow['Body (HTML)'] || '',
              vendor: mainRow['Vendor'] || '',
              product_type: mainRow['Type'] || '',
              status: isPublished ? 'active' : 'draft',
              published_at: isPublished ? new Date().toISOString() : null,
              tags: tags,
              options: uniqueOptions,
              images: productImages,
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
            };

            // --- Create / Update Product ---
            await delay(2000);

            let product = null;
            const existing = await shopifyRequest(
              `${shopifyStoreUrl}/admin/api/2024-01/products.json?handle=${handle}`,
              'GET',
              null,
              shopifyApiKey,
              shopifyAccessToken
            );

            if (existing?.products?.length > 0) {
              const existingProduct = existing.products[0];
              const updateRes = await shopifyRequest(
                `${shopifyStoreUrl}/admin/api/2024-01/products/${existingProduct.id}.json`,
                'PUT',
                { product: { ...productPayload, id: existingProduct.id } },
                shopifyApiKey,
                shopifyAccessToken
              );
              product = updateRes.product;
            } else {
              const createRes = await shopifyRequest(
                `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
                'POST',
                { product: productPayload },
                shopifyApiKey,
                shopifyAccessToken
              );
              product = createRes.product;
            }

            const productId = product.id;
            const metafieldColumns = Object.keys(mainRow).filter((k) =>
              k.includes('(product.metafields.')
            );

            for (const col of metafieldColumns) {
              const match = col.match(/\(product\.metafields\.([^.]+)\.([^)]+)\)/);
              if (!match) continue;

              const namespace = match[1];
              const key = match[2];
              const value = mainRow[col]?.trim();
              if (!value) continue;

              try {
                await shopifyRequest(
                  `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
                  'POST',
                  {
                    metafield: {
                      namespace,
                      key,
                      value,
                      type: 'single_line_text_field',
                    },
                  },
                  shopifyApiKey,
                  shopifyAccessToken
                );
              } catch (metaErr) {
                console.error(`Metafield error [${namespace}.${key}]:`, metaErr.message);
              }
            }
            
            const uploadedVariantImages = [];

            for (const variant of variants) {
              const optionValues = [variant.option1, variant.option2, variant.option3]
                .filter(Boolean)
                .join(' - ');
              const altBase = [variant.sku, optionValues].filter(Boolean).join(' - ');

              for (let i = 0; i < variant.variant_images.length; i++) {
                const imgUrl = variant.variant_images[i];
                if (!imgUrl) continue;

                try {
                  const uploadPayload = {
                    image: {
                      src: imgUrl,
                      alt:
                        variant.variant_images.length > 1
                          ? `${altBase} (Image ${i + 1})`
                          : altBase,
                    },
                  };

                  const uploadRes = await shopifyRequest(
                    `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/images.json`,
                    'POST',
                    uploadPayload,
                    shopifyApiKey,
                    shopifyAccessToken
                  );

                  if (uploadRes?.image) {
                    uploadedVariantImages.push({
                      variantSku: variant.sku,
                      image_id: uploadRes.image.id,
                      src: uploadRes.image.src,
                    });
                  }
                } catch (err) {
                  console.error(`Image upload failed for ${variant.sku}: ${err.message}`);
                }
              }
            }

            await delay(2000);

            // --- Get Variants & Link images ---
            const productDetails = await shopifyRequest(
              `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
              'GET',
              null,
              shopifyApiKey,
              shopifyAccessToken
            );

            const shopifyVariants = productDetails?.product?.variants || [];

            for (const variant of shopifyVariants) {
              const match = uploadedVariantImages.find(
                (img) => img.variantSku === variant.sku
              );
              if (match?.image_id) {
                try {
                  await shopifyRequest(
                    `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
                    'PUT',
                    {
                      variant: {
                        id: variant.id,
                        image_id: match.image_id,
                      },
                    },
                    shopifyApiKey,
                    shopifyAccessToken
                  );
                } catch (err) {
                  console.error(`Error linking variant ${variant.sku}: ${err.message}`);
                }
              }
            }

            // --- Save to DB ---
            await listingModel.findOneAndUpdate(
              { shopifyId: productId },
              {
                shopifyId: productId,
                id: productId,
                title: product.title,
                body_html: product.body_html,
                vendor: product.vendor,
                product_type: product.product_type,
                status: product.status,
                handle: product.handle,
                tags,
                images: product.images,
                variants: shopifyVariants,
                options: product.options,
                userId: userId,
                variantImages: uploadedVariantImages,
              },
              { upsert: true, new: true }
            );

            await new imageGalleryModel({
              userId: userId,
              images: product.images.map((img) => ({
                id: img.id?.toString(),
                product_id: img.product_id?.toString(),
                position: img.position,
                alt: img.alt,
                src: img.src,
                productId: productId.toString(),
              })),
            }).save();

            results.push({
              success: true,
              handle,
              productId,
              title: product.title,
            });
          } catch (err) {
            console.error(`Failed to process product: ${handle}`, err.message);
            results.push({ success: false, handle, error: err.message });
          }
        }

        return res.status(200).json({
          message: 'Products processed successfully.',
          successCount: results.filter((r) => r.success).length,
          failedCount: results.filter((r) => !r.success).length,
          results,
        });
      });
  } catch (error) {
    console.error('Server error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unexpected error during CSV upload.',
      error: error?.message || 'Unknown error',
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

    // Get Shopify variant details to obtain inventory_item_id
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

    // Get inventory level info
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

    // Update inventory level on Shopify
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

    // Atomic update in MongoDB
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

// export const exportProducts = async (req, res) => {
//   try {
//     const { userId, type, page = 1, limit = 10, productIds } = req.query;

//     if (!userId || !type) {
//       return res
//         .status(400)
//         .json({ message: 'Missing required query parameters.' });
//     }

//     let query = {};

//     if (type === 'selected') {
//       if (!productIds) {
//         return res
//           .status(400)
//           .json({ message: 'Product IDs required for selected export.' });
//       }
//       const productIdsArray = productIds.split(',');
//       query._id = { $in: productIdsArray };
//     } else {
//       query.userId = userId;
//     }

//     const skip = (parseInt(page) - 1) * parseInt(limit);

//     const products =
//       type === 'current'
//         ? await listingModel.find(query).skip(skip).limit(parseInt(limit))
//         : await listingModel.find(query);

//     if (!products.length) {
//       return res.status(404).json({ message: 'No products found.' });
//     }

//     const config = await shopifyConfigurationModel.findOne();
//     if (!config) {
//       return res.status(400).json({ message: 'Shopify config not found.' });
//     }

//     const { shopifyStoreUrl, shopifyAccessToken, shopifyApiKey } = config;
//     const rows = [];

//     for (const dbProduct of products) {
//       const shopifyProductId = dbProduct.id;
//       if (!shopifyProductId) continue;

//       const shopifyUrl = `${shopifyStoreUrl}/admin/api/2023-10/products/${shopifyProductId}.json`;

//       const response = await shopifyRequest(
//         shopifyUrl,
//         'GET',
//         null,
//         shopifyApiKey,
//         shopifyAccessToken
//       );

//       const product = response?.product;
//       if (!product) continue;

//       product.variants.forEach((variant, index) => {
//         rows.push({
//           Handle: product.handle || '',
//           Title: index === 0 ? product.title : '',
//           'Body (HTML)': index === 0 ? product.body_html || '' : '',
//           Vendor: index === 0 ? product.vendor || '' : '',
//           'Product Category': '',
//           Type: index === 0 ? product.product_type || '' : '',
//           Tags: index === 0 ? (product.tags || '').toString() : '',
//           Published:
//             index === 0
//               ? String(product.published_at !== null).toUpperCase()
//               : '',
//           'Option1 Name': product.options?.[0]?.name || '',
//           'Option1 Value': variant.option1 || '',
//           'Option2 Name': product.options?.[1]?.name || '',
//           'Option2 Value': variant.option2 || '',
//           'Option3 Name': product.options?.[2]?.name || '',
//           'Option3 Value': variant.option3 || '',
//           'Variant SKU': variant.sku || '',
//           'Variant Grams': variant.grams || 0,
//           'Variant Inventory Tracker':
//             variant.inventory_management || 'shopify',
//           'Variant Inventory Qty': variant.inventory_quantity || 0,
//           'Variant Inventory Policy': variant.inventory_policy || 'deny',
//           'Variant Fulfillment Service':
//             variant.fulfillment_service || 'manual',
//           'Variant Price': variant.price || '',
//           'Variant Compare At Price': variant.compare_at_price || '',
//           'Variant Requires Shipping': variant.requires_shipping
//             ? 'TRUE'
//             : 'FALSE',
//           'Variant Taxable': variant.taxable ? 'TRUE' : 'FALSE',
//           'Variant Barcode': variant.barcode || '',
//           'Image Src': product.image?.src || '',
//           'Image Position': index + 1,
//           'Image Alt Text': '',
//           'Gift Card': 'FALSE',
//           'SEO Title': '',
//           'SEO Description': '',
//           'Google Shopping / Google Product Category': '',
//           'Google Shopping / Gender': '',
//           'Google Shopping / Age Group': '',
//           'Google Shopping / MPN': '',
//           'Google Shopping / Condition': '',
//           'Google Shopping / Custom Product': '',
//           'Google Shopping / Custom Label 0': '',
//           'Google Shopping / Custom Label 1': '',
//           'Google Shopping / Custom Label 2': '',
//           'Google Shopping / Custom Label 3': '',
//           'Google Shopping / Custom Label 4': '',
//           'Variant Image': variant.image_id
//             ? product.images.find((img) => img.id === variant.image_id)?.src
//             : '',
//           'Variant Weight Unit': variant.weight_unit || 'kg',
//           'Variant Tax Code': '',
//           'Cost per item': '',
//           Status: product.status || 'active',
//         });
//       });
//     }

//     if (rows.length === 0) {
//       return res
//         .status(404)
//         .json({ message: 'No Shopify product data found.' });
//     }

//     const fields = Object.keys(rows[0]);
//     const parser = new Parser({ fields });
//     const csv = parser.parse(rows);

//     const filename = `shopify-products-${type}-${Date.now()}.csv`;
//     const isVercel = process.env.VERCEL === '1';
//     const exportDir = isVercel ? '/tmp' : path.join(process.cwd(), 'exports');

//     if (!isVercel && !fs.existsSync(exportDir)) {
//       fs.mkdirSync(exportDir, { recursive: true });
//     }

//     const filePath = path.join(exportDir, filename);
//     fs.writeFileSync(filePath, csv);

//     res.download(filePath, filename, (err) => {
//       if (err) {
//         console.error('Download error:', err);
//         res.status(500).send('Error downloading file');
//       }
//       fs.unlinkSync(filePath);
//     });
//   } catch (error) {
//     console.error('Export Error:', error);
//     res.status(500).json({ message: 'Server error during export.' });
//   }
// };

export const exportProducts = async (req, res) => {
  try {
    const { userId, type, page = 1, limit = 10, productIds } = req.query;

    if (!userId || !type) {
      return res.status(400).json({ message: "Missing required query parameters." });
    }

    let query = {};

    if (type === "selected") {
      if (!productIds) {
        return res
          .status(400)
          .json({ message: "Product IDs required for selected export." });
      }
      const productIdsArray = productIds.split(",");
      query._id = { $in: productIdsArray };
    } else {
      query.userId = userId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products =
      type === "current"
        ? await listingModel.find(query).skip(skip).limit(parseInt(limit))
        : await listingModel.find(query);

    if (!products.length) {
      return res.status(404).json({ message: "No products found." });
    }

    const config = await shopifyConfigurationModel.findOne();
    if (!config) {
      return res.status(400).json({ message: "Shopify config not found." });
    }

    const { shopifyStoreUrl, shopifyAccessToken, shopifyApiKey } = config;
    const rows = [];
    const allMetafieldsSet = new Set();

    for (const dbProduct of products) {
      const productId = dbProduct.id;
      if (!productId) continue;

      try {
        const metafieldsRes = await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
          "GET",
          null,
          shopifyApiKey,
          shopifyAccessToken
        );

        const metafields = metafieldsRes?.metafields || [];
        metafields.forEach((mf) => {
          const header = `${mf.key} (product.metafields.${mf.namespace}.${mf.key})`;
          allMetafieldsSet.add(header);
        });
      } catch (err) {
        console.error(`Error fetching metafields for ${productId}:`, err.message);
      }
    }

    for (const dbProduct of products) {
      const shopifyProductId = dbProduct.id;
      if (!shopifyProductId) continue;

      const productUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyProductId}.json`;
      const productResponse = await shopifyRequest(
        productUrl,
        "GET",
        null,
        shopifyApiKey,
        shopifyAccessToken
      );

      const product = productResponse?.product;
      if (!product) continue;

      const metafieldsResponse = await shopifyRequest(
        `${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyProductId}/metafields.json`,
        "GET",
        null,
        shopifyApiKey,
        shopifyAccessToken
      );
      const metafields = metafieldsResponse?.metafields || [];

      const metafieldMap = {};
      metafields.forEach((mf) => {
        const header = `${mf.key} (product.metafields.${mf.namespace}.${mf.key})`;
        metafieldMap[header] = mf.value;
      });

      const productImages = product.images || [];
      const variantImages = dbProduct.variantImages || [];

      product.variants.forEach((variant, index) => {
        const variantImgList = variantImages
          .filter((img) => img.variantSku === variant.sku)
          .map((img) => img.src);

        const row = {
          Handle: product.handle || "",
          Title: index === 0 ? product.title : "",
          "Body (HTML)": index === 0 ? product.body_html || "" : "",
          Vendor: index === 0 ? product.vendor || "" : "",
          "Product Category": dbProduct.categories?.join(", ") || "",
          Type: index === 0 ? product.product_type || "" : "",
          Tags: index === 0 ? (product.tags || "").toString() : "",
          Published:
            index === 0 ? (product.published_at ? "TRUE" : "FALSE") : "",
          "Option1 Name": product.options?.[0]?.name || "",
          "Option1 Value": variant.option1 || "",
          "Option2 Name": product.options?.[1]?.name || "",
          "Option2 Value": variant.option2 || "",
          "Option3 Name": product.options?.[2]?.name || "",
          "Option3 Value": variant.option3 || "",
          "Variant SKU": variant.sku || "",
          "Variant Price": variant.price || "",
          "Variant Compare At Price": variant.compare_at_price || "",
          "Variant Inventory Tracker": variant.inventory_management || "shopify",
          "Variant Inventory Qty": variant.inventory_quantity || 0,
          "Variant Inventory Policy": variant.inventory_policy || "deny",
          "Variant Fulfillment Service": variant.fulfillment_service || "manual",
          "Variant Requires Shipping": variant.requires_shipping ? "TRUE" : "FALSE",
          "Variant Taxable": variant.taxable ? "TRUE" : "FALSE",
          "Variant Barcode": variant.barcode || "",
          "Variant Grams": variant.grams || 0,
          "Variant Weight Unit": variant.weight_unit || "g",
          "Image Src": product.image?.src || "",
          "Image Alt Text": product.image?.alt || "",
          "Variant Image Src 1": variantImgList[0] || "",
          "Variant Image Src 2": variantImgList[1] || "",
          "Variant Image Src 3": variantImgList[2] || "",
          "Variant Image Alt": variant.title || "",
          "Variant Image Position": index + 1,
          Status: product.status || "active",
        };

        allMetafieldsSet.forEach((header) => {
          row[header] = metafieldMap[header] || "";
        });

        rows.push(row);
      });
    }

    if (!rows.length) {
      return res.status(404).json({ message: "No Shopify product data found." });
    }

    const baseColumns = [
      "Handle",
      "Title",
      "Body (HTML)",
      "Vendor",
      "Type",
      "Product Category",
      "Tags",
      "Published",
      "Option1 Name",
      "Option1 Value",
      "Option2 Name",
      "Option2 Value",
      "Option3 Name",
      "Option3 Value",
      "Variant SKU",
      "Variant Price",
      "Variant Compare At Price",
      "Variant Inventory Tracker",
      "Variant Inventory Qty",
      "Variant Inventory Policy",
      "Variant Fulfillment Service",
      "Variant Requires Shipping",
      "Variant Taxable",
      "Variant Barcode",
      "Variant Grams",
      "Variant Weight Unit",
      "Image Src",
      "Image Alt Text",
      "Variant Image Src 1",
      "Variant Image Src 2",
      "Variant Image Src 3",
      "Variant Image Alt",
      "Variant Image Position",
      ...Array.from(allMetafieldsSet), 
      "Status",
    ];

    const parser = new Parser({ fields: baseColumns });
    const csv = parser.parse(rows);

    const filename = `shopify-products-${type}-${Date.now()}.csv`;
    const isVercel = process.env.VERCEL === "1";
    const exportDir = isVercel ? "/tmp" : path.join(process.cwd(), "exports");

    if (!isVercel && !fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, filename);
    fs.writeFileSync(filePath, csv);

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).send("Error downloading file");
      }
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Server error during export." });
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
      return res.status(400).json({ error: "userId is required." });
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
          productId: "$_id",
        },
      },
      {
        $unwind: "$variants",
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$variants",
              {
                productId: "$productId",
                productTitle: "$title",
                productCreatedAt: "$created_at",
                status: "$status",
                shopifyId: "$shopifyId",
                productImages: "$images",
                variantImages: "$variantImages",
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
      { $project: { variantsCount: { $size: "$variants" } } },
      {
        $group: { _id: null, totalVariants: { $sum: "$variantsCount" } },
      },
    ]);

    const totalVariants = productCount[0]?.totalVariants || 0;

    if (products.length === 0) {
      return res
        .status(404)
        .json({ message: "No variants found for this user." });
    }

    const normalizeString = (str) =>
      String(str || "")
        .replace(/['"]/g, "")
        .trim()
        .toLowerCase();

    products = products.map((variant) => {
      let matchedImage = null;
      const titleKey = normalizeString(variant.title);

      if (variant.image_id) {
        matchedImage =
          variant.variantImages?.find(
            (img) => String(img.id) === String(variant.image_id)
          ) ||
          variant.productImages?.find(
            (img) => String(img.id) === String(variant.image_id)
          );
      }

      if (!matchedImage && variant.variantImages?.length > 0) {
        matchedImage = variant.variantImages.find((img) =>
          normalizeString(img.alt).includes(titleKey)
        );
      }


      return {
        ...variant,
        finalImage: matchedImage
          ? {
              src: matchedImage.src,
              alt: matchedImage.alt || variant.title || "Variant Image",
            }
          : null, 
      };
    });

    res.status(200).json({
      variants: products,
      currentPage: page,
      totalPages: Math.ceil(totalVariants / limit),
      totalVariants,
    });
  } catch (error) {
    console.error("Error in getAllVariants function:", error);
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
          productId: "$_id",
        },
      },
      { $unwind: "$variants" },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$variants",
              {
                productId: "$productId",
                productTitle: "$title",
                productCreatedAt: "$created_at",
                status: "$status",
                shopifyId: "$shopifyId",
                productImages: "$images",
                variantImages: "$variantImages",
                userId: "$userId",
              },
            ],
          },
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);

    const productCount = await listingModel.aggregate([
      { $project: { variantsCount: { $size: "$variants" } } },
      { $group: { _id: null, totalVariants: { $sum: "$variantsCount" } } },
    ]);

    const totalVariants = productCount[0]?.totalVariants || 0;

    if (products.length === 0) {
      return res.status(404).json({ message: "No variants found." });
    }

    const normalizeString = (str) =>
      String(str || "")
        .replace(/['"]/g, "")
        .trim()
        .toLowerCase();

    products = products.map((variant) => {
      let matchedImage = null;
      const titleKey = normalizeString(variant.title);

      if (variant.image_id) {
        matchedImage =
          variant.variantImages?.find(
            (img) => String(img.id) === String(variant.image_id)
          ) ||
          variant.productImages?.find(
            (img) => String(img.id) === String(variant.image_id)
          );
      }

      if (!matchedImage && variant.variantImages?.length > 0) {
        matchedImage = variant.variantImages.find((img) =>
          normalizeString(img.alt).includes(titleKey)
        );
      }


      return {
        ...variant,
        finalImage: matchedImage
          ? {
              src: matchedImage.src,
              alt: matchedImage.alt || variant.title || "Variant Image",
            }
          : null, 
      };
    });

    res.status(200).json({
      variants: products,
      currentPage: page,
      totalPages: Math.ceil(totalVariants / limit),
      totalVariants,
    });
  } catch (error) {
    console.error("Error in getAllVariantsForAdmin function:", error);
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

          const images = [
            ...new Set(
              rows.map((r) => cleanUrl(r['Image Src'])).filter(Boolean)
            ),
          ].map((src, index) => ({
            src,
            position: index + 1,
            alt:
              rows.find((r) => cleanUrl(r['Image Src']) === src)?.[
                'Image Alt Text'
              ] || null,
          }));

          const payload = {
            product: {
              title: mainRow['Title'],
              handle: handle, // ✅ Correct place
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
            const uploadedVariantImages = [];

            await Promise.all(
  variants.map(async (variant) => {
    try {
      // collect all image URLs for this variant (e.g., Variant Image 1, 2, 3)
      const variantImageUrls = Object.keys(mainRow)
        .filter((key) =>
          key.toLowerCase().startsWith('variant image')
        )
        .map((key) => cleanUrl(variant[key] || mainRow[key]))
        .filter(Boolean);

      if (variant.variant_image) {
        variantImageUrls.push(cleanUrl(variant.variant_image));
      }

      // remove duplicates
      const uniqueVariantImages = [...new Set(variantImageUrls)];

      if (uniqueVariantImages.length === 0) return;

      // Create alt text from SKU + variant options
      const optionValues = Object.keys(variant)
        .filter(
          (key) =>
            key.toLowerCase().startsWith('option') && variant[key]
        )
        .map((key) => variant[key]);

      const variantAltBase = [variant.sku, ...optionValues]
        .filter(Boolean)
        .join(' - ');

      // Upload all variant images
      for (let i = 0; i < uniqueVariantImages.length; i++) {
        const imgUrl = uniqueVariantImages[i];
        const imageUploadPayload = {
          image: {
            src: imgUrl,
            alt:
              uniqueVariantImages.length > 1
                ? `${variantAltBase} (Image ${i + 1})`
                : variantAltBase,
          },
        };

        const uploadResponse = await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/images.json`,
          'POST',
          imageUploadPayload,
          shopifyApiKey,
          shopifyAccessToken
        );

        if (uploadResponse?.image) {
          const img = uploadResponse.image;
          uploadedVariantImages.push({
            id: img.id?.toString() || '',
            alt: img.alt || '',
            position: img.position || 0,
            product_id: img.product_id?.toString() || '',
            created_at: img.created_at || '',
            updated_at: img.updated_at || '',
            width: img.width || 0,
            height: img.height || 0,
            src: img.src || '',
            variantSku: variant.sku || '',
          });
        }
      }
    } catch (uploadError) {
      console.error(`Image upload error for SKU ${variant.sku}: ${uploadError.message}`);
    }
  })
);


            const productDetails = await shopifyRequest(
              `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
              'GET',
              null,
              shopifyApiKey,
              shopifyAccessToken
            );
            const shopifyVariants = productDetails?.product?.variants || [];

            await Promise.all(
              shopifyVariants.map(async (variant, i) => {
                if (uploadedVariantImages[i]) {
                  await shopifyRequest(
                    `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
                    'PUT',
                    {
                      variant: {
                        id: variant.id,
                        image_id: uploadedVariantImages[i].image_id,
                      },
                    },
                    shopifyApiKey,
                    shopifyAccessToken
                  );
                }
              })
            );

            if (
              mainRow.metafield_namespace &&
              mainRow.metafield_key &&
              mainRow.metafield_value &&
              mainRow.metafield_type
            ) {
              const metafieldPayload = {
                metafield: {
                  namespace: mainRow.metafield_namespace,
                  key: mainRow.metafield_key,
                  value: mainRow.metafield_value,
                  type: mainRow.metafield_type,
                },
              };

              await shopifyRequest(
                `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`,
                'POST',
                metafieldPayload,
                shopifyApiKey,
                shopifyAccessToken
              );
            }

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

        return res
          .status(200)
          .json({ message: '✅ Upload completed', results });
      });
  } catch (error) {
    console.error('🔥 API Error:', error.message);
    return res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
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
