import { authModel } from '../Models/auth.js';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Buffer } from 'buffer';
import { registerSchema, loginSchema } from '../validation/auth.js';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import { brandAssetModel } from '../Models/brandAsset.js';
import {apiCredentialModel} from '../Models/apicredential.js'

const createToken = (payLoad) => {
  const token = jwt.sign({ payLoad }, process.env.SECRET_KEY, {
    expiresIn: '1d',
  });
  return token;
};

export const signUp = async (req, res) => {
  try {
    // const { error } = registerSchema.validate(req.body);
    // if (error) {
    //   return res.status(400).json({ error: error.details[0].message });
    // }

    const baseUsername = req.body.email
      .split('@')[0]
      .toLowerCase()
      .replace(/[.-\s]/g, '');
    let username = baseUsername;
    let counter = 1;

    const userExist = await authModel.findOne({ email: req.body.email });
    if (userExist) {
      return res
        .status(400)
        .json({ error: 'User already exists with this email' });
    }

    const usernameExists = async (username) => {
      return await authModel.findOne({ userName: username });
    };

    while (await usernameExists(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    const shopifyPayload = {
      customer: {
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        email: req.body.email,
        password: req.body.password,
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

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const apiKey = shopifyConfiguration.shopifyApiKey;
    const apiPassword = shopifyConfiguration.shopifyAccessToken;
    const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
      'base64'
    );
    const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/customers.json`;

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

    const shopifyResponse = await response.json();
    const shopifyId = shopifyResponse.customer.id;

    const newUser = new authModel({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      userName: username,
      email: req.body.email,
      password: req.body.password,
      shopifyId: shopifyId,
      tags: `Trade User, trade_${username}`,
      phoneNumber: req.body.phoneNumber,
      city: req.body.city,
      state: req.body.state,
      zip: req.body.zip,
      country: req.body.country,
    });
    const savedUser = await newUser.save();
    const token = createToken({ _id: savedUser._id });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'aydimarketplace@gmail.com',
        pass: 'ijeg fypl llry kftw',
      },
    });

    const mailOptions = {
      from: `${req.body.firstName} <${req.body.email}>`,
      to: 'aydimarketplace@gmail.com',
      subject: 'New User Signup',
      html: `
        <h2>New User Registered</h2>
        <p><strong>Name:</strong> ${req.body.firstName} ${req.body.lastName}</p>
        <p><strong>Email:</strong> ${req.body.email}</p>
       
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Signup mail failed:', err);
      } else {
        console.log('Signup mail sent:', info.response);
      }
    });
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

// export const checkShopifyAdminTag = async (email) => {
//   const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//   if (!shopifyConfiguration) {
//     throw new Error('Shopify configuration not found.');
//   }

//   const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
//   const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
//   const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;
//   try {
//     const credentials = `${shopifyApiKey}:${shopifyAccessToken}`;
//     const base64Credentials = Buffer.from(credentials).toString('base64');

//     const response = await fetch(
//       `${shopifyStoreUrl}/admin/api/2023-10/customers.json?email=${email}`,
//       {
//         method: 'GET',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Basic ${base64Credentials}`,
//         },
//       }
//     );

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }

//     const data = await response.json();
//     const customers = data.customers;

//     if (customers.length > 0) {
//       const tags = customers[0].tags.split(',').map((tag) => tag.trim());

//       if (tags.includes('DevAdmin')) return 'Dev Admin';
//       if (tags.includes('MasterAdmin')) return 'Master Admin';
//       if (tags.includes('Client')) return 'Client';
//       if (tags.includes('Staff')) return 'Staff';
//       if (tags.includes('approved')) return 'Client';
//     }

//     return 'User';
//   } catch (error) {
//     console.error('Error fetching Shopify customer:', error);
//     throw new Error('Error checking Shopify customer');
//   }
// };

export const checkShopifyAdminTag = async (email) => {
  const shopifyConfiguration = await shopifyConfigurationModel.findOne();
  if (!shopifyConfiguration) {
    throw new Error('Shopify configuration not found.');
  }

  const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
  const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
  const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;

  const modules = [
    'Dashboard',
    'Products',
    'Manage Product',
    'Add Product',
    'Inventory',
    'Orders',
    'ManageOrders',
    'Promotions',
    'All Promotions',
    'Reports',
    'Catalog Performance',
    'eCommerce Consultation',
  ];

  try {
    const credentials = `${shopifyApiKey}:${shopifyAccessToken}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');

    const response = await fetch(
      `${shopifyStoreUrl}/admin/api/2023-10/customers.json?email=${email}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${base64Credentials}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const customers = data.customers;

    if (customers.length > 0) {
      const tags = customers[0].tags.split(',').map((tag) => tag.trim());
      const shopifyId = customers[0].id;

      if (tags.includes('DevAdmin')) return 'Dev Admin';
      if (tags.includes('MasterAdmin')) return 'Master Admin';

      if (tags.includes('approved')) {
        const existingUser = await authModel.findOne({ email });

        if (existingUser) {
          existingUser.modules = modules;
          existingUser.role = 'Client';
          existingUser.shopifyId = shopifyId;
          await existingUser.save();
        } else {
          console.log('User not found to update.');
        }

        return 'Client';
      }

      if (tags.includes('Client')) return 'Client';
      if (tags.includes('Staff')) return 'Staff';
    }

    return 'User';
  } catch (error) {
    console.error('Error fetching Shopify customer:', error);
    throw new Error('Error checking Shopify customer');
  }
};

export const signIn = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = req.body;

    const user = await authModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const userRole = await checkShopifyAdminTag(email);

    user.role = userRole;
    await user.save();

    const token = createToken({ _id: user._id, role: user.role });

    res.json({ token, role: user.role, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};




const hashPassword = async (password) => {
  if (password) {
    return await bcrypt.hash(password, 10);
  }
  return null;
};

const tagExistsInShopify = async (shopifyId, tag) => {
  const shopifyConfiguration = await shopifyConfigurationModel.findOne();
  if (!shopifyConfiguration) {
    throw new Error('Shopify configuration not found.');
  }

  const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
  const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;

  const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;

  const credentials = `${shopifyApiKey}:${shopifyAccessToken}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');

  const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/customers/${shopifyId}.json`;

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
    const userTags = userData.customer.tags.split(', ');

    return userTags.includes(tag);
  } catch (error) {
    console.error('Error in tagExistsInShopify function:', error);
    throw error;
  }
};

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

    const defaultTag = 'Trade User';
    const tagExists = await tagExistsInShopify(shopifyId, defaultTag);

    if (!tagExists) {
      return res
        .status(404)
        .json({ error: 'User with the specified tag not found in Shopify' });
    }

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
        tags: defaultTag,
      },
    };

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      throw new Error('Shopify configuration not found.');
    }

    const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
    const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
    const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;

    const credentials = `${shopifyApiKey}:${shopifyAccessToken}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');
    const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/customers/${shopifyId}.json`;

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

    const hashedPassword = await hashPassword(password);

    const mongoUpdateData = {
      firstName,
      lastName,
      email,
      zip,
      address,
      phoneNumber,
    };

    if (hashedPassword) {
      mongoUpdateData.password = hashedPassword;
    }

    const updatedUser = await authModel.findOneAndUpdate(
      { shopifyId: shopifyId },
      mongoUpdateData,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found in MongoDB' });
    }

    res.status(200).json({
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error in updateUser function:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const CreateUserTagsModule = async (req, res) => {
  try {
    const { email, modules, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let existingUser = await authModel.findOne({ email });

    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'User already exists with this email' });
    }

    const token = createToken(email);
    const resetLink = `http://localhost:3006/New?token=${token}`;

    console.log(resetLink);

    await transporter.sendMail({
      to: email,
      subject: 'Password Reset',
      html: `<p>Click <a href="${resetLink}">here</a> to create your password.</p>`,
    });

    const shopifyPayload = {
      customer: {
        tags: role,
        email: email,
      },
    };
    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
    const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;

    if (!shopifyAccessToken || !shopifyStoreUrl) {
      return res.status(500).json({ error: 'Shopify credentials are missing' });
    }

    const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/customers.json`;

    const response = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyAccessToken,
      },
      body: JSON.stringify(shopifyPayload),
    });

    const shopifyResponse = await response.json();

    if (!response.ok) {
      console.error('Error creating user in Shopify:', shopifyResponse);
      return res.status(500).json({
        error: 'Failed to create user in Shopify',
        details: shopifyResponse,
      });
    }

    const shopifyId = shopifyResponse.customer.id;

    const newUser = new authModel({
      email,
      modules,
      role,
      shopifyId,
    });

    await newUser.save();

    res.status(201).json({
      message: 'User created successfully in both Shopify and MongoDB',
      data: newUser,
    });
  } catch (error) {
    console.error('Error in CreateUserTagsModule function:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getUserWithModules = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await authModel.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(id) },
      },
      {
        $project: {
          _id: 0,
          modules: 1,
        },
      },
    ]);

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching user modules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logout = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await authModel.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.clearCookie('token', { path: '/' });

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
  const { userId } = req.params;
  const {
    email,
    phoneNumber,
    address,
    firstName,
    lastName,
    gstRegistered,
    sellerGst,
    dispatchzip,
    dispatchCountry,
    dispatchCity,
    dispatchAddress,
  } = req.body;
  const images = req.files?.images || [];
  const requiredFields = [email, firstName, lastName];
  const fieldNames = ['email', 'firstName', 'lastName'];

  for (let i = 0; i < requiredFields.length; i++) {
    if (!requiredFields[i]) {
      return res.status(400).json({ error: `${fieldNames[i]} is required.` });
    }
  }

  try {
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const user = await authModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.email = email;
    user.address = address;

    // user.phoneNumber = phoneNumber;
    user.firstName = firstName;
    user.lastName = lastName;
    user.gstRegistered = gstRegistered;
    user.sellerGst = sellerGst;
    user.dispatchzip = dispatchzip;
    user.dispatchCountry = dispatchCountry;
    user.dispatchCity = dispatchCity;
    user.dispatchAddress = dispatchAddress;

    const imagesData = [];
    if (Array.isArray(images) && images.length > 0) {
      for (const image of images) {
        const imageUrl = image.path;
        imagesData.push(imageUrl);
      }
      user.avatar = imagesData;
    }

    await user.save();
    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const shopifyApiKey = shopifyConfiguration.shopifyApiKey;
    const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
    const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;
    console.log(shopifyStoreUrl);
    const shopifyCustomerId = user.shopifyId;
    console.log(shopifyCustomerId);
    if (shopifyCustomerId) {
      const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/customers/${shopifyCustomerId}.json`;
      const shopifyPayload = {
        customer: {
          id: shopifyCustomerId,
          first_name: firstName,
          last_name: lastName,
          email: email,
        },
      };

      await shopifyRequest(
        shopifyUrl,
        'PUT',
        shopifyPayload,
        shopifyApiKey,
        shopifyAccessToken
      );

      // const metafieldsUrl = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/customers/${shopifyCustomerId}/metafields.json`;
      // const metafieldsPayload = {
      //   metafield: {
      //     namespace: 'custom',
      //     key: 'profileimages',
      //     value: imagesData.join(','),
      //     type: 'single_line_text_field',
      //   },
      // };

      // await shopifyRequest(metafieldsUrl, 'POST', metafieldsPayload);
    }

    res.status(200).json({ message: 'Profile updated successfully.', user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

export const shopifyRequest = async (
  url,
  method,
  body,
  apiKey,
  accessToken
) => {
  const base64Credentials = Buffer.from(`${apiKey}:${accessToken}`).toString(
    'base64'
  );

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${base64Credentials}`,
    },
    body: body ? JSON.stringify(body) : null,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed: ${errorText}`);
  }

  return response.json();
};

export const deleteUser = async (req, res) => {
  const customerId = req.body.id;

  try {
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
    user: 'aydimarketplace@gmail.com',
    pass: 'ijeg fypl llry kftw',
  },
  secure: true,
  tls: {
    rejectUnauthorized: false,
  },
});

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await authModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = createToken(user._id);

    const resetLink = `${'http://localhost:3006/New'}?token=${token}`;
    console.log(resetLink);
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
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.payLoad._id;
    console.log('Decoded token:', decoded);

    const user = await authModel.findById(userId);
    console.log('User fetched from database:', user);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;

    await user.save();

    await updateShopifyPassword(user.shopifyId, newPassword);

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res
      .status(500)
      .json({ message: 'Error resetting password', error: error.message });
  }
};

export const createPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    console.log('Decoded token:', decoded);

    const userEmail = decoded.payLoad;

    console.log('Searching for user with email:', userEmail);

    const user = await authModel.findOne({ email: userEmail });
    console.log('User fetched from database:', user);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

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
  const shopifyConfiguration = await shopifyConfigurationModel.findOne();
  if (!shopifyConfiguration) {
    return res.status(404).json({ error: 'Shopify configuration not found.' });
  }

  const apiKey = shopifyConfiguration.shopifyApiKey;
  const apiPassword = shopifyConfiguration.shopifyAccessToken;
  const shopifyDomain = new URL(shopifyConfiguration.shopifyStoreUrl).hostname;
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

export const getAllUsersData = async (req, res) => {
  try {
    const result = await authModel.aggregate([
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          role: 1,
          country: 1,
          city: 1,
          shopifyId:1
        },
      },
    ]);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: error.message });
  }
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

export const getUserByRole = async (req, res) => {
  try {
    const { id } = req.params;

    const currentUser = await authModel.findById(id);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const userRole = currentUser.role;
    let roleFilter = {};

    if (userRole === 'Dev Admin') {
      roleFilter = {
        role: { $in: ['Master Admin', 'Client', 'Dev Admin', 'Staff'] },
      };
    } else if (userRole === 'Master Admin') {
      roleFilter = { role: { $in: ['Client', 'Staff'] } };
    } else if (userRole === 'Client') {
      roleFilter = { role: 'Staff' };
    } else if (userRole === 'Staff') {
      return res.status(403).json({ error: 'Staff cannot see any users.' });
    }

    const users = await authModel.aggregate([
      { $match: roleFilter },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          role: 1,
          country: 1,
          city: 1,
          userName: 1,
          shopifyId:1
        },
      },
    ]);

    if (users.length === 0) {
      return res
        .status(404)
        .json({ message: 'No users found based on your role.' });
    }

    return res.status(200).json({
      message: 'Users retrieved successfully.',
      users,
    });
  } catch (error) {
    console.error('Error fetching users by role:', error);
    return res.status(500).json({ error: 'Server error.' });
  }
};

export const saveShopifyCredentials = async (req, res) => {
  try {
    const { shopifyAccessToken, shopifyApiKey, shopifyStoreUrl } = req.body;

    if (!shopifyAccessToken || !shopifyApiKey) {
      return res.status(400).json({ message: 'Missing required credentials.' });
    }

    const result = await shopifyConfigurationModel.updateMany(
      {},
      { $set: { shopifyAccessToken, shopifyApiKey, shopifyStoreUrl } }
    );

    if (result.modifiedCount > 0) {
      return res
        .status(200)
        .json({ message: 'Credentials updated successfully.' });
    } else {
      return res.status(404).json({ message: 'No documents were updated.' });
    }
  } catch (error) {
    console.error('Error updating credentials:', error);
    return res
      .status(500)
      .json({ message: 'Server error while updating credentials.' });
  }
};

export const createShopifyCollection = async (req, res) => {
  try {
    const { description } = req.body;

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const ACCESS_TOKEN = shopifyConfiguration.shopifyAccessToken;
    // const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
    const SHOPIFY_STORE_URL = shopifyConfiguration.shopifyStoreUrl;

    const images = req.files?.images
      ? Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images]
      : [];

    const firstImageUrl = images.length > 0 ? images[0].path : null;

    const collectionPayload = {
      custom_collection: {
        title: 'Brand Asset Upload',
        body_html: description,
      },
    };

    if (firstImageUrl) {
      collectionPayload.custom_collection.image = {
        src: firstImageUrl,
      };
    }

    const createCollection = await axios.post(
      `${SHOPIFY_STORE_URL}/admin/api/2023-10/custom_collections.json`,
      collectionPayload,
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );
    const saveBrandData = new brandAssetModel({
      images: firstImageUrl || '',
      description,
    });
    await saveBrandData.save();
    return res.status(200).json({
      message: 'Collection created successfully',
      collection: createCollection.data.custom_collection,
    });
  } catch (error) {
    if (error.response) {
      console.error(' Shopify API Error:');
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(' General Error:', error.message);
    }

    res
      .status(500)
      .json({ message: 'Failed to create collection', error: error.message });
  }
};

export const getLatestBrandAsset = async (req, res) => {
  try {
    const data = await brandAssetModel.aggregate([
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);
    res.status(200).send(data);
  } catch (error) {}
};

export const getSingleUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await authModel.findById(id);

    if (user) {
      res.status(200).json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
