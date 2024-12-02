import { productModel } from '../Models/product.js';
import fetch from 'node-fetch';
import { authModel } from '../Models/auth.js';
import mongoose from 'mongoose';
import { BuyCreditModel } from '../Models/buyCredit.js';
import fs from 'fs'
import { listingModel } from '../Models/Listing.js';


export const updateListing = async (req, res) => {
  const { id } = req.params; // MongoDB ID
  const { userId } = req.body; // User ID from body
  const updateData = req.body; // Data to update
  const images = req.files?.images || []; // Expecting multiple images
  const imagesData = [];

  try {
    // Fetch user by userId
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const username = user.userName ; // Fallback to 'Unknown' if not available
    const country = user.country;
   const email=user.email;
   const phoneNumber=user.phoneNumber
    const city=user.city
    const firstName=user.firstName
    const lastName=user.lastName
    // Find the product by MongoDB ID
    const product = await listingModel.findOne({id});
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Validate that the product_type matches the data being updated
    const { product_type } = product;

    // Handle image uploads if images exist in the request
    if (Array.isArray(images) && images.length > 0) {
      for (const image of images) {
        const cloudinaryImageUrl = image?.path; // Assuming `path` has the Cloudinary URL

        const imagePayload = {
          image: {
            src: cloudinaryImageUrl, // Cloudinary URL
            alt: 'Product Image', // Optional alt text
          },
        };

        // Shopify image upload URL
        const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${product.id}/images.json`;

        // Upload image to Shopify
        const imageResponse = await shopifyRequest(
          imageUrl,
          'POST',
          imagePayload
        );

        if (imageResponse && imageResponse.image) {
          imagesData.push({
            id: imageResponse.image.id,
            product_id: product.id,
            position: imageResponse.image.position,
            alt: 'Product Image',
            width: imageResponse.image.width,
            height: imageResponse.image.height,
            src: imageResponse.image.src,
          });
        }
      }

      // Update the product's images array with the new images
      product.images = imagesData; // Replace existing images
      updateData.images = imagesData; // Ensure the images are updated in MongoDB as well
    }

    // Define metafield arrays for different product types
    let metafieldsPayload = [];

    if (product_type === 'Used Equipments') {
      metafieldsPayload = [
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'zip',
            value: updateData.zip || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'city',
            value: updateData.city || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'location',
            value: updateData.location || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'brand',
            value: updateData.brand,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'description',
            value: updateData.description,
            type: 'multi_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'asking_price',
            value: updateData.asking_price,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'accept_offers',
            value: updateData.accept_offers,
            type: 'boolean',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'equipment_type',
            value: updateData.equipment_type,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'certification',
            value: updateData.certification,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'year_purchased',
            value: updateData.year_purchased,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'warranty',
            value: updateData.warranty,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'reason_for_selling',
            value: updateData.reason_for_selling,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'shipping',
            value: updateData.shipping,
            type: 'single_line_text_field',
          },
        },
        // {
        //   metafield:  {
        //     namespace: 'fold_tech',
        //     key: 'userinformation',
        //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
        //     type: 'single_line_text_field',
        //   },
        // },
      ];
    } else if (product_type === 'Businesses To Purchase') {
      metafieldsPayload = [
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'zip',
            value: updateData.zip || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'location',
            value: updateData.location,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'business_description',
            value: updateData.businessDescription,
            type: 'multi_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'asking_price',
            value: updateData.asking_price.toString(),
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'established_year',
            value: updateData.establishedYear.toString(),
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'number_of_employees',
            value: updateData.numberOfEmployees.toString(),
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'location_monthly_rent',
            value: updateData.locationMonthlyRent.toString(),
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'lease_expiration_date',
            value: new Date(updateData.leaseExpirationDate).toISOString(),
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'location_size',
            value: updateData.locationSize.toString(),
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'gross_yearly_revenue',
            value: updateData.grossYearlyRevenue.toString(),
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'cash_flow',
            value: updateData.cashFlow.toString(),
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'products_inventory',
            value: updateData.productsInventory.toString(),
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'equipment_value',
            value: updateData.equipmentValue.toString(),
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'reason_for_selling',
            value: updateData.reasonForSelling,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'list_of_devices',
            value: JSON.stringify(updateData.listOfDevices),
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'offered_services',
            value: JSON.stringify(updateData.offeredServices),
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'support_and_training',
            value: updateData.supportAndTraining,
            type: 'single_line_text_field',
          },
        },
        // {
        //   metafield:  {
        //     namespace: 'fold_tech',
        //     key: 'userinformation',
        //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
        //     type: 'single_line_text_field',
        //   },
        // },
      ];
    } else if (product_type === 'Providers Available') {
      metafieldsPayload = [
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'zip',
            value: updateData.zip || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'location',
            value: updateData.location || 'Unknown',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'name',
            value: updateData.name || 'No Name Provided',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'qualification_requested',
            value: updateData.qualificationRequested || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'requested_yearly_salary',
            value:
              updateData.requestedYearlySalary !== undefined
                ? updateData.requestedYearlySalary.toString()
                : 'Not specified',
            type: 'number_decimal',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'position_requested_description',
            value: updateData.positionRequestedDescription || 'No Description',
            type: 'multi_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'availability',
            value: updateData.availability || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        // {
        //   metafield:  {
        //     namespace: 'fold_tech',
        //     key: 'userinformation',
        //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
        //     type: 'single_line_text_field',
        //   },
        // },
      ];
    } else if (product_type === 'Provider Needed') {
      metafieldsPayload = [
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'zip',
            value: updateData.zip || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'location',
            value: updateData.location,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'qualification_requested',
            value: updateData.qualificationRequested,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'job_type',
            value: updateData.jobType,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'type_of_job_offered',
            value: updateData.typeOfJobOffered,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'offered_yearly_salary',
            value: updateData.offeredYearlySalary,
            type: 'number_integer',  // Ensure this is actually an integer
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'offered_position_description',
            value: updateData.offeredPositionDescription,
            type: 'multi_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'availableToWorkAs',
            value: updateData.availableToWorkAs,
            type: 'single_line_text_field',
          },
        },
        // {
        //   metafield:  {
        //     namespace: 'fold_tech',
        //     key: 'userinformation',
        //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
        //     type: 'single_line_text_field',
        //   },
        // },
      ];
    
    } else if (product_type === 'Spa Room For Rent') {
      metafieldsPayload = [
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'zip',
            value: updateData.zip || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'location',
            value: updateData.location,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'room_size',
            value: updateData.roomSize,
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'monthly_rent',
            value: updateData.monthlyRent,
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'deposit',
            value: updateData.deposit,
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'minimum_insurance_requested',
            value: updateData.minimumInsuranceRequested,
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'type_of_use_allowed',
            value: updateData.typeOfUseAllowed,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'rental_terms',
            value: updateData.rentalTerms,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'wifi_available',
            value: updateData.wifiAvailable,
            type: 'boolean',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'other_details',
            value: updateData.otherDetails,
            type: 'multi_line_text_field',
          },
        },
        // {
        //   metafield:  {
        //     namespace: 'fold_tech',
        //     key: 'userinformation',
        //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
        //     type: 'single_line_text_field',
        //   },
        // },
      ];
    } else if (product_type === 'New Equipments') {
      metafieldsPayload = [
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'zip',
            value: updateData.zip || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'name',
            value: updateData.name,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'description',
            value: updateData.description,
            type: 'multi_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'location',
            value: updateData.location || 'Unknown',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'brand',
            value: updateData.brand,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'sale_price',
            value: updateData.sale_price.toString(),
            type: 'number_integer',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'equipment_type',
            value: updateData.equipment_type,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'certification',
            value: updateData.certification,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'year_manufactured',
            value: updateData.year_manufactured.toString(),
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'warranty',
            value: updateData.warranty,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'training',
            value: updateData.training,
            type: 'multi_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'shipping',
            value: updateData.shipping || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        // {
        //   metafield:  {
        //     namespace: 'fold_tech',
        //     key: 'userinformation',
        //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
        //     type: 'single_line_text_field',
        //   },
        // },
      ];
    }else if (product_type === 'Looking For') {
      metafieldsPayload = [
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'zip',
            value: updateData.zip || 'Not specified',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'name',
            value: updateData.name,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'description',
            value: updateData.description,
            type: 'multi_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'location',
            value: updateData.location || 'Unknown',
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'brand',
            value: updateData.brand,
            type: 'single_line_text_field',
          },
        },
        {
          metafield: {
            namespace: 'fold_tech',
            key: 'sale_price',
            value: updateData.sale_price,
            type: 'number_integer',
          },
        },
        // {
        //   metafield:  {
        //     namespace: 'fold_tech',
        //     key: 'userinformation',
        //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
        //     type: 'single_line_text_field',
        //   },
        // },
      ];
    }

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${id}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', metafield);
    }
    // Prepare Shopify payload, including user info
    const shopifyPayload = {
      product: {
        title: `${updateData.name || updateData.qualificationRequested || updateData.typeOfUseAllowed} | ${country} , ${updateData.location} , ${updateData.zip}`,
        body_html: updateData.businessDescription || updateData.description || updateData.offeredPositionDescription || updateData.otherDetails ,
        vendor: updateData.brand || updateData.location,
        tags: `zip_${updateData.zip}, location_${updateData.location}, username_${username}`,
        images: product.images, // Attach updated images
      },
    };

    // Shopify update API URL
    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${product.id}.json`;

    // Update the product in Shopify
    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shopifyPayload),
    });

    if (!shopifyResponse.ok) {
      const errorDetails = await shopifyResponse.text();
      return res.status(500).json({
        message: 'Failed to update product in Shopify',
        details: errorDetails,
      });
    }
    const currentStatus = product.status;
if (product_type === 'Used Equipments' || product_type === 'New Equipments' ) {
  updateData.equipment = {
    location: req.body.location,
    zip: req.body.zip,
    name: req.body.name,
    brand: req.body.brand,
    asking_price: req.body.asking_price,
    accept_offers: req.body.accept_offers,
    equipment_type: req.body.equipment_type,
    certification: req.body.certification,
    year_purchased: req.body.year_purchased,
    warranty: req.body.warranty,
    reason_for_selling: req.body.reason_for_selling,
    shipping: req.body.shipping,
    sale_price: req.body.sale_price,
    year_manufactured: req.body.year_manufactured,
    training: req.body.training,
    description: req.body.description,
    city:req.body.city,
  };
}

if (product_type === 'Businesses To Purchase') {
  updateData.business = {
    name: req.body.name,
    location: req.body.location,
    zip: req.body.zip,
    businessDescription: req.body.businessDescription,
    asking_price: req.body.asking_price,
    establishedYear: req.body.establishedYear,
    numberOfEmployees: req.body.numberOfEmployees,
    locationMonthlyRent: req.body.locationMonthlyRent,
    leaseExpirationDate: new Date(req.body.leaseExpirationDate),
    locationSize: req.body.locationSize,
    grossYearlyRevenue: req.body.grossYearlyRevenue,
    cashFlow: req.body.cashFlow,
    productsInventory: req.body.productsInventory,
    equipmentValue: req.body.equipmentValue,
    reasonForSelling: req.body.reasonForSelling,
    listOfDevices: req.body.listOfDevices,
    offeredServices: req.body.offeredServices,
    supportAndTraining: req.body.supportAndTraining,
  };
}

if (product_type === 'Spa Room For Rent') {
  updateData.roomListing = [
    {
      location: req.body.location,
      zip: req.body.zip,
      roomSize: req.body.roomSize,
      monthlyRent: req.body.monthlyRent,
      deposit: req.body.deposit,
      minimumInsuranceRequested: req.body.minimumInsuranceRequested,
      typeOfUseAllowed: req.body.typeOfUseAllowed,
      rentalTerms: req.body.rentalTerms,
      wifiAvailable: req.body.wifiAvailable,
      otherDetails: req.body.otherDetails,
      images: imagesData, // Assuming imagesData is already defined
    },
  ];
}

if (product_type === 'Provider Needed') {
  updateData.providerListings = [
    {
      location: req.body.location,
      zip: req.body.zip,
      qualificationRequested: req.body.qualificationRequested,
      jobType: req.body.jobType,
      typeOfJobOffered: req.body.typeOfJobOffered,
      offeredYearlySalary: req.body.offeredYearlySalary,
      offeredPositionDescription: req.body.offeredPositionDescription,
      images: imagesData, // Assuming imagesData is already defined
    },
  ];
}

if (product_type === 'Providers Available') {
  updateData.jobListings = [
    {
      location: req.body.location,
      zip: req.body.zip,
      name: req.body.name,
      qualification: req.body.qualification,
      positionRequestedDescription: req.body.positionRequestedDescription,
      availability: req.body.availability,
      requestedYearlySalary: req.body.requestedYearlySalary,
      jobType:req.body.jobType,
      availableToWorkAs:req.body.availableToWorkAs,
      images: imagesData, // Assuming imagesData is already defined
    },
  ];
}
if (product_type === 'Looking For') {
  updateData.looking = {
    name: req.body.name,
    location: req.body.location,
    zip: req.body.zip,
    brand: req.body.brand,
    sale_price: req.body.sale_price,
    description: req.body.description,
    images:imagesData
  };
}
// Set common fields for all product types
const commonFields = {
  title: req.body.name || req.body.qualificationRequested,
  body_html: req.body.description || req.body.offeredPositionDescription || req.body.otherDetails,
  vendor: req.body.brand,
  product_type,
  status:currentStatus,
  created_at: new Date(),
};

// Combine common fields with the specific update data
const updatedProduct = await listingModel.findOneAndUpdate(
  { id },
  { ...commonFields, ...updateData },
  { new: true } // Option to return the updated document
);
 
return res
      .status(200)
      .json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({ message: 'An error occurred', error });
  }
};
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
    throw new Error(`request failed${errorText}`);
  }

  return response.json();
};

export  const addProduct = async (req, res) => {
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
  let productId;
  try {
    // Extract equipment details from request body
    const {
      location,
      zip,
      name, // Required field
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
      city,
      userId,
      status
    } = req.body;
    // Validate required field
    const productStatus = status === 'publish' ? 'active' : 'draft';
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const username = user.userName; // Fetch username, default to 'Unknown' if not found
    const phoneNumber = user.phoneNumber;
    const country = user.country;
    const newcity = user.city;
    const email = user.email;
    const firstName=user.firstName;
    const lastName=user.lastName
    // const formattedDescription = description.replace(/\n/g, '<br>');

    // Validate required fields
    if (!zip) return res.status(400).json({ error: 'Zipcode is required.' });
    if (!accept_offers) return res.status(400).json({ error: 'Accept offers is required.' });
    if (!location) return res.status(400).json({ error: 'Location is required.' });
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (!brand) return res.status(400).json({ error: 'Brand is required.' });
    if (asking_price === undefined) return res.status(400).json({ error: 'asking price is required.' });
    if (!equipment_type) return res.status(400).json({ error: 'Equipment type is required.' });
    if (!certification) return res.status(400).json({ error: 'Certification is required.' });
    if (year_purchased === undefined) return res.status(400).json({ error: 'Year purchased is required.' });
    if (warranty === undefined) return res.status(400).json({ error: 'Warranty is required.' });
    if (!reason_for_selling) return res.status(400).json({ error: 'reason for selling are required.' });
    if (!shipping) return res.status(400).json({ error: 'Shipping information is required.' });
    if (!description) return res.status(400).json({ error: 'Description is required.' });
    if (!req.files?.images || req.files.images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }
// const fullLocation=`${city}_${location}`
    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: `${name} | ${country} , ${location} , ${zip}`,
        body_html: description,
        vendor: brand,
        product_type: 'Used Equipments',
        variants: [{ price: asking_price.toString() }],
        status: productStatus,
        tags: [`zip_${zip}`, `location_${location}`, `username_${username}`], // Include username in tags
      },
    };
    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(shopifyUrl, 'POST', shopifyPayload);
    productId = productResponse.product.id;

    // Step 2: Create Structured Metafields for the Equipment Details
    const metafieldsPayload = [
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'zip',
          value: zip || 'Not specified',
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'location',
          value: location || 'Not specified',
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
          type: 'multi_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'asking_price',
          value: asking_price.toString(),
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'accept_offers',
          value: accept_offers,
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
          type: 'single_line_text_field',
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
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'userinformation',
          value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${newcity} - ${country}`,
          type: 'single_line_text_field',
        },
      },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', metafield);
    }

    // Step 3: Upload Images to Shopify if provided
    const images = req.files?.images || [];
    const imagesData = [];

    for (const image of images) {
      const cloudinaryImageUrl = image.path; // Ensure we use the correct path

      const imagePayload = {
        image: {
          src: cloudinaryImageUrl,
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
      const imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);

      if (imageResponse && imageResponse.image) {
        imagesData.push({
          id: imageResponse.image.id,
          product_id: productId,
          position: imageResponse.image.position,
          created_at: imageResponse.image.created_at,
          updated_at: imageResponse.image.updated_at,
          alt: 'Equipment Image',
          width: imageResponse.image.width,
          height: imageResponse.image.height,
          src: imageResponse.image.src,
        });
      }
    }

    const createdAt = new Date();
    const expirationDate = new Date(createdAt);
    expirationDate.setMonth(expirationDate.getMonth() + 6);

    // Step 4: Save Product to MongoDB
    const newProduct = new listingModel({
      id: productId,
      title: name,
      body_html: description,
      vendor: brand,
      product_type: 'Used Equipments',
      created_at: new Date(),
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imagesData,
      equipment: {
        location: location || 'Not specified',
        zip,
        name,
        brand: brand,
        asking_price: asking_price,
        accept_offers: !!accept_offers,
        equipment_type: equipment_type,
        certification: certification,
        year_purchased: year_purchased,
        warranty: warranty,
        reason_for_selling: reason_for_selling,
        shipping: shipping,
        description,
        city,
      },
      userId,
      status: productStatus,
    });

    await newProduct.save();

    if (status === 'active') {
      const user = await authModel.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Check subscription quantity
      const productConfig = await productModel.findOne({ product_type: 'Used Equipments' });
      if (!productConfig) {
        return res.status(404).json({ error: 'Product configuration not found.' });
      }

      // if (!user.subscription || user.subscription.quantity <= 0) {
      //   return res.status(400).json({ error: 'Insufficient subscription credits to publish product.' });
      // }

      if (user.subscription.quantity < productConfig.credit_required) {
        return res.status(400).json({
          error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
        });
      }

      // Decrement the subscription quantity
      user.subscription.quantity -= productConfig.credit_required;
      await user.save();

      // Set expiration date to 30 days from now
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Step 6: Update product status in Shopify
      const updateShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
      const shopifyUpdatePayload = {
        product: {
          id: productId,
          status: 'active',
          published_scope: 'global',
        },
      };

      const shopifyResponse = await shopifyRequest(updateShopifyUrl, 'PUT', shopifyUpdatePayload);
      if (!shopifyResponse.product) {
        return res.status(400).json({ error: 'Failed to update product status in Shopify.' });
      }

      // Step 7: Update product status in MongoDB
      const updatedProduct = await listingModel.findOneAndUpdate(
        { id: productId },
        { status: 'active', expiresAt },
        { new: true }
      );

      if (!updatedProduct) {
        return res.status(404).json({ error: 'Product not found in database.' });
      }

      // Schedule the unpublish task
      // scheduleUnpublish(productId, userId, expiresAt);

      // Send a successful response
      return res.status(201).json({
        message: 'Product successfully created and published.',
        product: updatedProduct,
        expiresAt,
      });
    }

    // If the product is saved as draft
    res.status(201).json({
      message: 'Product successfully created and saved as draft.',
      product: newProduct,
      expiresAt: null, // No expiration date for draft
    });
  } catch (error) {
    console.error('Error in addNewEquipments function:', error);

    // Attempt to delete the product from Shopify if it was created
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


export const addNewEquipments = async (req, res) => {
  let productId; // Declare productId outside try block for access in catch
  try {
    // Validate input data

    // Extract equipment details and action from request body
    const {
      location,
      zip,
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
    if (!zip) return res.status(400).json({ error: 'ZipCode is required.' });
    if (!location)
      return res.status(400).json({ error: 'Location is required.' });
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (!brand) return res.status(400).json({ error: 'Brand is required.' });
    if (sale_price === undefined)
      return res.status(400).json({ error: 'Sale price is required.' });
    if (!equipment_type)
      return res.status(400).json({ error: 'Equipment type is required.' });
    if (!certification)
      return res.status(400).json({ error: 'Certification is required.' });
    if (year_manufactured === undefined)
      return res.status(400).json({ error: 'Year manufactured is required.' });
    if (warranty === undefined)
      return res.status(400).json({ error: 'Warranty is required.' });
    if (!training)
      return res.status(400).json({ error: 'Training details are required.' });
    if (!shipping)
      return res
        .status(400)
        .json({ error: 'Shipping information is required.' });
    if (!description)
      return res.status(400).json({ error: 'Description is required.' });
    if (!req.files?.images || req.files.images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }
    // Determine product status based on action
    const productStatus = status === 'publish' ? 'active' : 'draft';

    // const formattedDescription = description.replace(/\n/g, '<br>');

    // Step 1: Fetch user to get the username
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const username = user.userName; // Fetch username, default to 'Unknown' if not found
    const phoneNumber = user.phoneNumber;
    const country = user.country;
    const city = user.city;
    const email = user.email;
    const firstName=user.firstName;
    const lastName=user.lastName
    // Step 2: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: `${name} | ${country},${location},${zip}`,
        body_html: description,
        vendor: brand,
        product_type: 'New Equipments',
        variants: [{ price: sale_price.toString() }],
        status: productStatus,
        published_scope: 'global',
        tags: [`zip_${zip}`, `location_${location}`, `username_${username}`], // Include username in tags
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(
      shopifyUrl,
      'POST',
      shopifyPayload
    );
    productId = productResponse.product.id; // Assign productId

    // Step 3: Create Structured Metafields for the Equipment Details
    const metafieldsPayload = [
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'zip',
          value: zip || 'Not specified',
          type: 'single_line_text_field',
        },
      },
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
          type: 'multi_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'location',
          value: location || 'Unknown',
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
          type: 'single_line_text_field',
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
          value: shipping || 'Not specified',
          type: 'single_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'userinformation',
          value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
          type: 'single_line_text_field',
        },
      },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', metafield);
    }

    // Step 4: Upload Images to Shopify if provided
    const images = req.files?.images || [];
    const imagesData = [];

    for (const image of images) {
      const cloudinaryImageUrl = image.path; // Ensure we use the correct path

      const imagePayload = {
        image: {
          src: cloudinaryImageUrl,
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
      const imageResponse = await shopifyRequest(
        imageUrl,
        'POST',
        imagePayload
      );

      if (imageResponse && imageResponse.image) {
        imagesData.push({
          id: imageResponse.image.id,
          product_id: productId,
          position: imageResponse.image.position,
          created_at: imageResponse.image.created_at,
          updated_at: imageResponse.image.updated_at,
          alt: 'Equipment Image',
          width: imageResponse.image.width,
          height: imageResponse.image.height,
          src: imageResponse.image.src,
        });
      }
    }

    // Step 5: Save Product to MongoDB
    const newProduct = new listingModel({
      id: productId,
      title: name,
      body_html: description, // Empty body_html as we use metafields for details
      vendor: brand,
      product_type: 'New Equipments',
      created_at: new Date(),
      handle: productResponse.product.handle,
      updated_at: new Date(),
      published_at: productResponse.product.published_at,
      template_suffix: productResponse.product.template_suffix,
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imagesData,
      equipment: {
        location,
        zip,
        name,
        brand,
        sale_price,
        equipment_type,
        certification,
        year_manufactured,
        warranty,
        training,
        shipping,
        description:description,
      },
      userId,
      status: productStatus,
    });

    await newProduct.save();

    // If the product is published, decrease user subscription quantity
    if (status === 'active') {
      const user = await authModel.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Check subscription quantity
      const productConfig = await productModel.findOne({ product_type: 'New Equipments' });
      if (!productConfig) {
        return res.status(404).json({ error: 'Product configuration not found.' });
      }

      // if (!user.subscription || user.subscription.quantity <= 0) {
      //   return res.status(400).json({ error: 'Insufficient subscription credits to publish product.' });
      // }

      if (user.subscription.quantity < productConfig.credit_required) {
        return res.status(400).json({
          error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
        });
      }

      // Decrement the subscription quantity
      user.subscription.quantity -= productConfig.credit_required;
      await user.save();

      // Set expiration date to 30 days from now
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Step 6: Update product status in Shopify
      const updateShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
      const shopifyUpdatePayload = {
        product: {
          id: productId,
          status: 'active',
          published_scope: 'global',
        },
      };

      const shopifyResponse = await shopifyRequest(
        updateShopifyUrl,
        'PUT',
        shopifyUpdatePayload
      );
      if (!shopifyResponse.product) {
        return res
          .status(400)
          .json({ error: 'Failed to update product status in Shopify.' });
      }

      // Step 7: Update product status in MongoDB
      const updatedProduct = await listingModel.findOneAndUpdate(
        { id: productId },
        { status: 'active', expiresAt },
        { new: true }
      );

      if (!updatedProduct) {
        return res
          .status(404)
          .json({ error: 'Product not found in database.' });
      }

      // Schedule the unpublish task
      //scheduleUnpublish(productId, userId, expiresAt);

      // Send a successful response
      return res.status(201).json({
        message: 'Product successfully created and published.',
        product: updatedProduct,
        expiresAt,
      });
    }

    // If the product is saved as draft
    res.status(201).json({
      message: 'Product successfully created and saved as draft.',
      product: newProduct,
      expiresAt: null, // No expiration date for draft
    });
  } catch (error) {
    console.error('Error in addNewEquipments function:', error);

    // Attempt to delete the product from Shopify if it was created
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


export const addNewBusiness = async (req, res) => {
  let productId; // Declare productId outside try block for access in catch
  try {
    // Extract business listing details from request body
    const {
      name,
      location,
      zip,
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
      status, // "draft" or "publish"
    } = req.body;

    const images = req.files?.images || []; // Handle multiple file uploads
    //const askingPriceValue = parseFloat(asking_price);
    const productStatus = status === 'publish' ? 'active' : 'draft'; // Determine product status
    // const formattedDescription = businessDescription.replace(/\n/g, '<br>');

    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const username = user.userName;
    const phoneNumber = user.phoneNumber;
    const country = user.country;
    const city = user.city;
    const email = user.email;
    const firstName=user.firstName
    const lastName=user.lastName

    if (!zip) {
      return res.status(400).json({ error: 'Zipcode is required.' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Business name is required.' });
    }

    if (!location) {
      return res.status(400).json({ error: 'Location is required.' });
    }

    if (!businessDescription) {
      return res
        .status(400)
        .json({ error: 'Business description is required.' });
    }

    if (!asking_price) {
      return res.status(400).json({ error: 'Asking price is required.' });
    }

    if (!establishedYear) {
      return res.status(400).json({ error: 'Established year is required.' });
    }

    if (!numberOfEmployees) {
      return res
        .status(400)
        .json({ error: 'Number of employees is required.' });
    }

    if (!locationMonthlyRent) {
      return res
        .status(400)
        .json({ error: 'Location monthly rent is required.' });
    }

    if (!leaseExpirationDate) {
      return res
        .status(400)
        .json({ error: 'Lease expiration date is required.' });
    }

    if (!locationSize) {
      return res.status(400).json({ error: 'Location size is required.' });
    }

    if (!grossYearlyRevenue) {
      return res
        .status(400)
        .json({ error: 'Gross yearly revenue is required.' });
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
      return res
        .status(400)
        .json({ error: 'Support and training information is required.' });
    }
    if (!req.files?.images || req.files.images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: `${name} | ${country} , ${location} , ${zip}`,
        body_html: businessDescription,
        vendor: location,
        product_type: 'Businesses To Purchase',
        variants: [{ price: asking_price.toString() }],
        status: productStatus, // Use determined status
        tags: [`zip_${zip}`, `location_${location}`, `username_${username}`], // Include username in tags
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(
      shopifyUrl,
      'POST',
      shopifyPayload
    );
    productId = productResponse.product.id; // Assign productId

    // Step 2: Create Structured Metafields for the Business Listing Details
    const metafieldsPayload = [
      {
        namespace: 'fold_tech',
        key: 'zip',
        value: zip || 'Not specified',
        type: 'single_line_text_field',
      },
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
        type: 'multi_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'asking_price',
        value: asking_price.toString(),
        type: 'single_line_text_field',
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
        value: leaseExpirationDate,
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
      {
          namespace: 'fold_tech',
          key: 'userinformation',
          value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
          type: 'single_line_text_field',
        },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', { metafield });
    }

    // Step 3: Upload Images to Shopify if provided
    const imagesData = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const image of images) {
        const cloudinaryImageUrl = image.path; // Ensure we use the correct path

        const imagePayload = {
          image: {
            src: cloudinaryImageUrl,
          },
        };

        const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
        const imageResponse = await shopifyRequest(
          imageUrl,
          'POST',
          imagePayload
        );

        if (imageResponse && imageResponse.image) {
          imagesData.push({
            id: imageResponse.image.id,
            product_id: productId,
            position: imageResponse.image.position,
            created_at: imageResponse.image.created_at,
            updated_at: imageResponse.image.updated_at,
            alt: 'Business Listing Image',
            width: imageResponse.image.width,
            height: imageResponse.image.height,
            src: imageResponse.image.src,
          });
        }
      }
    }

    // Step 4: Save Product to MongoDB
    const newProduct = new listingModel({
      id: productId,
      title: name,
      body_html: businessDescription,
      vendor: location,
      product_type: 'Businesses To Purchase',
      created_at: new Date(),
      handle: productResponse.product.handle,
      updated_at: new Date(),
      published_at: productResponse.product.published_at,
      template_suffix: productResponse.product.template_suffix,
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imagesData,
      business: {
        name,
        location,
        zip,
        businessDescription,
        asking_price: asking_price,
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
      userId,
      status: productStatus,
    });

    await newProduct.save();

    // Subscription management for active listings
    if (status === 'active') {
      const user = await authModel.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Check subscription quantity
      const productConfig = await productModel.findOne({ product_type: 'Businesses To Purchase' });
      if (!productConfig) {
        return res.status(404).json({ error: 'Product configuration not found.' });
      }

      // if (!user.subscription || user.subscription.quantity <= 0) {
      //   return res.status(400).json({ error: 'Insufficient subscription credits to publish product.' });
      // }

      if (user.subscription.quantity < productConfig.credit_required) {
        return res.status(400).json({
          error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
        });
      }

      // Decrement the subscription quantity
      user.subscription.quantity -= productConfig.credit_required;
      await user.save();

      // Set expiration date to 30 days from now
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Step 6: Update product status in Shopify
      const updateShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
      const shopifyUpdatePayload = {
        product: {
          id: productId,
          status: 'active',
          published_scope: 'global',
        },
      };

      const shopifyResponse = await shopifyRequest(
        updateShopifyUrl,
        'PUT',
        shopifyUpdatePayload
      );
      if (!shopifyResponse.product) {
        return res
          .status(400)
          .json({ error: 'Failed to update product status in Shopify.' });
      }

      // Step 7: Update product status in MongoDB
      const updatedProduct = await listingModel.findOneAndUpdate(
        { id: productId },
        { status: 'active', expiresAt },
        { new: true }
      );

      if (!updatedProduct) {
        return res
          .status(404)
          .json({ error: 'Product not found in database.' });
      }

      // Schedule the unpublish task

      // Send a successful response
      return res.status(201).json({
        message: 'Product successfully created and published.',
        product: updatedProduct,
        expiresAt,
      });
    }

    // If the product is saved as draft
    res.status(201).json({
      message: 'Product successfully created and saved as draft.',
      product: newProduct,
      expiresAt: null, // No expiration date for draft
    });
  } catch (error) {
    console.error('Error in addNewEquipments function:', error);

    // Attempt to delete the product from Shopify if it was created
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


// export const addNewJobListing = async (req, res) => {
//   let productId; // Declare productId outside try block for access in catch
//   try {
//     // Log incoming request data
//     console.log('Request Body:', req.body);
//     console.log('Uploaded Files:', req.files);

//     // Extract job listing details from request body
//     const {
//       location,
//       zip,
//       name,
//       qualification,
//       positionRequestedDescription,
//       availability,
//       requestedYearlySalary,
//       userId,
//       status,
//     } = req.body;

//     // Handle file upload
//     const images = req.files?.images || []; // Ensure we have an array of images
//     const productStatus = status === 'publish' ? 'active' : 'draft';
//     const user = await authModel.findById(userId);
//     if (!user) return res.status(404).json({ error: 'User not found.' });

//     const username = user.userName;
//     const phoneNumber = user.phoneNumber;
//     const country = user.country;
//     const city = user.city;
//     const email = user.email;

//     // Validate required field
//     if (!zip) {
//       return res.status(400).json({ error: 'Zipcode is required.' });
//     }

//     if (!name) {
//       return res.status(400).json({ error: 'Business name is required.' });
//     }

//     if (!location) {
//       return res.status(400).json({ error: 'Location is required.' });
//     }

//     if (!qualification) {
//       return res.status(400).json({ error: 'Qualification is required.' });
//     }

//     if (!positionRequestedDescription) {
//       return res
//         .status(400)
//         .json({ error: 'Position requested description is required.' });
//     }

//     if (!availability) {
//       return res.status(400).json({ error: 'Availability is required.' });
//     }

//     if (!requestedYearlySalary) {
//       return res
//         .status(400)
//         .json({ error: 'Requested yearly salary is required.' });
//     }
//     if (!req.files?.images || req.files.images.length === 0) {
//       return res.status(400).json({ error: 'At least one image is required.' });
//     }
//     // Continue with any additional field validations as needed

//     // Step 1: Create Product in Shopify
//     const shopifyPayload = {
//       product: {
//         title: `${name} | ${country} , ${location} , ${zip}`,
//         body_html: positionRequestedDescription,
//         vendor: location,
//         product_type: 'Providers Available',
//         variants: [{ price: requestedYearlySalary.toString() }],
//         status: productStatus,
//         tags: [`zip_${zip}`, `location_${location}`, `username_${username}`], // Include username in tags
//       },
//     };

//     const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
//     const productResponse = await shopifyRequest(
//       shopifyUrl,
//       'POST',
//       shopifyPayload
//     );
//     productId = productResponse.product.id; // Assign productId

//     // Step 2: Create Structured Metafields for the Job Listing Details
//     const metafieldsPayload = [
//       {
//         namespace: 'fold_tech',
//         key: 'zip',
//         value: zip || 'Not specified',
//         type: 'single_line_text_field',
//       },
//       {
//         namespace: 'fold_tech',
//         key: 'location',
//         value: location,
//         type: 'single_line_text_field',
//       },
//       {
//         namespace: 'fold_tech',
//         key: 'name',
//         value: name,
//         type: 'single_line_text_field',
//       },
//       {
//         namespace: 'fold_tech',
//         key: 'qualification',
//         value: qualification,
//         type: 'single_line_text_field',
//       },
//       {
//         namespace: 'fold_tech',
//         key: 'position_requested_description',
//         value: positionRequestedDescription,
//         type: 'single_line_text_field',
//       },
//       {
//         namespace: 'fold_tech',
//         key: 'availability',
//         value: availability,
//         type: 'single_line_text_field',
//       },
//       {
//         namespace: 'fold_tech',
//         key: 'requested_yearly_salary',
//         value: requestedYearlySalary.toString(),
//         type: 'number_decimal',
//       },
//       {
//         namespace: 'fold_tech',
//         key: 'userinformation',
//         value: `${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//         type: 'single_line_text_field',
//       },
//     ];

//     for (const metafield of metafieldsPayload) {
//       const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
//       await shopifyRequest(metafieldsUrl, 'POST', { metafield });
//     }

//     // Step 3: Upload Images to Shopify if provided
//     const imagesData = [];
//     if (Array.isArray(images) && images.length > 0) {
//       for (const image of images) {
//         const cloudinaryImageUrl = image?.path; // Ensure we use the correct path

//         const imagePayload = {
//           image: {
//             src: cloudinaryImageUrl,
//           },
//         };

//         const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
//         const imageResponse = await shopifyRequest(
//           imageUrl,
//           'POST',
//           imagePayload
//         );

//         if (imageResponse && imageResponse.image) {
//           imagesData.push({
//             id: imageResponse.image.id,
//             product_id: productId,
//             position: imageResponse.image.position,
//             alt: 'Job Listing Image',
//             width: imageResponse.image.width,
//             height: imageResponse.image.height,
//             src: imageResponse.image.src,
//           });
//         }
//       }
//     }

//     // Step 4: Save Product to MongoDB
//     const newJobListing = new productModel({
//       id: productId,
//       title: name,
//       body_html: positionRequestedDescription,
//       vendor: location,
//       product_type: 'Providers Available',
//       tags: productResponse.product.tags,
//       variants: productResponse.product.variants,
//       images: imagesData,
//       jobListings: [
//         {
//           location,
//           zip,
//           name,
//           qualification,
//           positionRequestedDescription,
//           availability,
//           requestedYearlySalary,
//           images: imagesData,
//         },
//       ],
//       userId,
//       status: productStatus,
//     });

//     await newJobListing.save();

//     // Subscription management for active listings
//     if (status === 'active') {
//       const user = await authModel.findById(userId);
//       if (!user) return res.status(404).json({ error: 'User not found.' });

//       // Check subscription quantity
//       const productConfig = await productModel.findOne({ product_type: 'Providers Available' });
//       if (!productConfig) {
//         return res.status(404).json({ error: 'Product configuration not found.' });
//       }

//       // if (!user.subscription || user.subscription.quantity <= 0) {
//       //   return res.status(400).json({ error: 'Insufficient subscription credits to publish product.' });
//       // }

//       if (user.subscription.quantity < productConfig.credit_required) {
//         return res.status(400).json({
//           error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
//         });
//       }

//       // Decrement the subscription quantity
//       user.subscription.quantity -= productConfig.credit_required;
//       await user.save();

//       // Set expiration date to 30 days from now
//       const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

//       // Step 6: Update product status in Shopify
//       const updateShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
//       const shopifyUpdatePayload = {
//         product: {
//           id: productId,
//           status: 'active',
//           published_scope: 'global',
//         },
//       };

//       const shopifyResponse = await shopifyRequest(
//         updateShopifyUrl,
//         'PUT',
//         shopifyUpdatePayload
//       );
//       if (!shopifyResponse.product) {
//         return res
//           .status(400)
//           .json({ error: 'Failed to update product status in Shopify.' });
//       }

//       // Step 7: Update product status in MongoDB
//       const updatedProduct = await productModel.findOneAndUpdate(
//         { id: productId },
//         { status: 'active', expiresAt },
//         { new: true }
//       );

//       if (!updatedProduct) {
//         return res
//           .status(404)
//           .json({ error: 'Product not found in database.' });
//       }

//       // Schedule the unpublish task

//       // Send a successful response
//       return res.status(201).json({
//         message: 'Product successfully created and published.',
//         product: updatedProduct,
//         expiresAt,
//       });
//     }

//     // If the product is saved as draft
//     res.status(201).json({
//       message: 'Product successfully created and saved as draft.',
//       product: newJobListing,
//       expiresAt: null, // No expiration date for draft
//     });
//   } catch (error) {
//     console.error('Error in addNewEquipments function:', error);

//     // Attempt to delete the product from Shopify if it was created
//     if (productId) {
//       try {
//         const deleteShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
//         await shopifyRequest(deleteShopifyUrl, 'DELETE');
//       } catch (deleteError) {
//         console.error('Error deleting product from Shopify:', deleteError);
//       }
//     }

//     res.status(500).json({ error: error.message });
//   }
// };


export const addNewJobListing = async (req, res) => {
  let productId; // Declare productId outside try block for access in catch
  try {
    // Log incoming request data
    console.log('Request Body:', req.body);
    console.log('Uploaded Files:', req.files);

    // Extract job listing details from request body
    const {
      location,
      zip,
      name,
      qualification,
      positionRequestedDescription,
      availability,
      requestedYearlySalary,
      userId,
      availableToWorkAs,
      jobType,
      status,
    } = req.body;
    // const formattedDescription = positionRequestedDescription.replace(/\n/g, '<br>');
  
    // Handle file upload
    const files = req.files?.images || []; // Ensure we have an array of files
    const productStatus = status === 'publish' ? 'active' : 'draft';
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const username = user.userName;
    const phoneNumber = user.phoneNumber;
    const country = user.country;
    const city = user.city;
    const email = user.email;
    const firstName=user.firstName
    const lastName=user.lastName

    // Validate required field
    if (!zip) return res.status(400).json({ error: 'Zipcode is required.' });
    if (!name) return res.status(400).json({ error: 'name is required.' });
    if (!location) return res.status(400).json({ error: 'Location is required.' });
    if (!qualification) return res.status(400).json({ error: 'Qualification is required.' });
    if (!positionRequestedDescription) return res.status(400).json({ error: 'Position requested description is required.' });
    if (!availability) return res.status(400).json({ error: 'Availability is required.' });
    if (!availableToWorkAs) return res.status(400).json({ error: 'available To Work As is required.' });
    if (files.length === 0) return res.status(400).json({ error: 'At least one file is required.' });

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: `${name} | ${country} , ${location} , ${zip}`,
        body_html:positionRequestedDescription,
        vendor: location,
        product_type: 'Providers Available',
        variants: [{ price: requestedYearlySalary.toString() }],
        status: productStatus,
        tags: [`zip_${zip}`, `location_${location}`, `username_${username}`], // Include username in tags
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(shopifyUrl, 'POST', shopifyPayload);
    productId = productResponse.product.id; // Assign productId

    // Step 2: Create Structured Metafields for the Job Listing Details
    const metafieldsPayload = [
      {
        namespace: 'fold_tech',
        key: 'zip',
        value: zip || 'Not specified',
        type: 'single_line_text_field',
      },
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
        key: 'availableToWorkAs',
        value: availableToWorkAs,
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
        type: 'multi_line_text_field',
      },
      {
        namespace: 'fold_tech',
        key: 'availability',
        value: availability,
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
        key: 'requested_yearly_salary',
        value: requestedYearlySalary.toString(),
        type: 'number_decimal',
      },
      {
          namespace: 'fold_tech',
          key: 'userinformation',
          value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
          type: 'single_line_text_field',
      },

    ];

    // Step 3: Process Files for Images and PDFs
    const imagesData = [];
    const pdfsData = [];

    for (const file of files) {
      const cloudinaryImageUrl = file?.path; // Ensure we use the correct path

      if (file.mimetype.startsWith('image/')) {
        // If the file is an image
        const imagePayload = {
          image: {
            src: cloudinaryImageUrl,
          },
        };

        const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
        const imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);

        if (imageResponse && imageResponse.image) {
          imagesData.push({
            id: imageResponse.image.id,
            product_id: productId,
            position: imageResponse.image.position,
            alt: 'Job Listing Image',
            width: imageResponse.image.width,
            height: imageResponse.image.height,
            src: imageResponse.image.src,
          });
        }
      } else if (file.mimetype === 'application/pdf') {
        // If the file is a PDF
        pdfsData.push({
          file_name: file.originalname,
          file_url: cloudinaryImageUrl,
        });
      }
    }

    // Add PDFs to the metafieldsPayload
    for (const pdf of pdfsData) {
      metafieldsPayload.push({
        namespace: 'fold_tech',
        key: 'pdf',
        value: pdf.file_url,
        type: 'single_line_text_field',
      });
    }

    // Create Metafields
    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', { metafield });
    }

    // Step 4: Save Product to MongoDB
    const newJobListing = new listingModel({
      id: productId,
      title: name,
      body_html: positionRequestedDescription,
      vendor: location,
      product_type: 'Providers Available',
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imagesData,
      jobListings: [
        {
          location,
          zip,
          name,
          qualification,
          positionRequestedDescription,
          availability,
          jobType,
          requestedYearlySalary,
          availableToWorkAs,
          images: imagesData,
       
        },
      ],
      userId,
      status: productStatus,
    });

    await newJobListing.save()

    // Subscription management for active listings
    if (status === 'active') {
      const user = await authModel.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Check subscription quantity
      const productConfig = await productModel.findOne({ product_type: 'Providers Available' });
      if (!productConfig) {
        return res.status(404).json({ error: 'Product configuration not found.' });
      }

      if (user.subscription.quantity < productConfig.credit_required) {
        return res.status(400).json({
          error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
        });
      }

      // Decrement the subscription quantity
      user.subscription.quantity -= productConfig.credit_required;
      await user.save();

      // Set expiration date to 30 days from now
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Step 6: Update product status in Shopify
      const updateShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
      const shopifyUpdatePayload = {
        product: {
          id: productId,
          status: 'active',
          published_scope: 'global',
        },
      };

      const shopifyResponse = await shopifyRequest(updateShopifyUrl, 'PUT', shopifyUpdatePayload);
      if (!shopifyResponse.product) {
        return res.status(400).json({ error: 'Failed to update product status in Shopify.' });
      }

      // Step 7: Update product status in MongoDB
      const updatedProduct = await listingModel.findOneAndUpdate(
        { id: productId },
        { status: 'active', expiresAt },
        { new: true }
      );

      if (!updatedProduct) {
        return res.status(404).json({ error: 'Product not found in database.' });
      }

      // Send a successful response
      return res.status(201).json({
        message: 'Product successfully created and published.',
        product: updatedProduct,
        expiresAt,
      });
    }

    // If the product is saved as draft
    res.status(201).json({
      message: 'Product successfully created and saved as draft.',
      product: newJobListing,
      expiresAt: null, // No expiration date for draft
    });
  } catch (error) {
    console.error('Error in addNewJobListing function:', error);

    // Attempt to delete the product from Shopify if it was created
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
 
export const addNewProviderListing = async (req, res) => {
  let productId; // Declare productId outside try block for access in catch
  try {
    console.log('Request Body:', req.body);
    console.log('Uploaded Files:', req.files);

    // Extract provider listing details from request body
    const {
      location,
      zip,
      qualificationRequested,
      jobType,
      typeOfJobOffered,
      offeredYearlySalary,
      offeredPositionDescription,
      userId,
      status,
    } = req.body;
    // const formattedDescription = offeredPositionDescription.replace(/\n/g, '<br>');
console.log(req.body)
    // Handle file upload
    const images = req.files?.images || []; // Ensure we have an array of images
    const productStatus = status === 'publish' ? 'active' : 'draft';
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const username = user.userName;
    const phoneNumber = user.phoneNumber;
    const country = user.country;
    const city = user.city;
    const email = user.email;
    const firstName=user.firstName
    const lastName=user.lastName

    if (!zip) {
      return res.status(400).json({ error: 'Zipcode is required.' });
    }
    if (!location) {
      return res.status(400).json({ error: 'Location is required.' });
    }

    if (!qualificationRequested) {
      return res
        .status(400)
        .json({ error: 'Qualification requested is required.' });
    }

    if (!jobType) {
      return res.status(400).json({ error: 'Job type is required.' });
    }

    if (!typeOfJobOffered) {
      return res
        .status(400)
        .json({ error: 'Type of job offered is required.' });
    }

    if (!offeredYearlySalary) {
      return res
        .status(400)
        .json({ error: 'Offered yearly salary is required.' });
    }

    if (!offeredPositionDescription) {
      return res
        .status(400)
        .json({ error: 'Offered position description is required.' });
    }
   
    // Continue with any additional field validations as needed

    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: `${qualificationRequested} | ${country} , ${location} , ${zip}`,
        body_html: offeredPositionDescription,
        vendor: location,
        product_type: 'Provider Needed',
        variants: [{ price: offeredYearlySalary.toString() }],
        status: productStatus,
        tags: [`zip_${zip}`, `location_${location}`, `username_${username}`], // Include username in tags
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(
      shopifyUrl,
      'POST',
      shopifyPayload
    );
    productId = productResponse.product.id; // Assign productId

    // Step 2: Create Structured Metafields for the Provider Listing Details
    const metafieldsPayload = [
      {
        namespace: 'fold_tech',
        key: 'zip',
        value: zip || 'Not specified',
        type: 'single_line_text_field',
      },
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
        type: 'multi_line_text_field',
      },
      {
          namespace: 'fold_tech',
          key: 'userinformation',
          value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
          type: 'single_line_text_field',
      },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', { metafield });
    }

    // Step 3: Upload Images to Shopify if provided
    // const imagesData = [];
    // if (Array.isArray(images) && images.length > 0) {
    //   for (const image of images) {
    //     const cloudinaryImageUrl = image?.path; // Ensure we use the correct path

    //     const imagePayload = {
    //       image: {
    //         src: cloudinaryImageUrl,
    //       },
    //     };

    //     const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
    //     const imageResponse = await shopifyRequest(
    //       imageUrl,
    //       'POST',
    //       imagePayload
    //     );

    //     if (imageResponse && imageResponse.image) {
    //       imagesData.push({
    //         id: imageResponse.image.id,
    //         product_id: productId,
    //         position: imageResponse.image.position,
    //         alt: 'Provider Needed',
    //         width: imageResponse.image.width,
    //         height: imageResponse.image.height,
    //         src: imageResponse.image.src,
    //       });
    //     }
    //   }
    // }

    // Step 4: Save Provider Listing to MongoDB
    const newProviderListing = new listingModel({
      id: productId,
      title: qualificationRequested,
      body_html: offeredPositionDescription,
      vendor: location,
      product_type: 'Provider Needed',
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      // images: imagesData,
      providerListings: [
        {
          location,
          zip,
          qualificationRequested,
          jobType,
          typeOfJobOffered,
          offeredYearlySalary,
          offeredPositionDescription,
          // images: imagesData,
        },
      ],
      userId,
      status: productStatus,
    });

    await newProviderListing.save();

    // Handle subscription management for active listings
    if (status === 'active') {
      const user = await authModel.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Check subscription quantity
      const productConfig = await productModel.findOne({ product_type: 'Provider Needed' });
      if (!productConfig) {
        return res.status(404).json({ error: 'Product configuration not found.' });
      }

      // if (!user.subscription || user.subscription.quantity <= 0) {
      //   return res.status(400).json({ error: 'Insufficient subscription credits to publish product.' });
      // }

      if (user.subscription.quantity < productConfig.credit_required) {
        return res.status(400).json({
          error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
        });
      }

      // Decrement the subscription quantity
      user.subscription.quantity -= productConfig.credit_required;
      await user.save();

      // Set expiration date to 30 days from now
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Step 6: Update product status in Shopify
      const updateShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
      const shopifyUpdatePayload = {
        product: {
          id: productId,
          status: 'active',
          published_scope: 'global',
        },
      };

      const shopifyResponse = await shopifyRequest(
        updateShopifyUrl,
        'PUT',
        shopifyUpdatePayload
      );
      if (!shopifyResponse.product) {
        return res
          .status(400)
          .json({ error: 'Failed to update product status in Shopify.' });
      }

      // Step 7: Update product status in MongoDB
      const updatedProduct = await listingModel.findOneAndUpdate(
        { id: productId },
        { status: 'active', expiresAt },
        { new: true }
      );

      if (!updatedProduct) {
        return res
          .status(404)
          .json({ error: 'Product not found in database.' });
      }

      // Schedule the unpublish task

      // Send a successful response
      return res.status(201).json({
        message: 'Product successfully created and published.',
        product: updatedProduct,
        expiresAt,
      });
    }

    // If the product is saved as draft
    res.status(201).json({
      message: 'Product successfully created and saved as draft.',
      product: newProviderListing,
      expiresAt: null, // No expiration date for draft
    });
  } catch (error) {
    console.error('Error in addNewEquipments function:', error);

    // Attempt to delete the product from Shopify if it was created
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


export const addRoomListing = async (req, res) => {
  let productId;
  try {
    // Extract room listing details from request body
    const {
      location,
      zip,
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

    // const formattedDescription = otherDetails.replace(/\n/g, '<br>');

    // Handle file upload
    const images = req.files.images || []; // Handle file upload
    const productStatus = status === 'publish' ? 'active' : 'draft';
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const username = user.userName;
    const phoneNumber = user.phoneNumber;
    const country = user.country;
    const city = user.city;
    const email = user.email;
    const firstName=user.firstName
    const lastName=user.lastName

    if (!zip) {
      return res.status(400).json({ error: 'Zipcode is required.' });
    }
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
      return res
        .status(400)
        .json({ error: 'Minimum insurance requested is required.' });
    }

    if (!typeOfUseAllowed) {
      return res
        .status(400)
        .json({ error: 'Type of use allowed is required.' });
    }

    if (!rentalTerms) {
      return res.status(400).json({ error: 'Rental terms are required.' });
    }

    if (wifiAvailable === undefined) {
      // Check if this field can be a boolean
      return res.status(400).json({ error: 'WiFi availability is required.' });
    }

    if (!otherDetails) {
      return res.status(400).json({ error: 'Other details are required.' });
    }

    if (!req.files?.images || req.files.images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }
    // Step 1: Create Product in Shopify
    const shopifyPayload = {
      product: {
        title: `${typeOfUseAllowed} | ${location}, ${country} ${zip}`,
        body_html: otherDetails,
        vendor: location,
        product_type: 'Spa Room For Rent',
        variants: [{ price: monthlyRent.toString() }],
        status: productStatus,
        tags: [`zip_${zip}`, `location_${location}`, `username_${username}`], // Include username in tags
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(
      shopifyUrl,
      'POST',
      shopifyPayload
    );

    const productId = productResponse.product.id;

    // Step 2: Create Structured Metafields for the Room Listing Details
    const metafieldsPayload = [
      {
        namespace: 'fold_tech',
        key: 'zip',
        value: zip,
        type: 'single_line_text_field',
      },
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
        type: 'multi_line_text_field',
      },
      {
          namespace: 'fold_tech',
          key: 'userinformation',
          value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
          type: 'single_line_text_field',
        },
    ];
    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', { metafield });
    }

    const imagesData = [];
    if (Array.isArray(images) && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const cloudinaryImageUrl = images[i]?.path; // Use the path to the image

        const imagePayload = {
          image: {
            // Corrected key from 'images' to 'image'
            src: cloudinaryImageUrl,
          },
        };

        const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
        const imageResponse = await shopifyRequest(
          imageUrl,
          'POST',
          imagePayload
        );

        if (imageResponse && imageResponse.image) {
          imagesData.push({
            id: imageResponse.image.id,
            product_id: productId,
            position: imageResponse.image.position,
            alt: 'Room Listing Image',
            width: imageResponse.image.width,
            height: imageResponse.image.height,
            src: imageResponse.image.src,
          });
        }
      }
    }

    // Step 4: Save Room Listing to MongoDB
    const newRoomListing = new listingModel({
      id: productId,
      title: location,
      body_html: otherDetails,
      vendor: location,
      product_type: 'Spa Room For Rent',
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imagesData,
      roomListing: [
        {
          location,
          zip,
          roomSize,
          monthlyRent,
          deposit,
          minimumInsuranceRequested,
          typeOfUseAllowed,
          rentalTerms,
          wifiAvailable,
          otherDetails,
          images: imagesData,
        },
      ],
      userId: userId,
      status: productStatus,
    });

    await newRoomListing.save();

    if (status === 'active') {
      const user = await authModel.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Check subscription quantity
      const productConfig = await productModel.findOne({ product_type: 'Spa Room For Rent' });
      if (!productConfig) {
        return res.status(404).json({ error: 'Product configuration not found.' });
      }

      // if (!user.subscription || user.subscription.quantity <= 0) {
      //   return res.status(400).json({ error: 'Insufficient subscription credits to publish product.' });
      // }

      if (user.subscription.quantity < productConfig.credit_required) {
        return res.status(400).json({
          error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
        });
      }

      // Decrement the subscription quantity
      user.subscription.quantity -= productConfig.credit_required;
      await user.save();

      // Set expiration date to 30 days from now
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Step 6: Update product status in Shopify
      const updateShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
      const shopifyUpdatePayload = {
        product: {
          id: productId,
          status: 'active',
          published_scope: 'global',
        },
      };

      const shopifyResponse = await shopifyRequest(
        updateShopifyUrl,
        'PUT',
        shopifyUpdatePayload
      );
      if (!shopifyResponse.product) {
        return res
          .status(400)
          .json({ error: 'Failed to update product status in Shopify.' });
      }

      // Step 7: Update product status in MongoDB
      const updatedProduct = await listingModel.findOneAndUpdate(
        { id: productId },
        { status: 'active', expiresAt },
        { new: true }
      );

      if (!updatedProduct) {
        return res
          .status(404)
          .json({ error: 'Product not found in database.' });
      }

      // Schedule the unpublish task
      // Send a successful response
      return res.status(201).json({
        message: 'Product successfully created and published.',
        product: updatedProduct,
        expiresAt,
      });
    }

    // If the product is saved as draft
    res.status(201).json({
      message: 'Product successfully created and saved as draft.',
      product: newRoomListing,
      expiresAt: null, // No expiration date for draft
    });
  } catch (error) {
    console.error('Error in addNewEquipments function:', error);

    // Attempt to delete the product from Shopify if it was created
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


// export const getProduct = async (req, res) => {
//   try {
//     const userId = req.params.userId;

//     // Validate userId (basic check, you can enhance this)
//     if (!userId) {
//       return res.status(400).json({ error: 'userId is required.' });
//     }

//     // Find products by userId
//     const products = await productModel.find({ userId: userId });

//     // Check if products were found
//     if (products.length === 0) {
//       return res
//         .status(404)
//         .json({ message: 'No products found for this user.' });
//     }

//     // Send the found products as a response
//     res.status(200).json({ products });
//   } catch (error) {
//     console.error('Error in getProductsByUserId function:', error);
//     res.status(500).json({ error: error.message });
//   }
// };




// get product by search

export const getProduct = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Validate userId (basic check, you can enhance this)
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    // Pagination setup
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 products per page
    const skip = (page - 1) * limit; // Number of items to skip

    // Find products by userId with pagination
    const products = await listingModel
      .find({ userId: userId })
      .skip(skip)
      .limit(limit);

    // Get the total number of products for the user
    const totalProducts = await productModel.countDocuments({ userId: userId });

    // Check if products were found
    if (products.length === 0) {
      return res.status(404).json({ message: 'No products found for this user.' });
    }

    // Send the paginated products as a response
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


// export const updateListing = async (req, res) => {
//   const { id } = req.params; // MongoDB ID
//   const { userId } = req.body; // User ID from body
//   const updateData = req.body; // Data to update
//   const images = req.files?.images || []; // Expecting multiple images
//   const imagesData = [];

//   try {
//     // Fetch user by userId
//     const user = await authModel.findById(userId);
//     if (!user) return res.status(404).json({ error: 'User not found.' });

//     const username = user.userName ; // Fallback to 'Unknown' if not available
//     const country = user.country;
//    const email=user.email;
//    const phoneNumber=user.phoneNumber
//     const city=user.city
//     const firstName=user.firstName
//     const lastName=user.lastName
//     // Find the product by MongoDB ID
//     const product = await listingModel.findOne({id});
//     if (!product) {
//       return res.status(404).json({ message: 'Product not found' });
//     }

//     // Validate that the product_type matches the data being updated
//     const { product_type } = product;

//     // Handle image uploads if images exist in the request
//     if (Array.isArray(images) && images.length > 0) {
//       for (const image of images) {
//         const cloudinaryImageUrl = image?.path; // Assuming `path` has the Cloudinary URL

//         const imagePayload = {
//           image: {
//             src: cloudinaryImageUrl, // Cloudinary URL
//             alt: 'Product Image', // Optional alt text
//           },
//         };

//         // Shopify image upload URL
//         const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${product.id}/images.json`;

//         // Upload image to Shopify
//         const imageResponse = await shopifyRequest(
//           imageUrl,
//           'POST',
//           imagePayload
//         );

//         if (imageResponse && imageResponse.image) {
//           imagesData.push({
//             id: imageResponse.image.id,
//             product_id: product.id,
//             position: imageResponse.image.position,
//             alt: 'Product Image',
//             width: imageResponse.image.width,
//             height: imageResponse.image.height,
//             src: imageResponse.image.src,
//           });
//         }
//       }

//       // Update the product's images array with the new images
//       product.images = imagesData; // Replace existing images
//       updateData.images = imagesData; // Ensure the images are updated in MongoDB as well
//     }

//     // Define metafield arrays for different product types
//     let metafieldsPayload = [];

//     if (product_type === 'Used Equipments') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'city',
//             value: updateData.city || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'brand',
//             value: updateData.brand,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'description',
//             value: updateData.description,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'asking_price',
//             value: updateData.asking_price,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'accept_offers',
//             value: updateData.accept_offers,
//             type: 'boolean',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'equipment_type',
//             value: updateData.equipment_type,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'certification',
//             value: updateData.certification,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'year_purchased',
//             value: updateData.year_purchased,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'warranty',
//             value: updateData.warranty,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'reason_for_selling',
//             value: updateData.reason_for_selling,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'shipping',
//             value: updateData.shipping,
//             type: 'single_line_text_field',
//           },
//         },
//         // {
//         //   metafield:  {
//         //     namespace: 'fold_tech',
//         //     key: 'userinformation',
//         //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//         //     type: 'single_line_text_field',
//         //   },
//         // },
//       ];
//     } else if (product_type === 'Businesses To Purchase') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'business_description',
//             value: updateData.businessDescription,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'asking_price',
//             value: updateData.asking_price.toString(),
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'established_year',
//             value: updateData.establishedYear.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'number_of_employees',
//             value: updateData.numberOfEmployees.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location_monthly_rent',
//             value: updateData.locationMonthlyRent.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'lease_expiration_date',
//             value: new Date(updateData.leaseExpirationDate).toISOString(),
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location_size',
//             value: updateData.locationSize.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'gross_yearly_revenue',
//             value: updateData.grossYearlyRevenue.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'cash_flow',
//             value: updateData.cashFlow.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'products_inventory',
//             value: updateData.productsInventory.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'equipment_value',
//             value: updateData.equipmentValue.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'reason_for_selling',
//             value: updateData.reasonForSelling,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'list_of_devices',
//             value: JSON.stringify(updateData.listOfDevices),
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'offered_services',
//             value: JSON.stringify(updateData.offeredServices),
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'support_and_training',
//             value: updateData.supportAndTraining,
//             type: 'single_line_text_field',
//           },
//         },
//         // {
//         //   metafield:  {
//         //     namespace: 'fold_tech',
//         //     key: 'userinformation',
//         //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//         //     type: 'single_line_text_field',
//         //   },
//         // },
//       ];
//     } else if (product_type === 'Providers Available') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location || 'Unknown',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'name',
//             value: updateData.name || 'No Name Provided',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'qualification_requested',
//             value: updateData.qualificationRequested || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'requested_yearly_salary',
//             value:
//               updateData.requestedYearlySalary !== undefined
//                 ? updateData.requestedYearlySalary.toString()
//                 : 'Not specified',
//             type: 'number_decimal',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'position_requested_description',
//             value: updateData.positionRequestedDescription || 'No Description',
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'availability',
//             value: updateData.availability || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         // {
//         //   metafield:  {
//         //     namespace: 'fold_tech',
//         //     key: 'userinformation',
//         //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//         //     type: 'single_line_text_field',
//         //   },
//         // },
//       ];
//     } else if (product_type === 'Provider Needed') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'qualification_requested',
//             value: updateData.qualificationRequested,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'job_type',
//             value: updateData.jobType,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'type_of_job_offered',
//             value: updateData.typeOfJobOffered,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'offered_yearly_salary',
//             value: updateData.offeredYearlySalary,
//             type: 'number_integer',  // Ensure this is actually an integer
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'offered_position_description',
//             value: updateData.offeredPositionDescription,
//             type: 'multi_line_text_field',
//           },
//         },
//         // {
//         //   metafield:  {
//         //     namespace: 'fold_tech',
//         //     key: 'userinformation',
//         //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//         //     type: 'single_line_text_field',
//         //   },
//         // },
//       ];
    
//     } else if (product_type === 'Spa Room For Rent') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'room_size',
//             value: updateData.roomSize,
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'monthly_rent',
//             value: updateData.monthlyRent,
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'deposit',
//             value: updateData.deposit,
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'minimum_insurance_requested',
//             value: updateData.minimumInsuranceRequested,
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'type_of_use_allowed',
//             value: updateData.typeOfUseAllowed,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'rental_terms',
//             value: updateData.rentalTerms,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'wifi_available',
//             value: updateData.wifiAvailable,
//             type: 'boolean',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'other_details',
//             value: updateData.otherDetails,
//             type: 'multi_line_text_field',
//           },
//         },
//         // {
//         //   metafield:  {
//         //     namespace: 'fold_tech',
//         //     key: 'userinformation',
//         //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//         //     type: 'single_line_text_field',
//         //   },
//         // },
//       ];
//     } else if (product_type === 'New Equipments') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'name',
//             value: updateData.name,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'description',
//             value: updateData.description,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location || 'Unknown',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'brand',
//             value: updateData.brand,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'sale_price',
//             value: updateData.sale_price.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'equipment_type',
//             value: updateData.equipment_type,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'certification',
//             value: updateData.certification,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'year_manufactured',
//             value: updateData.year_manufactured.toString(),
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'warranty',
//             value: updateData.warranty,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'training',
//             value: updateData.training,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'shipping',
//             value: updateData.shipping || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         // {
//         //   metafield:  {
//         //     namespace: 'fold_tech',
//         //     key: 'userinformation',
//         //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//         //     type: 'single_line_text_field',
//         //   },
//         // },
//       ];
//     }else if (product_type === 'Looking For') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'name',
//             value: updateData.name,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'description',
//             value: updateData.description,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location || 'Unknown',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'brand',
//             value: updateData.brand,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'sale_price',
//             value: updateData.sale_price,
//             type: 'number_integer',
//           },
//         },
//         // {
//         //   metafield:  {
//         //     namespace: 'fold_tech',
//         //     key: 'userinformation',
//         //     value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//         //     type: 'single_line_text_field',
//         //   },
//         // },
//       ];
//     }

//     for (const metafield of metafieldsPayload) {
//       const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${id}/metafields.json`;
//       await shopifyRequest(metafieldsUrl, 'POST', metafield);
//     }
//     // Prepare Shopify payload, including user info
//     const shopifyPayload = {
//       product: {
//         title: `${updateData.name || updateData.qualificationRequested || updateData.typeOfUseAllowed} | ${country} , ${updateData.location} , ${updateData.zip}`,
//         body_html: updateData.description || updateData.offeredPositionDescription || updateData.otherDetails || updateData.businessDescription,
//         vendor: updateData.brand || updateData.location,
//         tags: `zip_${updateData.zip}, location_${updateData.location}, username_${username}`,
//         images: product.images, // Attach updated images
//       },
//     };

//     // Shopify update API URL
//     const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${product.id}.json`;

//     // Update the product in Shopify
//     const shopifyResponse = await fetch(shopifyUrl, {
//       method: 'PUT',
//       headers: {
//         Authorization: `Basic ${Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`).toString('base64')}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(shopifyPayload),
//     });

//     if (!shopifyResponse.ok) {
//       const errorDetails = await shopifyResponse.text();
//       return res.status(500).json({
//         message: 'Failed to update product in Shopify',
//         details: errorDetails,
//       });
//     }
//     const currentStatus = product.status;
// if (product_type === 'Used Equipments' || product_type === 'New Equipments' ) {
//   updateData.equipment = {
//     location: req.body.location,
//     zip: req.body.zip,
//     name: req.body.name,
//     brand: req.body.brand,
//     asking_price: req.body.asking_price,
//     accept_offers: req.body.accept_offers,
//     equipment_type: req.body.equipment_type,
//     certification: req.body.certification,
//     year_purchased: req.body.year_purchased,
//     warranty: req.body.warranty,
//     reason_for_selling: req.body.reason_for_selling,
//     shipping: req.body.shipping,
//     sale_price: req.body.sale_price,
//     year_manufactured: req.body.year_manufactured,
//     training: req.body.training,
//     description: req.body.description,
//     city:req.body.city,
//   };
// }

// if (product_type === 'Businesses To Purchase') {
//   updateData.business = {
//     name: req.body.name,
//     location: req.body.location,
//     zip: req.body.zip,
//     businessDescription: req.body.businessDescription,
//     asking_price: req.body.asking_price,
//     establishedYear: req.body.establishedYear,
//     numberOfEmployees: req.body.numberOfEmployees,
//     locationMonthlyRent: req.body.locationMonthlyRent,
//     leaseExpirationDate: new Date(req.body.leaseExpirationDate),
//     locationSize: req.body.locationSize,
//     grossYearlyRevenue: req.body.grossYearlyRevenue,
//     cashFlow: req.body.cashFlow,
//     productsInventory: req.body.productsInventory,
//     equipmentValue: req.body.equipmentValue,
//     reasonForSelling: req.body.reasonForSelling,
//     listOfDevices: req.body.listOfDevices,
//     offeredServices: req.body.offeredServices,
//     supportAndTraining: req.body.supportAndTraining,
//   };
// }

// if (product_type === 'Spa Room For Rent') {
//   updateData.roomListing = [
//     {
//       location: req.body.location,
//       zip: req.body.zip,
//       roomSize: req.body.roomSize,
//       monthlyRent: req.body.monthlyRent,
//       deposit: req.body.deposit,
//       minimumInsuranceRequested: req.body.minimumInsuranceRequested,
//       typeOfUseAllowed: req.body.typeOfUseAllowed,
//       rentalTerms: req.body.rentalTerms,
//       wifiAvailable: req.body.wifiAvailable,
//       otherDetails: req.body.otherDetails,
//       images: imagesData, // Assuming imagesData is already defined
//     },
//   ];
// }

// if (product_type === 'Provider Needed') {
//   updateData.providerListings = [
//     {
//       location: req.body.location,
//       zip: req.body.zip,
//       qualificationRequested: req.body.qualificationRequested,
//       jobType: req.body.jobType,
//       typeOfJobOffered: req.body.typeOfJobOffered,
//       offeredYearlySalary: req.body.offeredYearlySalary,
//       offeredPositionDescription: req.body.offeredPositionDescription,
//       images: imagesData, // Assuming imagesData is already defined
//     },
//   ];
// }

// if (product_type === 'Providers Available') {
//   updateData.jobListings = [
//     {
//       location: req.body.location,
//       zip: req.body.zip,
//       name: req.body.name,
//       qualification: req.body.qualification,
//       positionRequestedDescription: req.body.positionRequestedDescription,
//       availability: req.body.availability,
//       requestedYearlySalary: req.body.requestedYearlySalary,
//       images: imagesData, // Assuming imagesData is already defined
//     },
//   ];
// }
// if (product_type === 'Looking For') {
//   updateData.looking = {
//     name: req.body.name,
//     location: req.body.location,
//     zip: req.body.zip,
//     brand: req.body.brand,
//     sale_price: req.body.sale_price,
//     description: req.body.description,
//     images:imagesData
//   };
// }
// // Set common fields for all product types
// const commonFields = {
//   title: req.body.name || req.body.qualificationRequested,
//   body_html: req.body.description || req.body.offeredPositionDescription || req.body.otherDetails,
//   vendor: req.body.brand,
//   product_type,
//   status:currentStatus,
//   created_at: new Date(),
// };

// // Combine common fields with the specific update data
// const updatedProduct = await listingModel.findOneAndUpdate(
//   { id },
//   { ...commonFields, ...updateData },
//   { new: true } // Option to return the updated document
// );
 
// return res
//       .status(200)
//       .json({ message: 'Product updated successfully', product: updatedProduct });
//   } catch (error) {
//     console.error('Error updating product:', error);
//     return res.status(500).json({ message: 'An error occurred', error });
//   }
// };


// export const updateListing = async (req, res) => {
//   const { id } = req.params; // MongoDB ID
//   const { userId } = req.body; // User ID from body
//   const updateData = req.body; // Data to update
//   const images = req.files?.images || []; // Expecting multiple images
//   const imagesData = [];

//   try {
//     // Fetch user by userId
//     const user = await authModel.findById(userId);
//     if (!user) return res.status(404).json({ error: 'User not found.' });
//     const formattedDescription = updateData.description.replace(/\n/g, '<br>') ||updateData.otherDetails.replace(/\n/g, '<br>') ||updateData.offeredPositionDescription.replace(/\n/g, '<br>') ||updateData.positionRequestedDescription.replace(/\n/g, '<br>') ||updateData.businessDescription.replace(/\n/g, '<br>')

//     const username = user.userName ; // Fallback to 'Unknown' if not available
//     const country = user.country;
//    const email=user.email;
//    const phoneNumber=user.phoneNumber
//     const city=user.city
//     // Find the product by MongoDB ID
//     const product = await listingModel.findOne({id});
//     if (!product) {
//       return res.status(404).json({ message: 'Product not found' });
//     }

//     // Validate that the product_type matches the data being updated
//     const { product_type } = product;

//     // Handle image uploads if images exist in the request
//     if (Array.isArray(images) && images.length > 0) {
//       for (const image of images) {
//         const cloudinaryImageUrl = image?.path; // Assuming `path` has the Cloudinary URL

//         const imagePayload = {
//           image: {
//             src: cloudinaryImageUrl, // Cloudinary URL
//             alt: 'Product Image', // Optional alt text
//           },
//         };

//         // Shopify image upload URL
//         const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${product.id}/images.json`;

//         // Upload image to Shopify
//         const imageResponse = await shopifyRequest(
//           imageUrl,
//           'POST',
//           imagePayload
//         );

//         if (imageResponse && imageResponse.image) {
//           imagesData.push({
//             id: imageResponse.image.id,
//             product_id: product.id,
//             position: imageResponse.image.position,
//             alt: 'Product Image',
//             width: imageResponse.image.width,
//             height: imageResponse.image.height,
//             src: imageResponse.image.src,
//           });
//         }
//       }

//       // Update the product's images array with the new images
//       product.images = imagesData; // Replace existing images
//       updateData.images = imagesData; // Ensure the images are updated in MongoDB as well
//     }

//     // Define metafield arrays for different product types
//     let metafieldsPayload = [];

//     if (product_type === 'Used Equipments') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'brand',
//             value: updateData.brand,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'description',
//             value: formattedDescription,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'asking_price',
//             value: updateData.asking_price,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'accept_offers',
//             value: updateData.accept_offers,
//             type: 'boolean',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'equipment_type',
//             value: updateData.equipment_type,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'certification',
//             value: updateData.certification,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'year_purchased',
//             value: updateData.year_purchased,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'warranty',
//             value: updateData.warranty,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'reason_for_selling',
//             value: updateData.reason_for_selling,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'shipping',
//             value: updateData.shipping,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'userinformation',
//             value: `${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//             type: 'single_line_text_field',
//           },
//         },
//       ];
//     } else if (product_type === 'Businesses To Purchase') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'business_description',
//             value: formattedDescription,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'asking_price',
//             value: updateData.asking_price.toString(),
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'established_year',
//             value: updateData.establishedYear.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'number_of_employees',
//             value: updateData.numberOfEmployees.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location_monthly_rent',
//             value: updateData.locationMonthlyRent.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'lease_expiration_date',
//             value: new Date(updateData.leaseExpirationDate).toISOString(),
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location_size',
//             value: updateData.locationSize.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'gross_yearly_revenue',
//             value: updateData.grossYearlyRevenue.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'cash_flow',
//             value: updateData.cashFlow.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'products_inventory',
//             value: updateData.productsInventory.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'equipment_value',
//             value: updateData.equipmentValue.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'reason_for_selling',
//             value: updateData.reasonForSelling,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'list_of_devices',
//             value: JSON.stringify(updateData.listOfDevices),
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'offered_services',
//             value: JSON.stringify(updateData.offeredServices),
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'support_and_training',
//             value: updateData.supportAndTraining,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'userinformation',
//             value: `${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//             type: 'single_line_text_field',
//           },
//         },
//       ];
//     } else if (product_type === 'Providers Available') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location || 'Unknown',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'name',
//             value: updateData.name || 'No Name Provided',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'qualification_requested',
//             value: updateData.qualificationRequested || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'requested_yearly_salary',
//             value:
//               updateData.requestedYearlySalary !== undefined
//                 ? updateData.requestedYearlySalary.toString()
//                 : 'Not specified',
//             type: 'number_decimal',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'position_requested_description',
//             value: formattedDescription || 'No Description',
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'availability',
//             value: updateData.availability || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'userinformation',
//             value: `${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//             type: 'single_line_text_field',
//           },
//         },
//       ];
//     } else if (product_type === 'Provider Needed') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'qualification_requested',
//             value: updateData.qualificationRequested,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'job_type',
//             value: updateData.jobType,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'type_of_job_offered',
//             value: updateData.typeOfJobOffered,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'offered_yearly_salary',
//             value: updateData.offeredYearlySalary,
//             type: 'number_integer',  // Ensure this is actually an integer
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'offered_position_description',
//             value: formattedDescription,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'userinformation',
//             value: `${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//             type: 'single_line_text_field',
//           },
//         },
//       ];
    
//     } else if (product_type === 'Spa Room For Rent') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'room_size',
//             value: updateData.roomSize,
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'monthly_rent',
//             value: updateData.monthlyRent,
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'deposit',
//             value: updateData.deposit,
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'minimum_insurance_requested',
//             value: updateData.minimumInsuranceRequested,
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'type_of_use_allowed',
//             value: updateData.typeOfUseAllowed,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'rental_terms',
//             value: updateData.rentalTerms,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'wifi_available',
//             value: updateData.wifiAvailable,
//             type: 'boolean',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'other_details',
//             value: formattedDescription,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'userinformation',
//             value: `${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//             type: 'single_line_text_field',
//           },
//         },
//       ];
//     } else if (product_type === 'New Equipments') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'name',
//             value: updateData.name,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'description',
//             value: formattedDescription,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location || 'Unknown',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'brand',
//             value: updateData.brand,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'sale_price',
//             value: updateData.sale_price.toString(),
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'equipment_type',
//             value: updateData.equipment_type,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'certification',
//             value: updateData.certification,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'year_manufactured',
//             value: updateData.year_manufactured.toString(),
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'warranty',
//             value: updateData.warranty,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'training',
//             value: updateData.training,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'shipping',
//             value: updateData.shipping || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'userinformation',
//             value: `${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//             type: 'single_line_text_field',
//           },
//         },
//       ];
//     }else if (product_type === 'Looking For') {
//       metafieldsPayload = [
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'zip',
//             value: updateData.zip || 'Not specified',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'name',
//             value: updateData.name,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'description',
//             value: formattedDescription,
//             type: 'multi_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'location',
//             value: updateData.location || 'Unknown',
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'brand',
//             value: updateData.brand,
//             type: 'single_line_text_field',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'sale_price',
//             value: updateData.sale_price,
//             type: 'number_integer',
//           },
//         },
//         {
//           metafield: {
//             namespace: 'fold_tech',
//             key: 'userinformation',
//             value: `${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//             type: 'single_line_text_field',
//           },
//         },
//       ];
//     }

//     for (const metafield of metafieldsPayload) {
//       const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${id}/metafields.json`;
//       await shopifyRequest(metafieldsUrl, 'POST', metafield);
//     }
//     // Prepare Shopify payload, including user info
//     const shopifyPayload = {
//       product: {
//         title: `${updateData.name || updateData.qualificationRequested || updateData.typeOfUseAllowed} | ${country} , ${updateData.location} , ${updateData.zip}`,
//         body_html: formattedDescription || formattedDescription || formattedDescription,
//         vendor: updateData.brand || updateData.location,
//         tags: `zip_${updateData.zip}, location_${updateData.location}, username_${username}`,
//         images: product.images, // Attach updated images
//       },
//     };

//     // Shopify update API URL
//     const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${product.id}.json`;

//     // Update the product in Shopify
//     const shopifyResponse = await fetch(shopifyUrl, {
//       method: 'PUT',
//       headers: {
//         Authorization: `Basic ${Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`).toString('base64')}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(shopifyPayload),
//     });

//     if (!shopifyResponse.ok) {
//       const errorDetails = await shopifyResponse.text();
//       return res.status(500).json({
//         message: 'Failed to update product in Shopify',
//         details: errorDetails,
//       });
//     }
//     const currentStatus = product.status;
// if (product_type === 'Used Equipments' || product_type === 'New Equipments' ) {
//   updateData.equipment = {
//     location: req.body.location,
//     zip: req.body.zip,
//     name: req.body.name,
//     brand: req.body.brand,
//     asking_price: req.body.asking_price,
//     accept_offers: req.body.accept_offers,
//     equipment_type: req.body.equipment_type,
//     certification: req.body.certification,
//     year_purchased: req.body.year_purchased,
//     warranty: req.body.warranty,
//     reason_for_selling: req.body.reason_for_selling,
//     shipping: req.body.shipping,
//     sale_price: req.body.sale_price,
//     year_manufactured: req.body.year_manufactured,
//     training: req.body.training,
//     description: formattedDescription,
//   };
// }

// if (product_type === 'Businesses To Purchase') {
//   updateData.business = {
//     name: req.body.name,
//     location: req.body.location,
//     zip: req.body.zip,
//     businessDescription: req.body.businessDescription,
//     asking_price: req.body.asking_price,
//     establishedYear: req.body.establishedYear,
//     numberOfEmployees: req.body.numberOfEmployees,
//     locationMonthlyRent: req.body.locationMonthlyRent,
//     leaseExpirationDate: new Date(req.body.leaseExpirationDate),
//     locationSize: req.body.locationSize,
//     grossYearlyRevenue: req.body.grossYearlyRevenue,
//     cashFlow: req.body.cashFlow,
//     productsInventory: req.body.productsInventory,
//     equipmentValue: req.body.equipmentValue,
//     reasonForSelling: req.body.reasonForSelling,
//     listOfDevices: req.body.listOfDevices,
//     offeredServices: req.body.offeredServices,
//     supportAndTraining: formattedDescription,
//   };
// }

// if (product_type === 'Spa Room For Rent') {
//   updateData.roomListing = [
//     {
//       location: req.body.location,
//       zip: req.body.zip,
//       roomSize: req.body.roomSize,
//       monthlyRent: req.body.monthlyRent,
//       deposit: req.body.deposit,
//       minimumInsuranceRequested: req.body.minimumInsuranceRequested,
//       typeOfUseAllowed: req.body.typeOfUseAllowed,
//       rentalTerms: req.body.rentalTerms,
//       wifiAvailable: req.body.wifiAvailable,
//       otherDetails: formattedDescription,
//       images: imagesData, // Assuming imagesData is already defined
//     },
//   ];
// }

// if (product_type === 'Provider Needed') {
//   updateData.providerListings = [
//     {
//       location: req.body.location,
//       zip: req.body.zip,
//       qualificationRequested: req.body.qualificationRequested,
//       jobType: req.body.jobType,
//       typeOfJobOffered: req.body.typeOfJobOffered,
//       offeredYearlySalary: req.body.offeredYearlySalary,
//       offeredPositionDescription: formattedDescription,
//       images: imagesData, // Assuming imagesData is already defined
//     },
//   ];
// }

// if (product_type === 'Providers Available') {
//   updateData.jobListings = [
//     {
//       location: req.body.location,
//       zip: req.body.zip,
//       name: req.body.name,
//       qualification: req.body.qualification,
//       positionRequestedDescription: formattedDescription,
//       availability: req.body.availability,
//       requestedYearlySalary: req.body.requestedYearlySalary,
//       images: imagesData, // Assuming imagesData is already defined
//     },
//   ];
// }
// if (product_type === 'Looking For') {
//   updateData.looking = {
//     name: req.body.name,
//     location: req.body.location,
//     zip: req.body.zip,
//     brand: req.body.brand,
//     sale_price: req.body.sale_price,
//     description: formattedDescription,
//     images:imagesData
//   };
// }

// // || formattedDescription || req.body.otherDetails
// // Set common fields for all product types
// const commonFields = {
//   title: req.body.name || req.body.qualificationRequested,
//   body_html: formattedDescription ,
//   vendor: req.body.brand,
//   product_type,
//   status:currentStatus,
//   created_at: new Date(),
// };

// // Combine common fields with the specific update data
// const updatedProduct = await listingModel.findOneAndUpdate(
//   { id },
//   { ...commonFields, ...updateData },
//   { new: true } // Option to return the updated document
// );
 
// return res
//       .status(200)
//       .json({ message: 'Product updated successfully', product: updatedProduct });
//   } catch (error) {
//     console.error('Error updating product:', error);
//     return res.status(500).json({ message: 'An error occurred', error });
//   }
// };



export const productUpdate = async (req, res) => {
  const { id, updateData } = req.body; // Shopify product ID and update data from the request body

  if (!id || !updateData) {
    return res.status(400).send('Product ID and update data are required');
  }

  try {
    // Update the product in MongoDB using the Shopify product ID
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


export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    // Find product in MongoDB
    const product = await listingModel.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if shopifyId is defined
    if (!product.id) {
      // Use the correct field name
      return res
        .status(400)
        .json({ message: 'Shopify ID is not available for this product' });
    }

    // Construct the Shopify URL
    const shopifyUrl = `https://med-spa-trader.myshopify.com/admin/api/2023-10/products/${product.id}.json`;

    // Delete from Shopify using Authorization header
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

    // Delete from MongoDB
    await listingModel.findByIdAndDelete(id);

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: 'An error occurred', error: error.message });
  }
};

// webhook product deletion
export const productDelete = async (req, res) => {
  const { id } = req.body; // Shopify product ID from the request body

  if (!id) {
    return res.status(400).send('Product ID is required');
  }

  try {
    // Delete the product from MongoDB using the Shopify product ID
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

//FOR CONVERTING UNPUBLISH TO PUBLISH
export const publishProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    // Fetch the local product
    const localProduct = await listingModel.findOne({ id: productId });
    if (!localProduct) {
      return res.status(404).json({ error: 'Product not found in database.' });
    }

    const { userId, product_type } = localProduct;

    // Fetch user from MongoDB
    const user = await authModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check subscription quantity
    const productConfig = await productModel.findOne({ product_type });
    if (!productConfig) {
      return res.status(404).json({ error: 'Product configuration not found for this product type.' });
    }

    // Check subscription credits
    // if (!user.subscription || user.subscription.quantity < 0) {
    //   return res.status(400).json({ error: 'Insufficient subscription credits to publish product.' });
    // }

    if (user.subscription.quantity < productConfig.credit_required) {
      return res.status(400).json({
        error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
      });
    }

    // Decrement the subscription quantity
    user.subscription.quantity -= productConfig.credit_required;
    await user.save();

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

    // Set expiration date to 30 days from now
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Update product status in MongoDB
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
    // Get product ID from request parameters
    const { userId } = req.params; // Get user ID from request body

    // Validate productId and userId
    if (!mongoose.isValidObjectId(userId)) {
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
      console.error(
        `Insufficient quantity: User ID ${userId}, Quantity: ${user.subscription ? user.subscription.quantity : 'undefined'}`
      );
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
    const basicAuth = Buffer.from(
      `${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`
    ).toString('base64');

    // Update the product in Shopify
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
      console.error(`Shopify API error for product ID ${id}: ${errorText}`); // Log detailed error
      return res
        .status(response.status)
        .send(`Failed to update in Shopify: ${errorText}`);
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

//FOR CONVERTING PUBLISH TO UNPUBLISH
export const unpublishProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    // Step 1: Update product status in Shopify
    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
    const shopifyPayload = {
      product: {
        id: productId,
        status: 'draft', // Set status to draft
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

    // Step 2: Update product status in MongoDB
    const updatedProduct = await listingModel.findOneAndUpdate(
      { id: productId },
      { status: 'draft' },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found in database.' });
    }

    // Step 3: Send response
    return res.status(200).json({
      message: 'Product successfully unpublished.',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('Error in unpublishProduct function:', error);
    return res.status(500).json({ error: error.message });
  }
};


export const deletAllProduct = async (req, res) => {
  try {
    listingModel.deleteMany().then((result) => {
      if (result) {
        res.status(200).send('sucessfully deleted');
      }
    });
  } catch (error) {}
};

//In this api admin can change credits on the base of product type
export const updateCredits=async(req,res)=>{
  const { newCredit,productType } = req.body;

  // Validate input
  if (typeof newCredit !== 'number' || newCredit < 0) {
    return res.status(400).json({ message: 'Invalid credit value. It must be a non-negative number.' });
  }

  try {
      await productModel.updateMany(
      { product_type: productType },
      { credit_required: newCredit }
    );

    // Send a response
    res.json({
      message: `Updated credit for '${productType}' to require ${newCredit} credits.`,
      
    });
  } catch (error) {
    console.error('Error updating credit requirement:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
}


export const updateProductPrice = async (req, res) => {
  const { creditId, price } = req.body;

  try {
      // Fetch the Shopify product details using the productId
      const apiKey = process.env.SHOPIFY_API_KEY;
      const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
      const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

      const shopifyProductUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/products/${creditId}.json`;

      const productResponse = await fetch(shopifyProductUrl, {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiPassword}`).toString('base64')}`,
          },
      });

      const shopifyProductData = await productResponse.json();

      // Check if the product was fetched successfully
      if (productResponse.status !== 200 || !shopifyProductData.product) {
          return res.status(404).json({ message: 'Failed to fetch product from Shopify' });
      }

      // Step 2: Find the correct variant within the product
      const variant = shopifyProductData.product.variants[0]; // Assuming a single variant for simplicity

      if (!variant) {
          return res.status(404).json({ message: 'No variants found for this product' });
      }

      // Store the product info in the database
      const product = new BuyCreditModel({
        creditId,
          variantId: variant.id, // Use the fetched variant ID
          price,
      });

      await product.save();

      res.status(201).json({ message: 'Product updated successfully', variantId: variant.id });
  } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: 'Error updating product', error: error.message });
  }
};


export const updateNewPrice = async (req, res) => {
  const id = "670cdd8351a965e64f096390"; // MongoDB product ID
  const { price, creditId } = req.body; // creditId is the Shopify product ID from the request

  try {
    // Step 1: Fetch the product from Shopify to get its variants
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

    // Fetch the Shopify product details using the product ID (creditId)
    const shopifyProductUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/products/${creditId}.json`;

    const productResponse = await fetch(shopifyProductUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiPassword}`).toString('base64')}`,
      },
    });

    const shopifyProductData = await productResponse.json();

    if (productResponse.status !== 200 || !shopifyProductData.product) {
      return res.status(404).json({ message: 'Failed to fetch product from Shopify' });
    }

    // Step 2: Find the correct variant within the product
    const variant = shopifyProductData.product.variants[0]; // Assuming a single variant for simplicity

    if (!variant) {
      return res.status(404).json({ message: 'No variants found for this product' });
    }

    // Step 3: Update the price for that specific variant in Shopify
    const shopifyVariantUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`;

    const updateResponse = await fetch(shopifyVariantUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiPassword}`).toString('base64')}`,
      },
      body: JSON.stringify({
        variant: {
          id: variant.id,
          price: price, // Update only the price
        },
      }),
    });

    const updateData = await updateResponse.json();

    if (updateResponse.status !== 200) {
      return res.status(updateResponse.status).json({
        message: 'Failed to update price in Shopify',
        error: updateData.errors,
      });
    }

    // Step 4: Update the product in MongoDB to include price, creditId, and variantId
    const updatedProduct = await BuyCreditModel.findByIdAndUpdate(
      id,
      { price, creditId, variantId: variant.id }, // Update MongoDB fields
      { new: true, runValidators: true } // Return the updated document and run validators
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found in MongoDB' });
    }

    // Step 5: Return the updated MongoDB product and Shopify variant
    res.status(200).json({
      message: 'Price updated successfully',
      updatedProduct, // MongoDB response
      updatedVariant: updateData.variant, // Shopify response (updated variant)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred', error: error.message });
  }
};


export const fetchPricePerCredit = async (req, res) => {
  try {
      // Use `await` to wait for the aggregation to finish
      const credit = await BuyCreditModel.aggregate([
          {
              $project: {
                creditId:1,
                price: 1,
                variantId:1 // Only project the `price` field
              }
          }
      ]);

      if (credit && credit.length > 0) {
          // If data is found, send it
          res.status(200).json(credit);
      } else {
          // If no data found, return a 404
          res.status(404).json({ message: 'No data found' });
      }
  } catch (error) {
      // Handle errors gracefully
      console.error(error);
      res.status(500).json({ message: 'An error occurred', error: error.message });
  }
}; 


export const fetchRequireCredits = async (req, res) => {
  try {
    // Fetch unique product types and their required credits using aggregation
    const products = await productModel.aggregate([
      {
        $group: {
          _id: "$product_type", // Group by product_type
          credit_required: { $first: "$credit_required" } // Get the first credit_required for each product_type
        }
      },
      {
        $project: {
          product_type: "$_id", // Rename _id to product_type
          credit_required: 1,
          _id: 0 // Exclude the default _id field from the output
        }
      }
    ]);

    // Check if products were found
    if (!products || products.length === 0) {
      return res.status(404).json({ message: 'No products found.' });
    }

    // Send response with fetched products
    res.status(200).json({
      message: 'Unique products and required credits fetched successfully.',
      data: products
    });
  } catch (error) {
    console.error('Error fetching required credits:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};


// export const lookingFor = async (req, res) => {
//   let productId;
//   try {
//     const {
//       location,
//       zip,
//       name,
//       brand,
//       sale_price,
//       description,
//       userId,
//       status, // 'publish' or 'draft'
//     } = req.body;

//     // Validate required fields
//     if (!zip) return res.status(400).json({ error: 'ZipCode is required.' });
//     if (!location)
//       return res.status(400).json({ error: 'Location is required.' });
//     if (!name) return res.status(400).json({ error: 'Name is required.' });
//     if (!brand) return res.status(400).json({ error: 'Brand is required.' });
//     if (!description)
//       return res.status(400).json({ error: 'Description is required.' });
    
//     // Determine product status based on action
//     const productStatus = status === 'publish' ? 'active' : 'draft';

//     // Step 1: Fetch user to get the username
//     const user = await authModel.findById(userId);
//     if (!user) return res.status(404).json({ error: 'User not found.' });

//     const username = user.userName; // Fetch username, default to 'Unknown' if not found
//     const phoneNumber = user.phoneNumber;
//     const country = user.country;
//     const city = user.city;
//     const email = user.email;
//     // Step 2: Create Product in Shopify
//     const shopifyPayload = {
//       product: {
//         title: `${name} | ${country},${location},${zip}`,
//         body_html: description,
//         vendor: brand,
//         product_type: 'Looking For',
//         variants: [{ price: sale_price }],
//         status: productStatus,
//         published_scope: 'global',
//         tags: [`zip_${zip}`, `location_${location}`, `username_${username}`], // Include username in tags
//       },
//     };

//     const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
//     const productResponse = await shopifyRequest(
//       shopifyUrl,
//       'POST',
//       shopifyPayload
//     );
//     productId = productResponse.product.id; // Assign productId

//     // Step 3: Create Structured Metafields for the Equipment Details
//     const metafieldsPayload = [
//       {
//         metafield: {
//           namespace: 'fold_tech',
//           key: 'zip',
//           value: zip || 'Not specified',
//           type: 'single_line_text_field',
//         },
//       },
//       {
//         metafield: {
//           namespace: 'fold_tech',
//           key: 'name',
//           value: name,
//           type: 'single_line_text_field',
//         },
//       },
//       {
//         metafield: {
//           namespace: 'fold_tech',
//           key: 'description',
//           value: description,
//           type: 'multi_line_text_field',
//         },
//       },
//       {
//         metafield: {
//           namespace: 'fold_tech',
//           key: 'location',
//           value: location || 'Unknown',
//           type: 'single_line_text_field',
//         },
//       },
//       {
//         metafield: {
//           namespace: 'fold_tech',
//           key: 'brand',
//           value: brand,
//           type: 'single_line_text_field',
//         },
//       },
//       {
//         metafield: {
//           namespace: 'fold_tech',
//           key: 'sale_price',
//           value: sale_price || 0,
//           type: 'number_integer',
//         },
//       },
//       {
//         metafield: {
//           namespace: 'fold_tech',
//           key: 'userinformation',
//           value: `${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
//           type: 'single_line_text_field',
//         },
//       },
//     ];

//     for (const metafield of metafieldsPayload) {
//       const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
//       await shopifyRequest(metafieldsUrl, 'POST', metafield);
//     }

//     // Step 4: Upload Images to Shopify if provided
//     const images = req.files?.images || [];
//     const imagesData = [];

//     for (const image of images) {
//       const cloudinaryImageUrl = image.path; // Ensure we use the correct path

//       const imagePayload = {
//         image: {
//           src: cloudinaryImageUrl,
//         },
//       };

//       const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
//       const imageResponse = await shopifyRequest(
//         imageUrl,
//         'POST',
//         imagePayload
//       );

//       if (imageResponse && imageResponse.image) {
//         imagesData.push({
//           id: imageResponse.image.id,
//           product_id: productId,
//           position: imageResponse.image.position,
//           created_at: imageResponse.image.created_at,
//           updated_at: imageResponse.image.updated_at,
//           alt: 'Looking Image',
//           width: imageResponse.image.width,
//           height: imageResponse.image.height,
//           src: imageResponse.image.src,
//         });
//       }
//     }

//     // Step 5: Save Product to MongoDB
//     const newProduct = new listingModel({
//       id: productId,
//       title: name,
//       body_html: '', // Empty body_html as we use metafields for details
//       vendor: brand,
//       product_type: 'Looking For',
//       created_at: new Date(),
//       handle: productResponse.product.handle,
//       updated_at: new Date(),
//       published_at: productResponse.product.published_at,
//       template_suffix: productResponse.product.template_suffix,
//       tags: productResponse.product.tags,
//       variants: productResponse.product.variants,
//       images: imagesData,
//       equipment: {
//         location,
//         zip,
//         name,
//         brand,
//         sale_price,
//         description,
//       },
//       userId,
//       status: productStatus,
//     });

//     await newProduct.save();

//     // If the product is published, decrease user subscription quantity
//     if (status === 'active') {
//       const user = await authModel.findById(userId);
//       if (!user) return res.status(404).json({ error: 'User not found.' });

//       // Check subscription quantity
//       const productConfig = await productModel.findOne({ product_type: 'Looking For' });
//       if (!productConfig) {
//         return res.status(404).json({ error: 'Product configuration not found.' });
//       }

//       // if (!user.subscription || user.subscription.quantity <= 0) {
//       //   return res.status(400).json({ error: 'Insufficient subscription credits to publish product.' });
//       // }

//       if (user.subscription.quantity < productConfig.credit_required) {
//         return res.status(400).json({
//           error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
//         });
//       }

//       // Decrement the subscription quantity
//       user.subscription.quantity -= productConfig.credit_required;
//       await user.save();

//       // Set expiration date to 30 days from now
//       const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

//       // Step 6: Update product status in Shopify
//       const updateShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
//       const shopifyUpdatePayload = {
//         product: {
//           id: productId,
//           status: 'active',
//           published_scope: 'global',
//         },
//       };

//       const shopifyResponse = await shopifyRequest(
//         updateShopifyUrl,
//         'PUT',
//         shopifyUpdatePayload
//       );
//       if (!shopifyResponse.product) {
//         return res
//           .status(400)
//           .json({ error: 'Failed to update product status in Shopify.' });
//       }

//       // Step 7: Update product status in MongoDB
//       const updatedProduct = await listingModel.findOneAndUpdate(
//         { id: productId },
//         { status: 'active', expiresAt },
//         { new: true }
//       );

//       if (!updatedProduct) {
//         return res
//           .status(404)
//           .json({ error: 'Product not found in database.' });
//       }

//       // Schedule the unpublish task
//       //scheduleUnpublish(productId, userId, expiresAt);

//       // Send a successful response
//       return res.status(201).json({
//         message: 'Product successfully created and published.',
//         product: updatedProduct,
//         expiresAt,
//       });
//     }

//     // If the product is saved as draft
//     res.status(201).json({
//       message: 'Product successfully created and saved as draft.',
//       product: newProduct,
//       expiresAt: null, // No expiration date for draft
//     });
//   } catch (error) {
//     console.error('Error in addNewEquipments function:', error);

//     // Attempt to delete the product from Shopify if it was created
//     if (productId) {
//       try {
//         const deleteShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
//         await shopifyRequest(deleteShopifyUrl, 'DELETE');
//       } catch (deleteError) {
//         console.error('Error deleting product from Shopify:', deleteError);
//       }
//     }

//     res.status(500).json({ error: error.message });
//   }
// };

export const lookingFor = async (req, res) => {
  let productId;
  try {
    const {
      location,
      zip,
      name,
      brand,
      sale_price,
      description,
      userId,
      status, // 'publish' or 'draft'
    } = req.body;

    // Validate required fields
    if (!zip) return res.status(400).json({ error: 'ZipCode is required.' });
    if (!location)
      return res.status(400).json({ error: 'Location is required.' });
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (!brand) return res.status(400).json({ error: 'Brand is required.' });
    if (!description)
      return res.status(400).json({ error: 'Description is required.' });
    
    // Determine product status based on action
    const productStatus = status === 'publish' ? 'active' : 'draft';

    // Step 1: Fetch user to get the username
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const username = user.userName; // Fetch username, default to 'Unknown' if not found
    const phoneNumber = user.phoneNumber;
    const country = user.country;
    const city = user.city;
    const email = user.email;
    const firstName=user.firstName
    const lastName=user.lastName
    // Step 2: Create Product in Shopify
    // const formattedDescription = description.replace(/\n/g, '<br>');

    const shopifyPayload = {
      product: {
        title: `${name} | ${country},${location},${zip}`,
        body_html: description,
        vendor: brand,
        product_type: 'Looking For',
        variants: [{ price: sale_price }],
        status: productStatus,
        published_scope: 'global',
        tags: [`zip_${zip}`, `location_${location}`, `username_${username}`], // Include username in tags
      },
    };

    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products.json`;
    const productResponse = await shopifyRequest(
      shopifyUrl,
      'POST',
      shopifyPayload
    );
    productId = productResponse.product.id; // Assign productId

    // Step 3: Create Structured Metafields for the Equipment Details
    const metafieldsPayload = [
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'zip',
          value: zip || 'Not specified',
          type: 'single_line_text_field',
        },
      },
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
          type: 'multi_line_text_field',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'location',
          value: location || 'Unknown',
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
          value: sale_price || 0,
          type: 'number_integer',
        },
      },
      {
        metafield: {
          namespace: 'fold_tech',
          key: 'userinformation',
          value: `${firstName} ${lastName} | ${username} | ${email} | ${phoneNumber} | ${city} - ${country}`,
          type: 'single_line_text_field',
        },
      },
    ];

    for (const metafield of metafieldsPayload) {
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/metafields.json`;
      await shopifyRequest(metafieldsUrl, 'POST', metafield);
    }

    // Step 4: Upload Images to Shopify if provided
    const images = req.files?.images || [];
    const imagesData = [];

    for (const image of images) {
      const cloudinaryImageUrl = image.path; // Ensure we use the correct path

      const imagePayload = {
        image: {
          src: cloudinaryImageUrl,
        },
      };

      const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}/images.json`;
      const imageResponse = await shopifyRequest(
        imageUrl,
        'POST',
        imagePayload
      );

      if (imageResponse && imageResponse.image) {
        imagesData.push({
          id: imageResponse.image.id,
          product_id: productId,
          position: imageResponse.image.position,
          created_at: imageResponse.image.created_at,
          updated_at: imageResponse.image.updated_at,
          alt: 'Looking Image',
          width: imageResponse.image.width,
          height: imageResponse.image.height,
          src: imageResponse.image.src,
        });
      }
    }

    // Step 5: Save Product to MongoDB
    const newProduct = new listingModel({
      id: productId,
      title: name,
      body_html: description, // Empty body_html as we use metafields for details
      vendor: brand,
      product_type: 'Looking For',
      created_at: new Date(),
      handle: productResponse.product.handle,
      updated_at: new Date(),
      published_at: productResponse.product.published_at,
      template_suffix: productResponse.product.template_suffix,
      tags: productResponse.product.tags,
      variants: productResponse.product.variants,
      images: imagesData,
      looking: {
        location,
        zip,
        name,
        brand,
        sale_price,
        description,
      },
      userId,
      status: productStatus,
    });

    await newProduct.save();

    // If the product is published, decrease user subscription quantity
    if (status === 'active') {
      const user = await authModel.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Check subscription quantity
      const productConfig = await productModel.findOne({ product_type: 'Looking For' });
      if (!productConfig) {
        return res.status(404).json({ error: 'Product configuration not found.' });
      }

      // if (!user.subscription || user.subscription.quantity <= 0) {
      //   return res.status(400).json({ error: 'Insufficient subscription credits to publish product.' });
      // }

      if (user.subscription.quantity < productConfig.credit_required) {
        return res.status(400).json({
          error: `Insufficient subscription credits to publish product. Requires ${productConfig.credit_required} credits.`,
        });
      }

      // Decrement the subscription quantity
      user.subscription.quantity -= productConfig.credit_required;
      await user.save();

      // Set expiration date to 30 days from now
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Step 6: Update product status in Shopify
      const updateShopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${productId}.json`;
      const shopifyUpdatePayload = {
        product: {
          id: productId,
          status: 'active',
          published_scope: 'global',
        },
      };

      const shopifyResponse = await shopifyRequest(
        updateShopifyUrl,
        'PUT',
        shopifyUpdatePayload
      );
      if (!shopifyResponse.product) {
        return res
          .status(400)
          .json({ error: 'Failed to update product status in Shopify.' });
      }

      // Step 7: Update product status in MongoDB
      const updatedProduct = await listingModel.findOneAndUpdate(
        { id: productId },
        { status: 'active', expiresAt },
        { new: true }
      );

      if (!updatedProduct) {
        return res
          .status(404)
          .json({ error: 'Product not found in database.' });
      }

      // Schedule the unpublish task
      //scheduleUnpublish(productId, userId, expiresAt);

      // Send a successful response
      return res.status(201).json({
        message: 'Product successfully created and published.',
        product: updatedProduct,
        expiresAt,
      });
    }

    // If the product is saved as draft
    res.status(201).json({
      message: 'Product successfully created and saved as draft.',
      product: newProduct,
      expiresAt: null, // No expiration date for draft
    });
  } catch (error) {
    console.error('Error in addNewEquipments function:', error);

    // Attempt to delete the product from Shopify if it was created
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



export const getAllProductData = async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
  const limit = parseInt(req.query.limit) || 10; // Default to 10 products per page

  try {
    const products = await listingModel
      .find()
      .sort({ createdAt: -1 }) // Sort by createdAt in descending order (latest first)
      .skip((page - 1) * limit) // Skip products based on the page number
      .limit(limit); // Limit the number of products returned

    const totalProducts = await listingModel.countDocuments(); // Get the total number of products

    if (products.length > 0) { // Check if products are found
      res.status(200).send({
        products,
        currentPage: page,
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts
      });
    } else {
      res.status(400).send('No products found'); // Adjusted message for clarity
    }
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};





























