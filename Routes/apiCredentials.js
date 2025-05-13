import { generateAcessKeys, getApiCredentialByUserId } from "../controller/apicredential.js";
import express from 'express'

const apiCredentialsRouter=express.Router()
apiCredentialsRouter.post('/generate-keys',generateAcessKeys)
apiCredentialsRouter.get('/getApiCredentialByUserId/:userId',getApiCredentialByUserId)

export default apiCredentialsRouter;