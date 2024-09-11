import { productModel } from '../Models/product.js';
import multer from 'multer';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from 'cloudinary';

cloudinary.v2.config({
  cloud_name: 'djocrwprs', // replace with your Cloudinary cloud name
  api_key: '433555789235653', // replace with your Cloudinary API key
  api_secret: 'YuzeR8ryVZNJ2jPowPxPb3YXWvY', // replace with your Cloudinary API secret
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: 'uploads', // specify the folder where images will be uploaded
    allowed_formats: ['jpg', 'png', 'jpeg'], // specify allowed formats
  },
});

export const upload = multer({ storage });


//routes for image uploads
export const imageUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { path: imageUrl, originalname } = req.file;
    res.status(200).json({ imageUrl, originalname });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'An error occurred during the upload' });
  }
};

//fetch product data from shopify store
export const fetchAndStoreProducts = async (req, res) => {
  try {
    // Basic Auth credentials
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
      'base64'
    );
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/products.json`;

    // Get query parameters for pagination
    const limit = parseInt(req.query.limit) || 10; // Default to 10 if not provided
    const pageInfo = req.query.pageInfo || ''; // Optional pagination cursor

    // Build the URL with pagination
    const urlWithPagination = `${shopifyUrl}?limit=${limit}&page_info=${pageInfo}`;

    // Fetch data from Shopify
    const response = await fetch(urlWithPagination, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Credentials}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching data from Shopify:', errorData);
      return res
        .status(500)
        .json({ error: 'Failed to fetch data from Shopify' });
    }

    const shopifyData = await response.json();
    const products = shopifyData.products;

    // Save products to MongoDB
    for (const product of products) {
      await productModel.updateOne(
        { shopifyId: product.id },
        { ...product, updated_at: new Date() },
        { upsert: true }
      );
    }

    // Prepare response data with pagination info
    const nextPageInfo = shopifyData.nextPageInfo || null;

    // Send response
    res.status(200).json({
      message: 'Products successfully fetched and stored',
      products,
      nextPageInfo,
    });
  } catch (error) {
    console.error('Error in fetchAndStoreProducts function:', error);
    return res.status(500).json({ error: error.message });
  }
};


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
    throw new Error(`Shopify API request failed: ${errorText}`);
  }

  return response.json();
};

// Function to handle adding a product
export const addProduct = async (req, res) => {
  try {
    const { title, body_html, vendor, product_type, price } = req.body;
    const image = req.file; // Handle file upload

    if (!title || !body_html || !vendor || !product_type || !price || !image) {
      return res
        .status(400)
        .json({ error: 'All fields are required, including image' });
    }

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title,
        body_html,
        vendor,
        product_type,
        variants: [{ price }],
      },
    };

    const shopifyUrl = `${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(
      shopifyUrl,
      'POST',
      shopifyPayload
    );

    console.log('Product Response:', productResponse);

    const productId = productResponse.product.id;

    // Step 2: Upload Image to Shopify
    // Assuming you have already uploaded the image to Cloudinary and have the URL
    const cloudinaryImageUrl =
      'https://res.cloudinary.com/djocrwprs/image/upload/v1726029463/uploads/cejpbbglmdniw5ot49c4.png'; // Replace with the actual Cloudinary URL

    const imagePayload = {
      image: {
        src: cloudinaryImageUrl, // Use Cloudinary URL here
      },
    };

    const imageUrl = `${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
    const imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);

    const imageId = imageResponse.image.id;

    // Step 3: Save Product to MongoDB
    const newProduct = new productModel({
      id: productId,
      title,
      body_html,
      vendor,
      product_type,
      created_at: new Date(),
      handle: productResponse.product.handle,
      updated_at: new Date(),
      published_at: productResponse.product.published_at,
      template_suffix: productResponse.product.template_suffix,
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: [
        {
          id: imageId,
          product_id: productId,
          position: imageResponse.image.position,
          created_at: imageResponse.image.created_at,
          updated_at: imageResponse.image.updated_at,
          alt: imageResponse.image.alt,
          width: imageResponse.image.width,
          height: imageResponse.image.height,
          src: imageResponse.image.src,
        },
      ],
      image: {
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        created_at: imageResponse.image.created_at,
        updated_at: imageResponse.image.updated_at,
        alt: imageResponse.image.alt,
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      },
    });

    await newProduct.save();

    // Send a successful response
    res.status(201).json({
      message: 'Product successfully created and saved',
      product: newProduct,
    });
  } catch (error) {
    console.error('Error in addProduct function:', error);
    res.status(500).json({ error: error.message });
  }
};
// Function to add a product

export const newAddProduct = async (req, res) => {
  try {
    const { title, body_html, vendor, product_type, price, variants } =
      req.body;
    const image = req.file;

    if (
      !title ||
      !body_html ||
      !vendor ||
      !product_type ||
      !price ||
      !image ||
      !variants
    ) {
      return res
        .status(400)
        .json({
          error: 'All fields are required, including image and variants',
        });
    }

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title,
        body_html,
        vendor,
        product_type,
        variants: JSON.parse(variants), // Assuming variants are passed as a JSON string
        images: [{ src: `http://localhost:4000/${image.filename}` }], // Adjust URL according to your server configuration
      },
    };

    const productResponse = await shopifyRequest(
      `${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`,
      'POST',
      shopifyPayload
    );
    console.log('Product Response:', productResponse);
    const productId = productResponse.product.id;

    // Step 2: Upload Image to Shopify
    const imagePayload = {
      image: {
        src: `http://localhost:4000/uploads/${image.path}`, // Adjust URL according to your server configuration
      },
    };

    const imageResponse = await shopifyRequest(
      `${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`,
      'POST',
      imagePayload
    );

    const imageId = imageResponse.image.id;

    // Step 3: Save Product to MongoDB
    const newProduct = new productModel({
      id: productId,
      title,
      body_html,
      vendor,
      product_type,
      created_at: new Date(),
      handle: productResponse.product.handle,
      updated_at: new Date(),
      published_at: productResponse.product.published_at,
      template_suffix: productResponse.product.template_suffix,
      tags: productResponse.product.tags,
      variants: JSON.parse(variants).map((v) => ({
        ...v,
        product_id: productId,
        created_at: new Date(),
        updated_at: new Date(),
      })),
      images: [
        {
          id: imageId,
          product_id: productId,
          position: imageResponse.image.position,
          created_at: imageResponse.image.created_at,
          updated_at: imageResponse.image.updated_at,
          alt: imageResponse.image.alt,
          width: imageResponse.image.width,
          height: imageResponse.image.height,
          src: imageResponse.image.src,
        },
      ],
      image: {
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        created_at: imageResponse.image.created_at,
        updated_at: imageResponse.image.updated_at,
        alt: imageResponse.image.alt,
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      },
    });

    await newProduct.save();

    // Send a successful response
    res.status(201).json({
      message: 'Product successfully created and saved',
      product: newProduct,
    });
  } catch (error) {
    console.error('Error in addProduct function:', error);
    res.status(500).json({ error: error.message });
  }
};
