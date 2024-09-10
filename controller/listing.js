import { listingModel } from "../Models/listing.js";
import fetch from "node-fetch";
import multer from "multer";
import path from "path";
import FormData from 'form-data';
import fs from 'fs';
// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Folder where images will be stored
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

export const upload = multer({ storage });

// API to add a new used equipment listing


export const addListingForUsedEquipments = async (req, res) => {
    try {
      // Extract product data from the request
      const { location, equipmentName, brandName, askingPrice, acceptOffers, equipmentType, certification, yearPurchased, warranty, reasonForSelling, shipping } = req.body;
    const image = req.file; // Get the uploaded file
      
    if (!location || !equipmentName || !brandName || !askingPrice || !acceptOffers || !equipmentType || !certification || !yearPurchased || !warranty || !reasonForSelling || !shipping || !image) {
        return res.status(400).json({ error: 'All fields are required, including image' });
      }
  
      // Save product to MongoDB
      const newProduct = new listingModel({
        location,
        equipmentName,
        brandName,
        askingPrice,
        acceptOffers,
        equipmentType,
        certification,
        yearPurchased,
        warranty,
        reasonForSelling,
        shipping,
        image: image.path, // Store the path to the image
      });
      const savedProduct = await newProduct.save();
  
      // Prepare Shopify request payload for the product
      const shopifyPayload = {
        product: {
            title: equipmentName,
            body_html: `<strong>Brand:</strong> ${brandName} <br><strong>Description:</strong> ${reasonForSelling}`,
            vendor: brandName,
            product_type: equipmentType,
            variants: [{ price: askingPrice }],
          images: [],
        }
      };
  
      // Basic Auth credentials
      const apiKey = process.env.SHOPIFY_API_KEY;
      const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
      const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
  
      const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');
      const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/products.json`;
  
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
      const shopifyId = shopifyResponse.product.id;
  
      // Upload the image to a hosting service and get the public URL
      const imageUrl = `http://localhost:5000/${image.path}`; // Adjust URL as needed
  
      // Prepare metafield data
      const metafieldPayload = {
        metafield: {
          namespace: 'custom',
          key: 'product_image',
          value: imageUrl,
          type: 'single_line_text_field', // Specify the correct type
        }
      };
  
      // Save metafield to Shopify
      const metafieldUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/products/${shopifyId}/metafields.json`;
      const metafieldResponse = await fetch(metafieldUrl, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${base64Credentials}`,
        },
        body: JSON.stringify(metafieldPayload),
      });
  
      if (!metafieldResponse.ok) {
        const errorData = await metafieldResponse.json();
        console.error('Error saving metafield to Shopify:', errorData);
        return res.status(500).json({ error: 'Failed to save metafield with Shopify' });
      }
  
      // Update the MongoDB document with the Shopify ID
      await listingModel.findByIdAndUpdate(savedProduct._id, { shopifyId });
  
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



