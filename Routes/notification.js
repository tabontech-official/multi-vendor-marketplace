import express from 'express'
import { addNotification, getNotificationByUserId } from '../controller/notification.js';
const notificationRouter=express.Router()
notificationRouter.post('/addNotofication',addNotification)
notificationRouter.get("/getNotificationByUserId/:userId",getNotificationByUserId)

export default notificationRouter;