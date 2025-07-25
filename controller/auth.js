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
import { apiCredentialModel } from '../Models/apicredential.js';
import crypto from 'crypto';
import { orderRquestModel } from '../Models/OrderRequest.js';
import { orderModel } from '../Models/order.js';
import { authBulkUploaderModel } from '../Models/authForBulkUploder.js';

const generateApiKey = () => `shpka_${crypto.randomBytes(16).toString('hex')}`;
const generateApiSecretKey = () =>
  `shpsk_${crypto.randomBytes(16).toString('hex')}`;

const createToken = (payLoad) => {
  const token = jwt.sign({ payLoad }, process.env.SECRET_KEY, {
    expiresIn: '1d',
  });
  return token;
};

// export const signUp = async (req, res) => {
//   try {
//     // const { error } = registerSchema.validate(req.body);
//     // if (error) {
//     //   return res.status(400).json({ error: error.details[0].message });
//     // }

//     const baseUsername = req.body.email
//       .split('@')[0]
//       .toLowerCase()
//       .replace(/[.-\s]/g, '');
//     let username = baseUsername;
//     let counter = 1;

//     const userExist = await authModel.findOne({ email: req.body.email });
//     if (userExist) {
//       return res
//         .status(400)
//         .json({ error: 'User already exists with this email' });
//     }

//     const usernameExists = async (username) => {
//       return await authModel.findOne({ userName: username });
//     };

//     while (await usernameExists(username)) {
//       username = `${baseUsername}${counter}`;
//       counter++;
//     }

//     const shopifyPayload = {
//       customer: {
//         first_name: req.body.firstName,
//         last_name: req.body.lastName,
//         email: req.body.email,
//         password: req.body.password,
//         password_confirmation: req.body.password,
//         tags: `Trade User, trade_${username}`,
//         metafields: [
//           {
//             namespace: 'custom',
//             key: 'username',
//             value: username,
//             type: 'single_line_text_field',
//           },
//           {
//             namespace: 'custom',
//             key: 'phoneNumber',
//             value: req.body.phoneNumber,
//             type: 'single_line_text_field',
//           },
//           {
//             namespace: 'custom',
//             key: 'city',
//             value: req.body.city,
//             type: 'single_line_text_field',
//           },
//           {
//             namespace: 'custom',
//             key: 'state',
//             value: req.body.state,
//             type: 'single_line_text_field',
//           },
//           {
//             namespace: 'custom',
//             key: 'zip',
//             value: req.body.zip,
//             type: 'single_line_text_field',
//           },
//           {
//             namespace: 'custom',
//             key: 'country',
//             value: req.body.country,
//             type: 'single_line_text_field',
//           },
//         ],
//       },
//     };

//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfiguration) {
//       return res
//         .status(404)
//         .json({ error: 'Shopify configuration not found.' });
//     }

//     const apiKey = shopifyConfiguration.shopifyApiKey;
//     const apiPassword = shopifyConfiguration.shopifyAccessToken;
//     const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;

//     const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString(
//       'base64'
//     );
//     const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/customers.json`;

//     const response = await fetch(shopifyUrl, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Basic ${base64Credentials}`,
//       },
//       body: JSON.stringify(shopifyPayload),
//     });

//     if (!response.ok) {
//       const errorData = await response.json();
//       console.error('Error saving user to Shopify:', errorData);
//       return res
//         .status(500)
//         .json({ error: 'Failed to register user with Shopify' });
//     }

//     const shopifyResponse = await response.json();
//     const shopifyId = shopifyResponse.customer.id;

//     const newUser = new authModel({
//       firstName: req.body.firstName,
//       lastName: req.body.lastName,
//       userName: username,
//       email: req.body.email,
//       password: req.body.password,
//       shopifyId: shopifyId,
//       tags: `Trade User, trade_${username}`,
//       phoneNumber: req.body.phoneNumber,
//       city: req.body.city,
//       state: req.body.state,
//       zip: req.body.zip,
//       country: req.body.country,
//     });
//     const savedUser = await newUser.save();
//     const token = createToken({ _id: savedUser._id });

//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: 'aydimarketplace@gmail.com',
//         pass: 'ijeg fypl llry kftw',
//       },
//     });

//     const mailOptions = {
//       from: `${req.body.firstName} <${req.body.email}>`,
//       to: 'aydimarketplace@gmail.com',
//       subject: 'New User Signup',
//       html: `
//         <h2>New User Registered</h2>
//         <p><strong>Name:</strong> ${req.body.firstName} ${req.body.lastName}</p>
//         <p><strong>Email:</strong> ${req.body.email}</p>

//       `,
//     };

//     transporter.sendMail(mailOptions, (err, info) => {
//       if (err) {
//         console.error('Signup mail failed:', err);
//       } else {
//         console.log('Signup mail sent:', info.response);
//       }
//     });
//     res.status(201).send({
//       message: 'Successfully registered',
//       token,
//       data: savedUser,
//     });
//   } catch (error) {
//     console.error('Error in signUp function:', error);
//     return res.status(500).json({ error: error.message });
//   }
// };

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

export const signUp = async (req, res) => {
  try {
    const { email, sellerName } = req.body;

    const baseUsername = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[.-\s]/g, '');
    let username = baseUsername;
    let counter = 1;

    const userExist = await authModel.findOne({ email });
    if (userExist) {
      return res
        .status(400)
        .json({ error: 'User already exists with this email' });
    }

    const usernameExists = async (uname) => {
      return await authModel.findOne({ userName: uname });
    };

    while (await usernameExists(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    const shopifyPayload = {
      customer: {
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        email,
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

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;
    const base64Credentials = Buffer.from(
      `${shopifyApiKey}:${shopifyAccessToken}`
    ).toString('base64');
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
      console.error('Shopify customer creation error:', errorData);
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
      email,
      password: req.body.password,
      shopifyId,
      tags: `Trade User, trade_${username}`,
      phoneNumber: req.body.phoneNumber,
      city: req.body.city,
      state: req.body.state,
      zip: req.body.zip,
      country: req.body.country,
      sellerName,
    });

    const savedUser = await newUser.save();

    let createdCollectionId = null;
    try {
      const collectionPayload = {
        custom_collection: {
          title: sellerName,
          body_html: `Brand collection for seller: ${sellerName}`,
        },
      };

      const collectionResponse = await axios.post(
        `${shopifyStoreUrl}/admin/api/2023-10/custom_collections.json`,
        collectionPayload,
        {
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      createdCollectionId = collectionResponse.data.custom_collection.id;

      await authModel.findByIdAndUpdate(savedUser._id, {
        shopifyCollectionId: createdCollectionId,
      });

      await brandAssetModel.create({
        userId: savedUser._id,
        sellerName: sellerName,
        shopifyCollectionId: createdCollectionId,
        description: '',
        images: '',
      });
    } catch (err) {
      console.error(
        'Shopify collection creation error:',
        err?.response?.data || err.message
      );
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'aydimarketplace@gmail.com',
        pass: 'ijeg fypl llry kftw',
      },
    });

    transporter.sendMail({
      from: `${req.body.firstName} <${email}>`,
      to: 'aydimarketplace@gmail.com',
      subject: 'New User Signup',
      html: `
        <h2>New User Registered</h2>
        <p><strong>Seller Name:</strong> ${sellerName}</p>
        <p><strong>Email:</strong> ${email}</p>
      `,
    });

    const token = createToken({ _id: savedUser._id });

    res.status(201).send({
      message: 'Successfully registered',
      token,
      data: {
        ...savedUser.toObject(),
        shopifyCollectionId: createdCollectionId,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
};

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
    'Finance',
    'Manage Categories',
    'Documentation'
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
          existingUser.role = 'Merchant';
          existingUser.shopifyId = shopifyId;
          await existingUser.save();
        } else {
          console.log('User not found to update.');
        }

        return 'Merchant';
      }
      if (tags.includes('Support Staff')) return 'Support Staff';

      if (tags.includes('Merchant')) return 'Merchant';
      if (tags.includes('Merchant Staff')) return 'Merchant Staff';
    }

    return 'User';
  } catch (error) {
    console.error('Error fetching Shopify customer:', error);
    throw new Error('Error checking Shopify customer');
  }
};

// export const signIn = async (req, res) => {
//   try {
//     const { error } = loginSchema.validate(req.body);
//     if (error) {
//       return res.status(400).json({ error: error.details[0].message });
//     }

//     const { email, password } = req.body;

//     const user = await authModel.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: 'Invalid password' });
//     }

//     const userRole = await checkShopifyAdminTag(email);

//     user.role = userRole;
//     await user.save();

//     const token = createToken({ _id: user._id, role: user.role });

//     res.json({ token, role: user.role, user });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// };

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

    let credentials = await apiCredentialModel.findOne({ userId: user._id });

    if (!credentials) {
      const apiKey = generateApiKey();
      const apiSecretKey = generateApiSecretKey();

      credentials = await apiCredentialModel.create({
        userId: user._id,
        apiKey,
        apiSecretKey,
      });
    }

    res.json({
      token,
      role: user.role,
      user,
      apiKey: credentials.apiKey,
      apiSecretKey: credentials.apiSecretKey,
      userId: user._id,
    });
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

// export const CreateUserTagsModule = async (req, res) => {
//   try {
//     const { email, modules, role } = req.body;

//     if (!email) {
//       return res.status(400).json({ error: 'Email is required' });
//     }

//     let existingUser = await authModel.findOne({ email });

//     if (existingUser) {
//       return res
//         .status(400)
//         .json({ error: 'User already exists with this email' });
//     }

//     const token = createToken(email);
//     const resetLink = `http://localhost:3006/New?token=${token}`;

//     console.log(resetLink);

//     await transporter.sendMail({
//       to: email,
//       subject: 'Password Reset',
//       html: `<p>Click <a href="${resetLink}">here</a> to create your password.</p>`,
//     });

//     const shopifyPayload = {
//       customer: {
//         tags: role,
//         email: email,
//       },
//     };
//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//     if (!shopifyConfiguration) {
//       return res
//         .status(404)
//         .json({ error: 'Shopify configuration not found.' });
//     }

//     const shopifyAccessToken = shopifyConfiguration.shopifyAccessToken;
//     const shopifyStoreUrl = shopifyConfiguration.shopifyStoreUrl;

//     if (!shopifyAccessToken || !shopifyStoreUrl) {
//       return res.status(500).json({ error: 'Shopify credentials are missing' });
//     }

//     const shopifyUrl = `${shopifyStoreUrl}/admin/api/2024-01/customers.json`;

//     const response = await fetch(shopifyUrl, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'X-Shopify-Access-Token': shopifyAccessToken,
//       },
//       body: JSON.stringify(shopifyPayload),
//     });

//     const shopifyResponse = await response.json();

//     if (!response.ok) {
//       console.error('Error creating user in Shopify:', shopifyResponse);
//       return res.status(500).json({
//         error: 'Failed to create user in Shopify',
//         details: shopifyResponse,
//       });
//     }

//     const shopifyId = shopifyResponse.customer.id;

//     const newUser = new authModel({
//       email,
//       modules,
//       role,
//       shopifyId,
//     });

//     await newUser.save();

//     res.status(201).json({
//       message: 'User created successfully in both Shopify and MongoDB',
//       data: newUser,
//     });
//   } catch (error) {
//     console.error('Error in CreateUserTagsModule function:', error);
//     return res.status(500).json({ error: error.message });
//   }
// };

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

// export const CreateUserTagsModule = async (req, res) => {
//   try {
//     const { email, modules, role, creatorId } = req.body;

//     const creator = await authModel.findById(creatorId);
//     if (!creator) return res.status(404).json({ error: 'Creator not found' });

//     let roleLimitReached = false;

//     if (creator.role === 'MasterAdmin' && role === 'Client') {
//       const clientCount = await authModel.countDocuments({ role: 'Client', createdBy: creatorId });
//       if (clientCount >= 2) roleLimitReached = true;
//     }

//     if (creator.role === 'MasterAdmin' && role === 'Staff') {
//       const staffCount = await authModel.countDocuments({ role: 'Staff', createdBy: creatorId });
//       if (staffCount >= 2) roleLimitReached = true;
//     }

//     if (creator.role === 'Client' && role === 'Staff') {
//       const staffCount = await authModel.countDocuments({ role: 'Staff', createdBy: creatorId });
//       if (staffCount >= 2) roleLimitReached = true;
//     }

//     if (roleLimitReached) {
//       return res.status(403).json({ error: 'Role creation limit reached' });
//     }

//     const existingUser = await authModel.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ error: 'User already exists with this email' });
//     }

//     const token = createToken(email);
//     const resetLink = `http://localhost:3006/New?token=${token}`;

//     await transporter.sendMail({
//       to: email,
//       subject: 'Password Reset',
//       html: `<p>Click <a href="${resetLink}">here</a> to create your password.</p>`,
//     });

//     const shopifyConfiguration = await shopifyConfigurationModel.findOne();
//     const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfiguration || {};

//     const shopifyPayload = {
//       customer: {
//         tags: role,
//         email,
//       },
//     };

//     const response = await fetch(`${shopifyStoreUrl}/admin/api/2024-01/customers.json`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'X-Shopify-Access-Token': shopifyAccessToken,
//       },
//       body: JSON.stringify(shopifyPayload),
//     });

//     const shopifyResponse = await response.json();
//     if (!response.ok) {
//       return res.status(500).json({ error: 'Shopify user creation failed', details: shopifyResponse });
//     }

//     let organizationId = null;
//     if (creator.role === 'DevAdmin') {
//       organizationId = null;
//     } else if (creator.role === 'MasterAdmin') {
//       organizationId = creator._id;
//     } else {
//       organizationId = creator.organizationId || creator._id;
//     }

//     const newUser = new authModel({
//       email,
//       modules,
//       role,
//       shopifyId: shopifyResponse.customer.id,
//       createdBy: creator._id,
//       organizationId,
//     });

//     await newUser.save();

//     res.status(201).json({
//       message: 'User created successfully in both Shopify and MongoDB',
//       data: newUser,
//     });

//   } catch (error) {
//     console.error('Error in CreateUserTagsModule function:', error);
//     return res.status(500).json({ error: error.message });
//   }
// };

export const CreateUserTagsModule = async (req, res) => {
  try {
    const { email, modules, role, creatorId } = req.body;

    const creator = await authModel.findById(creatorId);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    let roleLimitReached = false;

    if (creator.role === 'MasterAdmin') {
      if (role === 'Merchant') {
        const merchantCount = await authModel.countDocuments({
          role: 'Merchant',
          createdBy: creatorId,
        });
        if (merchantCount >= 10) roleLimitReached = true;
      }

      if (role === 'Support Staff') {
        const staffCount = await authModel.countDocuments({
          role: 'Support Staff',
          createdBy: creatorId,
        });
        if (staffCount >= 10) roleLimitReached = true;
      }

      if (role === 'Merchant Staff') {
        const staffCount = await authModel.countDocuments({
          role: 'Merchant Staff',
          createdBy: creatorId,
        });
        if (staffCount >= 10) roleLimitReached = true;
      }
    }

    if (creator.role === 'Merchant' && role === 'Merchant Staff') {
      const staffCount = await authModel.countDocuments({
        role: 'Merchant Staff',
        createdBy: creatorId,
      });
      if (staffCount >= 2) roleLimitReached = true;
    }

    if (roleLimitReached) {
      return res.status(403).json({ error: 'Role creation limit reached' });
    }

    const existingUser = await authModel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'User already exists with this email' });
    }

   

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    const { shopifyAccessToken, shopifyStoreUrl } = shopifyConfiguration || {};

    const tags = role === 'Merchant' ? `${role},approved` : role;

    const shopifyPayload = {
      customer: {
        tags,
        email,
      },
    };

    const response = await fetch(
      `${shopifyStoreUrl}/admin/api/2024-01/customers.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyAccessToken,
        },
        body: JSON.stringify(shopifyPayload),
      }
    );

    const shopifyResponse = await response.json();
    if (!response.ok) {
      return res.status(500).json({
        error: 'Shopify user creation failed',
        details: shopifyResponse,
      });
    }

    const shopifyTags = shopifyResponse.customer.tags || '';
    const extractedRole = shopifyTags.split(',')[0];

    // ✅ Use selected merchant as creator only if merchant staff is being created by admin
    const actualCreatorId =
      extractedRole === 'Merchant Staff' &&
      (creator.role === 'DevAdmin' || creator.role === 'MasterAdmin')
        ? req.body.creatorId // selected merchant ID from frontend
        : creator._id;

    // Determine organizationId
    let organizationId = null;
    if (creator.role === 'DevAdmin') {
      organizationId = null;
    } else if (creator.role === 'MasterAdmin') {
      organizationId = creator._id;
    } else {
      organizationId = creator.organizationId || creator._id;
    }

    const newUser = new authModel({
      email,
      modules,
      role: extractedRole,
      shopifyId: shopifyResponse.customer.id,
      createdBy: actualCreatorId,
      organizationId,
    });

    await newUser.save();

 const token = createToken(email,newUser._id);
    const resetLink = `https://multi-vendor-marketplaces.vercel.app/New?token=${token}`;

    await transporter.sendMail({
      to: email,
      subject: 'Password Reset',
      html: `<p>Click <a href="${resetLink}">here</a> to create your password.</p>`,
    });

    res.status(201).json({
      message: 'User created successfully in both Shopify and MongoDB',
      data: newUser,
    });
  } catch (error) {
    console.error('Error in CreateUserTagsModule function:', error);
    return res.status(500).json({ error: error.message });
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

    res.status(200).json({ message: 'Reset link sent to your email',token });
  } catch (error) {
    console.error('Error sending reset email:', error);
    res.status(500).json({ message: 'Error sending reset email', error });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decoded.payLoad;
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
    const userId = decoded?.payLoad;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ message: 'Invalid or missing user ID in token' });
    }

    const user = await authModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    if (user.shopifyId && updateShopifyPassword) {
      await updateShopifyPassword(user.shopifyId, newPassword);
    }

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token has expired. Please request a new password reset.',
      });
    }

    console.error(' Error resetting password:', error);
    res.status(500).json({
      message: 'Internal server error while resetting password',
      error: error.message,
    });
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
          shopifyId: 1,
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

    const userId = new mongoose.Types.ObjectId(id);

    const usersInOrg = await authModel.find({ createdBy: userId });

    if (!usersInOrg.length) {
      return res
        .status(404)
        .json({ message: 'No users found for this organization.' });
    }

    return res.status(200).json({
      message: 'Users retrieved successfully.',
      users: usersInOrg.map((user) => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        country: user.country,
        city: user.city,
        userName: user.userName,
        shopifyId: user.shopifyId,
      })),
    });
  } catch (error) {
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
    const { description, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    const brandAsset = await brandAssetModel.findOne({ userId });

    if (!brandAsset || !brandAsset.shopifyCollectionId) {
      return res
        .status(404)
        .json({ error: 'No collection found for this user.' });
    }

    const collectionId = brandAsset.shopifyCollectionId;

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration) {
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });
    }

    const ACCESS_TOKEN = shopifyConfiguration.shopifyAccessToken;
    const SHOPIFY_STORE_URL = shopifyConfiguration.shopifyStoreUrl;

    const images = req.files?.images
      ? Array.isArray(req.files.images)
        ? req.files.images
        : [req.files.images]
      : [];

    const firstImageUrl = images.length > 0 ? images[0].path : null;

    const updatePayload = {
      custom_collection: {
        id: collectionId,
        body_html: description,
      },
    };

    if (firstImageUrl) {
      updatePayload.custom_collection.image = {
        src: firstImageUrl,
      };
    }

    const updateCollection = await axios.put(
      `${SHOPIFY_STORE_URL}/admin/api/2023-10/custom_collections/${collectionId}.json`,
      updatePayload,
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    await brandAssetModel.findOneAndUpdate(
      { userId, shopifyCollectionId: collectionId },
      {
        description,
        ...(firstImageUrl && { images: firstImageUrl }),
        updatedAt: new Date(),
      },
      { new: true }
    );

    return res.status(200).json({
      message: 'Collection updated successfully',
      collection: updateCollection.data.custom_collection,
    });
  } catch (error) {
    if (error.response) {
      console.error('Shopify API Error:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('General Error:', error.message);
    }

    res.status(500).json({
      message: 'Failed to update collection details',
      error: error.message,
    });
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
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getAllMerchants = async (req, res) => {
  try {
    const result = await authModel.aggregate([
      {
        $match: {
          role: 'Merchant',
        },
      },
      {
        $project: {
          _id: 1,
          email: 1,
        },
      },
    ]);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({ error: 'Failed to fetch merchants' });
  }
};

// export const getAllOnboardUsersData = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const admin = await authModel.findById(id);

//     if (!admin) {
//       return res.status(404).json({ error: "Admin not found" });
//     }

//     let filter = {};

//     if (admin.role === "Dev Admin") {
//       filter = {};
//     } else if (admin.role === "Master Admin") {
//       filter = {
//         role: { $in: ["Support Staff", "Merchant", "Merchant Staff"] },
//       };
//     } else {
//       return res.status(403).json({ error: "Unauthorized role" });
//     }

//     const users = await authModel.find(filter);
//     res.status(200).json(users);
//   } catch (error) {
//     console.error("Error in getAllOnboardUsersData:", error);
//     res.status(500).json({ error: "Server error: " + error.message });
//   }
// };

export const getAllOnboardUsersData = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await authModel.findById(id);

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    // Fetch merchants
    const merchants = await authModel.find({ role: 'Merchant' });

    // Build merchantGroups (each merchant + their merchant staff)
    const merchantGroups = await Promise.all(
      merchants.map(async (merchant) => {
        const staff = await authModel.find({
          role: 'Merchant Staff',
          createdBy: merchant._id,
        });

        const formattedMerchant = {
          ...merchant.toObject(),
          id: merchant._id.toString(),
          _id: undefined,
        };

        const formattedStaff = staff.map((s) => ({
          ...s.toObject(),
          id: s._id.toString(),
          _id: undefined,
          createdBy: s.createdBy?.toString() || null,
        }));

        return {
          merchant: formattedMerchant,
          staff: formattedStaff,
        };
      })
    );

    // Fetch support staff (flat)
    const supportStaffRaw = await authModel.find({ role: 'Support Staff' });
    const supportStaff = supportStaffRaw.map((s) => ({
      ...s.toObject(),
      id: s._id.toString(),
      _id: undefined,
      createdBy: s.createdBy?.toString() || null,
    }));

    // ✅ DEV ADMIN
    if (admin.role === 'Dev Admin') {
      const allUsers = await authModel.find();

      const formattedUsers = allUsers.map((user) => ({
        ...user.toObject(),
        id: user._id.toString(),
        _id: undefined,
        createdBy: user.createdBy?.toString() || null,
      }));

      return res.status(200).json({
        type: 'dev',
        users: formattedUsers,
        supportStaff,
        merchantGroups,
      });
    }

    // ✅ MASTER ADMIN
    if (admin.role === 'Master Admin') {
      return res.status(200).json({
        type: 'master',
        supportStaff,
        merchantGroups,
      });
    }

    // ❌ Unauthorized
    return res.status(403).json({ error: 'Unauthorized role' });
  } catch (error) {
    console.error('Error in getAllOnboardUsersData:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

export const addOrderRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { request, orderId, orderNo, lineItemIds } = req.body;

    const user = await authModel.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const order = await orderModel.findOne({ orderId: String(orderId) });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const allLineItems = order.lineItems || [];
    const requestedItems = allLineItems.filter((item) =>
      lineItemIds.includes(item.id)
    );
    const productNames = requestedItems.map((item) => item.name);

    const savedRequest = await orderRquestModel.create({
      userId: id,
      orderId,
      orderNo,
      request,
      productNames,
    });

    const email = 'aydimarketplace@gmail.com';
    await transporter.sendMail({
      to: email,
      subject: 'Request for Order Cancellation',
      html: `
        <div style="font-family: sans-serif;">
          <p><strong>Request from:</strong> ${user.firstName} ${user.lastName}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Order No:</strong> ${orderNo}</p>
          <p><strong>Message:</strong> ${request}</p>
          <p><strong>Products:</strong></p>
          <ul>
            ${productNames.map((name) => `<li>${name}</li>`).join('')}
          </ul>
        </div>
      `,
    });

    return res.status(200).json({
      message: 'Request submitted successfully.',
      data: savedRequest,
    });
  } catch (error) {
    console.error('Error in addOrderRequest:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

export const getCollectionId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await authModel.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      message: 'Collection fetched successfully',
      sellerName: user.sellerName || `${user.firstName} ${user.lastName}`,
      shopifyCollectionId: user.shopifyCollectionId,
    });
  } catch (error) {
    console.error('Error in getCollectionId:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const getBrandAssets = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const asset = await brandAssetModel.findOne({ userId: id });

    if (!asset) {
      return res
        .status(404)
        .json({ error: 'No brand asset found for this user' });
    }

    return res.status(200).json({
      message: 'Brand asset fetched successfully',
      data: asset,
    });
  } catch (error) {
    console.error('Error in getBrandAssets:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
};

export const signUpForBulkUploader = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Full name, email, and password are required.' });
    }

    const existingUser = await authBulkUploaderModel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: 'User already exists with this email.' });
    }

    const newUser = new authBulkUploaderModel({
      fullName,
      email,
      password,
    });

    const savedUser = await newUser.save();

    const token = createToken({ _id: savedUser._id });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      data: savedUser,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup.' });
  }
};

export const signInForBulkUploader = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required.' });
    }

    const user = await authBulkUploaderModel.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ error: 'Invalid credentials. User not found.' });
    }

    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = createToken({ _id: user._id });

    res.status(200).json({
      message: 'Login successful',
      token,
      data: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        userName: user.userName,
      },
    });
  } catch (error) {
    console.error('SignIn error:', error);
    res.status(500).json({ error: 'Server error during sign in.' });
  }
};
