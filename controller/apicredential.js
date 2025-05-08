import { apiCredentialModel } from "../Models/apicredential.js";
import crypto from 'crypto';

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
