import express from "express";
import { getNotificationSettings, saveNotificationSettings } from "../controller/notificationSetting.js";


const notificationSettingsRouter = express.Router();

notificationSettingsRouter.get("/", getNotificationSettings);
notificationSettingsRouter.post("/", saveNotificationSettings);

export default notificationSettingsRouter;