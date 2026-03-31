import { sendBatchCompletionNotification } from '../controller/csvImportWorker.js';
import csvImportBatchSchema from '../Models/csvImportBatchSchema.js';
import { notificationModel } from '../Models/Notifications.js';

const runBatchCompletionMonitor = async () => {
  console.log('\n🔍 Checking batch completion...');

  try {
    const batches = await csvImportBatchSchema.find({
      status: { $in: ['processing', 'queued'] },
    });

    if (!batches.length) {
      console.log('ℹ️ No active batches');
      return;
    }

    for (const batch of batches) {
      const total = batch.summary?.total || 0;
      const success = batch.summary?.success || 0;
      const failed = batch.summary?.failed || 0;

      const processed = success + failed;

      console.log(`📊 Batch ${batch.batchNo}: ${processed}/${total}`);

      // ✅ ONLY when fully done
      if (processed !== total) continue;

      // ✅ prevent duplicate execution
      if (batch.status === 'completed') continue;

      // =========================
      // ✅ UPDATE STATUS
      // =========================
      batch.status = 'completed';
      batch.completedAt = new Date();

      await batch.save();

      console.log(`🎉 Batch COMPLETED: ${batch.batchNo}`);

      // =========================
      // 🔔 SAVE NOTIFICATION
      // =========================
      try {
        await notificationModel.create({
          userId: batch.userId,
          message: `Batch ${batch.batchNo} completed. Success: ${success}, Failed: ${failed}`,
          source: 'csv-import',
          seen: false,
        });

        console.log('🔔 Notification saved');
      } catch (notifErr) {
        console.log('❌ Notification error:', notifErr.message);
      }

      // =========================
      // 📧 EMAIL (optional)
      // =========================
      try {
        await sendBatchCompletionNotification(batch, batch.userId);
      } catch (err) {
        console.log('❌ Email error:', err.message);
      }
    }

    console.log('✅ Batch monitor cycle complete\n');
  } catch (err) {
    console.log('❌ Batch monitor error:', err.message);
  }
};

export const startBatchCompletionMonitor = () => {
  console.log('🚀 Starting Batch Completion Monitor...');

  setInterval(async () => {
    await runBatchCompletionMonitor();
  }, 2000); 
};