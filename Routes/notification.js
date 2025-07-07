import express from 'express'
import { addNotification, getNotificationByUserId, updateSeen } from '../controller/notification.js';
const notificationRouter=express.Router()
notificationRouter.post('/addNotofication',addNotification)
notificationRouter.get("/getNotificationByUserId/:userId",getNotificationByUserId)
notificationRouter.put('/markAllSeen/:userId',updateSeen)
export default notificationRouter;