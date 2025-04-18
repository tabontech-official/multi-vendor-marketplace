import { productModel } from '../Models/product.js';
import fetch from 'node-fetch';
import { authModel } from '../Models/auth.js';
import mongoose from 'mongoose';
import { listingModel } from '../Models/Listing.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import fs from 'fs';
import csv from 'csv-parser';

// const shopifyRequest = async (url, method, body) => {
//   const apiKey = process.env.SHOPIFY_API_KEY;
//   const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
//   const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
//     'base64'
//   );

//   const response = await fetch(url, {
//     method,
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Basic ${base64Credentials}`,
//     },
//     body: JSON.stringify(body),
//   });

//   if (!response.ok) {
//     const errorText = await response.text();
//     throw new Error(`request failed${errorText}`);
//   }

//   return response.json();
// };

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
    const shopifyVariants =
      variantCombinations.length === 0
        ? [
            {
              option1: parsedOptions[0].values[0] || null,
              option2: parsedOptions[1] ? parsedOptions[1].values[0] : null,
              option3: parsedOptions[2] ? parsedOptions[2].values[0] : null,
              price: formatPrice(variantPrices || price),
              compare_at_price: compare_at_price || null,
              inventory_management: track_quantity ? 'shopify' : null,
              inventory_quantity:
                track_quantity && !isNaN(parseInt(quantity))
                  ? parseInt(quantity)
                  : 0,
              sku: has_sku ? `${sku}-1` : null,
              barcode: has_sku ? `${barcode}-1` : null,
              weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
              weight_unit: track_shipping ? weight_unit : null,
              isParent: true,
            },
          ]
        : variantCombinations.map((variant, index) => {
            let variantPrice = price;

            if (Array.isArray(variantPrices) && variantPrices.length > index) {
              if (
                variantPrices[index] !== null &&
                variantPrices[index] !== undefined &&
                variantPrices[index] !== ''
              ) {
                variantPrice = variantPrices[index];
              }
            }

            // Alternative approach if variantPrices is an object with option combinations as keys
            // const variantKey = Object.values(variant).join('-');
            // if (variantPrices && variantPrices[variantKey]) {
            //   variantPrice = variantPrices[variantKey];
            // }

            return {
              option1: variant[parsedOptions[0].name] || null,
              option2: parsedOptions[1] ? variant[parsedOptions[1].name] : null,
              option3: parsedOptions[2] ? variant[parsedOptions[2].name] : null,
              price: formatPrice(variantPrice),
              compare_at_price: compare_at_price || null,
              inventory_management: track_quantity ? 'shopify' : null,
              inventory_quantity:
                track_quantity && !isNaN(parseInt(quantity))
                  ? parseInt(quantity)
                  : 0,
              sku: has_sku ? `${sku}-${index + 1}` : null,
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
        console.log(
          'Metafield created successfully:',
          metafieldResponse.metafield
        );
      } else {
        console.log('Error creating metafield:', metafieldResponse);
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

    const shopifyVariants = variantCombinations.map((variant, index) => {
      const variantPrice =
        Array.isArray(variantPrices) && variantPrices[index]
          ? formatPrice(variantPrices[index])
          : formatPrice(price);

      return {
        option1: variant[parsedOptions[0]?.name] || null,
        option2:
          parsedOptions.length > 1 ? variant[parsedOptions[1]?.name] : null,
        option3:
          parsedOptions.length > 2 ? variant[parsedOptions[2]?.name] : null,
        price: variantPrice,
        compare_at_price: compare_at_price || null,
        inventory_management: track_quantity ? 'shopify' : null,
        inventory_quantity: track_quantity ? parseInt(quantity) : 0,
        sku: has_sku
          ? variantCombinations.length > 1
            ? `${sku}-${index + 1}`
            : sku
          : null,
        barcode: has_sku
          ? variantCombinations.length > 1
            ? `${barcode}-${index + 1}`
            : barcode
          : null,
        weight: track_shipping ? parseFloat(weight) || 0.0 : 0.0,
        weight_unit: weight_unit || 'kg',
        isParent: index === 0,
      };
    });

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

export const updateImages = async (req, res) => {
  const { id } = req.params;
  const imageUrls = req.body.images;
  const variantImages = req.body.variantImages;

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

    const imagesData = imageUrls.map((url, index) => ({
      src: url,
      position: index + 1,
      alt: `Image ${index + 1}`,
    }));

    const updatedProduct = await listingModel.findOneAndUpdate(
      { id },
      { images: imagesData },
      { new: true }
    );

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

      const imageResponse = await shopifyRequest(
        imageUrl,
        'POST',
        imagePayload,
        shopifyApiKey,
        shopifyAccessToken
      );

      if (imageResponse?.image) {
        imagesDataToPush.push(imageResponse.image);
      }
    }

    const uploadedVariantImages = [];
    if (variantImages && variantImages.length > 0) {
      for (let i = 0; i < variantImages.length; i++) {
        const variantImageUrl = variantImages[i]?.url;

        if (variantImageUrl) {
          const variantImagePayload = {
            image: {
              src: variantImageUrl,
              alt: `Variant Image ${i + 1}`,
            },
          };

          const variantImageUploadResponse = await shopifyRequest(
            `${shopifyStoreUrl}/admin/api/2024-01/products/${id}/images.json`,
            'POST',
            variantImagePayload,
            shopifyApiKey,
            shopifyAccessToken
          );

          if (variantImageUploadResponse?.image) {
            uploadedVariantImages.push(variantImageUploadResponse.image);
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

    const variants = productResponse?.product?.variants || [];

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
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
      }
    }

    const updatedVariants = product.variants.map((variant) => {
      const uploadedImage = uploadedVariantImages.find(
        (img) => img.variantId === variant.id
      );
      if (uploadedImage) {
        variant.image.push(uploadedImage);
      }
      return variant;
    });
    console.log(updatedVariants);
    await listingModel.updateOne({ id }, { variants: updatedVariants });
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
      inventoryQuantity,
      sku,
      option1,
      option2,
      option3,
      weight,
      compareAtPrice,
      inventoryPolicy,
    } = req.body;
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
        price,
        inventory_quantity: inventoryQuantity,
        sku,
        option1,
        option2,
        option3,
        weight,
        compare_at_price: compareAtPrice,
        inventory_policy: inventoryPolicy,
      },
    };

    const updatedVariant = await shopifyRequest(
      shopifyUrl,
      'PUT',
      body,
      shopifyApiKey,
      shopifyAccessToken
    );

    const updatedProduct = await listingModel.updateOne(
      { 'variants.variantId': variantId },
      {
        $set: {
          'variants.$.price': price,
          'variants.$.inventoryQuantity': inventoryQuantity,
          'variants.$.sku': sku,
          'variants.$.option1': option1,
          'variants.$.option2': option2,
          'variants.$.option3': option3,
          'variants.$.weight': weight,
          'variants.$.compareAtPrice': compareAtPrice,
          'variants.$.inventoryPolicy': inventoryPolicy,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: 'Variant updated successfully in both Shopify and the database.',
      shopifyResponse: updatedVariant,
      dbResponse: updatedProduct,
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
