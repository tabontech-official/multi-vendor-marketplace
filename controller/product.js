import { productModel } from "../Models/product.js";
import multer from 'multer'
import path from 'path'
import fetch from 'node-fetch';
import fs from 'fs'


export const fetchAndStoreProducts = async (req, res) => {
    try {
      // Basic Auth credentials
      const apiKey = process.env.SHOPIFY_API_KEY;
      const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
      const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
  
      const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');
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
          'Authorization': `Basic ${base64Credentials}`,
        },
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching data from Shopify:', errorData);
        return res.status(500).json({ error: 'Failed to fetch data from Shopify' });
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

 
  
  export const addProduct = async (req, res) => {
    try {
      // Extract product data from the request
      const { name, description, price } = req.body;
      const image = req.file; // Get the uploaded file
  
      if (!name || !description || !price || !image) {
        return res.status(400).json({ error: 'All fields are required, including image' });
      }
  
      // Basic Auth credentials
      const apiKey = process.env.SHOPIFY_API_KEY;
      const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
      const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
  
      const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');
      const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/products.json`;
  
      // Prepare Shopify request payload for product creation
      const shopifyPayload = {
        product: {
          title: name,
          body_html: description,
          variants: [{ price }],
        }
      };
  
      // Save product to Shopify
      const response = await fetch(shopifyUrl, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${base64Credentials}`,
        },
        body: JSON.stringify(shopifyPayload),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error saving product to Shopify:', errorData);
        return res.status(500).json({ error: 'Failed to register product with Shopify' });
      }
  
      const shopifyResponse = await response.json();
      const shopifyProductId = shopifyResponse.product.id;
  
      // Save product to MongoDB with Shopify product ID
      const newProduct = new productModel({
        name,
        description,
        price,
        shopifyId: shopifyProductId,
        image: image.path, // Store the path to the image
      });
      const savedProduct = await newProduct.save();
  
      // Optional: Upload Image to Shopify Media
      const imageUploadUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyProductId}/images.json`;
      const imageUploadResponse = await fetch(imageUploadUrl, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${base64Credentials}`,
        },
        body: JSON.stringify({
          image: { src: `http://localhost:5000/${image.path}` } // Adjust URL as needed
        }),
      });
  
      if (!imageUploadResponse.ok) {
        const errorData = await imageUploadResponse.json();
        console.error('Error uploading image to Shopify:', errorData);
        return res.status(500).json({ error: 'Failed to upload image to Shopify' });
      }
  
      const imageUploadResponseData = await imageUploadResponse.json();
      const shopifyImageId = imageUploadResponseData.image.id;
  
      // Optional: Update Metafields with the image URL
      const metafieldsUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyProductId}/metafields.json`;
      const metafieldsResponse = await fetch(metafieldsUrl, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${base64Credentials}`,
        },
        body: JSON.stringify({
          metafield: {
            namespace: 'global',
            key: 'image_url',
            value: `http://localhost:5000/${image.path}`, // Adjust URL as needed
            value_type: 'string'
          }
        }),
      });
  
      if (!metafieldsResponse.ok) {
        const errorData = await metafieldsResponse.json();
        console.error('Error updating metafields in Shopify:', errorData);
        return res.status(500).json({ error: 'Failed to update metafields in Shopify' });
      }
  
      // Update MongoDB with Shopify Image ID
      await productModel.findByIdAndUpdate(savedProduct._id, { shopifyImageId });
  
      // Send a successful response
      res.status(201).json({
        message: 'Product successfully added',
        product: savedProduct,
      });
    } catch (error) {
      console.error('Error in addProduct function:', error);
      return res.status(500).json({ error: error.message });
    }
  };
  
  

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = 'uploads/';
      // Ensure upload directory exists
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });
  
 export const upload = multer({ storage });