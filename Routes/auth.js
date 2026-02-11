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
  getAllUsersData,
  fetchUserData,
  getUserByRole,
  saveShopifyCredentials,
  createShopifyCollection,
  getSingleUser,
  getAllMerchants,
  getAllOnboardUsersData,
  addOrderRequest,
  getCollectionId,
  getBrandAssets,
  signInForBulkUploader,
  signUpForBulkUploader,
  addMerchantAccDetails,
  getMerchantAccDetails,
  updateMerchantCommission,
  bulkUpdateMerchantCommission,
} from '../controller/auth.js';
import { cpUpload } from '../middleware/cloudinary.js';
import { verifyShopifyWebhook } from '../middleware/verifyShopifyWebhook.js';
import { cpUploads } from '../middleware/upload.js';
import { Csvuplaods } from '../middleware/multer.js';

const authRouter = express.Router();


authRouter.put("/updateMerchantCommission", updateMerchantCommission);
authRouter.post(
  "/bulk-update-commission",
  Csvuplaods,
  bulkUpdateMerchantCommission
);
authRouter.post('/signIn', signIn);
authRouter.post('/signInForBulkUploader', signInForBulkUploader);
authRouter.post('/signUpForBulkUploader', signUpForBulkUploader);
authRouter.post('/signUp', signUp);
authRouter.post('/forgot', forgotPassword);
authRouter.post('/logout/:userId', logout);
authRouter.post('/webHook', verifyShopifyWebhook, webHook);
authRouter.put('/editProfile/:userId', cpUpload, editProfile);
authRouter.put('/shopifyConfigurations', saveShopifyCredentials);
authRouter.post('/webHook/delete', deleteUser);
authRouter.post('/resetpassword', resetPassword);
authRouter.post('/createpassword', createPassword);
authRouter.post('/createUserTagsModule', CreateUserTagsModule);
authRouter.get('/getUserWithModules/:id', getUserWithModules);
authRouter.get('/getAllUsers', getAllUsersData);
authRouter.get('/user/:id', fetchUserData);
authRouter.get('/getUserByRole/:id', getUserByRole);
authRouter.post('/addBrandAsset', cpUploads, createShopifyCollection);
authRouter.get('/getSingleUser/:id', getSingleUser);
authRouter.get('/getAllMerchant', getAllMerchants);
authRouter.get('/getAllOnboardUsers/:id', getAllOnboardUsersData);
authRouter.post('/addRequestForOrderCancellation/:id', addOrderRequest);
authRouter.get('/getCollcetion/:id', getCollectionId);
authRouter.get('/getBrandAssets/:id', getBrandAssets);
authRouter.post('/addMerchantAccountDetails', addMerchantAccDetails);
authRouter.get('/getMerchantAccountDetails/:userId', getMerchantAccDetails);

export default authRouter;
