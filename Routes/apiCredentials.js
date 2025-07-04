import { addMultipleStores, generateAcessKeys, getApiCredentialByUserId, getStores } from "../controller/apicredential.js";
import express from 'express'

const apiCredentialsRouter=express.Router()
apiCredentialsRouter.post('/generate-keys',generateAcessKeys)
apiCredentialsRouter.get('/getApiCredentialByUserId/:userId',getApiCredentialByUserId)
apiCredentialsRouter.post('/',addMultipleStores)
apiCredentialsRouter.get('/getStores',getStores)

export default apiCredentialsRouter;