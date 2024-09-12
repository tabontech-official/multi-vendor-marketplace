import express from 'express';
import {
  signIn,
  signUp,
  logout,
  newSignUp,
  updateUserInShopify,
  webHook,
} from '../controller/auth.js';

const authRouter = express.Router();
authRouter.post('/signIn', signIn);
authRouter.post('/signUp', signUp);
// authRouter.put('/update/:shopifyId',updateUser)
authRouter.post('/logout/:userId', logout);
authRouter.post('/newSignUp', newSignUp);
authRouter.put('/updateInShopify', updateUserInShopify);
authRouter.post('/webHook', webHook);

export default authRouter;
