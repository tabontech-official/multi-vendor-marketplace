import cron from 'node-cron';
import csvImportBatchSchema from '../Models/csvImportBatchSchema.js';
import { processInventoryBatch } from './inventoryProcessor.js';

export const startCsvImportWorkerForInventory = () => {


  cron.schedule('*/3 * * * * *', async () => {

    try {

      const batch = await csvImportBatchSchema.findOneAndUpdate(
        {
          status: 'pending',
          batchNo: { $regex: /^INV-/ },
        },
        { status: 'processing', lockedAt: new Date() },
        { new: true }
      );
      if (!batch) {
        return;
      }



      if (!batch.batchLogs) batch.batchLogs = [];

      batch.batchLogs.push({
        message: 'Batch picked by inventory worker',
        createdAt: new Date(),
      });

      await batch.save();

      if (batch.batchNo.startsWith('INV-')) {
        console.log('🟢 Inventory Batch Detected');
        console.log('➡ Sending to processInventoryBatch()\n');

        await processInventoryBatch(batch);

        console.log('✅ Inventory Processing Finished for:', batch.batchNo);
        return;
      }

      console.log('⚠️ Batch type not supported by this worker:', batch.batchNo);
    } catch (err) {
      console.log('\n🔥 WORKER LEVEL ERROR');
      console.log('Error Message:', err.message);
      console.log('Stack:', err.stack);
    }

    console.log('🔁 Worker Cycle Completed');
  });
};
