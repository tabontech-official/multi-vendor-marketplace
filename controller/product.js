import { productModel } from "../Models/product.js";
import multer from 'multer'

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
  
      // Save product to MongoDB
      const newProduct = new productModel({
        name,
        description,
        price,
        image: image.path, // Store the path to the image
      });
      const savedProduct = await newProduct.save();
  
      // Prepare Shopify request payload
      const shopifyPayload = {
        product: {
          title: name,
          body_html: description,
          variants: [{ price }],
          images: [{ src: `http://localhost:5000/${image.path}` }] // Adjust URL as needed
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
  
      // Update the MongoDB document with the Shopify ID
      await productModel.findByIdAndUpdate(savedProduct._id, { shopifyId });
  
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
  

  export const handleShopifyWebhook = async (req, res) => {
    try {
      // Shopify sends the data in the request body
      const shopifyProduct = req.body.product;
  
      // Prepare the data for MongoDB
      const mongoPayload = {
        name: shopifyProduct.title,
        description: shopifyProduct.body_html,
        price: shopifyProduct.variants[0].price,
        image: shopifyProduct.images[0]?.src,
        shopifyId: shopifyProduct.id,
      };
  
      // Update or create the product in MongoDB
      const updatedProduct = await productModel.findOneAndUpdate(
        { shopifyId: shopifyProduct.id },
        mongoPayload,
        { new: true, upsert: true }
      );
  
      // Send a successful response
      res.status(200).json({
        message: 'Product successfully updated in MongoDB',
        product: updatedProduct,
      });
    } catch (error) {
      console.error('Error handling Shopify webhook:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/'); // Ensure this directory exists
    },
    filename: function (req, file, cb) {
      cb(null, `${Date.now()}_${path.basename(file.originalname)}`);
    },
  });
  
  // Initialize multer with storage configuration
  export const upload = multer({ storage: storage });