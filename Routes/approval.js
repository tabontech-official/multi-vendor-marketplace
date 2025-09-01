import express from 'express'
import { verifyToken } from '../middleware/verifyToken.js'
import { addApprovalSetting, getApprovalSetting } from '../controller/approval.js'

const approvalRouter=express.Router()
approvalRouter.post('/add-approval',verifyToken,addApprovalSetting)
approvalRouter.get("/getApproval",verifyToken,getApprovalSetting)
export default approvalRouter