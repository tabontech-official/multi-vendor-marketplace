import { productModel } from "../Models/product.js";

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
