import mongoose from 'mongoose';

const shopifyConfigurationSchema = new mongoose.Schema({
  shopifyAccessToken: { type: String, required: true },
  shopifyApiKey: { type: String, required: true },
}, { timestamps: true }); 

export const shopifyConfigurationModel = mongoose.model('shopifyConfiguration', shopifyConfigurationSchema);

