import { productModel } from '../Models/product.js';
import multer from 'multer';
import fetch from 'node-fetch';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from 'cloudinary';

//storage for images storing
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

// helper function to add images
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

//for creating product
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

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
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

    const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
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

export const addUsedEquipments = async (req, res) => {
  try {
    // Extract equipment details from request body
    const {
      location,
      name,
      brand,
      asking_price,
      accept_offers,
      equipment_type,
      certification,
      year_purchased,
      warranty,
      reason_for_selling,
      shipping,
    } = req.body;
    const image = req.file; // Handle file upload

    // Validate required fields
    if (!name || !asking_price || !image) {
      return res
        .status(400)
        .json({ error: 'Name, asking price, and image are required.' });
    }

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: name, // Use equipment name as the title
        body_html: '', // Leave body_html empty, as we'll use metafields for details
        vendor: brand, // Use brand as the vendor
        product_type: equipment_type, // Use equipment type as the product type
        variants: [{ price: asking_price.toString() }], // Price should be a string
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(
      shopifyUrl,
      'POST',
      shopifyPayload
    );

    console.log('Product Response:', productResponse);

    const productId = productResponse.product.id;

    // Step 2: Create Structured Metafields for the Equipment Details
    const metafieldsPayload = [
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'location',
          value: location,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'brand',
          value: brand,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'asking_price',
          value: asking_price.toString(),
          type: 'number_integer',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'accept_offers',
          value: accept_offers ? 'true' : 'false',
          type: 'boolean',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'equipment_type',
          value: equipment_type,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'certification',
          value: certification,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'year_purchased',
          value: year_purchased.toString(),
          type: 'number_integer',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'warranty',
          value: warranty,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'reason_for_selling',
          value: reason_for_selling,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'shipping',
          value: shipping,
          type: 'single_line_text_field',
        },
      },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', metafield);
    }

    // Step 3: Upload Image to Shopify
    const cloudinaryImageUrl =
      'https://res.cloudinary.com/djocrwprs/image/upload/v1726029463/uploads/cejpbbglmdniw5ot49c4.png'; // Replace with the actual Cloudinary URL

    const imagePayload = {
      image: {
        src: cloudinaryImageUrl, // Use Cloudinary URL here
      },
    };

    const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
    const imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);

    const imageId = imageResponse.image.id;

    // Step 4: Save Product to MongoDB
    const newProduct = new productModel({
      id: productId,
      title: name,
      body_html: '', // Empty body_html as we use metafields for details
      vendor: brand,
      product_type: equipment_type,
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
          alt: 'Equipment Image',
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
        alt: 'Equipment Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      },
      equipment: {
        location,
        name,
        brand,
        asking_price,
        accept_offers,
        equipment_type,
        certification,
        year_purchased,
        warranty,
        reason_for_selling,
        shipping,
      },
    });

    await newProduct.save();

    // Send a successful response
    res.status(201).json({
      message: 'Product successfully created and saved',
      product: newProduct,
    });
  } catch (error) {
    console.error('Error in addUsedEquipments function:', error);
    res.status(500).json({ error: error.message });
  }
};

export const addNewEquipments = async (req, res) => {
  try {
    // Extract equipment details from request body
    const {
      location,
      name,
      brand,
      sale_price,
      equipment_type,
      certification,
      year_manufactured,
      warranty,
      training,
      shipping,
    } = req.body;
    const image = req.file; // Handle file upload

    // Validate required fields
    if (!name || !sale_price || !image) {
      return res
        .status(400)
        .json({ error: 'Name, sale price, and image are required.' });
    }

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: name, // Use equipment name as the title
        body_html: '', // Leave body_html empty, as we'll use metafields for details
        vendor: brand, // Use brand as the vendor
        product_type: equipment_type, // Use equipment type as the product type
        variants: [{ price: sale_price.toString() }], // Price should be a string
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(shopifyUrl, 'POST', shopifyPayload);

    console.log('Product Response:', productResponse);

    const productId = productResponse.product.id;

    // Step 2: Create Structured Metafields for the Equipment Details
    const metafieldsPayload = [
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'location',
          value: location,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'brand',
          value: brand,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'sale_price',
          value: sale_price.toString(),
          type: 'number_integer',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'equipment_type',
          value: equipment_type,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'certification',
          value: certification,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'year_manufactured',
          value: year_manufactured.toString(),
          type: 'number_integer',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'warranty',
          value: warranty,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'training',
          value: training,
          type: 'multi_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'shipping',
          value: shipping,
          type: 'single_line_text_field',
        },
      },
    ];

    // Create each metafield under the product
    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', metafield);
    }

    // Step 3: Upload Image to Shopify
    const cloudinaryImageUrl = image.path; // Use the uploaded image URL or path

    const imagePayload = {
      image: {
        src: cloudinaryImageUrl, // Use the actual image URL or path here
      },
    };

    const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
    const imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);

    const imageId = imageResponse.image.id;

    // Step 4: Save Product to MongoDB
    const newProduct = new productModel({
      id: productId,
      title: name,
      body_html: '', // Empty body_html as we use metafields for details
      vendor: brand,
      product_type: equipment_type,
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
          alt: 'Equipment Image',
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
        alt: 'Equipment Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      },
      equipment: {
        location,
        name,
        brand,
        sale_price,
        equipment_type,
        certification,
        year_manufactured,
        warranty,
        training,
        shipping,
      },
    });

    await newProduct.save();

    // Send a successful response
    res.status(201).json({
      message: 'Product successfully created and saved',
      product: newProduct,
    });
  } catch (error) {
    console.error('Error in addNewEquipments function:', error);
    res.status(500).json({ error: error.message });
  }
};


