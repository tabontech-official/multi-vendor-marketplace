import cron from 'node-cron';
import csvImportBatchSchema from '../Models/csvImportBatchSchema.js';
import { processInventoryBatch } from './inventoryProcessor.js';

export const startCsvImportWorkerForInventory = () => {
  console.log('\n=================================================');
  console.log('🚀 INVENTORY CSV WORKER STARTED');
  console.log('⏱ Running Every 3 Seconds');
  console.log('=================================================\n');

  cron.schedule('*/3 * * * * *', async () => {
    console.log('\n🔄 Worker Tick:', new Date().toISOString());

    try {
      console.log('🔎 Searching for pending batch...');

      const batch = await csvImportBatchSchema.findOneAndUpdate(
        {
          status: 'pending',
          batchNo: { $regex: /^INV-/ },
        },
        { status: 'processing', lockedAt: new Date() },
        { new: true }
      );
      if (!batch) {
        console.log('⚪ No pending batch found');
        return;
      }

      console.log('📦 Batch Found:', batch.batchNo);
      console.log('🔐 Batch Locked & Marked as Processing');

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
