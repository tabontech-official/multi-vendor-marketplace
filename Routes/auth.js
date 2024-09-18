import express from 'express';
import {
  signIn,
  signUp,
  logout,
  newSignUp,
  updateUserInShopify,
  webHook,
  editProfile,
  fetchUserData,
  subscription,
  subscriptionForOneMonth,
  subscriptionForTwoMonth,
} from '../controller/auth.js';
import { upload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';

const authRouter = express.Router();

authRouter.post('/signIn', signIn);
authRouter.post('/signUp', signUp);
// authRouter.put('/update/:shopifyId',updateUser)
authRouter.post('/logout/:userId', logout);
authRouter.post('/newSignUp', newSignUp);
authRouter.post('/subscription',subscription)
authRouter.post('/webHook',verifyShopifyWebhook, webHook);
authRouter.post('/oneMonth',subscriptionForOneMonth)
authRouter.post('/twoMonths',subscriptionForTwoMonth)
authRouter.get('/user/:id',fetchUserData)
authRouter.put('/editProfile/:userId', upload.single('avatar'), editProfile);
authRouter.put('/updateInShopify', updateUserInShopify);


export default authRouter;
