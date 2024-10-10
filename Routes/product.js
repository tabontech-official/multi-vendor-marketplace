import {
  fetchAndStoreProducts,
  addProduct,
  addUsedEquipments,
  addNewEquipments,
  addNewBusiness,
  addNewJobListing,
  addNewProviderListing,
  addRoomListing,
  getProduct,
  updateListing,
  publishProduct,
  deleteProduct,
  getSearchProduct,
  productDelete,
  deletAllProduct,
  unpublishProduct,
  productUpdate,
  updateCredits
} from '../controller/product.js';
import { upload, cpUpload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';
import express from 'express';

const productRouter = express.Router();
productRouter.get('/shopify', fetchAndStoreProducts);
productRouter.post('/addProduct', upload.single('image'), addProduct);
productRouter.post('/addEquipment', cpUpload, addUsedEquipments);
productRouter.post('/addRoom', cpUpload, addRoomListing);
productRouter.post('/addNewEquipments', cpUpload, addNewEquipments);
productRouter.post('/addJob', cpUpload, addNewJobListing);
productRouter.post('/addBusiness', cpUpload, addNewBusiness);
productRouter.post('/addProvider', cpUpload, addNewProviderListing);
productRouter.post('/webhooks/delete', productDelete);
productRouter.post('/webhook/product/update', productUpdate);
productRouter.get('/search/:userId', verifyShopifyWebhook, getSearchProduct);
productRouter.get('/getProduct/:userId', getProduct);
productRouter.put('/updateListing/:id', cpUpload, updateListing);
productRouter.put('/publishedProduct/:productId', publishProduct);
productRouter.put('/unpublished/:productId', unpublishProduct);
productRouter.delete('/deleteProduct/:id', deleteProduct);
productRouter.delete('/', deletAllProduct);
productRouter.put('/credits/:productType',updateCredits)
export default productRouter;

// export const updateListing = async (req, res) => {
//   const { id } = req.params; // Product ID from URL
//   const { userId } = req.body; // User ID from body

//   try {
//     // Fetch user by userId
//     const user = await authModel.findById(userId);
//     if (!user) return res.status(404).json({ error: 'User not found.' });

//     // Fetch user details
//     const username = user.userName; // Default to 'Unknown' if not found
//     const country = user.country;

//     // Find the product by ID
//     const product = await productModel.findById(id);
//     if (!product) {
//       return res.status(404).json({ message: 'Product not found' });
//     }
//     console.log("Existing Product before update:", product);

//     // Prepare the update data
//     const updateData = req.body;

//     // Handle image uploads
//     const images = req.files.images; // Expecting multiple images
//     const imagesData = [];

//     if (Array.isArray(images) && images.length > 0) {
//       for (const image of images) {
//         const cloudinaryImageUrl = image?.path; // Ensure we use the correct path

//         const imagePayload = {
//           image: {
//             src: cloudinaryImageUrl,
//           },
//         };

//         // Construct the image URL for Shopify
//         const imageUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${product.id}/images.json`;

//         // Make the request to upload the image to Shopify
//         const imageResponse = await shopifyRequest(imageUrl, 'POST', imagePayload);

//         if (imageResponse && imageResponse.image) {
//           imagesData.push({
//             id: imageResponse.image.id,
//             product_id: product.id,
//             position: imageResponse.image.position,
//             alt: 'Provider Search Listing',
//             width: imageResponse.image.width,
//             height: imageResponse.image.height,
//             src: imageResponse.image.src,
//           });
//         }
//       }

//       // Update the product's images array with the new images
//       product.images = imagesData; // Replace existing images
//     }

//     // Prepare updated data for product
//     const updatedProductData = {
//       ...updateData,
//       images: product.images,
//     };
//     console.log("Updating product:", id, updatedProductData);
//     // Ensure the title is set to the equipment name if it exists
//     if (updateData.equipment && updateData.equipment.name) {
//       updatedProductData.title = updateData.equipment.name; // Update title with equipment name
//     }

//     // Prepare Shopify payload
//     const shopifyPayload = {
//       product: {
//         title: `${updateData.name} | ${country} , ${updateData.location} , ${updateData.zip}`,
//         body_html: updateData.description,
//         vendor: updateData.brand,
//         product_type: 'Used Equipments',
//         variants: [{ price: updateData.asking_price.toString() }],
//         status: updateData.status,
//         tags: [`zip_${updateData.zip}`, `location_${updateData.location}`, `username_${username}`], // Include username in tags
//         images: product.images, // Attach the updated images to the Shopify payload
//       },
//     };

//     // Update the product in the database with new data
//     const updatedProduct = await productModel.findByIdAndUpdate(
//       id,
//       { $set: updatedProductData },
//       { new: true }
//     );
//     console.log("Incoming update data:", updateData);
//     console.log("Payload for MongoDB update:", updatedProductData);
//     console.log("MongoDB update result:", updatedProduct);

//     // Update in Shopify
//     const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/products/${product.id}.json`;
//     const response = await fetch(shopifyUrl, {
//       method: 'PUT',
//       headers: {
//         Authorization: `Basic ${Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`).toString('base64')}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify(shopifyPayload),
//     });

//     if (!response.ok) {
//       return res.status(500).json({
//         message: 'Failed to update product in Shopify',
//         details: await response.text(),
//       });
//     }

//     // Successful response
//     res.status(200).json({
//       message: 'Product successfully updated',
//       data: updatedProduct,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'An error occurred', error: error.message });
//   }
// };

export const updatesListing = async (req, res) => {
  const { id } = req.params; // MongoDB ID
  const { userId } = req.body; // User ID from body
  const updateData = req.body; // Data to update
  const images = req.files?.images || []; // Expecting multiple images
  const imagesData = [];

  try {
    // Fetch user by userId
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const username = user.userName || 'Unknown'; // Fallback to 'Unknown' if not available
    const country = user.country;

    // Find the product by MongoDB ID
    const product = await productModel.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log('Existing Product before update:', product);

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
        const imageUrl = `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/products/${product.id}/images.json`;

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

    // Prepare Shopify payload, including user info
    const shopifyPayload = {
      product: {
        title: `${updateData.name} | ${country} , ${updateData.location} , ${updateData.zip}`,
        body_html: updateData.description,
        vendor: updateData.brand,
        product_type: 'Used Equipments',
        variants: [{ price: updateData.asking_price.toString() }],
        status: updateData.status,
        tags: [
          `zip_${updateData.zip}`,
          `location_${updateData.location}`,
          `username_${username}`,
        ], // Include username in tags
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

    // Update product in MongoDB
    await productModel.findByIdAndUpdate(id, updateData, { new: true });

    return res
      .status(200)
      .json({ message: 'Product updated successfully', product: updateData });
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({ message: 'An error occurred', error });
  }
};
