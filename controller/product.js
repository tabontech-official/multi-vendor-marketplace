import { productModel } from '../Models/product.js';
import fetch from 'node-fetch';
import { authModel } from '../Models/auth.js';
import mongoose from 'mongoose';
import { Console } from 'console';


//fetch product data fom shopify store
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

// export const publishProduct = async (req, res) => {
//   const { id,status } = req.query

//   try {
//     // Find the product in MongoDB
//     const product = await productModel.findById(id);
//     if (!product) {
//       return res.status(404).json({ message: 'Product not found' });
//     }

//     // Update the product's status in MongoDB
//     product.status = status;
//     if (status === 'active') {
//       product.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
//     } else {
//       product.subscriptionEndDate = null; // Clear if not active
//     }
//     await product.save();

//     // Update the product in Shopify
//     const shopifyPayload = {
//       product: {
//         id: product.id,
//         status: status,
//       },
//     };

//     const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${product.id}.json`;
//     await shopifyRequest(shopifyUrl, 'PUT', shopifyPayload);

//     res.status(200).json({ message: 'Product published successfully' });
//   } catch (error) {
//     console.error('Error in publishProduct function:', error);
//     res.status(500).json({ error: error.message });
//   }
// };

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
      description,
      userId,
      //status = 'active', 
    } = req.body;

    const image = req.file; // Handle file upload

    // Set asking_price to 0.00 if not provided
    const askingPriceValue = asking_price ? parseFloat(asking_price) : 0.00;
    const brandValue = brand || 'medspa';
    const status = 'active';
    // Validate required fields
    if (!location) return res.status(400).json({ error: 'Location is required' });
    if (!name) return res.status(400).json({ error: 'Equipment Name is required' });
    if (isNaN(askingPriceValue)) return res.status(400).json({ error: 'Asking price must be a number' });
    if (!accept_offers) return res.status(400).json({ error: 'Accept offers is required' });
    if (!equipment_type) return res.status(400).json({ error: 'Equipment type is required' });
    if (!certification) return res.status(400).json({ error: 'Certification is required' });
    if (!year_purchased) return res.status(400).json({ error: 'Year purchased is required' });
    if (!warranty) return res.status(400).json({ error: 'Warranty is required' });
    if (!reason_for_selling) return res.status(400).json({ error: 'Reason for selling is required' });
    if (!shipping) return res.status(400).json({ error: 'Shipping is required' });
    if (!description) return res.status(400).json({ error: 'Description is required' });

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: name,
        body_html: description,
        vendor: brandValue,
        product_type: 'used equipments',
        variants: [{ price: askingPriceValue.toFixed(2).toString() }],
        status: status,
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(shopifyUrl, 'POST', shopifyPayload);
    const productId = productResponse.product.id;

    // Step 2: Create Structured Metafields for the Equipment Details
    const metafieldsPayload = [
      { metafield: { namespace: 'fold_tech', key: 'location', value: location, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'brand', value: brandValue, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'description', value: description, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'asking_price', value: askingPriceValue.toFixed(2), type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'accept_offers', value: accept_offers ? 'true' : 'false', type: 'boolean' }},
      { metafield: { namespace: 'fold_tech', key: 'equipment_type', value: equipment_type, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'certification', value: certification, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'year_purchased', value: year_purchased.toString(), type: 'number_integer' }},
      { metafield: { namespace: 'fold_tech', key: 'warranty', value: warranty, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'reason_for_selling', value: reason_for_selling, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'shipping', value: shipping, type: 'single_line_text_field' }},
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', metafield);
    }

    // Step 3: Upload Image to Shopify if provided
    let imageId = null;
    let imageResponse = null; // Initialize imageResponse to null

    if (image) {
      const cloudinaryImageUrl = image.path;

      const imagePayload = {
        image: {
          src: cloudinaryImageUrl,
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
      imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);
      imageId = imageResponse.image.id;
    }

    // Step 4: Save Product to MongoDB
    const newProduct = new productModel({
      id: productId,
      title: name,
      body_html: description,
      vendor: brandValue,
      product_type: 'used Equipment',
      created_at: new Date(),
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      approved: productResponse.product.approved,
      images: imageId ? [{
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        alt: 'Equipment Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      }] : [],
      image: imageId ? {
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        alt: 'Equipment Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      } : null,
      equipment: {
        location,
        name,
        brand,
        asking_price: askingPriceValue.toFixed(2),
        accept_offers,
        equipment_type,
        certification,
        year_purchased,
        warranty,
        reason_for_selling,
        shipping,
        description,
      },
      userId: userId,
      status: status,
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
    // Extract equipment details and action from request body
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
      description,
      userId,
      status, // 'publish' or 'draft'
    } = req.body;

    // Validate required fields
    if (!name) return res.status(400).json({ error: 'Title is required.' });

    const salePriceValue = sale_price ? parseFloat(sale_price) : 0.00;
    if (isNaN(salePriceValue)) return res.status(400).json({ error: 'Sale price must be a number.' });

    // Determine product status based on action
    const productStatus = status === 'publish' ? 'active' : 'draft';
    const brandValue = brand || 'medspa';

    // Optional fields with defaults
    const equipmentTypeValue = equipment_type || 'Unknown';
    const certificationValue = certification || 'Not specified';
    const yearManufacturedValue = year_manufactured ? parseInt(year_manufactured, 10) : 0; // Ensure this is an integer
    const warrantyValue = warranty || 'Not specified';
    const trainingValue = training || 'Not specified';
    const shippingValue = shipping || 'Not specified';
    const descriptionValue = description || 'No description provided.';

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: name,
        body_html: descriptionValue,
        vendor: brandValue,
        product_type: 'New Equipment',
        variants: [{ price: salePriceValue.toFixed(2).toString() }],
        status: productStatus,
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(shopifyUrl, 'POST', shopifyPayload);
    const productId = productResponse.product.id;

    // Step 2: Create Structured Metafields for the Equipment Details
    const metafieldsPayload = [
      { metafield: { namespace: 'fold_tech', key: 'name', value: name, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'description', value: descriptionValue, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'location', value: location || 'Unknown', type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'brand', value: brandValue, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'sale_price', value: salePriceValue.toFixed(2), type: 'number_integer' }},
      { metafield: { namespace: 'fold_tech', key: 'equipment_type', value: equipmentTypeValue, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'certification', value: certificationValue, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'year_manufactured', value: yearManufacturedValue, type: 'number_integer' }},
      { metafield: { namespace: 'fold_tech', key: 'warranty', value: warrantyValue, type: 'single_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'training', value: trainingValue, type: 'multi_line_text_field' }},
      { metafield: { namespace: 'fold_tech', key: 'shipping', value: shippingValue, type: 'single_line_text_field' }},
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', metafield);
    }

    // Step 3: Upload Image to Shopify if provided
    let imageId = null;
    let imageResponse = null;

    if (req.file) {
      const cloudinaryImageUrl = req.file.path; // Use the uploaded image URL or path here
      const imagePayload = {
        image: {
          src: cloudinaryImageUrl,
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
      imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);
      imageId = imageResponse.image.id;
    }

    // Step 4: Save Product to MongoDB
    const newProduct = new productModel({
      id: productId,
      title: name,
      body_html: '', // Empty body_html as we use metafields for details
      vendor: brandValue,
      product_type: 'New Equipment',
      created_at: new Date(),
      handle: productResponse.product.handle,
      updated_at: new Date(),
      published_at: productResponse.product.published_at,
      template_suffix: productResponse.product.template_suffix,
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imageId ? [{
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        created_at: imageResponse.image.created_at,
        updated_at: imageResponse.image.updated_at,
        alt: 'Equipment Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      }] : [],
      image: imageId ? {
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        created_at: imageResponse.image.created_at,
        updated_at: imageResponse.image.updated_at,
        alt: 'Equipment Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      } : null,
      equipment: {
        location: location || 'Unknown',
        name,
        brand: brandValue,
        sale_price: salePriceValue.toFixed(2),
        equipment_type: equipmentTypeValue,
        certification: certificationValue,
        year_manufactured: yearManufacturedValue,
        warranty: warrantyValue,
        training: trainingValue,
        shipping: shippingValue,
        description: descriptionValue,
      },
      userId: userId,
      status: productStatus,
    });

    await newProduct.save();
    const expirationDate = user.subscription.expiresAt;

    // If the product is published, decrease user subscription quantity
    if (productStatus === 'active') {
      const user = await authModel.findById(userId);
      if (!user) throw new Error('User not found');

      if (user.subscription && user.subscription.quantity > 0) {
        user.subscription.quantity -= 1; // Decrease subscription count
        await user.save();
      } else {
        return res.status(400).json({ error: 'Insufficient subscription quantity to publish.' });
      }
    }

    // Send a successful response
    res.status(201).json({
      message: `Product successfully created and ${productStatus === 'active' ? 'published' : 'saved as draft'}`,
      product: newProduct,
      expiresAt:expirationDate
    });
  } catch (error) {
    console.error('Error in addNewEquipments function:', error);
    res.status(500).json({ error: error.message });
  }
};


export const addNewBusiness = async (req, res) => {
  try {
    // Extract business listing details from request body
    const {
      name,
      location,
      businessDescription,
      asking_price,
      establishedYear,
      numberOfEmployees,
      locationMonthlyRent,
      leaseExpirationDate,
      locationSize,
      grossYearlyRevenue,
      cashFlow,
      productsInventory,
      equipmentValue,
      reasonForSelling,
      listOfDevices,
      offeredServices,
      supportAndTraining,
      userId,
      status,
    } = req.body;

    const image = req.file; // Handle file upload
    const askingPriceValue = asking_price ? parseFloat(asking_price) : 0.00;
    const productStatus = status === 'publish' ? 'active' : 'draft';

    // Validate required fields
    if (!location) return res.status(400).json({ error: 'Location is required.' });
    if (!businessDescription) return res.status(400).json({ error: 'Business description is required.' });
    if (isNaN(askingPriceValue)) return res.status(400).json({ error: 'Asking price must be a number' });
    if (!establishedYear) return res.status(400).json({ error: 'Established year is required.' });
    if (!numberOfEmployees) return res.status(400).json({ error: 'Number of employees is required.' });
    if (!locationMonthlyRent) return res.status(400).json({ error: 'Location monthly rent is required.' });
    if (!leaseExpirationDate) return res.status(400).json({ error: 'Lease expiration date is required.' });
    if (!locationSize) return res.status(400).json({ error: 'Location size is required.' });
    if (!grossYearlyRevenue) return res.status(400).json({ error: 'Gross yearly revenue is required.' });
    if (!cashFlow) return res.status(400).json({ error: 'Cash flow is required.' });
    if (!productsInventory) return res.status(400).json({ error: 'Products inventory is required.' });
    if (!equipmentValue) return res.status(400).json({ error: 'Equipment value is required.' });
    if (!reasonForSelling) return res.status(400).json({ error: 'Reason for selling is required.' });
    if (!listOfDevices) return res.status(400).json({ error: 'List of devices is required.' });
    if (!offeredServices) return res.status(400).json({ error: 'Offered services are required.' });
    if (!supportAndTraining) return res.status(400).json({ error: 'Support and training information is required.' });

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: name,
        body_html: businessDescription,
        vendor: location,
        product_type: 'Business Listing',
        variants: [{ price: askingPriceValue.toFixed(2).toString() }],
        //status: status === 'inactive' ? 'draft' : 'active',
        status:productStatus
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(shopifyUrl, 'POST', shopifyPayload);
    const productId = productResponse.product.id;

    // Step 2: Create Structured Metafields for the Business Listing Details
    const metafieldsPayload = [
      { namespace: 'fold_tech', key: 'location', value: location, type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'business_description', value: businessDescription, type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'asking_price', value: askingPriceValue.toString(), type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'established_year', value: establishedYear.toString(), type: 'number_integer' },
      { namespace: 'fold_tech', key: 'number_of_employees', value: numberOfEmployees.toString(), type: 'number_integer' },
      { namespace: 'fold_tech', key: 'location_monthly_rent', value: locationMonthlyRent.toString(), type: 'number_integer' },
      { namespace: 'fold_tech', key: 'lease_expiration_date', value: new Date(leaseExpirationDate).toISOString(), type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'location_size', value: locationSize.toString(), type: 'number_integer' },
      { namespace: 'fold_tech', key: 'gross_yearly_revenue', value: grossYearlyRevenue.toString(), type: 'number_integer' },
      { namespace: 'fold_tech', key: 'cash_flow', value: cashFlow.toString(), type: 'number_integer' },
      { namespace: 'fold_tech', key: 'products_inventory', value: productsInventory.toString(), type: 'number_integer' },
      { namespace: 'fold_tech', key: 'equipment_value', value: equipmentValue.toString(), type: 'number_integer' },
      { namespace: 'fold_tech', key: 'reason_for_selling', value: reasonForSelling, type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'list_of_devices', value: JSON.stringify(listOfDevices), type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'offered_services', value: JSON.stringify(offeredServices), type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'support_and_training', value: supportAndTraining, type: 'single_line_text_field' },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', { metafield });
    }

    // Step 3: Upload Image to Shopify if provided
    let imageId = null;
    let imageResponse = null; // Initialize to null

    if (image) {
      const cloudinaryImageUrl = image.path;

      const imagePayload = {
        image: {
          src: cloudinaryImageUrl,
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
      imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);
      imageId = imageResponse.image.id;
    }

    // Step 4: Save Product to MongoDB
    const newProduct = new productModel({
      id: productId,
      title: name,
      body_html: businessDescription,
      vendor: location,
      product_type: 'Business Listing',
      created_at: new Date(),
      handle: productResponse.product.handle,
      updated_at: new Date(),
      published_at: productResponse.product.published_at,
      template_suffix: productResponse.product.template_suffix,
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imageId ? [{
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        created_at: imageResponse.image.created_at,
        updated_at: imageResponse.image.updated_at,
        alt: 'Business Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      }] : [],
      image: imageId ? {
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        created_at: imageResponse.image.created_at,
        updated_at: imageResponse.image.updated_at,
        alt: 'Business Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      } : null,
      business: {
        name,
        location,
        businessDescription,
        asking_price: askingPriceValue,
        establishedYear,
        numberOfEmployees,
        locationMonthlyRent,
        leaseExpirationDate: new Date(leaseExpirationDate),
        locationSize,
        grossYearlyRevenue,
        cashFlow,
        productsInventory,
        equipmentValue,
        reasonForSelling,
        listOfDevices,
        offeredServices,
        supportAndTraining,
      },
      userId: userId,
      status: productStatus,
    });

    await newProduct.save();
    const expirationDate = user.subscription.expiresAt;

    if (productStatus === 'active') {
      const user = await authModel.findById(userId);
      if (!user) throw new Error('User not found');

      if (user.subscription && user.subscription.quantity > 0) {
        user.subscription.quantity -= 1; // Decrease subscription count
        await user.save();
      } else {
        return res.status(400).json({ error: 'Insufficient subscription quantity to publish.' });
      }
    }

    // Send a successful response
    res.status(201).json({
      message: `Product successfully created and ${productStatus === 'active' ? 'published' : 'saved as draft'}`,
      product: newProduct,
      expiresAt:expirationDate,
    });
  } catch (error) {
    console.error('Error in addNewEquipments function:', error);
    res.status(500).json({ error: error.message });
  }
};


export const addNewJobListing = async (req, res) => {
  try {
    // Extract job listing details from request body
    const {
      location,
      name,
      qualification,
      positionRequestedDescription,
      availability,
      requestedYearlySalary,
      userId,
      status,
    } = req.body;

    // Handle file upload
    const image = req.file; // Handle file upload
    const productStatus = status === 'publish' ? 'active' : 'draft';
    // Validate required fields
    if (!location) return res.status(400).json({ error: 'Location is required.' });
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (!qualification) return res.status(400).json({ error: 'Qualification is required.' });
    if (!positionRequestedDescription) return res.status(400).json({ error: 'Position description is required.' });
    if (!availability) return res.status(400).json({ error: 'Availability is required.' });
    if (!requestedYearlySalary) return res.status(400).json({ error: 'Requested yearly salary is required.' });

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: name, // Use job name as the title
        body_html: positionRequestedDescription, // Use position description as body_html
        vendor: location, // Use location as the vendor
        product_type: 'Job Listing', // Use a specific type for job listings
        variants: [{ price: requestedYearlySalary.toString() }], // Salary should be a string
       status:productStatus
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(shopifyUrl, 'POST', shopifyPayload);
    const productId = productResponse.product.id;

    // Step 2: Create Structured Metafields for the Job Listing Details
    const metafieldsPayload = [
      { namespace: 'fold_tech', key: 'location', value: location, type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'name', value: name, type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'qualification', value: qualification, type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'position_requested_description', value: positionRequestedDescription, type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'availability', value: availability, type: 'single_line_text_field' },
      { namespace: 'fold_tech', key: 'requested_yearly_salary', value: requestedYearlySalary.toString(), type: 'number_decimal' },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', { metafield });
    }

    // Step 3: Upload Image to Shopify if provided
    let imageId = null;
    let imageResponse = null;

    if (image) {
      const cloudinaryImageUrl = image.path; // Assuming image.path is the URL

      const imagePayload = {
        image: {
          src: cloudinaryImageUrl, // Use the path to the image
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
      imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);
      imageId = imageResponse.image.id;
    }

    // Step 4: Save Product to MongoDB
    const newJobListing = new productModel({
      id: productId,
      title: name,
      body_html: positionRequestedDescription,
      vendor: location,
      product_type: 'Job Listing',
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imageId ? [{
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        alt: 'Job Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      }] : [],
      image: imageId ? {
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        alt: 'Job Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      } : null,
      jobListings: [{
        location,
        name,
        qualification,
        positionRequestedDescription,
        availability,
        requestedYearlySalary,
        image: imageResponse ? imageResponse.image.src : null, // Store the image URL if available
      }],
      userId: userId,
      status: productStatus, // Save the status (active/inactive)
    });

    await newJobListing.save();
    const expirationDate = user.subscription.expiresAt;
    // If the product is published, decrease user subscription quantity
    if (productStatus === 'active') {
      const user = await authModel.findById(userId);
      if (!user) throw new Error('User not found');

      if (user.subscription && user.subscription.quantity > 0) {
        user.subscription.quantity -= 1; // Decrease subscription count
        await user.save();
      } else {
        return res.status(400).json({ error: 'Insufficient subscription quantity to publish.' });
      }
    }

    // Send a successful response
    res.status(201).json({
      message: `Product successfully created and ${productStatus === 'active' ? 'published' : 'saved as draft'}`,
      product: newJobListing,
      expiresAt:expirationDate
    });
  } catch (error) {
    console.error('Error in addNewEquipments function:', error);
    res.status(500).json({ error: error.message });
  }
};


export const addNewProviderListing = async (req, res) => {
  console.log('Request Body:', req.body);
  console.log('Uploaded File:', req.file);

  try {
    // Extract provider listing details from request body
    const {
      location,
      qualificationRequested,
      jobType,
      typeOfJobOffered,
      offeredYearlySalary,
      offeredPositionDescription,
      userId,
      status
             } = req.body;

    // Handle file upload
    const image = req.file; // Handle file upload
    const productStatus = status === 'publish' ? 'active' : 'draft';
    // Validate required fields
    if (!location) {
      return res.status(400).json({ error: 'Location is required.' });
    }
    if (!qualificationRequested) {
      return res.status(400).json({ error: 'Qualification requested is required.' });
    }
    if (!jobType) {
      return res.status(400).json({ error: 'Job type is required.' });
    }
    if (!typeOfJobOffered) {
      return res.status(400).json({ error: 'Type of job offered is required.' });
    }
    if (!offeredYearlySalary) {
      return res.status(400).json({ error: 'Offered yearly salary is required.' });
    }
    if (!offeredPositionDescription) {
      return res.status(400).json({ error: 'Position description is required.' });
    }

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: qualificationRequested, // Use qualification requested as the title
        body_html: offeredPositionDescription, // Use offered position description as body_html
        vendor: location, // Use location as the vendor
        product_type: 'Provider Search Listing', // Use a specific type for provider search listings
        variants: [{ price: offeredYearlySalary.toString() }], // Salary should be a string
        status: productStatus// Set Shopify status
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(shopifyUrl, 'POST', shopifyPayload);

    console.log('Product Response:', productResponse);

    const productId = productResponse.product.id;

    // Step 2: Create Structured Metafields for the Provider Listing Details
    const metafieldsPayload = [
      {
        namespace: 'fold_tech',
        key: 'location',
        value: location,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'qualification_requested',
        value: qualificationRequested,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'job_type',
        value: jobType,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'type_of_job_offered',
        value: typeOfJobOffered,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'offered_yearly_salary',
        value: offeredYearlySalary.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'offered_position_description',
        value: offeredPositionDescription,
        type: 'single_line_text_field',
      },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', { metafield });
    }

    // Step 3: Upload Image to Shopify if provided
    let imageId = null;
    let imageResponse = null;

    if (image) {
      const cloudinaryImageUrl = image.path; // Use the path to the image

      const imagePayload = {
        image: {
          src: cloudinaryImageUrl, // Use the local file path here; should be replaced with Cloudinary URL if you are using Cloudinary
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
      imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);
      imageId = imageResponse.image.id;
    }

    // Step 4: Save Provider Listing to MongoDB
    const newProviderListing = new productModel({
      id: productId,
      title: qualificationRequested,
      body_html: offeredPositionDescription,
      vendor: location,
      product_type: 'Provider Search Listing',
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imageId ? [{
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        created_at: imageResponse.image.created_at,
        updated_at: imageResponse.image.updated_at,
        alt: 'Provider Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      }] : [],
      image: imageId ? {
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        created_at: imageResponse.image.created_at,
        updated_at: imageResponse.image.updated_at,
        alt: 'Provider Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      } : null,
      providerListings: [{
        location,
        qualificationRequested,
        jobType,
        typeOfJobOffered,
        offeredYearlySalary,
        offeredPositionDescription,
        image: imageResponse ? imageResponse.image.src : null, // Store the image URL if available
      }],
      userId: userId,
      status: productStatus, // Save the status (active/inactive)
    });

    await newProviderListing.save();
  // If the product is published, decrease user subscription quantity
  if (productStatus === 'active') {
    const user = await authModel.findById(userId);
    if (!user) throw new Error('User not found');

    if (user.subscription && user.subscription.quantity > 0) {
      user.subscription.quantity -= 1; // Decrease subscription count
      await user.save();
    } else {
      return res.status(400).json({ error: 'Insufficient subscription quantity to publish.' });
    }
  }
  const expirationDate=user.subscription.expiresAt
  // Send a successful response
  res.status(201).json({
    message: `Product successfully created and ${productStatus === 'active' ? 'published' : 'saved as draft'}`,
    product: newProviderListing,
    expiresAt:expirationDate
  });
} catch (error) {
  console.error('Error in addNewEquipments function:', error);
  res.status(500).json({ error: error.message });
}
};


// Add Room listing
export const addRoomListing = async (req, res) => {
  try {
    // Extract room listing details from request body
    const {
      location,
      roomSize,
      monthlyRent,
      deposit,
      minimumInsuranceRequested,
      typeOfUseAllowed,
      rentalTerms,
      wifiAvailable,
      otherDetails,
      userId,
      status,
    } = req.body;

    // Handle file upload
    const image = req.file; // Handle file upload
    const productStatus = status === 'publish' ? 'active' : 'draft';
    // Validate required fields
    if (!location) {
      return res.status(400).json({ error: 'Location is required.' });
    }
    if (!roomSize) {
      return res.status(400).json({ error: 'Room size is required.' });
    }
    if (!monthlyRent) {
      return res.status(400).json({ error: 'Monthly rent is required.' });
    }
    if (!deposit) {
      return res.status(400).json({ error: 'Deposit is required.' });
    }
    if (!minimumInsuranceRequested) {
      return res.status(400).json({ error: 'Minimum insurance requested is required.' });
    }
    if (!typeOfUseAllowed) {
      return res.status(400).json({ error: 'Type of use allowed is required.' });
    }
    if (!rentalTerms) {
      return res.status(400).json({ error: 'Rental terms are required.' });
    }
    if (typeof wifiAvailable === 'undefined') {
      return res.status(400).json({ error: 'WiFi availability must be specified.' });
    }
    if (!otherDetails) {
      return res.status(400).json({ error: 'Other details are required.' });
    }

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: location, // Use location as the title
        body_html: otherDetails, // Use other details as body_html
        vendor: location, // Use location as the vendor
        product_type: 'Room Listing', // Use a specific type for room listings
        variants: [{ price: monthlyRent.toString() }], // Rent should be a string
        status: productStatus, 
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(shopifyUrl, 'POST', shopifyPayload);

    console.log('Product Response:', productResponse);

    const productId = productResponse.product.id;

    // Step 2: Create Structured Metafields for the Room Listing Details
    const metafieldsPayload = [
      {
        namespace: 'fold_tech',
        key: 'location',
        value: location,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'room_size',
        value: roomSize.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'monthly_rent',
        value: monthlyRent.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'deposit',
        value: deposit.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'minimum_insurance_requested',
        value: minimumInsuranceRequested.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'type_of_use_allowed',
        value: typeOfUseAllowed,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'rental_terms',
        value: rentalTerms,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'wifi_available',
        value: wifiAvailable.toString(),
        type: 'boolean',
      },
      {
        namespace: 'fold_tech',
        key: 'other_details',
        value: otherDetails,
        type: 'single_line_text_field',
      },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', { metafield });
    }

    // Step 3: Upload Image to Shopify if provided
    let imageId = null;
    let imageResponse = null;

    if (image) {
      const cloudinaryImageUrl = image.path; // Use the path to the image

      const imagePayload = {
        image: {
          src: cloudinaryImageUrl, // Use the local file path here; should be replaced with Cloudinary URL if you are using Cloudinary
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
      imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);
      imageId = imageResponse.image.id;
    }

    // Step 4: Save Room Listing to MongoDB
    const newRoomListing = new productModel({
      id: productId,
      title: location,
      body_html: otherDetails,
      vendor: location,
      product_type: 'Room Listing',
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imageId ? [{
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        alt: 'Room Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      }] : [],
      image: imageId ? {
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        alt: 'Room Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      } : null,
      roomListing: [{
        location,
        roomSize,
        monthlyRent,
        deposit,
        minimumInsuranceRequested,
        typeOfUseAllowed,
        rentalTerms,
        wifiAvailable,
        otherDetails,
        image: imageResponse ? imageResponse.image.src : null, // Store the image URL if available
      }],
      userId: userId,
      status: productStatus,
    });

    await newRoomListing.save();
const expirationDate=user.subscription.expiresAt
  // If the product is published, decrease user subscription quantity
  if (productStatus === 'active') {
    const user = await authModel.findById(userId);
    if (!user) throw new Error('User not found');

    if (user.subscription && user.subscription.quantity > 0) {
      user.subscription.quantity -= 1; // Decrease subscription count
      await user.save();
    } else {
      return res.status(400).json({ error: 'Insufficient subscription quantity to publish.' });
    }
  }

  // Send a successful response
  res.status(201).json({
    message: `Product successfully created and ${productStatus === 'active' ? 'published' : 'saved as draft'}`,
    product: newRoomListing,
    expiresAt:expirationDate
  });
} catch (error) {
  console.error('Error in addNewEquipments function:', error);
  res.status(500).json({ error: error.message });
}
};

// get product of specific user
export const getProduct = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Validate userId (basic check, you can enhance this)
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    // Find products by userId
    const products = await productModel.find({ userId: userId });

    // Check if products were found
    if (products.length === 0) {
      return res
        .status(404)
        .json({ message: 'No products found for this user.' });
    }

    // Send the found products as a response
    res.status(200).json({ products });
  } catch (error) {
    console.error('Error in getProductsByUserId function:', error);
    res.status(500).json({ error: error.message });
  }
};

// get product by search
export const getSearchProduct = async (req, res) => {
  const { query } = req.query; // Get search query from query parameters
  const { userId } = req.params; // Get user ID from URL parameters

  if (!query) {
    return res.status(400).send('Query parameter is required');
  }

  try {
    const products = await productModel.aggregate([
      {
        $match: {
          title: { $regex: query, $options: 'i' }, // Case-insensitive regex search
        },
      },
      {
        $unwind: '$variants', // Unwind the variants array if needed
      },
      {
        $project: {
          _id: 0,
          title: 1,
          product_type: 1,
          price: '$variants.price',
          product_id: '$variants.product_id',
          status: '$variants.status',
        },
      },
    ]);

    res.status(200).json(products);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const updateListing = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the document in MongoDB
    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    console.log('Shopify product ID:', product.id);

    // Prepare the update data for MongoDB
    const updateData = req.body;

    // Update the document in MongoDB
    const updatedProduct = await productModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });

    // Prepare data for Shopify
    const shopifyData = {
      product: {
        id: product.id, // Assuming the Shopify ID is stored in product.id
        ...updateData, // Include the fields to be updated
      },
    };

    // Construct the Shopify URL
    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/products/${shopifyData.product.id}.json`;
    console.log('Shopify URL:', shopifyUrl);
    // Update in Shopify
    const response = await fetch(shopifyUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shopifyData),
    });

    if (!response.ok) {
      return res.status(500).json({ message: 'Failed to update product in Shopify', details: await response.text() });
    }

    // Send successful response
    res.status(200).json({
      message: 'Product successfully updated in both MongoDB and Shopify',
      data: updatedProduct,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred', error: error.message });
  }
};


//delete product
export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    // Find product in MongoDB
    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if shopifyId is defined
    if (!product.id) {  // Use the correct field name
      return res.status(400).json({ message: 'Shopify ID is not available for this product' });
    }

    // Construct the Shopify URL
    const shopifyUrl = `https://med-spa-trader.myshopify.com/admin/api/2023-10/products/${product.id}.json`;

    // Delete from Shopify using Authorization header
    const response = await fetch(shopifyUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`).toString('base64')}`
      }
    });

    if (!response.ok) {
      return res.status(500).json({ message: 'Failed to delete product from Shopify', details: await response.text() });
    }

    // Delete from MongoDB
    await productModel.findByIdAndDelete(id);

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred', error: error.message });
  }
};

// webhook product deletion
export const productDelete = async (req, res) => {
  const { id } = req.body;

  if (!id) {
      return res.status(400).json({ message: 'Product ID is required' });
  }

  try {
      const result = await productModel.deleteOne({ shopifyId: id });
      
      if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Product not found in MongoDB' });
      }

      res.status(200).json({ message: 'Product successfully deleted from MongoDB' });
  } catch (error) {
      console.error('Error in deleteProduct function:', error);
      res.status(500).json({ error: error.message });
  }
};


export const publishProduct = async (req, res) => {
  try {
    const { productId } = req.params; // Get product ID from request parameters
    const { userId } = req.body; // Get user ID from request body

    // Validate productId and userId
    if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(userId)) {
      console.error('Validation Error: Invalid product ID or user ID');
      return res.status(400).send('Invalid product ID or user ID');
    }

    // Find the user by ID
    const user = await authModel.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return res.status(404).send('User not found');
    }

    // Check user's subscription quantity
    if (!user.subscription || user.subscription.quantity <= 1) {
      console.error(`Insufficient quantity: User ID ${userId}, Quantity: ${user.subscription ? user.subscription.quantity : 'undefined'}`);
      return res.status(400).send('Insufficient quantity to publish product');
    }

    // Find the product in your database
    const product = await productModel.findById(productId);
    if (!product) {
      console.error(`Product not found: ${productId}`);
      return res.status(404).send('Product not found or missing required fields');
    }

    // Log product details
    console.log('Found product:', product);

    // Get the Shopify ID from the product
    const id=product.id; // Ensure shopifyId is correctly stored in the product
    // Debugging line

    // Prepare Shopify API request data
    const shopifyUpdateData = {
      product: {
        id: id, // Use the correct shopifyId
        title: product.title, // Ensure title is included
        status: 'active', // Set status to active for publishing
      },
    };

    console.log('Shopify Update Data:', shopifyUpdateData); // Debugging line

    // Create Basic Auth header
    const basicAuth = Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`).toString('base64');

    // Update the product in Shopify
    const response = await fetch(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-01/products/${id}.json`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify(shopifyUpdateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Shopify API error for product ID ${id}: ${errorText}`); // Log detailed error
      return res.status(response.status).send(`Failed to update in Shopify: ${errorText}`);
    }

    // Update product status to 'active' in local database after successful Shopify update
    product.status = 'active';
    await product.save();

    // Decrease user subscription quantity
    user.subscription.quantity -= 1;
    await user.save();

    // Fetch the expiration date from the user's subscription
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


export const deletAllProduct=async(req,res)=>{
  try {
    productModel.deleteMany().then(result=>{
      if(result){
        res.status(200).send('sucessfully deleted')
      }
    })
  } catch (error) {
    
  }
}


export const newPublishProduct = async (req, res) => {
  try {
     // Get product ID from request parameters
    const { userId } = req.params; // Get user ID from request body

    // Validate productId and userId
    if ( !mongoose.isValidObjectId(userId)) {
      console.error('Validation Error: Invalid  user ID');
      return res.status(400).send('Invalid  user ID');
    }

    // Find the user by ID
    const user = await authModel.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return res.status(404).send('User not found');
    }

    // Check user's subscription quantity
    let productStatus = 'draft'; // Default to draft status
    if (user.subscription && user.subscription.quantity > 0) {
      productStatus = 'active'; // Set to active if quantity is greater than zero
    } else {
      console.error(`Insufficient quantity: User ID ${userId}, Quantity: ${user.subscription ? user.subscription.quantity : 'undefined'}`);
    }

    // Find the product in your database
  

    // Log product details

    // Get the Shopify ID from the product
    const id = product.id; // Ensure shopifyId is correctly stored in the product

    // Prepare Shopify API request data
    const shopifyUpdateData = {
      product: {
        id: id, // Use the correct shopifyId
        title: product.title, // Ensure title is included
        status: productStatus, // Use the determined status
      },
    };

    console.log('Shopify Update Data:', shopifyUpdateData); // Debugging line

    // Create Basic Auth header
    const basicAuth = Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`).toString('base64');

    // Update the product in Shopify
    const response = await fetch(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-01/products/${id}.json`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify(shopifyUpdateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Shopify API error for product ID ${id}: ${errorText}`); // Log detailed error
      return res.status(response.status).send(`Failed to update in Shopify: ${errorText}`);
    }

    // Update product status in local database
    product.status = productStatus;
    await product.save();

    // If the product is published with active status, decrease user subscription quantity
    if (productStatus === 'active') {
      user.subscription.quantity -= 1;
      await user.save();
    }

    // Fetch the expiration date from the user's subscription
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


