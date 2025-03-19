import { productModel } from '../Models/product.js';
import fetch from 'node-fetch';
import { authModel } from '../Models/auth.js';
import mongoose from 'mongoose';
import { BuyCreditModel } from '../Models/buyCredit.js';
import { listingModel } from '../Models/Listing.js';

const shopifyRequest = async (url, method, body) => {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
  const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
    'base64'
  );

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${base64Credentials}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`request failed${errorText}`);
  }

  return response.json();
};

export const addUsedEquipments = async (req, res) => {
  let productId;
  try {
    console.log('Received Data:', req.body);

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
    } = req.body;

    const productStatus = status === 'publish' ? 'active' : 'draft';
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const parsedOptions =
      typeof options === 'string' ? JSON.parse(options) : options;

    if (!Array.isArray(parsedOptions) || parsedOptions.length === 0) {
      return res
        .status(400)
        .json({ error: 'At least one option is required.' });
    }

    const shopifyOptions = parsedOptions.map((option) => ({
      name: option.name,
      values: option.values,
    }));

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

    const variantCombinations = generateVariantCombinations(parsedOptions);

    const shopifyVariants = variantCombinations.map((variant, index) => ({
      option1: variant[parsedOptions[0].name] || null,
      option2: parsedOptions.length > 1 ? variant[parsedOptions[1].name] : null,
      option3: parsedOptions.length > 2 ? variant[parsedOptions[2].name] : null,
      price: price.toString(),
      compare_at_price: compare_at_price ? compare_at_price.toString() : null,
      inventory_management: track_quantity ? 'shopify' : null,
      inventory_quantity:
        track_quantity && !isNaN(parseInt(quantity)) ? parseInt(quantity) : 0,
      sku: has_sku ? `${sku}-${index + 1}` : null,
      barcode: has_sku ? `${barcode}-${index + 1}` : null,
      weight: track_shipping ? parseFloat(weight) : null,
      weight_unit: track_shipping ? weight_unit : null,
    }));

    const shopifyPayload = {
      product: {
        title,
        body_html: description || '',
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

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(
      shopifyUrl,
      'POST',
      shopifyPayload
    );

    if (!productResponse?.product?.id) {
      throw new Error('Shopify product creation failed.');
    }

    const productId = productResponse.product.id;

    const images = req.files?.images
      ? Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images]
      : [];
    const imagesDataToPush = [];

    for (let i = 0; i < images.length; i++) {
      const cloudinaryImageUrl = images[i].path;

      const imagePayload = {
        image: {
          src: cloudinaryImageUrl,
          alt: `Product Image ${i + 1}`,
          position: i + 1,
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;

      try {
        const imageResponse = await shopifyRequest(
          imageUrl,
          'POST',
          imagePayload
        );

        if (imageResponse && imageResponse.image) {
          imagesDataToPush.push({
            id: imageResponse.image.id,
            product_id: productId,
            position: imageResponse.image.position,
            created_at: imageResponse.image.created_at,
            updated_at: imageResponse.image.updated_at,
            alt: imageResponse.image.alt,
            width: imageResponse.image.width,
            height: imageResponse.image.height,
            src: imageResponse.image.src,
          });
        }
      } catch (error) {
        console.error(`Error uploading image ${i + 1} to Shopify:`, error);
      }
    }

    const newProduct = new listingModel({
      id: productId,
      title,
      body_html: description,
      vendor,
      product_type: productType,
      created_at: new Date(),
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imagesDataToPush,
      inventory: {
        track_quantity: !!track_quantity,
        quantity:
          track_quantity && !isNaN(parseInt(quantity)) ? parseInt(quantity) : 0, // Fix for NaN
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
        const deleteShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
        await shopifyRequest(deleteShopifyUrl, 'DELETE');
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
      return res.status(400).json({ error: "userId is required." });
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
          images: 1,
          inventory: 1,
          shipping: 1,
          status: 1,
          userId: 1,
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

    const totalProducts = await listingModel.countDocuments({
      userId: objectIdUserId,
    });

    if (products.length === 0) {
      return res
        .status(404)
        .json({ message: "No products found for this user." });
    }

    res.status(200).json({
      products,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
    });
  } catch (error) {
    console.error("Error in getProductsByUserId function:", error);
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
  const { id } = req.params; // Ye MongoDB ki _id hai
  try {
    if (!id) {
      return res.status(400).json({ error: "Product ID is required for updating." });
    }

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
    } = req.body;

    const productStatus = status === "publish" ? "active" : "draft";

    const product = await listingModel.findById(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found in database." });
    }


    const shopifyProductId = product.id; 

    if (!shopifyProductId) {
      return res.status(400).json({ error: "Shopify Product ID not found in database." });
    }

    const shopifyFetchUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${shopifyProductId}.json`;
    const existingProduct = await shopifyRequest(shopifyFetchUrl, "GET");

    if (!existingProduct?.product) {
      return res.status(404).json({ error: "Product not found on Shopify." });
    }


    const shopifyVariants = [
      {
        price: parseFloat(price).toFixed(2),
        compare_at_price: compare_at_price ? parseFloat(compare_at_price).toFixed(2) : null,
        inventory_management: track_quantity ? "shopify" : null,
        inventory_quantity: track_quantity && !isNaN(parseInt(quantity)) ? parseInt(quantity) : 0,
        sku: has_sku ? sku : null,
        barcode: has_sku ? barcode : null,
        weight: track_shipping ? parseFloat(weight) : null,
        weight_unit: track_shipping ? weight_unit : null,
      },
    ];

    const shopifyPayload = {
      product: {
        title,
        body_html: description || "",
        vendor,
        product_type: productType,
        status: productStatus,
        variants: shopifyVariants,
        tags: [`user_${userId}`, `vendor_${vendor}`, ...(keyWord ? keyWord.split(",") : [])],
      },
    };


    const shopifyUpdateUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${shopifyProductId}.json`;
    const productResponse = await shopifyRequest(shopifyUpdateUrl, "PUT", shopifyPayload);

    if (!productResponse?.product?.id) {
      throw new Error("Shopify product update failed.");
    }


    const images = req.files?.images
      ? Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images]
      : [];

    const imagesDataToPush = [];

    for (let i = 0; i < images.length; i++) {
      const cloudinaryImageUrl = images[i].path;
      const imagePayload = {
        image: {
          src: cloudinaryImageUrl,
          alt: `Product Image ${i + 1}`,
          position: i + 1,
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${shopifyProductId}/images.json`;

      try {
        const imageResponse = await shopifyRequest(imageUrl, "POST", imagePayload);

        if (imageResponse?.image) {
          imagesDataToPush.push({
            id: imageResponse.image.id,
            product_id: id,
            position: imageResponse.image.position,
            created_at: imageResponse.image.created_at,
            updated_at: imageResponse.image.updated_at,
            alt: imageResponse.image.alt,
            width: imageResponse.image.width,
            height: imageResponse.image.height,
            src: imageResponse.image.src,
          });
        }
      } catch (error) {
        console.error(`Error uploading image ${i + 1} to Shopify:`, error);
      }
    }


    const updatedProduct = await listingModel.findByIdAndUpdate(
      id,
      {
        title,
        body_html: description,
        vendor,
        product_type: productType,
        updated_at: new Date(),
        tags: productResponse.product.tags,
        variants: productResponse.product.variants,
        images: imagesDataToPush.length > 0 ? imagesDataToPush : product.images, 
        inventory: {
          track_quantity: !!track_quantity,
          quantity: track_quantity && !isNaN(parseInt(quantity)) ? parseInt(quantity) : 0,
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
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found in database." });
    }

    return res.status(200).json({
      message: "Product successfully updated.",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error in updateProductData function:", error);
    res.status(500).json({ error: error.message });
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

    const shopifyUrl = `https://wasiq-test.myshopify.com/admin/api/2023-10/products/${product.id}.json`;

    const response = await fetch(shopifyUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`).toString('base64')}`,
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
    const localProduct = await listingModel.findOne({ id: productId });
    if (!localProduct) {
      return res.status(404).json({ error: 'Product not found in database.' });
    }

    // const { userId, product_type } = localProduct;

    // const user = await authModel.findById(userId);
    // if (!user) {
    //   return res.status(404).json({ error: 'User not found.' });
    // }

    // const productConfig = await productModel.findOne({ product_type });
    // if (!productConfig) {
    //   return res.status(404).json({
    //     error: 'Product configuration not found for this product type.',
    //   });
    // }

    // if (user.subscription.quantity < productConfig.credit_required) {
    //   return res.status(400).json({
    //     error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
    //   });
    // }

    // // Decrement the subscription quantity
    // user.subscription.quantity -= productConfig.credit_required;
    // await user.save();

    // Update product status in Shopify
    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
    const shopifyPayload = {
      product: {
        id: productId,
        status: 'active',
        published_scope: 'global',
      },
    };

    const shopifyResponse = await shopifyRequest(
      shopifyUrl,
      'PUT',
      shopifyPayload
    );
    if (!shopifyResponse.product) {
      return res
        .status(400)
        .json({ error: 'Failed to update product status in Shopify.' });
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const updatedProduct = await listingModel.findOneAndUpdate(
      { id: productId },
      { status: 'active', expiresAt },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found in database.' });
    }

    // Send response
    return res.status(200).json({
      message: 'Product successfully published.',
      product: updatedProduct,
      expiresAt: expiresAt,
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
    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
    const shopifyPayload = {
      product: {
        id: productId,
        status: 'draft',
      },
    };

    const shopifyResponse = await shopifyRequest(
      shopifyUrl,
      'PUT',
      shopifyPayload
    );
    if (!shopifyResponse.product) {
      return res
        .status(400)
        .json({ error: 'Failed to update product status in Shopify.' });
    }

    const updatedProduct = await listingModel.findOneAndUpdate(
      { id: productId },
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
        $skip: (page - 1 ) * limit,
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
          images: 1,
          inventory: 1,
          shipping: 1,
          status: 1,
          userId: 1,
          username: {
            $concat: [
              { $ifNull: ['$user.firstName', ''] },
              ' ',
              { $ifNull: ['$user.lastName', ''] },
            ],
          },
          email:"$user.email"
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

    if (!["active", "draft"].includes(status)) {
      return res.status(400).json({ error: "Invalid status provided." });
    }

    const localProducts = await listingModel.find();
    if (!localProducts.length) {
      return res.status(404).json({ error: "No products found in the database." });
    }

    const updateProductStatus = async (product) => {
      const productId = product.id; // Shopify Product ID
      if (!productId) return { error: "Missing Shopify Product ID", product };

      const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;

      const shopifyPayload = {
        product: {
          id: productId,
          status,
          published_scope: status === "active" ? "global" : "web",
        },
      };

      try {
        const shopifyResponse = await shopifyRequest(shopifyUrl, "PUT", shopifyPayload);

        if (!shopifyResponse.product) {
          return { error: `Failed to update product ${productId} in Shopify.` };
        }

        // Update status in the database
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

    // Process all products concurrently
    const results = await Promise.all(localProducts.map(updateProductStatus));

    return res.status(200).json({
      message: `All products updated to ${status}.`,
      results,
    });
  } catch (error) {
    console.error("Error in updateAllProductsStatus function:", error);
    return res.status(500).json({ error: error.message });
  }
};
