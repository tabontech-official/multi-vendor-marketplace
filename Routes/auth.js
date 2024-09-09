import express from 'express'
import { signIn,signUp,updateUser,logout,newSignUp,updateUserInShopify} from '../controller/auth.js'

import multer  from 'multer';
const upload = multer({ dest: 'uploads/' });

const authRouter =express.Router()
authRouter.post('/signIn',signIn)
authRouter.post('/signUp',signUp)
authRouter.put('/update/:shopifyId',updateUser)
authRouter.post('/logout',logout)
authRouter.post('/newSignUp',newSignUp)
authRouter.put('/updateInShopify',updateUserInShopify)
// authRouter.put('/metafield/:shopifyId',upload.single('profileImage'),updateMetaFeild)
export default authRouter;