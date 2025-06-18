import cron from 'node-cron';
import dayjs from 'dayjs';
import { PayoutConfig } from '../Models/finance.js';
export const financeScheduler = cron.schedule('0 2 * * *', async () => {
  console.log(" Running daily payout generator...");

  try {
    const config = await PayoutConfig.findOne();
    if (!config) {
      console.warn(' No payout config found.');
      return;
    }

    const today = dayjs();
    const currentMonth = today.month(); 
    const currentYear = today.year();

    const updatedFields = {};

    const generateDate = (dayNumber) => {
      const targetDay = Math.min(dayNumber, 28);
      const date = today.clone().set('date', targetDay).set('month', currentMonth).set('year', currentYear);
      return date.isValid() ? date.toDate() : null;
    };

    if (config.payoutFrequency === 'once' && typeof config.firstPayoutDate === 'number') {
      updatedFields.firstPayoutDate = generateDate(config.firstPayoutDate);
    }

    if (config.payoutFrequency === 'twice') {
      if (typeof config.firstPayoutDate === 'number') {
        updatedFields.firstPayoutDate = generateDate(config.firstPayoutDate);
      }
      if (typeof config.secondPayoutDate === 'number') {
        updatedFields.secondPayoutDate = generateDate(config.secondPayoutDate);
      }
    }

    if (Object.keys(updatedFields).length > 0) {
      await PayoutConfig.updateOne({ _id: config._id }, { $set: updatedFields });
      console.log('Updated payout config with resolved dates:', updatedFields);
    }
  } catch (err) {
    console.error("❌ Payout cron failed:", err.message);
  }
});

 