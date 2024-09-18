import { productModel } from '../Models/product.js';
import fetch from 'node-fetch';
import { authModel } from '../Models/auth.js';
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
    } = req.body;
    const image = req.file; // Handle file upload

    // Validate required fields
    if (!location) {
      errors.push('Location is required.');
  }
  if (!name) {
      errors.push('Name is required.');
  }
  if (!brand) {
      errors.push('Brand is required.');
  }
  if (!asking_price) {
      errors.push('Asking price is required.');
  }
  if (accept_offers === undefined) {
      errors.push('Accept offers is required.');
  }
  if (!equipment_type) {
      errors.push('Equipment type is required.');
  }
  if (!certification) {
      errors.push('Certification is required.');
  }
  if (!year_purchased) {
      errors.push('Year purchased is required.');
  }
  if (!warranty) {
      errors.push('Warranty is required.');
  }
  if (!reason_for_selling) {
      errors.push('Reason for selling is required.');
  }
  if (!shipping) {
      errors.push('Shipping details are required.');
  }
  if (!description) {
      errors.push('Description is required.');
  }
  if (!image) {
      errors.push('Image is required.');
  }

  // If there are errors, return them in a JSON response
  if (errors.length > 0) {
      return res.status(400).json({ errors });
  }

  // If all checks pass, proceed to the next middleware or route handler
  next();


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
          key: 'description',
          value: description,
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
    const cloudinaryImageUrl = image.path;
    // 'https://res.cloudinary.com/djocrwprs/image/upload/v1726029463/uploads/cejpbbglmdniw5ot49c4.png'; // Replace with the actual Cloudinary URL

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
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      approved: productResponse.product.approved,
      images: [
        {
          id: imageId,
          product_id: productId,
          position: imageResponse.image.position,
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
        description,
      },
      userId: userId,
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
      description,
      userId,
    } = req.body;
    const image = req.file; // Handle file upload

    // Validate required fields
    if (!location) {
      return res.status(400).json({ error: 'Location is required.' });
  }
  if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
  }
  if (!brand) {
      return res.status(400).json({ error: 'Brand is required.' });
  }
  if (!sale_price) {
      return res.status(400).json({ error: 'Sale price is required.' });
  }
  if (!equipment_type) {
      return res.status(400).json({ error: 'Equipment type is required.' });
  }
  if (!certification) {
      return res.status(400).json({ error: 'Certification is required.' });
  }
  if (!year_manufactured) {
      return res.status(400).json({ error: 'Year manufactured is required.' });
  }
  if (!warranty) {
      return res.status(400).json({ error: 'Warranty is required.' });
  }
  if (!training) {
      return res.status(400).json({ error: 'Training is required.' });
  }
  if (!shipping) {
      return res.status(400).json({ error: 'Shipping details are required.' });
  }
  if (!description) {
      return res.status(400).json({ error: 'Description is required.' });
  }
  if (!image) {
      return res.status(400).json({ error: 'Image is required.' });
  }

  // If all checks pass, proceed to the next middleware or route handler
  next();
    

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
          key: 'name',
          value: name,
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'description',
          value: description,
          type: 'single_line_text_field',
        },
      },
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
        description,
      },
      userId: userId,
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

export const addNewBusiness = async (req, res) => {
  try {
    // Extract business listing details from request body
    const {
      location,
      businessDescription,
      askingPrice,
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
    } = req.body;

    const image = req.file; // Handle file upload

    if (!location) {
      return res.status(400).json({ error: 'Location is required.' });
  }
  if (!businessDescription) {
      return res.status(400).json({ error: 'Business description is required.' });
  }
  if (!askingPrice) {
      return res.status(400).json({ error: 'Asking price is required.' });
  }
  if (!establishedYear) {
      return res.status(400).json({ error: 'Established year is required.' });
  }
  if (!numberOfEmployees) {
      return res.status(400).json({ error: 'Number of employees is required.' });
  }
  if (!locationMonthlyRent) {
      return res.status(400).json({ error: 'Location monthly rent is required.' });
  }
  if (!leaseExpirationDate) {
      return res.status(400).json({ error: 'Lease expiration date is required.' });
  }
  if (!locationSize) {
      return res.status(400).json({ error: 'Location size is required.' });
  }
  if (!grossYearlyRevenue) {
      return res.status(400).json({ error: 'Gross yearly revenue is required.' });
  }
  if (!cashFlow) {
      return res.status(400).json({ error: 'Cash flow is required.' });
  }
  if (!productsInventory) {
      return res.status(400).json({ error: 'Products inventory is required.' });
  }
  if (!equipmentValue) {
      return res.status(400).json({ error: 'Equipment value is required.' });
  }
  if (!reasonForSelling) {
      return res.status(400).json({ error: 'Reason for selling is required.' });
  }
  if (!listOfDevices) {
      return res.status(400).json({ error: 'List of devices is required.' });
  }
  if (!offeredServices) {
      return res.status(400).json({ error: 'Offered services are required.' });
  }
  if (!supportAndTraining) {
      return res.status(400).json({ error: 'Support and training information is required.' });
  }
  if (!image) {
      return res.status(400).json({ error: 'Image is required.' });
  }

  // If all checks pass, proceed to the next middleware or route handler
  next();
    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: businessDescription, // Use business description as the title
        body_html: '', // Leave body_html empty, as we'll use metafields for details
        vendor: location, // Use location as the vendor
        product_type: 'Business Listing', // Use a specific type for business listings
        variants: [{ price: askingPrice.toString() }], // Price should be a string
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

    // Step 2: Create Structured Metafields for the Business Listing Details
    const metafieldsPayload = [
      {
        namespace: 'fold_tech',
        key: 'location',
        value: location,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'business_description',
        value: businessDescription,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'asking_price',
        value: askingPrice.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'established_year',
        value: establishedYear.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'number_of_employees',
        value: numberOfEmployees.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'location_monthly_rent',
        value: locationMonthlyRent.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'lease_expiration_date',
        value: new Date(leaseExpirationDate).toISOString(),
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'location_size',
        value: locationSize.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'gross_yearly_revenue',
        value: grossYearlyRevenue.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'cash_flow',
        value: cashFlow.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'products_inventory',
        value: productsInventory.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'equipment_value',
        value: equipmentValue.toString(),
        type: 'number_integer',
      },
      {
        namespace: 'fold_tech',
        key: 'reason_for_selling',
        value: reasonForSelling,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'list_of_devices',
        value: JSON.stringify(listOfDevices),
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'offered_services',
        value: JSON.stringify(offeredServices),
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'support_and_training',
        value: supportAndTraining,
        type: 'single_line_text_field',
      },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', { metafield });
    }

    // Step 3: Upload Image to Shopify
    const cloudinaryImageUrl = image.path;
    // 'https://res.cloudinary.com/djocrwprs/image/upload/v1726029463/uploads/cejpbbglmdniw5ot49c4.png'; // Replace with actual Cloudinary URL

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
      title: businessDescription,
      body_html: '', // Empty body_html as we use metafields for details
      vendor: location,
      product_type: 'Business Listing',
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
          alt: 'Business Listing Image',
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
        alt: 'Business Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      },
      business: {
        location,
        businessDescription,
        askingPrice,
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
        listOfDevices: JSON.parse(listOfDevices),
        offeredServices: JSON.parse(offeredServices),
        supportAndTraining,
      },
      userId: userId,
    });

    await newProduct.save();

    // Send a successful response
    res.status(201).json({
      message: 'Business listing successfully created and saved',
      product: newProduct,
    });
  } catch (error) {
    console.error('Error in addBusinessListing function:', error);
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
    } = req.body;

    // Handle file upload
    const image = req.file; // Handle file upload
    if (!location) {
      return res.status(400).json({ error: 'Location is required.' });
  }
  if (!name) {
      return res.status(400).json({ error: 'Name is required.' });
  }
  if (!qualification) {
      return res.status(400).json({ error: 'Qualification is required.' });
  }
  if (!positionRequestedDescription) {
      return res.status(400).json({ error: 'Position requested description is required.' });
  }
  if (!availability) {
      return res.status(400).json({ error: 'Availability is required.' });
  }
  if (!requestedYearlySalary) {
      return res.status(400).json({ error: 'Requested yearly salary is required.' });
  }
  if (!image) {
      return res.status(400).json({ error: 'Image is required.' });
  }

  // If all checks pass, proceed to the next middleware or route handler
  next();
    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: name, // Use job name as the title
        body_html: positionRequestedDescription, // Use position description as body_html
        vendor: location, // Use location as the vendor
        product_type: 'Job Listing', // Use a specific type for job listings
        variants: [{ price: requestedYearlySalary.toString() }], // Salary should be a string
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

    // Step 2: Create Structured Metafields for the Job Listing Details
    const metafieldsPayload = [
      {
        namespace: 'fold_tech',
        key: 'location',
        value: location,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'name',
        value: name,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'qualification',
        value: qualification,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'position_requested_description',
        value: positionRequestedDescription,
        type: 'single_line_text_field',
      },
      // { namespace: 'fold_tech', key: 'experience', value: experience.toString(), type: 'number_integer' },
      {
        namespace: 'fold_tech',
        key: 'availability',
        value: availability,
        type: 'single_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'requested_yearly_salary',
        value: requestedYearlySalary.toString(),
        type: 'number_decimal',
      },
      {
        namespace: 'fold_tech',
        key: 'image',
        value: image.path,
        type: 'single_line_text_field',
      },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', { metafield });
    }

    // Step 3: Upload Image to Shopify
    const cloudinaryImageUrl = image.path; // Use the path to the image

    const imagePayload = {
      image: {
        src: cloudinaryImageUrl, // Use the local file path here; should be replaced with Cloudinary URL if you are using Cloudinary
      },
    };

    const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
    const imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);

    const imageId = imageResponse.image.id;

    // Step 4: Save Product to MongoDB
    const newJobListing = new productModel({
      id: productId,
      title: name,
      body_html: positionRequestedDescription,
      vendor: location,
      product_type: 'Job Listing',
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: [
        {
          id: imageId,
          product_id: productId,
          position: imageResponse.image.position,
          alt: 'Job Listing Image',
          width: imageResponse.image.width,
          height: imageResponse.image.height,
          src: imageResponse.image.src,
        },
      ],
      image: {
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        alt: 'Job Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      },
      jobListings: [
        {
          location,
          name,
          qualification,
          positionRequestedDescription,
          //experience,
          availability,
          requestedYearlySalary,
          image: imageResponse.image.src, // Store the image URL
        },
      ],
      userId: userId,
    });

    await newJobListing.save();

    // Clean up the uploaded file if necessary
    // Remove the file from local storage

    // Send a successful response
    res.status(201).json({
      message: 'Job listing successfully created and saved',
      product: newJobListing,
    });
  } catch (error) {
    console.error('Error in addNewJobListing function:', error);
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
    } = req.body;

    // Handle file upload
    const image = req.file; // Handle file upload

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
      return res.status(400).json({ error: 'Offered position description is required.' });
  }
  if (!image) {
      return res.status(400).json({ error: 'Image is required.' });
  }

  // If all checks pass, proceed to the next middleware or route handler
  next();
    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: qualificationRequested, // Use qualification requested as the title
        body_html: offeredPositionDescription, // Use offered position description as body_html
        vendor: location, // Use location as the vendor
        product_type: 'Provider Search Listing', // Use a specific type for provider search listings
        variants: [{ price: offeredYearlySalary.toString() }], // Salary should be a string
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

    // Step 3: Upload Image to Shopify
    const cloudinaryImageUrl = image.path; // Use the path to the image

    const imagePayload = {
      image: {
        src: cloudinaryImageUrl, // Use the local file path here; should be replaced with Cloudinary URL if you are using Cloudinary
      },
    };

    const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
    const imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);

    const imageId = imageResponse.image.id;

    // Step 4: Save Provider Listing to MongoDB
    const newProviderListing = new productModel({
      id: productId,
      title: qualificationRequested,
      body_html: offeredPositionDescription,
      vendor: location,
      product_type: 'Provider Search Listing',
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: [
        {
          id: imageId,
          product_id: productId,
          position: imageResponse.image.position,
          created_at: imageResponse.image.created_at,
          updated_at: imageResponse.image.updated_at,
          alt: 'Provider Listing Image',
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
        alt: 'Provider Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      },
      providerListings: [
        {
          location,
          qualificationRequested,
          jobType,
          typeOfJobOffered,
          offeredYearlySalary,
          offeredPositionDescription,
          image: imageResponse.image.src, // Store the image URL
        },
      ],
      userId: userId,
    });

    await newProviderListing.save();

    // Clean up the uploaded file if necessary
    // Remove the file from local storage

    // Send a successful response
    res.status(201).json({
      message: 'Provider listing successfully created and saved',
      product: newProviderListing,
    });
  } catch (error) {
    console.error('Error in addNewProviderListing function:', error);
    res.status(500).json({ error: error.message });
  }
};

// Add Room listing

export const addRoomListing = async (req, res) => {
  try {
    // Extract provider listing details from request body
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
    } = req.body;

    // Handle file upload
    const image = req.file; // Handle file upload
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
  if (!image) {
      return res.status(400).json({ error: 'Image is required.' });
  }

  // If all checks pass, proceed to the next middleware or route handler
  next();
    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: location, // Use qualification requested as the title
        body_html: otherDetails, // Use offered position description as body_html
        vendor: location, // Use location as the vendor
        product_type: 'Room Listing', // Use a specific type for provider search listings
        variants: [{ price: monthlyRent.toString() }], // Salary should be a string
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

    // Step 3: Upload Image to Shopify
    const cloudinaryImageUrl = image.path; // Use the path to the image

    const imagePayload = {
      image: {
        src: cloudinaryImageUrl, // Use the local file path here; should be replaced with Cloudinary URL if you are using Cloudinary
      },
    };

    const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
    const imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);

    const imageId = imageResponse.image.id;

    // Step 4: Save Provider Listing to MongoDB
    const newProviderListing = new productModel({
      id: productId,
      title: location,
      body_html: otherDetails,
      vendor: location,
      product_type: 'Room Search Listing',
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: [
        {
          id: imageId,
          product_id: productId,
          position: imageResponse.image.position,
          alt: 'Room Listing Image',
          width: imageResponse.image.width,
          height: imageResponse.image.height,
          src: imageResponse.image.src,
        },
      ],
      image: {
        id: imageId,
        product_id: productId,
        position: imageResponse.image.position,
        alt: 'Room Listing Image',
        width: imageResponse.image.width,
        height: imageResponse.image.height,
        src: imageResponse.image.src,
      },
      roomListing: [
        {
          location,
          roomSize,
          monthlyRent,
          deposit,
          minimumInsuranceRequested,
          typeOfUseAllowed,
          rentalTerms,
          wifiAvailable,
          otherDetails,
          image: imageResponse.image.src, // Store the image URL
        },
      ],
      userId: userId,
    });

    await newProviderListing.save();

    // Clean up the uploaded file if necessary
    // Remove the file from local storage

    // Send a successful response
    res.status(201).json({
      message: 'Provider listing successfully created and saved',
      product: newProviderListing,
    });
  } catch (error) {
    console.error('Error in addNewProviderListing function:', error);
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

//delete product
export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    // Attempt to find and delete the product by its ID
    const result = await productModel.findByIdAndDelete(id);

    if (result) {
      // If the product was found and deleted
      res.status(200).json({
        message: 'Product successfully deleted',
      });
    } else {
      // If the product was not found
      res.status(404).json({
        message: 'Product not found',
      });
    }
  } catch (error) {
    // Log and return a 500 status code for server errors
    console.error('Error in deleteProduct function:', error);
    res.status(500).json({
      error: error.message,
    });
  }
};

// Handler for product deletion
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


