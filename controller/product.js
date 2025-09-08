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
import { approvalModel } from "../Models/ApprovalSetting.js";


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
//     const userId=req.userId
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
//     const productStatus = status === 'publish' ? 'active' : 'draft';

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
    const userId=req.userId
     const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
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
    } = req.body;
   let productStatus = status === "publish" || status === "active" ? "active" : "draft";
let approvalStatus = "approved";

if (user.role === "Merchant") {
  const approvalSetting = await approvalModel.findOne();

  if (approvalSetting?.approvalMode === "Manual") {
    productStatus = "draft";      
    approvalStatus = "pending";   
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
      throw new Error('Shopify product creation failed.');
    productId = productResponse.product.id;
    const metafieldsPayload = [
      {
        namespace: 'Aydi',
        key: 'Aydi_Information',
        value: title || 'Not specified',
        type: 'single_line_text_field',
      },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/metafields.json`;

      const metafieldResponse = await shopifyRequest(
        metafieldsUrl,
        'POST',
        { metafield },
        shopifyApiKey,
        shopifyAccessToken
      );

      if (metafieldResponse?.metafield) {
      } else {
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


// export const duplicateProduct = async (req, res) => {
//   let newProductId;
//   try {
//     const userId = req.userId;
//     const user = await authModel.findById(userId);
//     if (!user) return res.status(404).json({ error: "User not found" });

//     const { productId } = req.params;

//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfiguration)
//       return res
//         .status(404)
//         .json({ error: "Shopify configuration not found." });

//     const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
//       shopifyConfiguration;

//     // Find existing product in DB
//     const existingProduct = await listingModel.findOne({ shopifyId: productId });
//     if (!existingProduct) {
//       return res.status(404).json({ error: "Product not found in database." });
//     }

//     // Duplicate title + handle
//     const duplicateTitle = `Copy of ${existingProduct.title}`;
//     const duplicateHandle = `copy-of-${existingProduct.title
//       .toLowerCase()
//       .replace(/\s+/g, "-")}`;

//     // ✅ Clean variants
//     const shopifyVariants = existingProduct.variants.map((variant, idx) => ({
//       option1: variant.option1 || "Default",
//       option2: variant.option2 || null,
//       option3: variant.option3 || null,
//       price: variant.price || "0.00",
//       compare_at_price: variant.compare_at_price || null,
//       sku: variant.sku ? `${variant.sku}-copy-${idx + 1}` : null,
//       inventory_management: variant.inventory_management || null,
//       inventory_quantity: 0, // new duplicate = no stock
//       weight: variant.weight || 0.0,
//       weight_unit: variant.weight_unit || "kg",
//     }));

//     // ✅ Images prepare karo
//     const shopifyImages =
//       existingProduct.images?.map((img) => ({
//         src: img.src || img.cloudUrl || img.localUrl,
//       })) || [];

//     // ✅ Build payload for Shopify
//     const shopifyPayload = {
//       product: {
//         title: duplicateTitle,
//         body_html: existingProduct.body_html || "",
//         vendor: existingProduct.vendor,
//         product_type: existingProduct.product_type,
//         status: "draft",
//         options:
//           existingProduct.options && existingProduct.options.length > 0
//             ? existingProduct.options
//             : [{ name: "Title", values: ["Default"] }],
//         variants:
//           shopifyVariants.length > 0
//             ? shopifyVariants
//             : [
//                 {
//                   option1: "Default",
//                   price: existingProduct.variants?.[0]?.price || "0.00",
//                   inventory_quantity: 0,
//                 },
//               ],
//         images: shopifyImages,
//         tags: [
//           ...(Array.isArray(existingProduct.tags)
//             ? existingProduct.tags
//             : [existingProduct.tags]),
//           `copy_of_${productId}`,
//         ],
//         handle: duplicateHandle,
//       },
//     };

//     // ✅ Create on Shopify
//     const productResponse = await shopifyRequest(
//       `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
//       "POST",
//       shopifyPayload,
//       shopifyApiKey,
//       shopifyAccessToken
//     );

//     if (!productResponse?.product?.id) {
//       throw new Error("Failed to duplicate product in Shopify.");
//     }

//     newProductId = productResponse.product.id;

//     // ✅ Save duplicate in DB (including images)
//     const duplicateProduct = new listingModel({
//       id: newProductId,
//       title: duplicateTitle,
//       body_html: existingProduct.body_html,
//       vendor: existingProduct.vendor,
//       approvalStatus: "approved",
//       product_type: existingProduct.product_type,
//       options: shopifyPayload.product.options,
//       created_at: new Date(),
//       tags: productResponse.product.tags,
//       variants: productResponse.product.variants,
//       images: productResponse.product.images || [], // ✅ images bhi save
//       inventory: {
//         track_quantity: false,
//         quantity: 0,
//         continue_selling: false,
//         has_sku: existingProduct.inventory?.has_sku || false,
//         sku: existingProduct.inventory?.sku || "",
//         barcode: existingProduct.inventory?.barcode || "",
//       },
//       shipping: existingProduct.shipping,
//       userId,
//       status: "draft",
//       shopifyId: newProductId,
//       categories: existingProduct.categories,
//     });

//     await duplicateProduct.save();

//     return res.status(201).json({
//       message: "Product duplicated successfully.",
//       product: duplicateProduct,
//     });
//   } catch (error) {
//     console.error("Error duplicating product:", error);

//     if (newProductId) {
//       try {
//         await shopifyRequest(
//           `${shopifyStoreUrl}/admin/api/2024-01/products/${newProductId}.json`,
//           "DELETE",
//           null,
//           shopifyApiKey,
//           shopifyAccessToken
//         );
//       } catch (deleteError) {
//         console.error("Error rolling back duplicate product:", deleteError);
//       }
//     }

//     res.status(500).json({ error: error.message });
//   }
// };


export const duplicateProduct = async (req, res) => {
  let newProductId;
  try {
    const userId = req.userId;
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { productId } = req.params;

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration)
      return res
        .status(404)
        .json({ error: "Shopify configuration not found." });

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    // Find existing product in DB
    const existingProduct = await listingModel.findOne({ shopifyId: productId });
    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found in database." });
    }

    // Duplicate title + handle
    const duplicateTitle = `Copy of ${existingProduct.title}`;
    const duplicateHandle = `copy-of-${existingProduct.title
      .toLowerCase()
      .replace(/\s+/g, "-")}`;

    // ✅ Prepare images
    const shopifyImages =
      existingProduct.images?.map((img) => ({
        src: img.src || img.cloudUrl || img.localUrl,
        alt: img.alt || "",
      })) || [];

    // ✅ Build initial payload (without image_id in variants)
   // ✅ Build Shopify payload
const shopifyPayload = {
  product: {
    title: duplicateTitle,
    body_html: existingProduct.body_html || "",
    vendor: existingProduct.vendor,
    product_type: existingProduct.product_type,
    status: "draft",
    options:
      existingProduct.options && existingProduct.options.length > 0
        ? existingProduct.options
        : [{ name: "Title", values: ["Default"] }],
    variants: existingProduct.variants.map((variant, idx) => ({
      option1: variant.option1 || "Default",
      option2: variant.option2 || null,
      option3: variant.option3 || null,
      price: variant.price || "0.00",
      compare_at_price: variant.compare_at_price || null,
      sku: variant.sku ? `${variant.sku}-copy-${idx + 1}` : null,
      inventory_management: variant.inventory_management || null,
      inventory_quantity: 0,
      weight: variant.weight || 0.0,
      weight_unit: variant.weight_unit || "kg",
      // 👇 NOTE: abhi image_id empty rakho, Shopify khud assign karega
    })),
    images:
      existingProduct.images?.map((img) => ({
        src: img.src || img.cloudUrl || img.localUrl,
      })) || [],
    tags: [
      ...(Array.isArray(existingProduct.tags)
        ? existingProduct.tags
        : [existingProduct.tags]),
      `copy_of_${productId}`,
    ],
    handle: duplicateHandle,
  },
};


    // ✅ Create product on Shopify (images upload + product shell)
    const productResponse = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
      "POST",
      shopifyPayload,
      shopifyApiKey,
      shopifyAccessToken
    );

    if (!productResponse?.product?.id) {
      throw new Error("Failed to duplicate product in Shopify.");
    }

    newProductId = productResponse.product.id;

    // ✅ Map new image IDs from Shopify response
    const newImages = productResponse.product.images; // Shopify ne nayi ids di hain
    const imageMap = {};
    (existingProduct.images || []).forEach((oldImg, idx) => {
      if (newImages[idx]) {
        imageMap[oldImg.src] = newImages[idx].id; // map old src → new id
      }
    });

    // ✅ Prepare variants with correct image_id mapping
    const shopifyVariants = existingProduct.variants.map((variant, idx) => {
      let imageId = null;
      if (variant.image_id && existingProduct.images) {
        const oldImage = existingProduct.images.find(
          (img) => String(img.id) === String(variant.image_id)
        );
        if (oldImage && imageMap[oldImage.src]) {
          imageId = imageMap[oldImage.src];
        }
      }

      return {
        option1: variant.option1 || "Default",
        option2: variant.option2 || null,
        option3: variant.option3 || null,
        price: variant.price || "0.00",
        compare_at_price: variant.compare_at_price || null,
        sku: variant.sku ? `${variant.sku}-copy-${idx + 1}` : null,
        inventory_management: variant.inventory_management || null,
        inventory_quantity: 0,
        weight: variant.weight || 0.0,
        weight_unit: variant.weight_unit || "kg",
        image_id: imageId, // ✅ link new image id
      };
    });

    // ✅ Update product variants with correct images
    const variantUpdateResponse = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products/${newProductId}.json`,
      "PUT",
      { product: { id: newProductId, variants: shopifyVariants } },
      shopifyApiKey,
      shopifyAccessToken
    );

    // ✅ Save duplicate in DB
    const duplicateProduct = new listingModel({
      id: newProductId,
      title: duplicateTitle,
      body_html: existingProduct.body_html,
      vendor: existingProduct.vendor,
      approvalStatus: "approved",
      product_type: existingProduct.product_type,
      options: shopifyPayload.product.options,
      created_at: new Date(),
      tags: productResponse.product.tags,
      variants: variantUpdateResponse.product.variants,
      images: newImages, // ✅ new images with new IDs
      inventory: {
        track_quantity: false,
        quantity: 0,
        continue_selling: false,
        has_sku: existingProduct.inventory?.has_sku || false,
        sku: existingProduct.inventory?.sku || "",
        barcode: existingProduct.inventory?.barcode || "",
      },
      shipping: existingProduct.shipping,
      userId,
      status: "draft",
      shopifyId: newProductId,
      categories: existingProduct.categories,
    });

    await duplicateProduct.save();

    return res.status(201).json({
      message: "Product duplicated successfully with images.",
      product: duplicateProduct,
    });
  } catch (error) {
    console.error("Error duplicating product:", error);

    if (newProductId) {
      try {
        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${newProductId}.json`,
          "DELETE",
          null,
          shopifyApiKey,
          shopifyAccessToken
        );
      } catch (deleteError) {
        console.error("Error rolling back duplicate product:", deleteError);
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
          approvalStatus:1,
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

// export const updateProductData = async (req, res) => {
//   const { id } = req.params;

//   try {
//     if (!id)
//       return res
//         .status(400)
//         .json({ error: 'Product ID is required for updating.' });
// const userId=req.userId
//     const {
//       title,
//       description,
//       price,
//       compare_at_price,
//       track_quantity,
//       quantity,
//       continue_selling,
//       has_sku,
//       sku,
//       barcode,
//       track_shipping,
//       weight,
//       weight_unit,
//       status,
//       productType,
//       vendor,
//       keyWord,
//       options,
//       variantPrices,
//       variantCompareAtPrices,
//       variantQuantities,
//       variantSku,
//       categories,
//     } = req.body;

//     const productStatus = status === 'publish' ? 'active' : 'draft';

//     const parsedOptions =
//       typeof options === 'string' ? JSON.parse(options) : options;

//     const shopifyOptions = parsedOptions.map((option) => ({
//       name: option.name,
//       values: option.values,
//     }));

//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfiguration)
//       return res.status(404).json({ error: 'Shopify config not found.' });

//     const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
//       shopifyConfiguration;

//     const product = await listingModel.findById(id);
//     if (!product)
//       return res.status(404).json({ error: 'Product not found in DB.' });

//     const shopifyProductId = product.id;
//     if (!shopifyProductId)
//       return res
//         .status(400)
//         .json({ error: 'Shopify Product ID not stored in DB.' });

//     const productUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyProductId}.json`;

//     const existingProduct = await shopifyRequest(
//       productUrl,
//       'GET',
//       null,
//       shopifyApiKey,
//       shopifyAccessToken
//     );
//     if (!existingProduct?.product)
//       return res.status(404).json({ error: 'Product not found on Shopify.' });

//     const variantCombinations = generateVariantCombinations(parsedOptions);
//     const dbVariants = product.variants || [];

//     const findMatchingVariantId = (variant) => {
//       return dbVariants.find(
//         (dbVariant) =>
//           dbVariant.option1 === variant[parsedOptions[0]?.name] &&
//           dbVariant.option2 ===
//             (parsedOptions[1] ? variant[parsedOptions[1]?.name] : null) &&
//           dbVariant.option3 ===
//             (parsedOptions[2] ? variant[parsedOptions[2]?.name] : null)
//       )?.id;
//     };
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

//     const shopifyVariants = variantCombinations.map((variant, index) => {
//       const variantPrice = formatPrice(variantPrices?.[index] || price);
//       const variantCompareAtPrice = formatCompareAtPrice(
//         variantCompareAtPrices?.[index] || compare_at_price
//       );
//       const variantQuantity =
//         track_quantity && !isNaN(parseInt(variantQuantities?.[index]))
//           ? parseInt(variantQuantities?.[index])
//           : 0;
//       const variantSKU = has_sku
//         ? variantSku?.[index] || `${sku}-${index + 1}`
//         : null;

//       return {
//         option1: variant[parsedOptions[0]?.name] || null,
//         option2: parsedOptions[1] ? variant[parsedOptions[1]?.name] : null,
//         option3: parsedOptions[2] ? variant[parsedOptions[2]?.name] : null,
//         price: variantPrice,
//         compare_at_price: variantCompareAtPrice,
//         inventory_management: track_quantity ? 'shopify' : null,
//         inventory_quantity: variantQuantity,
//         sku: variantSKU,
//         barcode: has_sku ? `${barcode}-${index + 1}` : null,
//         weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
//         weight_unit: track_shipping ? weight_unit : null,
//       };
//     });

//     const shopifyPayload = {
//       product: {
//         title,
//         body_html: description || '',
//         vendor,
//         product_type: productType,
//         status: productStatus,
//         options: shopifyOptions,
//         variants: shopifyVariants,
//         tags: keyWord ? keyWord.split(',') : [],
//       },
//     };

//     const updatePayload = {
//       product: {
//         title,
//         body_html: description,
//         vendor,
//         product_type: productType,
//         status: productStatus,
//         options: shopifyOptions,
//         variants: shopifyVariants,
//         tags: [
//           `user_${userId}`,
//           `vendor_${vendor}`,
//           ...(keyWord ? keyWord.split(',') : []),
//         ],
//       },
//     };

//     const updateResponse = await shopifyRequest(
//       productUrl,
//       'PUT',
//       updatePayload,
//       shopifyApiKey,
//       shopifyAccessToken
//     );
//     if (!updateResponse?.product?.id)
//       return res.status(500).json({ error: 'Shopify product update failed.' });

 
//     const existing = await listingModel.findById(id);

//     if (!existing) {
//       return res.status(404).json({ message: 'Product not found' });
//     }

//     const updatedFields = {
//       title: title || existing.title,
//       body_html: description || existing.body_html,
//       vendor: vendor || existing.vendor,
//       product_type: productType || existing.product_type,
//       updated_at: new Date(),
//       tags: updateResponse?.product?.tags || existing.tags,
//       variants: updateResponse?.product?.variants || existing.variants,
//       options: shopifyOptions || existing.options,
//       userId: userId || existing.userId,
//       status: productStatus || existing.status,
//       categories: Array.isArray(categories)
//         ? categories
//         : existing.categories || [],

//       inventory: {
//         track_quantity: !!track_quantity ?? existing.inventory?.track_quantity,
//         quantity:
//           !isNaN(parseInt(quantity)) && parseInt(quantity) !== null
//             ? parseInt(quantity)
//             : existing.inventory?.quantity || 0,
//         continue_selling:
//           typeof continue_selling === 'boolean'
//             ? continue_selling
//             : existing.inventory?.continue_selling || false,
//         has_sku:
//           typeof has_sku === 'boolean' ? has_sku : existing.inventory?.has_sku,
//         sku: sku ?? existing.inventory?.sku,
//         barcode: barcode ?? existing.inventory?.barcode,
//       },

//       shipping: {
//         track_shipping:
//           typeof track_shipping === 'boolean'
//             ? track_shipping
//             : existing.shipping?.track_shipping || false,
//         weight:
//           track_shipping && !isNaN(parseFloat(weight))
//             ? parseFloat(weight)
//             : existing.shipping?.weight || 0,
//         weight_unit:
//           track_shipping && weight_unit
//             ? weight_unit
//             : existing.shipping?.weight_unit || 'kg',
//       },
//     };

//     const updatedInDb = await listingModel.findByIdAndUpdate(
//       id,
//       updatedFields,
//       {
//         new: true,
//       }
//     );

//     return res.status(200).json({
//       message: 'Product and images updated successfully!',
//       product: updatedInDb,
//     });
//   } catch (error) {
//     console.error('updateProductData error:', error);
//     return res.status(500).json({ error: error.message });
//   }
// };

export const updateProductData = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id) {
      console.log("❌ Product ID missing in request params");
      return res.status(400).json({ error: "Product ID is required for updating." });
    }

    const userId = req.userId;
    console.log("🔹 Incoming update request for productId:", id, "by user:", userId);
    console.log("🔹 Request body:", req.body);

    const {
      title,
      description,
      price,
      compare_at_price,
      track_quantity,
      quantity,
      continue_selling,
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
      variantQuantites,   // 👈 spelling from frontend
      variantQuantities,  // 👈 in case spelled correctly
      variantSku,
      categories,
    } = req.body;

    // fallback handle
    const variantQtyArray = variantQuantites || variantQuantities || [];

    const productStatus = status === "publish" ? "active" : "draft";
    const parsedOptions = typeof options === "string" ? JSON.parse(options) : options || [];
    console.log("🔹 Parsed Options:", parsedOptions);

    const shopifyOptions = parsedOptions.map((option) => ({
      name: option.name,
      values: option.values,
    }));

    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      console.log("❌ Shopify configuration not found");
      return res.status(404).json({ error: "Shopify config not found." });
    }
    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

    const product = await listingModel.findById(id);
    if (!product) {
      console.log("❌ Product not found in DB for ID:", id);
      return res.status(404).json({ error: "Product not found in DB." });
    }

    const shopifyProductId = product.id;
    if (!shopifyProductId) {
      console.log("❌ No Shopify Product ID found in DB");
      return res.status(400).json({ error: "Shopify Product ID not stored in DB." });
    }

    const productUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyProductId}.json`;
    console.log("🔹 Fetching Shopify product:", productUrl);

    const existingProduct = await shopifyRequest(productUrl, "GET", null, shopifyApiKey, shopifyAccessToken);
    if (!existingProduct?.product) {
      console.log("❌ Product not found on Shopify for ID:", shopifyProductId);
      return res.status(404).json({ error: "Product not found on Shopify." });
    }

    // ✅ Variant payload build
    const variantCombinations = generateVariantCombinations(parsedOptions);
    console.log("🔹 Variant combinations generated:", variantCombinations);

    const formatPrice = (v) => (v ? parseFloat(v).toFixed(2) : "0.00");
    const formatCompareAtPrice = (v) => (v ? parseFloat(v).toFixed(2) : "0.00");

    const shopifyVariants = variantCombinations.map((variant, index) => {
      const variantPrice = formatPrice(variantPrices?.[index] || price);
      const variantCompareAtPrice = formatCompareAtPrice(variantCompareAtPrices?.[index] || compare_at_price);
      const variantSKU = has_sku ? variantSku?.[index] || `${sku}-${index + 1}` : null;

      return {
        option1: variant[parsedOptions[0]?.name] || null,
        option2: parsedOptions[1] ? variant[parsedOptions[1]?.name] : null,
        option3: parsedOptions[2] ? variant[parsedOptions[2]?.name] : null,
        price: variantPrice,
        compare_at_price: variantCompareAtPrice,
        inventory_management: track_quantity ? "shopify" : null,
        fulfillment_service: "manual",
        sku: variantSKU,
        barcode: has_sku ? `${barcode}-${index + 1}` : null,
        weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
        weight_unit: track_shipping ? weight_unit : null,
      };
    });
    console.log("🔹 Prepared Shopify Variants:", shopifyVariants);

    // ✅ Update product on Shopify
    const updatePayload = {
      product: {
        title,
        body_html: description,
        vendor,
        product_type: productType,
        status: productStatus,
        options: shopifyOptions,
        variants: shopifyVariants,
        tags: [`user_${userId}`, `vendor_${vendor}`, ...(keyWord ? keyWord.split(",") : [])],
      },
    };
    console.log("🔹 Sending update payload to Shopify:", JSON.stringify(updatePayload, null, 2));

    const updateResponse = await shopifyRequest(productUrl, "PUT", updatePayload, shopifyApiKey, shopifyAccessToken);
    if (!updateResponse?.product?.id) {
      console.log("❌ Shopify product update failed");
      return res.status(500).json({ error: "Shopify product update failed." });
    }
    console.log("✅ Shopify product updated successfully:", updateResponse.product.id);

    // ✅ Inventory update (same as updateInventoryQuantity API)
    if (Array.isArray(updateResponse.product.variants)) {
      for (let i = 0; i < updateResponse.product.variants.length; i++) {
        const variant = updateResponse.product.variants[i];
        const variantQuantity = track_quantity && !isNaN(parseInt(variantQtyArray?.[i]))
          ? parseInt(variantQtyArray[i])
          : 0;

        console.log(`🔹 Processing variant ${variant.id} for inventory update with qty: ${variantQuantity}`);

        // Step 1: Get variant details (to fetch inventory_item_id)
        const variantDetailsUrl = `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`;
        const variantResponse = await shopifyRequest(variantDetailsUrl, "GET", null, shopifyApiKey, shopifyAccessToken);
        const inventoryItemId = variantResponse?.variant?.inventory_item_id;

        if (!inventoryItemId) {
          console.log(`❌ Missing inventory_item_id for variant ${variant.id}`);
          continue;
        }

        // Step 2: Get inventory level info
        const inventoryLevelsUrl = `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${inventoryItemId}`;
        const inventoryLevelsRes = await shopifyRequest(inventoryLevelsUrl, "GET", null, shopifyApiKey, shopifyAccessToken);
        const currentInventoryLevel = inventoryLevelsRes?.inventory_levels?.[0];

        if (!currentInventoryLevel) {
          console.log(`❌ No inventory level found for variant ${variant.id}`);
          continue;
        }

        const locationId = currentInventoryLevel.location_id;

        // Step 3: Update inventory level on Shopify
        console.log(`🔹 Updating Shopify inventory: item ${inventoryItemId}, location ${locationId}, qty ${variantQuantity}`);
        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels/set.json`,
          "POST",
          { location_id: locationId, inventory_item_id: inventoryItemId, available: variantQuantity },
          shopifyApiKey,
          shopifyAccessToken
        );

        // Step 4: Update MongoDB variant atomically
        await listingModel.updateOne(
          { "variants.id": variant.id },
          {
            $set: {
              "variants.$.inventory_quantity": variantQuantity,
              "variants.$.inventory_item_id": inventoryItemId,
              "variants.$.location_id": locationId,
            },
          }
        );

        console.log(`✅ Inventory updated for variant ${variant.id}`);
      }
    }

    // ✅ Update product-level info in DB
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
      categories: Array.isArray(categories) ? categories : product.categories || [],
    };

    const updatedInDb = await listingModel.findByIdAndUpdate(id, updatedFields, { new: true });
    console.log("✅ Product updated in DB:", updatedInDb._id);

    return res.status(200).json({ message: "Product and inventory updated successfully!", product: updatedInDb });
  } catch (error) {
    console.error("❌ updateProductData error:", error?.response?.data || error.message);
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

// export const getAllProductData = async (req, res) => {
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 10;

//   try {
//     const matchStage = {
//       userId: { $exists: true, $ne: null },
//     };

//     const products = await listingModel.aggregate([
//       { $match: matchStage },
//       {
//   $addFields: {
//     userId: {
//       $cond: [
//         { $eq: [{ $type: '$userId' }, 'string'] },
//         { $convert: { input: '$userId', to: 'objectId', onError: null, onNull: null } },
//         '$userId'
//       ]
//     }
//   }
// },

//       {
//         $lookup: {
//           from: 'users',
//           localField: 'userId',
//           foreignField: '_id',
//           as: 'user',
//         },
//       },
//       {
//         $unwind: {
//           path: '$user',
//           preserveNullAndEmptyArrays: true,
//         },
//       },
//       { $sort: { created_at: -1 } },
//       { $skip: (page - 1) * limit },
//       { $limit: limit },
//       {
//         $project: {
//           _id: 1,
//           id: 1,
//           title: 1,
//           body_html: 1,
//           vendor: 1,
//           product_type: 1,
//           created_at: 1,
//           tags: 1,
//           variants: 1,
//           options: 1,
//           images: 1,
//           variantImages: 1,
//           inventory: 1,
//           shipping: 1,
//           status: 1,
//           userId: 1,
//           oldPrice: 1,
//           shopifyId: 1,
//           approvalStatus:1,
//           username: {
//             $concat: [
//               { $ifNull: ['$user.firstName', ''] },
//               ' ',
//               { $ifNull: ['$user.lastName', ''] },
//             ],
//           },
//           email: '$user.email',
//         },
//       },
//     ]);

//     const totalProducts = await listingModel.countDocuments(matchStage);

//     if (products.length > 0) {
//       res.status(200).send({
//         products,
//         currentPage: page,
//         totalPages: Math.ceil(totalProducts / limit),
//         totalProducts,
//       });
//     } else {
//       res.status(400).send('No products found');
//     }
//   } catch (error) {
//     console.error('Aggregation error:', error);
//     res.status(500).send({ error: error.message });
//   }
// };


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
              { $eq: [{ $type: "$userId" }, "string"] },
              {
                $convert: {
                  input: "$userId",
                  to: "objectId",
                  onError: null,
                  onNull: null,
                },
              },
              "$userId",
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
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
          username: {
            $concat: [
              { $ifNull: ["$user.firstName", ""] },
              " ",
              { $ifNull: ["$user.lastName", ""] },
            ],
          },
          email: "$user.email",
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
    console.error("Aggregation error:", error);
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

// export const fetchProductCount = async (req, res) => {
//   try {
//     const result = await listingModel.aggregate([
//       {
//         $group: {
//           _id: '$status',
//           count: { $sum: 1 },
//         },
//       },
//     ]);

//     let total = 0;
//     let active = 0;
//     let inactive = 0;

//     result.forEach((item) => {
//       total += item.count;
//       if (item._id === 'active') active = item.count;
//       if (item._id === 'draft') inactive = item.count;
//     });

//     const response = [
//       { status: 'Total', count: total },
//       { status: 'Active', count: active },
//       { status: 'Inactive', count: inactive },
//     ];

//     res.status(200).json(response);
//   } catch (error) {
//     console.error('❌ Error in fetchProductCount:', error);
//     res.status(500).json({ message: 'Failed to fetch product counts.' });
//   }
// };


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

// export const updateImages = async (req, res) => {
//   const { id } = req.params;
//   const imageUrls = req.body.images;
//   const variantImages = req.body.variantImages;

//   try {
//     const product = await listingModel.findOne({ id });
//     if (!product) return res.status(404).json({ error: 'Product not found.' });

//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfiguration) {
//       return res
//         .status(404)
//         .json({ error: 'Shopify configuration not found.' });
//     }

//     const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
//       shopifyConfiguration;

//     const imagesDataToPush = [];

//     for (let i = 0; i < imageUrls.length; i++) {
//       const imagePayload = {
//         image: {
//           src: imageUrls[i],
//           alt: `Image ${i + 1}`,
//           position: i + 1,
//         },
//       };

//       const imageUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`;

//       await shopifyRequest(
//         imageUrl,
//         'POST',
//         imagePayload,
//         shopifyApiKey,
//         shopifyAccessToken
//       );

//       const transformedUrl = transformCloudinaryToShopifyCdn(imageUrls[i]);
//       imagesDataToPush.push({
//         src: transformedUrl,
//         alt: `Image ${i + 1}`,
//         position: i + 1,
//       });
//     }

//     const uploadedVariantImages = [];
//     if (variantImages && variantImages.length > 0) {
//       for (let i = 0; i < variantImages.length; i++) {
//         const originalUrl = variantImages[i]?.url;

//         if (originalUrl) {
//           const payload = {
//             image: {
//               src: originalUrl,
//               alt: `Variant Image ${i + 1}`,
//             },
//           };

//           const uploadResponse = await shopifyRequest(
//             `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
//             'POST',
//             payload,
//             shopifyApiKey,
//             shopifyAccessToken
//           );

//           if (uploadResponse?.image) {
//             const transformedUrl = transformCloudinaryToShopifyCdn(originalUrl);
//             uploadedVariantImages.push({
//               ...uploadResponse.image,
//               src: transformedUrl,
//             });
//           }
//         }
//       }
//     }

//     const productResponse = await shopifyRequest(
//       `${shopifyStoreUrl}/admin/api/2024-01/products/${id}.json`,
//       'GET',
//       null,
//       shopifyApiKey,
//       shopifyAccessToken
//     );

//     const variantsFromShopify = productResponse?.product?.variants || [];
//     const updatedVariants = [];

//     for (let i = 0; i < variantsFromShopify.length; i++) {
//       const variant = variantsFromShopify[i];
//       const image = uploadedVariantImages[i];

//       if (variant && image) {
//         await shopifyRequest(
//           `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
//           'PUT',
//           {
//             variant: {
//               id: variant.id,
//               image_id: image.id,
//             },
//           },
//           shopifyApiKey,
//           shopifyAccessToken
//         );

//         updatedVariants.push({
//           ...variant,
//           image_id: image.id,
//         });
//       } else {
//         updatedVariants.push(variant);
//       }
//     }

//     const allCloudinaryUrls = [
//       ...imageUrls,
//       ...variantImages.map((img) => img?.url),
//     ].filter((url) => url?.includes('cloudinary.com'));
//     const productId = product.id;
//     if (allCloudinaryUrls.length > 0) {
//       await updateGalleryUrls(allCloudinaryUrls, productId);
//     }

//     const updatedProduct = await listingModel.findOneAndUpdate(
//       { id },
//       {
//         images: imagesDataToPush,
//         variantImages: uploadedVariantImages,
//         variants: updatedVariants,
//       },
//       { new: true }
//     );

//     res.status(200).json({
//       message: 'Product and variant images successfully updated.',
//       product: updatedProduct,
//       shopifyImages: imagesDataToPush,
//       variantImages: uploadedVariantImages,
//     });
//   } catch (error) {
//     console.error('Error updating images:', error);
//     res.status(500).json({ error: error.message });
//   }
// };

export const updateImages = async (req, res) => {
  const { id } = req.params;
  const imageUrls = req.body.images || [];
  const variantImages = req.body.variantImages || [];

  try {
    const product = await listingModel.findOne({ id });
    if (!product) return res.status(404).json({ error: "Product not found." });

    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      return res.status(404).json({ error: "Shopify configuration not found." });
    }

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = shopifyConfig;

    // ✅ Step 1: Fetch existing images from Shopify
    const existingImagesRes = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
      "GET",
      null,
      shopifyApiKey,
      shopifyAccessToken
    );
    const existingImages = existingImagesRes?.images || [];
    console.log("🔹 Existing Shopify images:", existingImages.map(img => img.src));

    // ✅ Step 2: Only add new images
    const imagesDataToPush = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const alreadyExists = existingImages.some(img => img.src === imageUrl);

      if (alreadyExists) {
        console.log(`⚠️ Skipping duplicate image: ${imageUrl}`);
        continue;
      }

      const payload = {
        image: { src: imageUrl, alt: `Image ${i + 1}`, position: i + 1 },
      };
      const uploadRes = await shopifyRequest(
        `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
        "POST",
        payload,
        shopifyApiKey,
        shopifyAccessToken
      );

      const transformedUrl = transformCloudinaryToShopifyCdn(imageUrl);
      imagesDataToPush.push({
        src: transformedUrl,
        alt: `Image ${i + 1}`,
        position: i + 1,
        id: uploadRes?.image?.id,
      });
    }

    // ✅ Step 3: Handle Variant Images (same logic)
    const uploadedVariantImages = [];
    if (variantImages.length > 0) {
      for (let i = 0; i < variantImages.length; i++) {
        const originalUrl = variantImages[i]?.url;
        if (!originalUrl) continue;

        const alreadyExists = existingImages.some(img => img.src === originalUrl);
        if (alreadyExists) {
          console.log(`⚠️ Skipping duplicate variant image: ${originalUrl}`);
          continue;
        }

        const payload = {
          image: { src: originalUrl, alt: `Variant Image ${i + 1}` },
        };
        const uploadResponse = await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
          "POST",
          payload,
          shopifyApiKey,
          shopifyAccessToken
        );

        if (uploadResponse?.image) {
          const transformedUrl = transformCloudinaryToShopifyCdn(originalUrl);
          uploadedVariantImages.push({
            ...uploadResponse.image,
            src: transformedUrl,
          });
        }
      }
    }

    // ✅ Step 4: Assign variant images
    const productResponse = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products/${id}.json`,
      "GET",
      null,
      shopifyApiKey,
      shopifyAccessToken
    );
    const variantsFromShopify = productResponse?.product?.variants || [];
    const updatedVariants = [];

    for (let i = 0; i < variantsFromShopify.length; i++) {
      const variant = variantsFromShopify[i];
      const image = uploadedVariantImages[i];

      if (variant && image) {
        await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
          "PUT",
          { variant: { id: variant.id, image_id: image.id } },
          shopifyApiKey,
          shopifyAccessToken
        );
        updatedVariants.push({ ...variant, image_id: image.id });
      } else {
        updatedVariants.push(variant);
      }
    }

    // ✅ Step 5: Save changes in DB
    const allCloudinaryUrls = [
      ...imageUrls,
      ...variantImages.map((img) => img?.url),
    ].filter((url) => url?.includes("cloudinary.com"));

    if (allCloudinaryUrls.length > 0) {
      await updateGalleryUrls(allCloudinaryUrls, product.id);
    }

    const updatedProduct = await listingModel.findOneAndUpdate(
      { id },
      { images: imagesDataToPush, variantImages: uploadedVariantImages, variants: updatedVariants },
      { new: true }
    );

    res.status(200).json({
      message: "Product and variant images successfully updated.",
      product: updatedProduct,
      shopifyImages: imagesDataToPush,
      variantImages: uploadedVariantImages,
    });
  } catch (error) {
    console.error("❌ Error updating images:", error?.response?.data || error.message);
    res.status(500).json({ error: error.message });
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
          variant_id: variantId, // Attach variant ID
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

    // Step 1: Update variant fields (price, SKU, etc.)
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

    // Step 2: Update inventory quantity (MUST be done separately)
    const inventoryItemId = updatedVariant?.variant?.inventory_item_id;

    if (!inventoryItemId) {
      return res
        .status(400)
        .json({ error: 'Missing inventory_item_id from variant.' });
    }

    // Get inventory location
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

    // Step 3: Update your local DB
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
  const {  images: imageUrls } = req.body;
const userId=req.userId
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

// export const getImageGallery = async (req, res) => {
//   const { userId, productId } = req.params;

//   try {
//     const result = await imageGalleryModel.aggregate([
//       {
//         $match: {
//           userId: new mongoose.Types.ObjectId(userId),
//         },
//       },
//       {
//         $project: {
//           id: '$_id',
//           _id: 0,
//           images: {
//             $filter: {
//               input: '$images',
//               as: 'image',
//               cond:
//                 productId && productId !== 'null'
//                   ? { $eq: ['$$image.productId', productId] }
//                   : {
//                       $regexMatch: {
//                         input: '$$image.src',
//                         regex: '^https://res\\.cloudinary\\.com',
//                       },
//                     },
//             },
//           },
//         },
//       },
//     ]);

//     res.status(200).json(result);
//   } catch (error) {
//     console.error('Error fetching image gallery:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };

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
// const userId = req.userId; // Secure userId from verifyToken

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
//     const cleanUrl = (url) => url?.split('?')[0];

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
//         const optionValues = [[], [], []];

// // Step 2: Filter only rows with actual variant data
// const variantRows = rows.filter(row => {
//   return row['Variant Price'] || row['Variant SKU'] || row['Option1 Value'];
// });

// // Step 3: Build variants from valid rows
// let variants = variantRows.map((row) => {
//   if (row['Option1 Value']) optionValues[0].push(row['Option1 Value']);
//   if (row['Option2 Value']) optionValues[1].push(row['Option2 Value']);
//   if (row['Option3 Value']) optionValues[2].push(row['Option3 Value']);

//   return {
//     sku: row['Variant SKU'] || '',
//     price: row['Variant Price'] || '0.00',
//     compare_at_price: row['Variant Compare At Price'] || null,
//     inventory_management: row['Variant Inventory Tracker'] === 'shopify' ? 'shopify' : null,
//     inventory_quantity: parseInt(row['Variant Inventory Qty']) || 0,
//     fulfillment_service: 'manual',
//     requires_shipping: row['Variant Requires Shipping'] === 'TRUE',
//     taxable: row['Variant Taxable'] === 'TRUE',
//     barcode: row['Variant Barcode'] || '',
//     weight: parseFloat(row['Variant Grams']) || 0,
//     weight_unit: ['g', 'kg', 'oz', 'lb'].includes(row['Variant Weight Unit']) ? row['Variant Weight Unit'] : 'g',
//     option1: row['Option1 Value'] || 'Default',
//     option2: row['Option2 Value'] || null,
//     option3: row['Option3 Value'] || null,
//     variant_image: cleanUrl(row['Variant Image']) || null,
//   };
// });

// // Step 4: Fallback default variant
// if (variants.length === 0) {
//   variants = [{
//     sku: '',
//     price: '0.00',
//     compare_at_price: null,
//     inventory_management: null,
//     inventory_quantity: 0,
//     fulfillment_service: 'manual',
//     requires_shipping: true,
//     taxable: true,
//     barcode: '',
//     weight: 0,
//     weight_unit: 'g',
//     option1: 'Default',
//     option2: null,
//     option3: null,
//     variant_image: null,
//   }];
// }

// // Step 5: Build unique options
// let options = ['Option1 Name', 'Option2 Name', 'Option3 Name']
//   .map((opt) => mainRow[opt])
//   .filter(Boolean);

// let uniqueOptions = options.map((name, idx) => ({
//   name,
//   values: [...new Set(optionValues[idx])],
// })).filter((opt) => opt.name);

// // Step 6: Fallback default option if none found
// if (!uniqueOptions.length || uniqueOptions.every(opt => !opt.values.length)) {
//   uniqueOptions = [{ name: 'Title', values: ['Default'] }];
// }
//             const images = [...new Set(rows.map((r) => cleanUrl(r['Image Src'])).filter(Boolean))].map((src, index) => ({
//               src,
//               position: index + 1,
//               alt: rows.find((r) => cleanUrl(r['Image Src']) === src)?.['Image Alt Text'] || null,
//             }));

//             const isPublished = mainRow['Published']?.toUpperCase() === 'TRUE';

//             const categoryTags = [];
//             const categoryPathTitles = [];

//             const categoryTitles = mainRow['Category']?.split('|').map((title) => title.trim().toLowerCase()).filter(Boolean) || [];

//             categoryTitles.forEach((catTitle) => {
//               const matchedCategory = catNoMap[catTitle];
//               if (matchedCategory) {
//                 const path = [];
//                 if (matchedCategory.level === 'level3') {
//                   path.push(matchedCategory.title);
//                   const level2 = categories.find((c) => c.catNo === matchedCategory.parentCatNo);
//                   if (level2) {
//                     categoryTags.push(level2.catNo);
//                     path.push(level2.title);
//                     const level1 = categories.find((c) => c.catNo === level2.parentCatNo);
//                     if (level1) {
//                       categoryTags.push(level1.catNo);
//                       path.push(level1.title);
//                     }
//                   }
//                 } else if (matchedCategory.level === 'level2') {
//                   path.push(matchedCategory.title);
//                   const level1 = categories.find((c) => c.catNo === matchedCategory.parentCatNo);
//                   if (level1) {
//                     categoryTags.push(level1.catNo);
//                     path.push(level1.title);
//                   }
//                 } else if (matchedCategory.level === 'level1') {
//                   path.push(matchedCategory.title);
//                 }

//                 categoryTags.push(matchedCategory.catNo);
//                 categoryPathTitles.push(path.join(' > '));
//               }
//             });

//             const csvTags = typeof mainRow['Tags'] === 'string'
//               ? mainRow['Tags'].split(',').map((t) => t.trim()).filter(Boolean)
//               : [];

//             const tags = [...new Set([
//               ...csvTags,
//               ...categoryTags,
//               ...categoryPathTitles,
//               `user_${userId}`,
//               `vendor_${mainRow['Vendor'] || ''}`,
//             ])];

//             const productPayload = {
//               title: mainRow['Title'],
//               body_html: mainRow['Body (HTML)'] || '',
//               vendor: mainRow['Vendor'] || '',
//               product_type: mainRow['Type'] || '',
//               status: isPublished ? 'active' : 'draft',
//               published_at: isPublished ? new Date().toISOString() : null,
//               tags: tags,
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
//             };

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

//             await Promise.all(variants.map(async (variant) => {
//               if (variant.variant_image) {
//                 try {
//                   const imageUploadPayload = {
//                     image: { src: variant.variant_image, alt: `Variant Image` },
//                   };

//                   const uploadResponse = await shopifyRequest(
//                     `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/images.json`,
//                     'POST',
//                     imageUploadPayload,
//                     shopifyApiKey,
//                     shopifyAccessToken
//                   );

//                   if (uploadResponse?.image) {
//                     const img = uploadResponse.image;
//                     uploadedVariantImages.push({
//                       id: img.id?.toString() || '',
//                       alt: img.alt || '',
//                       position: img.position || 0,
//                       product_id: img.product_id?.toString() || '',
//                       created_at: img.created_at || '',
//                       updated_at: img.updated_at || '',
//                       width: img.width || 0,
//                       height: img.height || 0,
//                       src: img.src || '',
//                     });
//                   }
//                 } catch (uploadError) {
//                   console.error(`Image upload error: ${uploadError.message}`);
//                 }
//               }
//             }));

//             const productDetails = await shopifyRequest(
//               `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
//               'GET',
//               null,
//               shopifyApiKey,
//               shopifyAccessToken
//             );

//             const shopifyVariants = productDetails?.product?.variants || [];

//             await Promise.all(shopifyVariants.map(async (variant, index) => {
//               if (uploadedVariantImages[index]) {
//                 try {
//                   await shopifyRequest(
//                     `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
//                     'PUT',
//                     {
//                       variant: {
//                         id: variant.id,
//                         image_id: uploadedVariantImages[index].id,
//                       },
//                     },
//                     shopifyApiKey,
//                     shopifyAccessToken
//                   );
//                 } catch (updateError) {
//                   console.error(`Error linking variant image: ${updateError.message}`);
//                 }
//               }
//             }));

//             const baseVariant = shopifyVariants[0] || {};
//             const inventory = {
//               track_quantity: !!baseVariant?.inventory_management,
//               quantity: baseVariant?.inventory_quantity ?? 0,
//               continue_selling: true,
//               has_sku: !!baseVariant?.sku,
//               sku: baseVariant?.sku || '',
//               barcode: baseVariant?.barcode || '',
//             };

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
//                 tags: tags,
//                 images: product.images,
//                 variants: shopifyVariants,
//                 options: product.options,
//                 userId: userId,
//                 variantImages: uploadedVariantImages,
//                 inventory: inventory,
//               },
//               { upsert: true, new: true }
//             );

//             await new imageGalleryModel({
//               userId: userId,
//               images: product.images.map((img) => ({
//                 id: img.id?.toString(),
//                 product_id: img.product_id?.toString(),
//                 position: img.position,
//                 created_at: img.created_at,
//                 updated_at: img.updated_at,
//                 alt: img.alt,
//                 width: img.width,
//                 height: img.height,
//                 src: img.src,
//                 productId: productId.toString(),
//               })),
//             }).save();

//             results.push({ success: true, handle, productId, title: product.title });

//           } catch (err) {
//             console.error(`❌ Failed to process product: ${handle}`, err.message);
//             results.push({ success: false, handle, error: err.message });
//             continue;
//           }
//         }

//         const orphanedProducts = await listingModel.aggregate([
//           {
//             $match: {
//               $expr: {
//                 $or: [
//                   { $eq: [{ $type: "$userId" }, "missing"] },
//                   { $eq: ["$userId", null] },
//                   {
//                     $and: [
//                       { $eq: [{ $type: "$userId" }, "string"] },
//                       { $ne: [{ $strLenBytes: "$userId" }, 24] }
//                     ]
//                   },
//                   { $not: { $eq: [{ $type: "$userId" }, "objectId"] } }
//                 ]
//               }
//             }
//           }
//         ]);

//         if (orphanedProducts.length > 0) {
//           const idsToDelete = orphanedProducts.map((item) => item._id);
//           await listingModel.deleteMany({ _id: { $in: idsToDelete } });
//         }

//         return res.status(200).json({
//           message: 'Products processed.',
//           successCount: results.filter(r => r.success).length,
//           failedCount: results.filter(r => !r.success).length,
//           results
//         });
//       });

//   } catch (error) {
//     console.error('🔥 Server error:', error.message);
//     return res.status(500).json({
//       success: false,
//       message: 'Unexpected error during CSV upload.',
//       error: error?.message || 'Unknown error',
//     });
//   }
// };


export const addCsvfileForProductFromBody = async (req, res) => {
  const file = req.file;
const userId = req.userId; // Secure userId from verifyToken

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
    const cleanUrl = (url) => url?.split('?')[0];

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
        const optionValues = [[], [], []];

// Step 2: Filter only rows with actual variant data
const variantRows = rows.filter(row => {
  return row['Variant Price'] || row['Variant SKU'] || row['Option1 Value'];
});

// Step 3: Build variants from valid rows
let variants = variantRows.map((row) => {
  if (row['Option1 Value']) optionValues[0].push(row['Option1 Value']);
  if (row['Option2 Value']) optionValues[1].push(row['Option2 Value']);
  if (row['Option3 Value']) optionValues[2].push(row['Option3 Value']);

  return {
    sku: row['Variant SKU'] || '',
    price: row['Variant Price'] || '0.00',
    compare_at_price: row['Variant Compare At Price'] || null,
    inventory_management: row['Variant Inventory Tracker'] === 'shopify' ? 'shopify' : null,
    inventory_quantity: parseInt(row['Variant Inventory Qty']) || 0,
    fulfillment_service: 'manual',
    requires_shipping: row['Variant Requires Shipping'] === 'TRUE',
    taxable: row['Variant Taxable'] === 'TRUE',
    barcode: row['Variant Barcode'] || '',
    weight: parseFloat(row['Variant Grams']) || 0,
    weight_unit: ['g', 'kg', 'oz', 'lb'].includes(row['Variant Weight Unit']) ? row['Variant Weight Unit'] : 'g',
    option1: row['Option1 Value'] || 'Default',
    option2: row['Option2 Value'] || null,
    option3: row['Option3 Value'] || null,
    variant_image: cleanUrl(row['Variant Image']) || null,
  };
});

// Step 4: Fallback default variant
if (variants.length === 0) {
  variants = [{
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
    variant_image: null,
  }];
}

// Step 5: Build unique options
let options = ['Option1 Name', 'Option2 Name', 'Option3 Name']
  .map((opt) => mainRow[opt])
  .filter(Boolean);

let uniqueOptions = options.map((name, idx) => ({
  name,
  values: [...new Set(optionValues[idx])],
})).filter((opt) => opt.name);

// Step 6: Fallback default option if none found
if (!uniqueOptions.length || uniqueOptions.every(opt => !opt.values.length)) {
  uniqueOptions = [{ name: 'Title', values: ['Default'] }];
}
            const images = [...new Set(rows.map((r) => cleanUrl(r['Image Src'])).filter(Boolean))].map((src, index) => ({
              src,
              position: index + 1,
              alt: rows.find((r) => cleanUrl(r['Image Src']) === src)?.['Image Alt Text'] || null,
            }));

            const isPublished = mainRow['Published']?.toUpperCase() === 'TRUE';

            const categoryTags = [];
            const categoryPathTitles = [];

            const categoryTitles = mainRow['Category']?.split('|').map((title) => title.trim().toLowerCase()).filter(Boolean) || [];

            categoryTitles.forEach((catTitle) => {
              const matchedCategory = catNoMap[catTitle];
              if (matchedCategory) {
                const path = [];
                if (matchedCategory.level === 'level3') {
                  path.push(matchedCategory.title);
                  const level2 = categories.find((c) => c.catNo === matchedCategory.parentCatNo);
                  if (level2) {
                    categoryTags.push(level2.catNo);
                    path.push(level2.title);
                    const level1 = categories.find((c) => c.catNo === level2.parentCatNo);
                    if (level1) {
                      categoryTags.push(level1.catNo);
                      path.push(level1.title);
                    }
                  }
                } else if (matchedCategory.level === 'level2') {
                  path.push(matchedCategory.title);
                  const level1 = categories.find((c) => c.catNo === matchedCategory.parentCatNo);
                  if (level1) {
                    categoryTags.push(level1.catNo);
                    path.push(level1.title);
                  }
                } else if (matchedCategory.level === 'level1') {
                  path.push(matchedCategory.title);
                }

                categoryTags.push(matchedCategory.catNo);
                categoryPathTitles.push(path.join(' > '));
              }
            });

            const csvTags = typeof mainRow['Tags'] === 'string'
              ? mainRow['Tags'].split(',').map((t) => t.trim()).filter(Boolean)
              : [];

            const tags = [...new Set([
              ...csvTags,
              ...categoryTags,
              ...categoryPathTitles,
              `user_${userId}`,
              `vendor_${mainRow['Vendor'] || ''}`,
            ])];

            const productPayload = {
              title: mainRow['Title'],
              body_html: mainRow['Body (HTML)'] || '',
              vendor: mainRow['Vendor'] || '',
              product_type: mainRow['Type'] || '',
              status: isPublished ? 'active' : 'draft',
              published_at: isPublished ? new Date().toISOString() : null,
              tags: tags,
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
            };

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
            const uploadedVariantImages = [];

            await Promise.all(variants.map(async (variant) => {
              if (variant.variant_image) {
                try {
                 const optionValues = Object.keys(variant)
        .filter(key => key.toLowerCase().startsWith('option') && variant[key])
        .map(key => variant[key]);

      // Combine SKU + option values
      const variantNameWithSku = [variant.sku, ...optionValues].filter(Boolean).join('-');

      const imageUploadPayload = {
        image: { src: variant.variant_image, alt: variantNameWithSku },
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
                    });
                  }
                } catch (uploadError) {
                  console.error(`Image upload error: ${uploadError.message}`);
                }
              }
            }));

            const productDetails = await shopifyRequest(
              `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
              'GET',
              null,
              shopifyApiKey,
              shopifyAccessToken
            );

            const shopifyVariants = productDetails?.product?.variants || [];

            await Promise.all(shopifyVariants.map(async (variant, index) => {
              if (uploadedVariantImages[index]) {
                try {
                  await shopifyRequest(
                    `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
                    'PUT',
                    {
                      variant: {
                        id: variant.id,
                        image_id: uploadedVariantImages[index].id,
                      },
                    },
                    shopifyApiKey,
                    shopifyAccessToken
                  );
                } catch (updateError) {
                  console.error(`Error linking variant image: ${updateError.message}`);
                }
              }
            }));

            const baseVariant = shopifyVariants[0] || {};
            const inventory = {
              track_quantity: !!baseVariant?.inventory_management,
              quantity: baseVariant?.inventory_quantity ?? 0,
              continue_selling: true,
              has_sku: !!baseVariant?.sku,
              sku: baseVariant?.sku || '',
              barcode: baseVariant?.barcode || '',
            };

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
                tags: tags,
                images: product.images,
                variants: shopifyVariants,
                options: product.options,
                userId: userId,
                variantImages: uploadedVariantImages,
                inventory: inventory,
              },
              { upsert: true, new: true }
            );

            await new imageGalleryModel({
              userId: userId,
              images: product.images.map((img) => ({
                id: img.id?.toString(),
                product_id: img.product_id?.toString(),
                position: img.position,
                created_at: img.created_at,
                updated_at: img.updated_at,
                alt: img.alt,
                width: img.width,
                height: img.height,
                src: img.src,
                productId: productId.toString(),
              })),
            }).save();

            results.push({ success: true, handle, productId, title: product.title });

          } catch (err) {
            console.error(`❌ Failed to process product: ${handle}`, err.message);
            results.push({ success: false, handle, error: err.message });
            continue;
          }
        }

        const orphanedProducts = await listingModel.aggregate([
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: [{ $type: "$userId" }, "missing"] },
                  { $eq: ["$userId", null] },
                  {
                    $and: [
                      { $eq: [{ $type: "$userId" }, "string"] },
                      { $ne: [{ $strLenBytes: "$userId" }, 24] }
                    ]
                  },
                  { $not: { $eq: [{ $type: "$userId" }, "objectId"] } }
                ]
              }
            }
          }
        ]);

        if (orphanedProducts.length > 0) {
          const idsToDelete = orphanedProducts.map((item) => item._id);
          await listingModel.deleteMany({ _id: { $in: idsToDelete } });
        }

        return res.status(200).json({
          message: 'Products processed.',
          successCount: results.filter(r => r.success).length,
          failedCount: results.filter(r => !r.success).length,
          results
        });
      });

  } catch (error) {
    console.error('🔥 Server error:', error.message);
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

export const exportProducts = async (req, res) => {
  try {
    const { userId, type, page = 1, limit = 10, productIds } = req.query;

    if (!userId || !type) {
      return res
        .status(400)
        .json({ message: 'Missing required query parameters.' });
    }

    let query = {};

    if (type === 'selected') {
      if (!productIds) {
        return res
          .status(400)
          .json({ message: 'Product IDs required for selected export.' });
      }
      const productIdsArray = productIds.split(',');
      query._id = { $in: productIdsArray };
    } else {
      query.userId = userId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products =
      type === 'current'
        ? await listingModel.find(query).skip(skip).limit(parseInt(limit))
        : await listingModel.find(query);

    if (!products.length) {
      return res.status(404).json({ message: 'No products found.' });
    }

    const config = await shopifyConfigurationModel.findOne();
    if (!config) {
      return res.status(400).json({ message: 'Shopify config not found.' });
    }

    const { shopifyStoreUrl, shopifyAccessToken, shopifyApiKey } = config;
    const rows = [];

    for (const dbProduct of products) {
      const shopifyProductId = dbProduct.id;
      if (!shopifyProductId) continue;

      const shopifyUrl = `${shopifyStoreUrl}/admin/api/2023-10/products/${shopifyProductId}.json`;

      const response = await shopifyRequest(
        shopifyUrl,
        'GET',
        null,
        shopifyApiKey,
        shopifyAccessToken
      );

      const product = response?.product;
      if (!product) continue;

      product.variants.forEach((variant, index) => {
        rows.push({
          Handle: product.handle || '',
          Title: index === 0 ? product.title : '',
          'Body (HTML)': index === 0 ? product.body_html || '' : '',
          Vendor: index === 0 ? product.vendor || '' : '',
          'Product Category': '',
          Type: index === 0 ? product.product_type || '' : '',
          Tags: index === 0 ? (product.tags || '').toString() : '',
          Published:
            index === 0
              ? String(product.published_at !== null).toUpperCase()
              : '',
          'Option1 Name': product.options?.[0]?.name || '',
          'Option1 Value': variant.option1 || '',
          'Option2 Name': product.options?.[1]?.name || '',
          'Option2 Value': variant.option2 || '',
          'Option3 Name': product.options?.[2]?.name || '',
          'Option3 Value': variant.option3 || '',
          'Variant SKU': variant.sku || '',
          'Variant Grams': variant.grams || 0,
          'Variant Inventory Tracker':
            variant.inventory_management || 'shopify',
          'Variant Inventory Qty': variant.inventory_quantity || 0,
          'Variant Inventory Policy': variant.inventory_policy || 'deny',
          'Variant Fulfillment Service':
            variant.fulfillment_service || 'manual',
          'Variant Price': variant.price || '',
          'Variant Compare At Price': variant.compare_at_price || '',
          'Variant Requires Shipping': variant.requires_shipping
            ? 'TRUE'
            : 'FALSE',
          'Variant Taxable': variant.taxable ? 'TRUE' : 'FALSE',
          'Variant Barcode': variant.barcode || '',
          'Image Src': product.image?.src || '',
          'Image Position': index + 1,
          'Image Alt Text': '',
          'Gift Card': 'FALSE',
          'SEO Title': '',
          'SEO Description': '',
          'Google Shopping / Google Product Category': '',
          'Google Shopping / Gender': '',
          'Google Shopping / Age Group': '',
          'Google Shopping / MPN': '',
          'Google Shopping / Condition': '',
          'Google Shopping / Custom Product': '',
          'Google Shopping / Custom Label 0': '',
          'Google Shopping / Custom Label 1': '',
          'Google Shopping / Custom Label 2': '',
          'Google Shopping / Custom Label 3': '',
          'Google Shopping / Custom Label 4': '',
          'Variant Image': variant.image_id
            ? product.images.find((img) => img.id === variant.image_id)?.src
            : '',
          'Variant Weight Unit': variant.weight_unit || 'kg',
          'Variant Tax Code': '',
          'Cost per item': '',
          Status: product.status || 'active',
        });
      });
    }

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'No Shopify product data found.' });
    }

    const fields = Object.keys(rows[0]);
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    const filename = `shopify-products-${type}-${Date.now()}.csv`;
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
    res.status(500).json({ message: 'Server error during export.' });
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

    const config = await shopifyConfigurationModel.findOne();
    if (!config) {
      return res.status(400).json({ message: 'Shopify config not found.' });
    }

    const { shopifyStoreUrl, shopifyAccessToken, shopifyApiKey } = config;

    const rows = [];

    for (const dbProduct of products) {
      const shopifyProductId = dbProduct.id;
      if (!shopifyProductId) continue;

      const shopifyUrl = `${shopifyStoreUrl}/admin/api/2023-10/products/${shopifyProductId}.json`;

      const response = await shopifyRequest(
        shopifyUrl,
        'GET',
        null,
        shopifyApiKey,
        shopifyAccessToken
      );

      const product = response?.product;
      if (!product) continue;

      const status = product.status || 'unknown';

      product.variants.forEach((variant) => {
        if (
          variantIdsArray.length > 0 &&
          !variantIdsArray.includes(String(variant.id))
        ) {
          return;
        }

        rows.push({
          'Variant SKU': variant.sku || '',
          'Variant Price': variant.price || '',
          'Variant Compare At Price': variant.compare_at_price || '',
          'Variant Inventory Qty': variant.inventory_quantity || 0,
          Status: status,
        });
      });
    }

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'No Shopify variant data found.' });
    }

    const fields = [
      'Variant SKU',
      'Variant Price',
      'Variant Compare At Price',
      'Variant Inventory Qty',
      'Status',
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    const filename = `shopify-variant-inventory-${Date.now()}.csv`;

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
    res.status(500).json({ message: 'Server error during export.' });
  }
};


// export const getAllVariants = async (req, res) => {
//   try {
//     const userId = req.params.userId;

//     if (!userId) {
//       return res.status(400).json({ error: "userId is required." });
//     }

//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const objectIdUserId = new mongoose.Types.ObjectId(userId);

//     let products = await listingModel.aggregate([
//       {
//         $match: {
//           userId: objectIdUserId,
//         },
//       },
//       {
//         $sort: { created_at: -1 },
//       },
//       {
//         $project: {
//           variants: 1,
//           images: 1,
//           status: 1,
//           shopifyId: 1,
//           variantImages: 1,
//           productId: "$_id",
//         },
//       },
//       {
//         $unwind: "$variants",
//       },
//       {
//         $replaceRoot: {
//           newRoot: {
//             $mergeObjects: [
//               "$variants",
//               {
//                 productId: "$productId",
//                 status: "$status",
//                 shopifyId: "$shopifyId",
//                 productImages: "$images",
//                 variantImages: "$variantImages",
//               },
//             ],
//           },
//         },
//       },
//       {
//         $skip: skip,
//       },
//       {
//         $limit: limit,
//       },
//     ]);

//     const productCount = await listingModel.aggregate([
//       { $match: { userId: objectIdUserId } },
//       { $project: { variantsCount: { $size: "$variants" } } },
//       {
//         $group: {
//           _id: null,
//           totalVariants: { $sum: "$variantsCount" },
//         },
//       },
//     ]);

//     const totalVariants = productCount[0]?.totalVariants || 0;

//     if (products.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "No variants found for this user." });
//     }

//     const normalizeString = (str) =>
//       String(str || "").replace(/['"]/g, "").trim().toLowerCase();

//     products = products.map((variant, idx) => {
//       let matchedImage = null;
//       const titleKey = normalizeString(variant.title);

//       if (variant.image_id) {
//         matchedImage =
//           variant.variantImages?.find(
//             (img) => String(img.id) === String(variant.image_id)
//           ) ||
//           variant.productImages?.find(
//             (img) => String(img.id) === String(variant.image_id)
//           );
//       }

//       if (!matchedImage && variant.variantImages) {
//         matchedImage = variant.variantImages.find((img) =>
//           normalizeString(img.alt).includes(titleKey)
//         );
//       }

//       if (!matchedImage && variant.productImages?.length > 0) {
//         matchedImage = variant.productImages[0];
//       }

//       console.log(
//         `Variant: ${variant.title} | Match type: ${
//           variant.image_id
//             ? matchedImage
//               ? "Matched by image_id"
//               : "image_id present but not found"
//             : matchedImage
//             ? "Fallback"
//             : "No image"
//         } | Image: ${matchedImage?.src || "N/A"}`
//       );

//       return {
//         ...variant,
//         finalImage: matchedImage
//           ? {
//               src: matchedImage.src,
//               alt: matchedImage.alt || variant.title || "Variant Image",
//             }
//           : null,
//       };
//     });

//     res.status(200).json({
//       variants: products,
//       currentPage: page,
//       totalPages: Math.ceil(totalVariants / limit),
//       totalVariants,
//     });
//   } catch (error) {
//     console.error("Error in getAllVariants function:", error);
//     res.status(500).json({ error: error.message });
//   }
// };


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
          title: 1,              // 👈 product title
          created_at: 1,         // 👈 product created date
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
                productTitle: "$title",           // 👈 product name
                productCreatedAt: "$created_at",  // 👈 product created_at
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
      String(str || "").replace(/['"]/g, "").trim().toLowerCase();

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

      if (!matchedImage && variant.variantImages) {
        matchedImage = variant.variantImages.find((img) =>
          normalizeString(img.alt).includes(titleKey)
        );
      }

      if (!matchedImage && variant.productImages?.length > 0) {
        matchedImage = variant.productImages[0];
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
      {
        $sort: { created_at: -1 },
      },
      {
        $project: {
          title: 1,              // product title
          created_at: 1,         // product created date
          variants: 1,
          images: 1,
          status: 1,
          shopifyId: 1,
          variantImages: 1,
          productId: "$_id",
          userId: 1,             // optional: expose userId too
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
      String(str || "").replace(/['"]/g, "").trim().toLowerCase();

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

      if (!matchedImage && variant.variantImages) {
        matchedImage = variant.variantImages.find((img) =>
          normalizeString(img.alt).includes(titleKey)
        );
      }

      if (!matchedImage && variant.productImages?.length > 0) {
        matchedImage = variant.productImages[0];
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
                if (variant.variant_image) {
                  try {
                    const imagePayload = {
                      image: { src: variant.variant_image },
                    };
                    const uploadRes = await shopifyRequest(
                      `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/images.json`,
                      'POST',
                      imagePayload,
                      shopifyApiKey,
                      shopifyAccessToken
                    );
                    uploadedVariantImages.push({
                      image_id: uploadRes?.image?.id,
                      src: uploadRes?.image?.src,
                    });
                  } catch (imgErr) {
                    console.error(
                      '❌ Error uploading variant image',
                      imgErr.message
                    );
                  }
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





//// thirdParty apis..............///////////

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
      approvalStatus: "pending",   
    };

    const products = await listingModel.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          userId: {
            $cond: [
              { $eq: [{ $type: "$userId" }, "string"] },
              {
                $convert: {
                  input: "$userId",
                  to: "objectId",
                  onError: null,
                  onNull: null,
                },
              },
              "$userId",
            ],
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
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
              { $ifNull: ["$user.firstName", ""] },
              " ",
              { $ifNull: ["$user.lastName", ""] },
            ],
          },
          email: "$user.email",
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
      res.status(404).send("No pending products found");
    }
  } catch (error) {
    console.error("Aggregation error:", error);
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
        expiresAt 
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