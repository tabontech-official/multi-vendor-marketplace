import express from 'express';
import {
  signIn,
  signUp,
  logout,
  newSignUp,
  AdminSignIn,
  updateUserInShopify,
  webHook,
  editProfile,
  fetchUserData,
  getUserData,
} from '../controller/auth.js';
import { upload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';

const authRouter = express.Router();

authRouter.post('/signIn', signIn);
authRouter.post('/signUp', signUp);
// authRouter.put('/update/:shopifyId',updateUser)
authRouter.post('/logout/:userId', logout);
authRouter.post('/newSignUp', newSignUp);
authRouter.post('/webHook', verifyShopifyWebhook, webHook);
authRouter.get('/user/:id', fetchUserData);
authRouter.get('/', getUserData);
authRouter.put('/editProfile/:userId', upload.single('avatar'), editProfile);
authRouter.put('/updateInShopify', updateUserInShopify);
authRouter.post('/Admin', AdminSignIn);

export default authRouter;
