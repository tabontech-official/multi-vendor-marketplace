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

export const addUsedEquipments = async (req, res) => {
  let productId;
  try {
    console.log(req.body);
    const {
      title,
      description,
      price,
      compare_at_price,
      track_quantity,
      trackQuantity,
      quantity,
      continue_selling,
      has_sku,
      sku,
      barcode,
      track_shipping,
      weight,
      weight_unit,
      status,
      userId,
      productType,
      vendor,
      keyWord,
      options,
      variantPrices,
      variantCompareAtPrices,
      variantQuantites,
      variantSku,
    } = req.body;
    const productStatus = status === 'publish' ? 'active' : 'draft';

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

    const shopifyPayload = {
      product: {
        title,
        body_html: description || '',
        vendor,
        product_type: productType,
        status: productStatus,
        options: shopifyOptions,
        variants: shopifyVariants,
        tags: [...(keyWord ? keyWord.split(',') : [])],
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
      vendor,
      product_type: productType,
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
    if (!id)
      return res
        .status(400)
        .json({ error: 'Product ID is required for updating.' });

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
      userId,
      productType,
      vendor,
      keyWord,
      options,
      variantPrices,
      variantCompareAtPrices,
      variantQuantities,
      variantSku,
    } = req.body;

    const productStatus = status === 'publish' ? 'active' : 'draft';

    const parsedOptions =
      typeof options === 'string' ? JSON.parse(options) : options;

    const shopifyOptions = parsedOptions.map((option) => ({
      name: option.name,
      values: option.values,
    }));

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration)
      return res.status(404).json({ error: 'Shopify config not found.' });

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    const product = await listingModel.findById(id);
    if (!product)
      return res.status(404).json({ error: 'Product not found in DB.' });

    const shopifyProductId = product.id;
    if (!shopifyProductId)
      return res
        .status(400)
        .json({ error: 'Shopify Product ID not stored in DB.' });

    const productUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyProductId}.json`;

    const existingProduct = await shopifyRequest(
      productUrl,
      'GET',
      null,
      shopifyApiKey,
      shopifyAccessToken
    );
    if (!existingProduct?.product)
      return res.status(404).json({ error: 'Product not found on Shopify.' });

    const variantCombinations = generateVariantCombinations(parsedOptions);
    const dbVariants = product.variants || [];

    const findMatchingVariantId = (variant) => {
      return dbVariants.find(
        (dbVariant) =>
          dbVariant.option1 === variant[parsedOptions[0]?.name] &&
          dbVariant.option2 ===
            (parsedOptions[1] ? variant[parsedOptions[1]?.name] : null) &&
          dbVariant.option3 ===
            (parsedOptions[2] ? variant[parsedOptions[2]?.name] : null)
      )?.id;
    };
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

    const shopifyVariants = variantCombinations.map((variant, index) => {
      const variantPrice = formatPrice(variantPrices?.[index] || price);
      const variantCompareAtPrice = formatCompareAtPrice(
        variantCompareAtPrices?.[index] || compare_at_price
      );
      const variantQuantity =
        track_quantity && !isNaN(parseInt(variantQuantities?.[index]))
          ? parseInt(variantQuantities?.[index])
          : 0;
      const variantSKU = has_sku
        ? variantSku?.[index] || `${sku}-${index + 1}`
        : null;

      return {
        option1: variant[parsedOptions[0]?.name] || null,
        option2: parsedOptions[1] ? variant[parsedOptions[1]?.name] : null,
        option3: parsedOptions[2] ? variant[parsedOptions[2]?.name] : null,
        price: variantPrice,
        compare_at_price: variantCompareAtPrice,
        inventory_management: track_quantity ? 'shopify' : null,
        inventory_quantity: variantQuantity,
        sku: variantSKU,
        barcode: has_sku ? `${barcode}-${index + 1}` : null,
        weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
        weight_unit: track_shipping ? weight_unit : null,
      };
    });

    const shopifyPayload = {
      product: {
        title,
        body_html: description || '',
        vendor,
        product_type: productType,
        status: productStatus,
        options: shopifyOptions,
        variants: shopifyVariants,
        tags: keyWord ? keyWord.split(',') : [],
      },
    };

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
    if (!updateResponse?.product?.id)
      return res.status(500).json({ error: 'Shopify product update failed.' });

    const updatedInDb = await listingModel.findByIdAndUpdate(
      id,
      {
        title,
        body_html: description,
        vendor,
        product_type: productType,
        updated_at: new Date(),
        tags: updateResponse.product.tags,
        variants: updateResponse.product.variants,
        inventory: {
          track_quantity: !!track_quantity,
          quantity: parseInt(quantity) || 0,
          continue_selling: !!continue_selling,
          has_sku: !!has_sku,
          sku: sku || null,
          barcode: barcode || null,
        },
        shipping: {
          track_shipping: !!track_shipping,
          weight: track_shipping ? parseFloat(weight) : null,
          weight_unit: track_shipping ? weight_unit : null,
        },
        userId,
        status: productStatus,
        options: shopifyOptions,
      },
      { new: true }
    );

    return res.status(200).json({
      message: 'Product and images updated successfully!',
      product: updatedInDb,
    });
  } catch (error) {
    console.error('updateProductData error:', error);
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
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const products = await listingModel.aggregate([
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
        $sort: { created_at: -1 },
      },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: limit,
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
          variants: 1,
          options: 1,
          images: 1,
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

    const totalProducts = await listingModel.countDocuments();

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
      { $match: { status: 'active' } },

      { $count: 'totalProducts' },
    ]);
    const count = result[0]?.totalProducts || '0';
    res.status(200).send({ count });
  } catch (error) {
    console.error('Error in fetchProductCount:', error);
    res.status(500).json({ message: 'Failed to fetch product count.' });
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
    const products = await listingModel.aggregate([
      {
        $match: {
          promotionStatus: 'active',
        },
      },
      {
        $sort: {
          createtedAt: -1,
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
        $sort: { created_at: -1 },
      },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: limit,
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
          variants: 1,
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
    ]);

    const totalProducts = await listingModel.countDocuments();

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

    const products = await listingModel.aggregate([
      {
        $match: {
          promotionStatus: 'inactive',
        },
      },
      {
        $sort: {
          createtedAt: -1,
        },
      },
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
      '❌ Failed to update imageGallery images with productId:',
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
//       return res.status(404).json({ error: 'Shopify configuration not found.' });
//     }

//     const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = shopifyConfiguration;

//     // 1. Upload Product Images
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

//       const imageResponse = await shopifyRequest(
//         imageUrl,
//         'POST',
//         imagePayload,
//         shopifyApiKey,
//         shopifyAccessToken
//       );

//       if (imageResponse?.image) {
//         imagesDataToPush.push({
//           ...imageResponse.image,
//           image_id: imageResponse.image.id, // explicitly add image_id
//         });
//       }
//     }

//     // 2. Upload Variant Images
//     const uploadedVariantImages = [];
//     if (variantImages && variantImages.length > 0) {
//       for (let i = 0; i < variantImages.length; i++) {
//         const variantImageUrl = variantImages[i]?.url;

//         if (variantImageUrl) {
//           const variantImagePayload = {
//             image: {
//               src: variantImageUrl,
//               alt: `Variant Image ${i + 1}`,
//             },
//           };

//           const variantImageUploadResponse = await shopifyRequest(
//             `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
//             'POST',
//             variantImagePayload,
//             shopifyApiKey,
//             shopifyAccessToken
//           );

//           if (variantImageUploadResponse?.image) {
//             uploadedVariantImages.push(variantImageUploadResponse.image);
//           }
//         }
//       }
//     }

//     // 3. Assign image_id to variants on Shopify
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
//           image_id: image.id, // save image_id to DB variant
//         });
//       } else {
//         updatedVariants.push(variant);
//       }
//     }

//     // 4. Update MongoDB
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
  const imageUrls = req.body.images;
  const variantImages = req.body.variantImages;

  try {
    const product = await listingModel.findOne({ id });
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    const imagesDataToPush = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imagePayload = {
        image: {
          src: imageUrls[i],
          alt: `Image ${i + 1}`,
          position: i + 1,
        },
      };

      const imageUrl = `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`;

      await shopifyRequest(
        imageUrl,
        'POST',
        imagePayload,
        shopifyApiKey,
        shopifyAccessToken
      );

      const transformedUrl = transformCloudinaryToShopifyCdn(imageUrls[i]);
      imagesDataToPush.push({
        src: transformedUrl,
        alt: `Image ${i + 1}`,
        position: i + 1,
      });
    }

    const uploadedVariantImages = [];
    if (variantImages && variantImages.length > 0) {
      for (let i = 0; i < variantImages.length; i++) {
        const originalUrl = variantImages[i]?.url;

        if (originalUrl) {
          const payload = {
            image: {
              src: originalUrl,
              alt: `Variant Image ${i + 1}`,
            },
          };

          const uploadResponse = await shopifyRequest(
            `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
            'POST',
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
    }

    const productResponse = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-01/products/${id}.json`,
      'GET',
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
          'PUT',
          {
            variant: {
              id: variant.id,
              image_id: image.id,
            },
          },
          shopifyApiKey,
          shopifyAccessToken
        );

        updatedVariants.push({
          ...variant,
          image_id: image.id,
        });
      } else {
        updatedVariants.push(variant);
      }
    }

    const allCloudinaryUrls = [
      ...imageUrls,
      ...variantImages.map((img) => img?.url),
    ].filter((url) => url?.includes('cloudinary.com'));
    const productId = product.id;
    if (allCloudinaryUrls.length > 0) {
      await updateGalleryUrls(allCloudinaryUrls, productId);
    }

    const updatedProduct = await listingModel.findOneAndUpdate(
      { id },
      {
        images: imagesDataToPush,
        variantImages: uploadedVariantImages,
        variants: updatedVariants,
      },
      { new: true }
    );

    res.status(200).json({
      message: 'Product and variant images successfully updated.',
      product: updatedProduct,
      shopifyImages: imagesDataToPush,
      variantImages: uploadedVariantImages,
    });
  } catch (error) {
    console.error('Error updating images:', error);
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
    if (!shopifyConfiguration)
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    const shopifyUrl = `${shopifyStoreUrl}/admin/api/2023-01/products/${productId}/variants/${variantId}.json`;

    const body = {
      variant: {
        id: variantId,
        price: price?.toString(),
        compare_at_price: compare_at_price?.toString(),
        inventory_quantity,
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

    console.log('Payload Sent to Shopify:', body);

    const updatedVariant = await shopifyRequest(
      shopifyUrl,
      'PUT',
      body,
      shopifyApiKey,
      shopifyAccessToken
    );

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
            inventory_quantity: updatedVariant.variant.inventory_quantity,
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
        'Variant and options updated successfully in both Shopify and the database.',
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
          title: 1,
          variants: 1,
          images: 1,
          variantImages: 1,
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

// export const updateImagesGallery = async (req, res) => {
//   const { id } = req.params;
//   const imageUrls = req.body.images;

//   try {
//     const product = await listingModel.findOne({ id });
//     if (!product) return res.status(404).json({ error: 'Product not found.' });

//     const imagesData = imageUrls.map((url, index) => ({
//       src: url,
//       position: index + 1,
//       alt: `Image ${index + 1}`,
//     }));

//     const updatedProduct = await listingModel.findOneAndUpdate(
//       { id },
//       { images: imagesData },
//       { new: true }
//     );

//     res.status(200).json({
//       message: 'Product images successfully updated in DB.',
//       product: updatedProduct,
//     });
//   } catch (error) {
//     console.error('Error updating images:', error);
//     res.status(500).json({ error: error.message });
//   }
// };

export const addImagesGallery = async (req, res) => {
  const { userId, images: imageUrls } = req.body;

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
  const { userId, productId } = req.params;

  try {
    const result = await imageGalleryModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
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
              cond:
                productId && productId !== 'null'
                  ? { $eq: ['$$image.productId', productId] }
                  : {
                      $regexMatch: {
                        input: '$$image.src',
                        regex: '^https://res\\.cloudinary\\.com',
                      },
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

export const addCsvfileForProductFromBody = async (req, res) => {
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

    const cleanUrl = (url) => url?.split('?')[0];

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
              weight_unit: row['Variant Weight Unit'] || 'kg',
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
              body_html: mainRow['Body (HTML)'] || '',
              vendor: mainRow['Vendor'] || '',
              product_type: mainRow['Type'] || '',
              status: mainRow['Published'] === 'TRUE' ? 'active' : 'draft',
              tags: mainRow['Tags']?.split(',').map((tag) => tag.trim()) || [],
              options: uniqueOptions,
              images: images,
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

          console.log(
            '🛠️ Shopify Product Payload:',
            JSON.stringify(payload, null, 2)
          );

          try {
            const response = await shopifyRequest(
              `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
              'POST',
              payload,
              shopifyApiKey,
              shopifyAccessToken
            );

            const product = response.product;
            const productId = product.id;
            console.log(' Created Product on Shopify with ID:', productId);

            const uploadedVariantImages = [];

            await Promise.all(
              variants.map(async (variant) => {
                if (variant.variant_image) {
                  try {
                    const imageUploadPayload = {
                      image: {
                        src: variant.variant_image,
                        alt: `Variant Image`,
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
                      });
                    }
                  } catch (uploadError) {
                    console.error(
                      ` Error uploading variant image: ${uploadError.message}`
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
              shopifyVariants.map(async (variant, index) => {
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
                    variant.image_id = uploadedVariantImages[index].id;
                  } catch (updateError) {
                    console.error(
                      ` Error linking image to variant ID ${variant.id}: ${updateError.message}`
                    );
                  }
                }
              })
            );

            await listingModel.create({
              shopifyId: productId,
              id: productId,
              title: product.title,
              body_html: product.body_html,
              vendor: product.vendor,
              product_type: product.product_type,
              status: product.status,
              handle: product.handle,
              tags: product.tags,
              images: product.images,
              variants: shopifyVariants,
              options: product.options,
              userId: userId,
              variantImages: uploadedVariantImages,
            });

            console.log(
              ` Product and Variant Images saved into Database for Product ID: ${productId}`
            );

            const imageGallery = await new imageGalleryModel({
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
            });
            imageGallery.save();
            results.push({ success: true, productId, title: product.title });
          } catch (error) {
            console.error(
              ` Error creating product for handle ${handle}:`,
              error?.message || error
            );
            results.push({
              success: false,
              handle,
              error: error?.message || 'Unknown Shopify error',
            });
          }
        }

        return res
          .status(200)
          .json({ message: 'Products processed.', results });
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

// export const updateInventoryPrice = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { price, compareAtPrice } = req.body;

//     const product = await listingModel.findById(id);
//     if (!product)
//       return res.status(404).json({ message: 'Product not found.' });

//     const skuToMatch = product.variants?.[0]?.sku;
//     if (!skuToMatch)
//       return res
//         .status(400)
//         .json({ message: 'SKU not found in product variants.' });

//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfiguration)
//       return res
//         .status(404)
//         .json({ error: 'Shopify configuration not found.' });

//     const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
//       shopifyConfiguration;
//     if (!shopifyApiKey || !shopifyAccessToken || !shopifyStoreUrl)
//       return res
//         .status(400)
//         .json({ error: 'Missing Shopify credentials for user.' });

//     let matchedVariants = [];

//     for (let variant of product.variants) {
//       if (variant.sku === skuToMatch) {
//         variant.price = price;
//         variant.compare_at_price = compareAtPrice;

//         matchedVariants.push(variant);

//         const updatedVariantPayload = {
//           variant: {
//             id: variant.id,
//             price,
//             compare_at_price: compareAtPrice,
//             sku: variant.sku,
//           },
//         };

//         const updateVariantUrl = `${shopifyStoreUrl}/admin/api/2023-10/variants/${variant.id}.json`;
//         await shopifyRequest(
//           updateVariantUrl,
//           'PUT',
//           updatedVariantPayload,
//           shopifyApiKey,
//           shopifyAccessToken
//         );
//       }
//     }

//     if (matchedVariants.length === 0) {
//       return res
//         .status(404)
//         .json({ message: `No variants found with SKU: ${skuToMatch}` });
//     }

//     await product.save();

//     res.status(200).json({
//       message: `Updated price and compare_at_price for ${matchedVariants.length} variant(s).`,
//     });
//   } catch (error) {
//     console.error('Error in updateInventoryPrice:', error);
//     res.status(500).json({ message: 'Server error while updating price.' });
//   }
// };

export const updateInventoryPrice = async (req, res) => {
  try {
    const variantId = req.params.id;
    const { price, compareAtPrice } = req.body;

    const product = await listingModel.findOne({ 'variants.id': variantId });
    if (!product) {
      return res
        .status(404)
        .json({ message: 'Product with this variant not found.' });
    }

    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found.' });
    }

    variant.price = price;
    variant.compare_at_price = compareAtPrice;

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

    await product.save();

    res.status(200).json({
      message: 'Variant price and compare_at_price updated successfully.',
    });
  } catch (error) {
    console.error('Error in updateInventoryPrice:', error);
    res.status(500).json({ message: 'Server error while updating price.' });
  }
};

// export const updateInventoryQuantity = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { quantity } = req.body;

//     const product = await listingModel.findById(id);
//     if (!product)
//       return res.status(404).json({ message: 'Product not found.' });

//     const skuToMatch = product.variants?.[0]?.sku;
//     if (!skuToMatch)
//       return res
//         .status(400)
//         .json({ message: 'SKU not found in product variants.' });

//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfiguration)
//       return res
//         .status(404)
//         .json({ error: 'Shopify configuration not found.' });

//     const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
//       shopifyConfiguration;
//     if (!shopifyApiKey || !shopifyAccessToken || !shopifyStoreUrl)
//       return res
//         .status(400)
//         .json({ error: 'Missing Shopify credentials for user.' });

//     const matchedVariants = [];
//     const shopifyResponses = [];

//     for (let variant of product.variants) {
//       if (variant.sku === skuToMatch) {
//         const variantDetailsUrl = `${shopifyStoreUrl}/admin/api/2023-10/variants/${variant.id}.json`;
//         const variantResponse = await shopifyRequest(
//           variantDetailsUrl,
//           'GET',
//           null,
//           shopifyApiKey,
//           shopifyAccessToken
//         );
//         const inventoryItemId = variantResponse?.variant?.inventory_item_id;

//         if (!inventoryItemId) {
//           return res
//             .status(400)
//             .json({ message: 'Missing inventory_item_id for variant.' });
//         }

//         const inventoryLevelsUrl = `${shopifyStoreUrl}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${inventoryItemId}`;
//         const inventoryLevelsRes = await shopifyRequest(
//           inventoryLevelsUrl,
//           'GET',
//           null,
//           shopifyApiKey,
//           shopifyAccessToken
//         );

//         const currentInventoryLevel = inventoryLevelsRes?.inventory_levels?.[0];
//         if (!currentInventoryLevel) {
//           return res
//             .status(400)
//             .json({ message: 'No inventory level found for this item.' });
//         }

//         const locationId = currentInventoryLevel.location_id;

//         const inventorySetUrl = `${shopifyStoreUrl}/admin/api/2023-10/inventory_levels/set.json`;
//         const inventoryPayload = {
//           location_id: locationId,
//           inventory_item_id: inventoryItemId,
//           available: quantity,
//         };

//         const shopifyRes = await shopifyRequest(
//           inventorySetUrl,
//           'POST',
//           inventoryPayload,
//           shopifyApiKey,
//           shopifyAccessToken
//         );

//         variant.inventory_quantity = quantity;
//         variant.inventory_item_id = inventoryItemId;
//         variant.location_id = locationId;

//         matchedVariants.push(variant);
//         shopifyResponses.push({
//           variant_id: variant.id,
//           inventory_item_id: inventoryItemId,
//           location_id: locationId,
//           response: shopifyRes,
//           updatedAt: new Date(),
//         });
//       }
//     }

//     if (matchedVariants.length === 0) {
//       return res
//         .status(404)
//         .json({ message: `No variants found with SKU: ${skuToMatch}` });
//     }

//     product.shopifyResponse = shopifyResponses;

//     await product.save();

//     res.status(200).json({
//       message: `Updated quantity for ${matchedVariants.length} variant(s).`,
//       shopifyResponse: shopifyResponses,
//     });
//   } catch (error) {
//     console.error(
//       'Error in updateInventoryQuantity:',
//       error?.response?.data || error.message
//     );
//     res.status(500).json({ message: 'Server error while updating quantity.' });
//   }
// };

// export const exportProducts = async (req, res) => {
//   try {
//     const { userId, type, page = 1, limit = 10 } = req.query;

//     if (!userId || !type) {
//       return res
//         .status(400)
//         .json({ message: 'Missing required query parameters.' });
//     }

//     const query = { userId: userId };
//     const skip = (parseInt(page) - 1) * parseInt(limit);

//     const products =
//       type === 'current'
//         ? await listingModel.find(query).skip(skip).limit(parseInt(limit))
//         : await listingModel.find(query);

//     if (!products.length) {
//       return res.status(404).json({ message: 'No products found.' });
//     }

//     const config = await shopifyConfigurationModel.findOne();
//     if (!config)
//       return res.status(400).json({ message: 'Shopify config not found.' });

//     const { shopifyStoreUrl, shopifyAccessToken } = config;
//     const headers = {
//       'Content-Type': 'application/json',
//       'X-Shopify-Access-Token': shopifyAccessToken,
//     };

//     const rows = [];

//     for (const dbProduct of products) {
//       const shopifyProductId = dbProduct.id;
//       if (!shopifyProductId) continue;

//       const shopifyUrl = `${shopifyStoreUrl}/admin/api/2023-10/products/${shopifyProductId}.json`;

//       const response = await shopifyRequest(
//         shopifyUrl,
//         'GET',
//         null,
//         config.shopifyApiKey,
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
//     const filePath = path.join(process.cwd(), 'exports', filename);

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

    const variant = product.variants.find((v) => v.id === variantId);
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

    variant.inventory_quantity = quantity;
    variant.inventory_item_id = inventoryItemId;
    variant.location_id = locationId;

    await product.save();

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
    const { userId, type, page = 1, limit = 10 } = req.query;

    if (!userId || !type) {
      return res
        .status(400)
        .json({ message: 'Missing required query parameters.' });
    }

    const query = { userId: userId };
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

    const { shopifyStoreUrl, shopifyAccessToken } = config;

    const rows = [];

    for (const dbProduct of products) {
      const shopifyProductId = dbProduct.id;
      if (!shopifyProductId) continue;

      const shopifyUrl = `${shopifyStoreUrl}/admin/api/2023-10/products/${shopifyProductId}.json`;

      const response = await shopifyRequest(
        shopifyUrl,
        'GET',
        null,
        config.shopifyApiKey,
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

// export const updateInventoryFromCsv = async (req, res) => {
//   const file = req.file;
//   const userId = req.body.userId;

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

//     stream
//       .pipe(csv())
//       .on('data', (row) => {
//         allRows.push(row);
//       })
//       .on('end', async () => {
//         const updateResults = [];

//         for (const row of allRows) {
//           const sku = row['Variant SKU']?.trim();
//           const quantity = row['Variant Inventory Qty']?.trim();
//           const price = row['Variant Price']?.trim();
//           const compareAtPrice = row['Variant Compare At Price']?.trim();

//           if (!sku) continue;

//           const products = await listingModel.find({
//             userId,
//             'variants.sku': sku,
//           });

//           if (!products.length) {
//             updateResults.push({ sku, status: 'product_not_found' });
//             continue;
//           }

//           for (const product of products) {
//             let variantUpdated = false;

//             for (let variant of product.variants) {
//               if (variant.sku !== sku) continue;

//               try {
//                 console.log(
//                   `🔄 Updating SKU: ${sku} (Variant ID: ${variant.id})`
//                 );

//                 if (price || compareAtPrice) {
//                   const pricePayload = {
//                     variant: {
//                       id: variant.id,
//                       ...(price && { price }),
//                       ...(compareAtPrice && {
//                         compare_at_price: compareAtPrice,
//                       }),
//                     },
//                   };

//                   console.log(
//                     `💰 Updating price for SKU: ${sku}`,
//                     pricePayload
//                   );

//                   await shopifyRequest(
//                     `${shopifyStoreUrl}/admin/api/2023-10/variants/${variant.id}.json`,
//                     'PUT',
//                     pricePayload,
//                     shopifyApiKey,
//                     shopifyAccessToken
//                   );

//                   updateResults.push({
//                     sku,
//                     variantId: variant.id,
//                     status: 'price_updated',
//                   });
//                 }

//                 if (quantity) {
//                   const variantDetailsUrl = `${shopifyStoreUrl}/admin/api/2023-10/variants/${variant.id}.json`;
//                   const variantResponse = await shopifyRequest(
//                     variantDetailsUrl,
//                     'GET',
//                     null,
//                     shopifyApiKey,
//                     shopifyAccessToken
//                   );

//                   const inventoryItemId =
//                     variantResponse?.variant?.inventory_item_id;

//                   if (!inventoryItemId) {
//                     updateResults.push({
//                       sku,
//                       status: 'missing_inventory_item_id',
//                     });
//                     continue;
//                   }

//                   const inventoryLevelsUrl = `${shopifyStoreUrl}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${inventoryItemId}`;
//                   const inventoryLevelsRes = await shopifyRequest(
//                     inventoryLevelsUrl,
//                     'GET',
//                     null,
//                     shopifyApiKey,
//                     shopifyAccessToken
//                   );

//                   const currentInventoryLevel =
//                     inventoryLevelsRes?.inventory_levels?.[0];

//                   if (!currentInventoryLevel) {
//                     updateResults.push({
//                       sku,
//                       status: 'no_inventory_level_found',
//                     });
//                     continue;
//                   }

//                   const locationId = currentInventoryLevel.location_id;

//                   const inventoryPayload = {
//                     location_id: locationId,
//                     inventory_item_id: inventoryItemId,
//                     available: parseInt(quantity),
//                   };

//                   console.log(
//                     `📦 Updating inventory for SKU: ${sku}`,
//                     inventoryPayload
//                   );

//                   const shopifyRes = await shopifyRequest(
//                     `${shopifyStoreUrl}/admin/api/2023-10/inventory_levels/set.json`,
//                     'POST',
//                     inventoryPayload,
//                     shopifyApiKey,
//                     shopifyAccessToken
//                   );

//                   variant.inventory_quantity = parseInt(quantity);
//                   variant.inventory_item_id = inventoryItemId;
//                   variant.location_id = locationId;

//                   updateResults.push({
//                     sku,
//                     variantId: variant.id,
//                     status: 'quantity_updated',
//                     response: shopifyRes,
//                     updatedAt: new Date(),
//                   });
//                 }

//                 variantUpdated = true;
//               } catch (err) {
//                 console.error(`❌ Failed to update SKU: ${sku}`, err.message);
//                 updateResults.push({
//                   sku,
//                   variantId: variant.id,
//                   status: 'error',
//                   message: err.message,
//                 });
//               }
//             }

//             if (variantUpdated) {
//               await product.save();
//             }
//           }
//         }

//         return res.status(200).json({
//           message: 'CSV processing completed.',
//           results: updateResults,
//         });
//       });
//   } catch (error) {
//     console.error('🔥 Server error:', error.message);
//     return res.status(500).json({
//       success: false,
//       message: 'Unexpected error during CSV update.',
//       error: error?.message || 'Unknown error',
//     });
//   }
// };

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

            for (let variant of product.variants) {
              if (variant.sku !== sku) continue;

              try {
                console.log(` Updating SKU: ${sku} (Variant ID: ${variant.id})`);

                if (quantity) {
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

                  const currentInventoryLevel = inventoryLevelsRes?.inventory_levels?.[0];

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

                  console.log(` Updating inventory for SKU: ${sku}`, inventoryPayload);

                  const shopifyRes = await shopifyRequest(
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
                    response: shopifyRes,
                    updatedAt: new Date(),
                  });
                }

                variantUpdated = true;
              } catch (err) {
                console.error(`Failed to update SKU: ${sku}`, err.message);
                updateResults.push({
                  sku,
                  variantId: variant.id,
                  status: 'error',
                  message: err.message,
                });
              }
            }

            if (variantUpdated) {
              await product.save();
            }
          }
        }

        return res.status(200).json({
          message: 'CSV processing completed.',
          results: updateResults,
        });
      });
  } catch (error) {
    console.error(' Server error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unexpected error during CSV update.',
      error: error?.message || 'Unknown error',
    });
  }
};


export const exportInventoryCsv = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'Missing userId parameter.' });
    }

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

      product.variants.forEach((variant) => {
        rows.push({
          'Variant SKU': variant.sku || '',
          'Variant Price': variant.price || '',
          'Variant Compare At Price': variant.compare_at_price || '',
          'Variant Inventory Qty': variant.inventory_quantity || 0,
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

    const products = await listingModel.aggregate([
      {
        $match: {
          userId: objectIdUserId,
        },
      },
      {
        $sort: { created_at: -1 },
      },
      {
        $project: {
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
                status: '$status',
                shopifyId: '$shopifyId',
                variantImages: '$images',
              },
            ],
          },
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
    ]);

    const productCount = await listingModel.aggregate([
      { $match: { userId: objectIdUserId } },
      { $project: { variantsCount: { $size: '$variants' } } },
      {
        $group: {
          _id: null,
          totalVariants: { $sum: '$variantsCount' },
        },
      },
    ]);

    const totalVariants = productCount[0]?.totalVariants || 0;

    if (products.length === 0) {
      return res
        .status(404)
        .json({ message: 'No variants found for this user.' });
    }

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
