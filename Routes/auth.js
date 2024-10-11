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
  getUserSubscriptionQuantity,
  forgotPassword,
  deleteUser,
  updateCustomer,
  resetPassword,
  updateSubscriptionQuantity,
} from '../controller/auth.js';
import { upload ,cpUpload} from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';
const authRouter = express.Router();

authRouter.post('/signIn', signIn);
authRouter.post('/signUp', signUp);
authRouter.post('/forgot',forgotPassword)
// authRouter.put('/update/:shopifyId',updateUser)
authRouter.post('/logout/:userId', logout);
authRouter.post('/newSignUp', newSignUp);
authRouter.post('/webHook', verifyShopifyWebhook, webHook);
authRouter.get('/user/:id', fetchUserData);
authRouter.get('/', getUserData);
authRouter.get('/quantity/:id',getUserSubscriptionQuantity)
authRouter.post('/webhook/update',updateCustomer)
authRouter.put('/editProfile/:userId', cpUpload, editProfile);
authRouter.put('/updateInShopify', updateUserInShopify);
authRouter.put('/updatequantity',updateSubscriptionQuantity)
authRouter.post('/Admin', AdminSignIn);
authRouter.post('/webHook/delete',deleteUser)
authRouter.post('/resetpassword',resetPassword)
export default authRouter;
