import express from 'express';
import {
  signIn,
  signUp,
  logout,
  newSignUp,
  updateUserInShopify,
  webHook,
  editProfile,
  fetchUserData
} from '../controller/auth.js';
import { upload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';

const authRouter = express.Router();

authRouter.post('/signIn', signIn);
authRouter.post('/signUp', signUp);
// authRouter.put('/update/:shopifyId',updateUser)
authRouter.post('/logout/:userId', logout);
authRouter.post('/newSignUp', newSignUp);
authRouter.put('/updateInShopify', updateUserInShopify);
authRouter.post('/webHook',verifyShopifyWebhook, webHook);
authRouter.put('/editProfile/:userId', upload.single('avatar'), editProfile);
authRouter.get('/user/:id',fetchUserData)
export default authRouter;
