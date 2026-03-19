// cron/topProductCron.js
import cron from "node-cron";
import { saveDailyTopProductsJob } from "./product.js";


export const startTopProductCron = () => {
  // runs every day at 12:00 AM
  cron.schedule("* * * * *", async () => {
    console.log("Running Top Product Cron...");
    await saveDailyTopProductsJob();
  });
};