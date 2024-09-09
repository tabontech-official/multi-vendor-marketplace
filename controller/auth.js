import { authModel } from '../Models/auth.js';
import fetch from 'node-fetch'
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { request } from 'https';
import { Buffer } from 'buffer';
import { registerSchema,loginSchema } from '../validation/auth.js';

const createToken = (payLoad) => {
  const token = jwt.sign({ payLoad }, process.env.SECRET_KEY, {
    expiresIn: "125d",
  });
  return token;
};


export const signUp = async (req, res) => {
  try {
    
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

   
    const userExist = await authModel.findOne({ email: req.body.email });
    if (userExist) {
      return res.status(400).json({ error: "User already exists with this email" });
    }

    // Prepare Shopify request payload
    const shopifyPayload = {
      customer: {
        first_name: req.body.firstName,
        last_name: req.body.lastName,
        email: req.body.email,
        password: req.body.password,
        password_confirmation: req.body.password,
        tags: 'Trade User', // Ensure this is a string or adjust as needed
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
        "Content-Type": "application/json",
        "Authorization": `Basic ${base64Credentials}`,
      },
      body: JSON.stringify(shopifyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error saving user to Shopify:", errorData);
      return res.status(500).json({ error: "Failed to register user with Shopify" });
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
      tags: 'Trade User',
    });
    const savedUser = await newUser.save();

    // Create token
    const token = createToken({ _id: savedUser._id });

    // Send response
    res.status(201).send({
      message: "Successfully registered",
      token,
      data: savedUser,
    });
  } catch (error) {
    console.error("Error in signUp function:", error);
    return res.status(500).json({ error: error.message });
  }
};


export const signIn = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const { email, password } = req.body;

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers.json?query=email:${email}`;

    const response = await fetch(shopifyUrl, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${base64Credentials}`,
      },
    });

    const data = await response.json();

    if (response.status !== 200 || !data.customers.length) {
      return res.status(404).json({ error: "User does not exist in Shopify" });
    }

    const shopifyCustomer = data.customers[0];

    // Debugging: Log Shopify Customer ID
    console.log('Shopify Customer ID:', shopifyCustomer.id);

    const user = await authModel.findOne({ shopifyId: shopifyCustomer.id });

    if (!user) {
      return res.status(404).json({ error: "User does not exist in our system" });
    }

    // Debugging: Log user details
    console.log('User from DB:', user);

    const isMatch = await user.comparePassword(password);

    // Debugging: Log comparison result
    console.log('Password match result:', isMatch);

    if (!isMatch) {
      return res.status(400).json({ error: "Password does not match" });
    }

    const token = createToken({ _id: user._id });

    res.json({
      message: "Successfully logged in",
      token,
      data: user,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
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

  const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');
  const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers/${shopifyId}.json`;

  try {
    const response = await fetch(shopifyUrl, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${base64Credentials}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error fetching user from Shopify:", errorData);
      throw new Error("Failed to fetch user from Shopify");
    }

    const userData = await response.json();
    const userTags = userData.customer.tags.split(', '); // Tags are typically a comma-separated string

    return userTags.includes(tag);
  } catch (error) {
    console.error("Error in tagExistsInShopify function:", error);
    throw error;
  }
};



// Controller function to update user data
export const updateUser = async (req, res) => {
  try {
    const { shopifyId } = req.params;
    const { firstName, lastName, email, password,phoneNumber,zip,address } = req.body;

    if (!shopifyId) {
      return res.status(400).json({ error: "Shopify ID is required" });
    }

    // Check if the specified tag exists for the user in Shopify
    const defaultTag = 'Trade User'; // Default tag to check
    const tagExists = await tagExistsInShopify(shopifyId, defaultTag);

    if (!tagExists) {
      return res.status(404).json({ error: "User with the specified tag not found in Shopify" });
    }

    // Prepare Shopify update payload
    const shopifyPayload = {
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password,
        password_confirmation: password,
        phoneNumber:phoneNumber,
        zip:zip,
        address:address,
        tags: defaultTag, // Tags are managed as default, not included in the body
      },
    };

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers/${shopifyId}.json`;

    // Update user in Shopify
    const response = await fetch(shopifyUrl, {
      method: 'PUT',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${base64Credentials}`,
      },
      body: JSON.stringify(shopifyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error updating user in Shopify:", errorData);
      return res.status(500).json({ error: "Failed to update user with Shopify" });
    }

    // Hash password if provided and update in MongoDB
    const hashedPassword = await hashPassword(password);

    const mongoUpdateData = {
      firstName,
      lastName,
      email,
      zip,
      address,
      phoneNumber   
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
      return res.status(404).json({ error: "User not found in MongoDB" });
    }

    // Send response
    res.status(200).json({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error in updateUser function:", error);
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
      return res.status(400).json({ error: "User already exists with this email" });
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

    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers.json`;

    // Save user to Shopify
    const response = await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${base64Credentials}`,
      },
      body: JSON.stringify(shopifyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error saving user to Shopify:", errorData);
      return res.status(500).json({ error: "Failed to register user with Shopify" });
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
      message: "Successfully registered",
      token,
      data: savedUser,
    });
  } catch (error) {
    console.error("Error in signUp function:", error);
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
    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');
    
    // Prepare Shopify update URL
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers/${user.shopifyId}.json`;

    // Update user in Shopify
    const response = await fetch(shopifyUrl, {
      method: 'PUT',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${base64Credentials}`,
      },
      body: JSON.stringify(shopifyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error updating user in Shopify:", errorData);
      return res.status(500).json({ error: "Failed to update user with Shopify" });
    }

    // Update user in MongoDB
    const updateData = {
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email,
      password: password || user.password,
      tags: `Trade User${additionalTags ? `, ${additionalTags}` : ''}`, // Update tags
    };

    const updatedUser = await authModel.findOneAndUpdate({ email }, updateData, { new: true });

    // Send response
    res.status(200).json({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error in updateUser function:", error);
    return res.status(500).json({ error: error.message });
  }
};

// export const logout=async(req,res)=>{
//   try {
//     const userId=await authModel.find({_id:req.params.id})
//     res.clearCookie('token');
//     res.status(200).send({message:'logout successfully',userId})
//   } catch (error) {
    
//   }
// }



// Your Shopify store credentials


export const logout = async (req, res) => {
  try {
    // Validate request parameters
    const { id } = req.params; // This should be the Shopify customer ID
    if (!id) {
      return res.status(400).json({ error: 'Shopify Customer ID is required' });
    }

    // Find the user by Shopify customer ID
    const user = await authModel.findOne({ shopifyId: id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clear session or token in MongoDB
    // Assuming 'shopifyAccessToken' is the field storing the token
    await authModel.findOneAndUpdate({ shopifyId: id }, { shopifyAccessToken: null });

    // Basic Auth credentials for Shopify
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
    const base64Credentials = Buffer.from(`${apiKey}:${apiPassword}`).toString('base64');

    // Prepare Shopify request URL (replace with the correct endpoint if needed)
    const shopifyUrl = `https://${shopifyStoreUrl}/admin/api/2024-01/customers/${id}.json`;

    // Revoke or delete user in Shopify (this example assumes a delete request)
    const response = await fetch(shopifyUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${base64Credentials}`,
        'Accept': 'application/json',
      },
    });

    // Handle Shopify response
    if (!response.ok) {
      let errorMessage = 'Failed to revoke token from Shopify';
      let responseBody = '';

      try {
        responseBody = await response.text(); // Read response as text
        if (responseBody) {
          const errorData = JSON.parse(responseBody);
          console.error('Error revoking token in Shopify:', errorData);
          errorMessage = errorData.message || errorMessage;
        } else {
          console.error('Shopify response is empty');
        }
      } catch (parseError) {
        console.error('Error parsing Shopify error response:', parseError);
      }

      return res.status(response.status).json({ error: errorMessage });
    }

    // Send success response
    res.status(200).json({
      message: 'Logged out successfully from both MongoDB and Shopify',
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: error.message });
  }
};