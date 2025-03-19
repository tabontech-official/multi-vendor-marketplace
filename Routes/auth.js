import express from 'express';
import {
  signIn,
  signUp,
  logout,
  webHook,
  editProfile,
  forgotPassword,
  deleteUser,
  resetPassword,
  getUserWithModules,
  CreateUserTagsModule,
  createPassword,
} from '../controller/auth.js';
import { cpUpload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';

const authRouter = express.Router();

authRouter.post('/signIn', signIn);
authRouter.post('/signUp', signUp);
authRouter.post('/forgot', forgotPassword);
authRouter.post('/logout/:userId', logout);
authRouter.post('/webHook', verifyShopifyWebhook, webHook);
authRouter.put('/editProfile/:userId', cpUpload, editProfile);
authRouter.post('/webHook/delete', deleteUser);
authRouter.post('/resetpassword', resetPassword);
authRouter.post('/createpassword', createPassword);
authRouter.post('/createUserTagsModule', CreateUserTagsModule);
authRouter.get('/getUserWithModules/:id', getUserWithModules);

export default authRouter;
