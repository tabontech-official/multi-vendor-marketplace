import express from 'express'
import { signIn,signUp,updateUser,logout,newSignUp,updateUserInShopify} from '../controller/auth.js'



const authRouter =express.Router()
authRouter.post('/signIn',signIn)
authRouter.post('/signUp',signUp)
authRouter.put('/update/:shopifyId',updateUser)
authRouter.post('/logout/:userId',logout)
authRouter.post('/newSignUp',newSignUp)
authRouter.put('/updateInShopify',updateUserInShopify)

export default authRouter;