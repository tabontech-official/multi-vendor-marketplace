import { authModel } from '../Models/auth.js';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import path from 'path';
import { Buffer } from 'buffer';
import { registerSchema, loginSchema } from '../validation/auth.js';
import fs from 'fs';
import mongoose from 'mongoose';

//storage for images storing
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

    // Check if the user already exists
    const userExist = await authModel.findOne({ email: req.body.email });
    if (userExist) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash the password before sending to Shopify and saving to DB
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Prepare Shopify request payload
    const shopifyPayload = {
      customer: {
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        email: req.body.email,
        password: req.body.password,
        password_confirmation: req.body.password,
        tags: 'Trade User',
      },
    };

    // Basic Auth credentials
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');
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
      return res.status(500).json({ error: 'Failed to register user with Shopify' });
    }

    // Extract Shopify ID from the response
    const shopifyResponse = await response.json();
    const shopifyId = shopifyResponse.customer.id;

    // Create and save new user in MongoDB with hashed password and Shopify ID
    const newUser = new authModel({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: hashedPassword, // Store the hashed password
      shopifyId: shopifyId, // Save the Shopify ID in MongoDB
      tags: 'Trade User',
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
      return res.status(404).json({ error: 'User does not exist with this email' });
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

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');
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

// export const logout = async (req res) => {

//   try {
//     // Validate request parameters
//     const { id } = req.params; // This should be the Shopify customer ID
//     if (!id) {
//       return res.status(400).json({ error: 'Shopify Customer ID is required' });
//     }

//     // Find the user by Shopify customer ID
//     const user = await authModel.findOne({ shopifyId: id });
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     // Clear session or token in MongoDB
//     // Assuming 'shopifyAccessToken' is the field storing the token
//     await authModel.findOneAndUpdate({ shopifyId: id }, { shopifyAccessToken: null });

//     // Basic Auth credentials for Shopify
//     const apiKey = process.env.SHOPIFY_API_KEY;
//     const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
//     const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
//     const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');

//     // Prepare Shopify request URL (replace with the correct endpoint if needed)
//     const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers/${id}.json`;

//     // Revoke or delete user in Shopify (this example assumes a delete request)
//     const response = await fetch(shopifyUrl, {
//       method: 'DELETE',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Basic ${base64Credentials}`,
//         'Accept': 'application/json',
//       },
//     });

//     // Handle Shopify response
//     if (!response.ok) {
//       let errorMessage = 'Failed to revoke token from Shopify';
//       let responseBody = '';

//       try {
//         responseBody = await response.text(); // Read response as text
//         if (responseBody) {
//           const errorData = JSON.parse(responseBody);
//           console.error('Error revoking token in Shopify:', errorData);
//           errorMessage = errorData.message || errorMessage;
//         } else {
//           console.error('Shopify response is empty');
//         }
//       } catch (parseError) {
//         console.error('Error parsing Shopify error response:', parseError);
//       }

//       return res.status(response.status).json({ error: errorMessage });
//     }

//     // Send success response
//     res.status(200).json({
//       message: 'Logged out successfully',
//     });
//   } catch (error) {
//     console.error('Error during logout:', error);
//     res.status(500).json({ error: error.message });
//   }
// };

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
  const { email, password, phoneNumber, address, zip, country, city } = req.body;
  const image = req.file; // Handle file upload

  try {
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    // Find user by ID
    const user = await authModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Update fields
    if (email) user.email = email;
    if (password) user.password = await bcrypt.hash(password, 10);
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (address) user.address = address;
    if (zip) user.zip = zip;
    if (country) user.country = country;
    if (city) user.city = city;
    if (image) {
      // Remove old image if it exists
      if (user.avatar) {
        const oldImagePath = path.resolve('/tmp/uploads/', user.avatar);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      // Update user's avatar with the new image filename
      user.avatar = image.filename; // Store only the filename
    }

    // Save the updated user
    await user.save();

    // Update user data in Shopify
    const shopifyUrl = `https://med-spa-trader.myshopify.com/admin/api/2023-10/customers/${user.shopifyId}.json`;
    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}`).toString('base64')}`,
      },
      body: JSON.stringify({
        customer: {
          id: user.shopifyId, // Make sure to have this ID in your user model
          email: user.email,
          phoneNumber: user.phoneNumber,
          addresses: [
            {
              address1: user.address,
              city: user.city,
              province: user.state, // Assuming you have a state field
              country: user.country,
              zip: user.zip,
            },
          ],
          // Include other fields as necessary
        },
      }),
    });

    if (!shopifyResponse.ok) {
      console.error(
        'Failed to update user in Shopify:',
        await shopifyResponse.text()
      );
      return res
        .status(500)
        .json({ error: 'Failed to update user in Shopify' });
    }

    res.status(200).json({ message: 'Profile updated successfully.' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const fetchUserData = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await authModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      { $project: { email: 1, password: 1, phoneNumber:1, address:1, zip:1, country:1, city:1 } },
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

export const getUserSubscriptionQuantity = async (req, res) => {
  const { userId } = req.params;

  // Validate userId format
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ error: 'Invalid user ID format.' });
  }

  try {
    // Fetch the user by userId
    const user = await authModel.findById(userId);
    
    // Check if user exists
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if subscription exists
    if (!user.subscription || !user.subscription.quantity || !user.subscription.expiresAt) {
      return res.status(400).json({ 
        message:'Insuffcient credits',
       
       });
    }

    // Return the quantity and expiry date from the user's subscription
    return res.status(200).json({
      quantity: user.subscription.quantity,
      expiresAt: user.subscription.expiresAt
    });
  } catch (error) {
    console.error('Error fetching user subscription quantity:', error);
    return res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
};



// export const checkSubscription = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     // Check if userId is provided
//     if (!userId) {
//       return res.status(400).send('User ID is required');
//     }

//     // Find the user
//     const user = await Auth.findById(userId);
//     if (!user) {
//       return res.status(404).send('User not found');
//     }

//     const currentDate = new Date();
//     const hasValidSubscription = user.subscription.status === 'active' &&
//       user.subscription.endDate > currentDate;

//     if (!user.hasPaidSubscription || !hasValidSubscription) {
//       return res.status(403).send('User does not have an active paid subscription');
//     }

//     res.status(200).send(user.subscription);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Internal server error');
//   }
// };

export const AdminSignIn = async (req, res) => {
  try {
    // Validate the request body
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = req.body;

    // Check if user exists in your database
    const user = await authModel.findOne({ email });
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

    // Create a JWT token for your application
    const token = createToken({ _id: user._id });

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


export const forgotPassword = async (req, res) => {
  try {
    const customerData = req.body;

    // Assuming you're storing customer emails in MongoDB
    const customer = await authModel.findOne({ email: customerData.email });

    if (customer) {
      // Hash the new password before saving
      const saltRounds = 10; // You can adjust this number based on your security needs
      const hashedPassword = await bcrypt.hash(customerData.password, saltRounds);
      
      customer.password = hashedPassword; // Set the hashed password
      await customer.save();
    }

    res.status(200).send('Successfully updated data');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};

export const updateCustomer=async(req,res)=>{
  const customerData = req.body;

  // Update or create customer in MongoDB
  await authModel.findOneAndUpdate(
      { shopifyId: customerData.id }, // Assuming `id` is the unique identifier
      customerData,
      { upsert: true, new: true }
  );

  res.sendStatus(200);
}


export const deleteUser=async(req,res)=>{
  const customerId = req.body.id; // Get the customer ID from the webhook data

  try {
      // Delete from MongoDB
      await authModel.deleteOne({ shopifyId: customerId });
      res.status(200).send('Customer deleted successfully.');
  } catch (error) {
      console.error('Error deleting customer from MongoDB:', error);
      res.status(500).send('Error deleting customer.');
  }
}