import { generateAcessKeys } from "../controller/apicredential.js";
import express from 'express'

const apiCredentialsRouter=express.Router()
apiCredentialsRouter.post('/generate-keys',generateAcessKeys)


export default apiCredentialsRouter;