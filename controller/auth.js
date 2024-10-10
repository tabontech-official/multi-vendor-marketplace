import { authModel } from '../Models/auth.js';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Buffer } from 'buffer';
import { registerSchema, loginSchema } from '../validation/auth.js';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import axios from 'axios';

const createToken = (payLoad) => {
  const token = jwt.sign({ payLoad }, process.env.SECRET_KEY, {
    expiresIn: '1d',
  });
  return token;
};

export const signUp = async (req, res) => {
  try {
    // Validate input data
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Extract and normalize the username
    const baseUsername = req.body.email
      .split('@')[0]
      .toLowerCase()
      .replace(/[.-\s]/g, '');
    let username = baseUsername;
    let counter = 1;

    // Check if the user already exists by email
    const userExist = await authModel.findOne({ email: req.body.email });
    if (userExist) {
      return res
        .status(400)
        .json({ error: 'User already exists with this email' });
    }

    // Check for existing username and create a unique one if needed
    const usernameExists = async (username) => {
      return await authModel.findOne({ userName: username });
    };

    while (await usernameExists(username)) {
      username = `${baseUsername}${counter}`; // Append the counter to the base username
      counter++;
    }

    // Create Shopify request payload
    const shopifyPayload = {
      customer: {
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        email: req.body.email,
        password: req.body.password, // Use plain password; it will be hashed in the model
        password_confirmation: req.body.password,
        tags: `Trade User, trade_${username}`,
        metafields: [
          {
            namespace: 'custom',
            key: 'username',
            value: username,
            type: 'single_line_text_field',
          },
          {
            namespace: 'custom',
            key: 'phoneNumber',
            value: req.body.phoneNumber,
            type: 'single_line_text_field',
          },
          {
            namespace: 'custom',
            key: 'city',
            value: req.body.city,
            type: 'single_line_text_field',
          },
          {
            namespace: 'custom',
            key: 'state',
            value: req.body.state,
            type: 'single_line_text_field',
          },
          {
            namespace: 'custom',
            key: 'zip',
            value: req.body.zip,
            type: 'single_line_text_field',
          },
          {
            namespace: 'custom',
            key: 'country',
            value: req.body.country,
            type: 'single_line_text_field',
          },
        ],
      },
    };

    // Basic Auth credentials
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
      'base64'
    );
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers.json`;

    // Save user to Shopify
    const response = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Credentials}`,
      },
      body: JSON.stringify(shopifyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error saving user to Shopify:', errorData);
      return res
        .status(500)
        .json({ error: 'Failed to register user with Shopify' });
    }

    // Extract Shopify ID from the response
    const shopifyResponse = await response.json();
    const shopifyId = shopifyResponse.customer.id;

    // Create and save new user in MongoDB with hashed password and Shopify ID
    const newUser = new authModel({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      userName: username, // Use the unique username
      email: req.body.email,
      password: req.body.password, // This will be hashed in the pre-save hook
      shopifyId: shopifyId,
      tags: `Trade User, trade_${username}`, // Adjusted to use the unique username
      phoneNumber: req.body.phoneNumber,
      city: req.body.city,
      state: req.body.state,
      zip: req.body.zip,
      country: req.body.country,
    });
    const savedUser = await newUser.save(); // This will trigger the pre-save hook

    // Create token
    const token = createToken({ _id: savedUser._id });

    // Send response
    res.status(201).send({
      message: 'Successfully registered',
      token,
      data: savedUser,
    });
  } catch (error) {
    console.error('Error in signUp function:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const signIn = async (req, res) => {
  try {
    // Validate input data
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = req.body;

    // Check if user exists in the database
    const user = await authModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ error: 'User does not exist with this email' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Basic Auth credentials for Shopify
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
      'base64'
    );
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers.json?query=email:${email}`;

    // Check Shopify credentials
    const response = await fetch(shopifyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Credentials}`,
      },
    });

    const shopifyData = await response.json();

    if (response.status !== 200 || !shopifyData.customers.length) {
      return res.status(404).json({ error: 'User does not exist in Shopify' });
    }

    const shopifyCustomer = shopifyData.customers[0];

    // Optional: Log Shopify Customer ID
    console.log('Shopify Customer ID:', shopifyCustomer.id);

    // Create a JWT token for your application
    const token = createToken({ _id: user._id });

    res.json({
      message: 'Successfully logged in',
      token,
      data: {
        user,
        shopifyCustomer, // Include Shopify customer data if needed
      },
    });
  } catch (error) {
    console.error('Login error:', error.message || error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const hashPassword = async (password) => {
  if (password) {
    return await bcrypt.hash(password, 10);
  }
  return null;
};

// Helper function to check if the tag exists for the user in Shopify
const tagExistsInShopify = async (shopifyId, tag) => {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
  const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

  const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
    'base64'
  );
  const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers/${shopifyId}.json`;

  try {
    const response = await fetch(shopifyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Credentials}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching user from Shopify:', errorData);
      throw new Error('Failed to fetch user from Shopify');
    }

    const userData = await response.json();
    const userTags = userData.customer.tags.split(', '); // Tags are typically a comma-separated string

    return userTags.includes(tag);
  } catch (error) {
    console.error('Error in tagExistsInShopify function:', error);
    throw error;
  }
};

// Controller function to update user data
export const updateUser = async (req, res) => {
  try {
    const { shopifyId } = req.params;
    const {
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      zip,
      address,
      country,
      city,
    } = req.body;

    if (!shopifyId) {
      return res.status(400).json({ error: 'Shopify ID is required' });
    }

    // Check if the specified tag exists for the user in Shopify
    const defaultTag = 'Trade User'; // Default tag to check
    const tagExists = await tagExistsInShopify(shopifyId, defaultTag);

    if (!tagExists) {
      return res
        .status(404)
        .json({ error: 'User with the specified tag not found in Shopify' });
    }

    // Prepare Shopify update payload
    const shopifyPayload = {
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password,
        password_confirmation: password,
        phoneNumber: phoneNumber,
        zip: zip,
        address: address,
        tags: defaultTag, // Tags are managed as default, not included in the body
      },
    };

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
      'base64'
    );
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers/${shopifyId}.json`;

    // Update user in Shopify
    const response = await fetch(shopifyUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Credentials}`,
      },
      body: JSON.stringify(shopifyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error updating user in Shopify:', errorData);
      return res
        .status(500)
        .json({ error: 'Failed to update user with Shopify' });
    }

    // Hash password if provided and update in MongoDB
    const hashedPassword = await hashPassword(password);

    const mongoUpdateData = {
      firstName,
      lastName,
      email,
      zip,
      address,
      phoneNumber,
      // The tags field is not included in the update payload because it's a default value
    };

    if (hashedPassword) {
      mongoUpdateData.password = hashedPassword;
    }

    const updatedUser = await authModel.findOneAndUpdate(
      { shopifyId: shopifyId },
      mongoUpdateData,
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found in MongoDB' });
    }

    // Send response
    res.status(200).json({
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error in updateUser function:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const newSignUp = async (req, res) => {
  try {
    // Validate request body (Optional: Uncomment if you have a validation schema)
    // const { error } = registerValidationSchema.validate(req.body);
    // if (error) {
    //   return res.status(400).json({ error: error.details[0].message });
    // }

    // Check if user already exists
    const userExist = await authModel.findOne({ email: req.body.email });
    if (userExist) {
      return res
        .status(400)
        .json({ error: 'User already exists with this email' });
    }

    // Prepare Shopify request payload
    const shopifyPayload = {
      customer: {
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        email: req.body.email,
        password: req.body.password,
        password_confirmation: req.body.password,
        tags: `Trade User${req.body.additionalTags ? `, ${req.body.additionalTags}` : ''}`, // Default and additional tags
      },
    };

    // Basic Auth credentials
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
      'base64'
    );
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers.json`;

    // Save user to Shopify
    const response = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Credentials}`,
      },
      body: JSON.stringify(shopifyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error saving user to Shopify:', errorData);
      return res
        .status(500)
        .json({ error: 'Failed to register user with Shopify' });
    }

    // Extract Shopify ID from the response
    const shopifyResponse = await response.json();
    const shopifyId = shopifyResponse.customer.id;

    // Create and save new user in MongoDB with Shopify ID
    const newUser = new authModel({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: req.body.password, // Ensure password is hashed
      shopifyId: shopifyId, // Save the Shopify ID in MongoDB
      tags: `Trade User${req.body.additionalTags ? `, ${req.body.additionalTags}` : ''}`, // Default and additional tags
    });
    const savedUser = await newUser.save();

    // Create token
    const token = createToken({ _id: savedUser._id });

    // Send response
    res.status(201).send({
      message: 'Successfully registered',
      token,
      data: savedUser,
    });
  } catch (error) {
    console.error('Error in signUp function:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Helper function to revoke Shopify token
export const updateUserInShopify = async (req, res) => {
  try {
    // Validate request body
    const { email, firstName, lastName, password, additionalTags } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find the user by email
    const user = await authModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare Shopify request payload
    const shopifyPayload = {
      customer: {
        first_name: firstName || user.firstName,
        last_name: lastName || user.lastName,
        email: email,
        password: password || user.password,
        password_confirmation: password || user.password,
        tags: `Trade User${additionalTags ? `, ${additionalTags}` : ''}`, // Update tags
      },
    };

    // Basic Auth credentials
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
      'base64'
    );

    // Prepare Shopify update URL
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers/${user.shopifyId}.json`;

    // Update user in Shopify
    const response = await fetch(shopifyUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Credentials}`,
      },
      body: JSON.stringify(shopifyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error updating user in Shopify:', errorData);
      return res
        .status(500)
        .json({ error: 'Failed to update user with Shopify' });
    }

    // Update user in MongoDB
    const updateData = {
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email,
      password: password || user.password,
      tags: `Trade User${additionalTags ? `, ${additionalTags}` : ''}`, // Update tags
    };

    const updatedUser = await authModel.findOneAndUpdate(
      { email },
      updateData,
      { new: true }
    );

    // Send response
    res.status(200).json({
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error in updateUser function:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const userId = req.params.userId; // Access userId from params

    // Check if userId is valid
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find user by ID (if needed)
    const user = await authModel.findById(userId);

    // Optionally check if user exists
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clear the cookie
    res.clearCookie('token', { path: '/' }); // Add options if needed

    res.status(200).json({ message: 'Logout successfully', userId });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
};

export const webHook = async (req, res) => {
  const { shopifyId } = req.body;

  if (!shopifyId) {
    return res.status(400).json({ message: 'user ID is required' });
  }

  try {
    const result = await authModel.deleteOne({ shopifyId: shopifyId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'user not found in MongoDB' });
    }

    res.status(200).json({ message: 'user successfully deleted from MongoDB' });
  } catch (error) {
    console.error('Error in deleteProduct function:', error);
    res.status(500).json({ error: error.message });
  }
};

export const editProfile = async (req, res) => {
  const { userId } = req.params; // Get userId from request parameters
  const {
    email,
    phoneNumber,
    address,
    zip,
    country,
    city,
    firstName,
    lastName,
  } = req.body;
  const images = req.files?.images || []; // Handle multiple file uploads
  const requiredFields = [
    email,
    phoneNumber,
    address,
    zip,
    country,
    city,
    firstName,
    lastName,
  ];
  const fieldNames = [
    'email',
    'phoneNumber',
    'address',
    'zip',
    'country',
    'city',
    'firstName',
    'lastName',
  ];

  // Validate required fields
  for (let i = 0; i < requiredFields.length; i++) {
    if (!requiredFields[i]) {
      return res.status(400).json({ error: `${fieldNames[i]} is required.` });
    }
  }

  try {
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    // Find user by ID
    const user = await authModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Update user fields
    user.email = email;
    user.phoneNumber = phoneNumber;
    user.address = address;
    user.zip = zip;
    user.country = country;
    user.city = city;
    user.firstName = firstName;
    user.lastName = lastName;

    // Handle image upload
    const imagesData = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const image of images) {
        const imageUrl = image.path; // Assuming image.path is the URL
        imagesData.push(imageUrl); // Store the full URL
      }
      user.avatar = imagesData; // Assuming `avatar` is an array of image URLs
    }

    // Save the updated user
    await user.save();

    // Update Shopify user (if applicable)
    const shopifyCustomerId = user.shopifyId; // Assuming you store the Shopify customer ID in the user record
    if (shopifyCustomerId) {
      // Update Shopify user details
      const shopifyUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/customers/${shopifyCustomerId}.json`;
      const shopifyPayload = {
        customer: {
          id: shopifyCustomerId,
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phoneNumber,
          addresses: [
            {
              address1: address,
              city: city,
              province: country, // Adjust if necessary
              zip: zip,
              country: country,
            },
          ],
        },
      };

      // Update Shopify customer
      await shopifyRequest(shopifyUrl, 'PUT', shopifyPayload);

      // Now, handle the metafield for images
      const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/customers/${shopifyCustomerId}/metafields.json`;
      const metafieldsPayload = {
        metafield: {
          namespace: 'custom',
          key: 'profileimages',
          value: imagesData.join(','), // Store images as JSON
          type: 'single_line_text_field', // Store as JSON string
        },
      };

      // Create or update the metafield
      await shopifyRequest(metafieldsUrl, 'POST', metafieldsPayload);
    }

    res.status(200).json({ message: 'Profile updated successfully.', user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Function to make Shopify API request
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

export const fetchUserData = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await authModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
    ]);
    if (response.length > 0) {
      res.status(200).json(response[0]);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while fetching user data' });
  }
};

// export const getUserSubscriptionQuantity = async (req, res) => {
//   const { userId } = req.params;

//   // Validate userId format
//   if (!mongoose.isValidObjectId(userId)) {
//     return res.status(400).json({ error: 'Invalid user ID format.' });
//   }

//   try {
//     // Fetch the user by userId
//     const user = await authModel.findById(userId);

//     // Check if user exists
//     if (!user) {
//       return res.status(404).json({ error: 'User not found.' });
//     }

//     // Check if subscription exists
//     if (
//       !user.subscription ||
//       !user.subscription.quantity ||
//       !user.subscription.expiresAt
//     ) {
//       return res.status(400).json({
//         message: 'Insuffcient credits',
//       });
//     }

//     // Return the quantity and expiry date from the user's subscription
//     return res.status(200).json({
//       quantity: user.subscription.quantity,
//       expiresAt: user.subscription.expiresAt,
//     });
//   } catch (error) {
//     console.error('Error fetching user subscription quantity:', error);
//     return res
//       .status(500)
//       .json({ error: 'Internal server error. Please try again later.' });
//   }
// };

export const getUserSubscriptionQuantity = async (req, res) => {
  const { id } = req.params;

  // Validate userId format
  
  try {
    // Fetch the user by userId
    const user = await authModel.findById(id);

    // Check if user exists
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if subscription exists
    if (
      !user.subscription.quantity
    ) {
      return res.status(400).json({
        message: 'Insuffcient credits',
      });
    }

    // Return the quantity and expiry date from the user's subscription
    return res.status(200).json({
      quantity: user.subscription.quantity,
      // expiresAt: user.subscription.expiresAt,
    });
  } catch (error) {
    console.error('Error fetching user subscription quantity:', error);
    return res
      .status(500)
      .json({ error: 'Internal server error. Please try again later.' });
  }
};

export const AdminSignIn = async (req, res) => {
  try {
    // Validate the request body
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = req.body;

    // Check if user exists in your database
    let user = await authModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ error: 'User does not exist with this email' });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Password does not match' });
    }

    // Check Shopify credentials
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
      'base64'
    );
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers.json?query=email:${email}`;

    const response = await fetch(shopifyUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${base64Credentials}`,
      },
    });

    const data = await response.json();

    if (response.status !== 200 || !data.customers.length) {
      return res.status(404).json({ error: 'User does not exist in Shopify' });
    }

    const shopifyCustomer = data.customers[0];

    // Check if "isAdmin" tag is present
    if (!shopifyCustomer.tags.split(',').includes('isAdmin')) {
      return res.status(403).json({ error: 'You do not have admin access' });
    }

    // Update MongoDB to set isAdmin to true
    user.isAdmin = true;
    user.shopifyId = shopifyCustomer.id; // Save Shopify ID for reference
    await user.save();

    // Create a JWT token for your application, including isAdmin flag
    const token = createToken({ _id: user._id, isAdmin: true });

    res.json({
      message: 'Successfully logged in as admin',
      token,
      data: user,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


export const getUserData = async (req, res) => {
  try {
    const data = await authModel.find();

    if (data.length > 0) {
      res.status(200).send({
        message: 'Successfully fetched',
        data: data,
      });
    } else {
      res.status(404).send({ message: 'No users found' });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

export const updateCustomer = async (req, res) => {
  const customerData = req.body;

  // Update or create customer in MongoDB
  await authModel.findOneAndUpdate(
    { shopifyId: customerData.id }, // Assuming `id` is the unique identifier
    customerData,
    { upsert: true, new: true }
  );

  res.sendStatus(200);
};

export const deleteUser = async (req, res) => {
  const customerId = req.body.id; // Get the customer ID from the webhook data

  try {
    // Delete from MongoDB
    await authModel.deleteOne({ shopifyId: customerId });
    res.status(200).send('Customer deleted successfully.');
  } catch (error) {
    console.error('Error deleting customer from MongoDB:', error);
    res.status(500).send('Error deleting customer.');
  }
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'medsparecovery@gmail.com',
    pass: 'vfqm uxah oapw qnka',
  },
  secure: false, // Use true if using 465 port and secure connection
  tls: {
    rejectUnauthorized: false, // This might help with some connection issues
  },
});

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await authModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a reset token using the createToken function
    const token = createToken(user._id);

    // Create the reset link
    const resetLink = `${'https://medspa-frntend.vercel.app/Reset'}?token=${token}`;
    console.log(resetLink);
    // Send the email
    await transporter.sendMail({
      to: email,
      subject: 'Password Reset',
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
    });

    res.status(200).json({ message: 'Reset link sent to your email' });
  } catch (error) {
    console.error('Error sending reset email:', error);
    res.status(500).json({ message: 'Error sending reset email', error });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // Verify the token and decode the user ID
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.payLoad; // Accessing payLoad instead of id
    console.log('Decoded token:', decoded);

    const user = await authModel.findById(userId); // Find user by userId
    console.log('User fetched from database:', user);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Set the new password directly (will be hashed in the pre-save hook)
    user.password = newPassword;

    // Update the user in MongoDB (this will trigger the pre-save hook)
    await user.save();

    // Update the password in Shopify
    await updateShopifyPassword(user.shopifyId, newPassword);

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res
      .status(500)
      .json({ message: 'Error resetting password', error: error.message });
  }
};

const updateShopifyPassword = async (shopifyId, newPassword) => {
  const shopifyDomain = 'med-spa-trader.myshopify.com';
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;

  const url = `https://${apiKey}:${apiPassword}@${shopifyDomain}/admin/api/2023-04/customers/${shopifyId}.json`;

  console.log(`Requesting Shopify URL: ${url}`);

  try {
    const response = await axios.put(url, {
      customer: {
        id: shopifyId,
        password: newPassword,
        password_confirmation: newPassword,
      },
    });

    console.log('Shopify response:', response.status, response.data);

    if (response.status !== 200) {
      throw new Error('Failed to update password in Shopify');
    }
  } catch (error) {
    console.error(
      'Error updating Shopify password:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Failed to update password in Shopify');
  }
};
