import { apiCredentialModel } from "../Models/apicredential.js";
import crypto from 'crypto';
import mongoose from "mongoose";
import { ShopifyModel } from "../Models/StoreCredits.js";

const generateApiKey = () => `shpka_${crypto.randomBytes(16).toString('hex')}`;
const generateApiSecretKey = () => `shpsk_${crypto.randomBytes(16).toString('hex')}`;

export const generateAcessKeys = async (req, res) => {
  try {
    const userId = req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const apiKey = generateApiKey();
    const apiSecretKey = generateApiSecretKey();

    const existing = await apiCredentialModel.findOne({ userId });

    if (existing) {
      existing.apiKey = apiKey;
      existing.apiSecretKey = apiSecretKey;
      await existing.save();
    } else {
      await apiCredentialModel.create({ userId, apiKey, apiSecretKey });
    }

    res.json({ apiKey, apiSecretKey });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate credentials' });
  }
};


export const getApiCredentialByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const result = await apiCredentialModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $project: {
          _id: 0,
          apiKey: 1,
          apiSecretKey: 1
        }
      }
    ]);

    if (!result.length) {
      return res.status(404).json({ message: 'No API credentials found for this user' });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching API credentials:', error);
    res.status(500).json({ error: 'Server error' });
  }
};



export const addMultipleStores=async(req,res)=>{
    try {
    const { name, storeUrl, accessToken, apiKey } = req.body;

    if (!name || !storeUrl || !accessToken || !apiKey) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newStore = new ShopifyModel({ name, storeUrl, accessToken, apiKey });
    const savedStore = await newStore.save();
    res.status(201).json(savedStore);
  } catch (error) {
    console.error('Error saving store:', error);
    res.status(500).json({ message: 'Server error' });
  }
}


export const getStores = async (req, res) => {
  try {
    const result = await ShopifyModel.find();

    if (result && result.length > 0) {
      res.status(200).json(result);
    } else {
      res.status(200).json([]); 
    }
  } catch (error) {
    console.error("Error fetching stores:", error);
    res.status(500).json({ message: "Failed to fetch stores" });
  }
};
