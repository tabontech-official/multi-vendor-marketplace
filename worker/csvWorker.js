// // import 'dotenv/config';

// // import mongoose from 'mongoose';
// // import { Worker } from 'bullmq';

// // import { shopifyConfigurationModel } from '../Models/buyCredit.js';
// // import csvImportBatchSchema from '../Models/csvImportBatchSchema.js';
// // import {connection} from '../queue/csvQueue.js';
// // import {
// //   processSingleProduct,
// //   preloadCategoryCache,
// //   sendBatchCompletionNotification,
// // } from '../controller/csvImportWorker.js';

// // // =======================
// // // 🔌 MONGO CONNECT
// // // =======================
// // await mongoose.connect(process.env.DB_URL);
// // console.log('✅ Worker Mongo connected');

// // // =======================
// // // 📂 PRELOAD CACHE
// // // =======================
// // await preloadCategoryCache();

// // // =======================
// // // 📊 FINALIZE BATCH
// // // =======================
// // async function finalizeBatchIfDone(batchId) {
// //   const batch = await csvImportBatchSchema.findById(batchId);

// //   if (!batch) {
// //     console.log('❌ Batch not found for finalize');
// //     return;
// //   }

// //   const total = batch.summary?.total || 0;
// //   const processed = batch.processedCount || 0;

// //   console.log(`📊 Batch progress: ${processed}/${total}`);

// //   if (processed < total) return;
// //   if (batch.status === 'completed') return;

// //   batch.status = 'completed';
// //   batch.completedAt = new Date();

// //   await batch.save();

// //   console.log(`🎉 Batch COMPLETED: ${batch.batchNo}`);

// //   await sendBatchCompletionNotification(batch, batch.userId);
// // }

// // // =======================
// // // 🚀 WORKER
// // // =======================
// // const worker = new Worker(
// //   'csv-import',
// //   async (job) => {
// //     const { handle, productRows, userId, batchId } = job.data;

// //     console.log('\n================ JOB START ================');
// //     console.log(`🆔 Job ID: ${job.id}`);
// //     console.log(`📦 Batch ID: ${batchId}`);
// //     console.log(`🔗 Handle: ${handle}`);

// //     try {
// //       await job.updateProgress(5);

// //       const config = await shopifyConfigurationModel.findOne();

// //       if (!config) {
// //         throw new Error('Shopify config missing');
// //       }

// //       await job.updateProgress(10);

// //       const batch = await csvImportBatchSchema.findById(batchId);

// //       if (!batch) {
// //         throw new Error('Batch not found');
// //       }

// //       if (batch.status !== 'processing' && batch.status !== 'completed') {
// //         batch.status = 'processing';
// //         await batch.save();
// //       }

// //       await processSingleProduct({
// //         handle,
// //         productRows,
// //         userId,
// //         batchId,
// //         shopifyStoreUrl: config.shopifyStoreUrl,
// //         shopifyApiKey: config.shopifyApiKey,
// //         shopifyAccessToken: config.shopifyAccessToken,
// //       });

// //       await job.updateProgress(100);

// //       await finalizeBatchIfDone(batchId);

// //       console.log(`✅ Done: ${handle}`);
// //       console.log('================ JOB END ================\n');

// //       return { success: true };
// //     } catch (err) {
// //       console.log(`❌ Error in ${handle}:`, err.message);

// //       if (batchId) {
// //         await finalizeBatchIfDone(batchId);
// //       }

// //       throw err;
// //     }
// //   },
// //   {
// //     connection,
// //     concurrency: 1,
// //   }
// // );
// // // =======================
// // // 📡 EVENTS
// // // =======================
// // worker.on('completed', (job) => {
// //   console.log(`🎉 Job completed: ${job.id}`);
// // });

// // worker.on('failed', async (job, err) => {
// //   console.log(`💥 Job failed: ${job?.id}`, err.message);

// //   if (job?.data?.batchId) {
// //     await finalizeBatchIfDone(job.data.batchId);
// //   }
// // });

// // worker.on('error', (err) => {
// //   console.log('❌ Worker error:', err.message);
// // });

// // worker.on('stalled', (jobId) => {
// //   console.log(`⚠️ Job stalled: ${jobId}`);
// // });

// import 'dotenv/config';

// import mongoose from 'mongoose';
// import { Worker } from 'bullmq';

// import { shopifyConfigurationModel } from '../Models/buyCredit.js';
// import csvImportBatchSchema from '../Models/csvImportBatchSchema.js';
// import { connection } from '../queue/csvQueue.js';
// import {
//   processSingleProduct,
//   preloadCategoryCache,
//   sendBatchCompletionNotification,
// } from '../controller/csvImportWorker.js';

// // =======================
// // 🔌 MONGO CONNECT
// // =======================
// await mongoose.connect(process.env.DB_URL);
// console.log('✅ Worker Mongo connected');

// // =======================
// // 📂 PRELOAD CACHE
// // =======================
// await preloadCategoryCache();

// // =======================
// // 📊 FINALIZE BATCH
// // =======================
// async function finalizeBatchIfDone(batchId) {
//   const batch = await csvImportBatchSchema.findById(batchId);

//   if (!batch) {
//     console.log('❌ Batch not found for finalize');
//     return;
//   }

//   const total = batch.summary?.total || 0;
//   const processed = batch.processedCount || 0;

//   console.log(`📊 Batch progress: ${processed}/${total}`);

//   if (processed < total) return;
//   if (batch.status === 'completed') return;

//   batch.status = 'completed';
//   batch.completedAt = new Date();

//   await batch.save();

//   console.log(`🎉 Batch COMPLETED: ${batch.batchNo}`);

//   await sendBatchCompletionNotification(batch, batch.userId);
// }

// // =======================
// // 🚀 WORKER
// // =======================
// const worker = new Worker(
//   'csv-import',
//   async (job) => {
//     const { handle, productRows, userId, batchId } = job.data;

//     console.log('\n================ JOB START ================');
//     console.log(`🆔 Job ID: ${job.id}`);
//     console.log(`📦 Batch ID: ${batchId}`);
//     console.log(`🔗 Handle: ${handle}`);

//     try {
//       await job.updateProgress(5);

//       const config = await shopifyConfigurationModel.findOne();

//       if (!config) {
//         throw new Error('Shopify config missing');
//       }

//       await job.updateProgress(10);

//       const batch = await csvImportBatchSchema.findById(batchId);

//       if (!batch) {
//         throw new Error('Batch not found');
//       }

//       if (batch.status !== 'processing' && batch.status !== 'completed') {
//         batch.status = 'processing';
//         await batch.save();
//       }

//       await processSingleProduct({
//         handle,
//         productRows,
//         userId,
//         batchId,
//         shopifyStoreUrl: config.shopifyStoreUrl,
//         shopifyApiKey: config.shopifyApiKey,
//         shopifyAccessToken: config.shopifyAccessToken,
//       });

//       await job.updateProgress(100);

//       await finalizeBatchIfDone(batchId);

//       console.log(`✅ Done: ${handle}`);
//       console.log('================ JOB END ================\n');

//       return { success: true };
//     } catch (err) {
//       console.log(`❌ Error in ${handle}:`, err.message);

//       if (batchId) {
//         await finalizeBatchIfDone(batchId);
//       }

//       throw err;
//     }
//   },
//   {
//     connection,
//     concurrency: 1,
//   }
// );

// // =======================
// // 📡 EVENTS
// // =======================
// worker.on('completed', (job) => {
//   console.log(`🎉 Job completed: ${job.id}`);
// });

// worker.on('failed', async (job, err) => {
//   console.log(`💥 Job failed: ${job?.id}`, err.message);

//   if (job?.data?.batchId) {
//     await finalizeBatchIfDone(job.data.batchId);
//   }
// });

// worker.on('error', (err) => {
//   console.log('❌ Worker error:', err.message);
// });

// worker.on('stalled', (jobId) => {
//   console.log(`⚠️ Job stalled: ${jobId}`);
// });

// export default worker;

import 'dotenv/config';

import mongoose from 'mongoose';
import { Worker } from 'bullmq';

import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import csvImportBatchSchema from '../Models/csvImportBatchSchema.js';
import { connection } from '../queue/csvQueue.js';
import {
  processSingleProduct,
  preloadCategoryCache,
  sendBatchCompletionNotification,
} from '../controller/csvImportWorker.js';

// =======================
// 🔌 MONGO CONNECT
// =======================
await mongoose.connect(process.env.DB_URL);
console.log('✅ Worker Mongo connected');

// =======================
// 📂 PRELOAD CACHE
// =======================
await preloadCategoryCache();

// =======================
// 📊 FINALIZE BATCH (FIXED)
// =======================
async function finalizeBatchIfDone(batchId) {
  const batch = await csvImportBatchSchema.findById(batchId);

  if (!batch) {
    console.log('❌ Batch not found for finalize');
    return;
  }

  const total = batch.summary?.total || 0;
  const success = batch.summary?.success || 0;
  const failed = batch.summary?.failed || 0;

  const processed = success + failed;

  console.log('📊 FINALIZE CHECK:', {
    batchNo: batch.batchNo,
    total,
    success,
    failed,
    processed,
  });

  // 🔴 IMPORTANT: stop if not finished
  if (processed < total) return;

  // 🔴 prevent double completion
  if (batch.status === 'completed') return;

  batch.status = 'completed';
  batch.completedAt = new Date();

  await batch.save();

  console.log(`🎉 Batch COMPLETED: ${batch.batchNo}`);

  // ✅ SEND NOTIFICATION + EMAIL
  await sendBatchCompletionNotification(batch, batch.userId);
}

// =======================
// 🚀 WORKER
// =======================
const worker = new Worker(
  'csv-import',
  async (job) => {
    const { handle, productRows, userId, batchId } = job.data;

    console.log('\n================ JOB START ================');
    console.log(`🆔 Job ID: ${job.id}`);
    console.log(`📦 Batch ID: ${batchId}`);
    console.log(`🔗 Handle: ${handle}`);

    try {
      await job.updateProgress(5);

      // 🔹 Shopify config
      const config = await shopifyConfigurationModel.findOne();

      if (!config) {
        throw new Error('Shopify config missing');
      }

      await job.updateProgress(10);

      // 🔹 Fetch batch
      const batch = await csvImportBatchSchema.findById(batchId);

      if (!batch) {
        throw new Error('Batch not found');
      }

      // 🔹 Mark processing (safe)
      if (batch.status !== 'processing' && batch.status !== 'completed') {
        batch.status = 'processing';
        await batch.save();
      }

      // =======================
      // 🧠 MAIN PRODUCT LOGIC
      // =======================
      await processSingleProduct({
        handle,
        productRows,
        userId,
        batchId,
        shopifyStoreUrl: config.shopifyStoreUrl,
        shopifyApiKey: config.shopifyApiKey,
        shopifyAccessToken: config.shopifyAccessToken,
      });

      await job.updateProgress(100);

      // 🔹 Check completion
      await finalizeBatchIfDone(batchId);

      console.log(`✅ Done: ${handle}`);
      console.log('================ JOB END ================\n');

      return { success: true };
    } catch (err) {
      console.log(`❌ Error in ${handle}:`, err.message);

      // even on fail → check batch completion
      if (batchId) {
        await finalizeBatchIfDone(batchId);
      }

      throw err; // retry trigger
    }
  },
  {
    connection,
    concurrency: 1, // Shopify safe
  }
);

// =======================
// 📡 EVENTS
// =======================
worker.on('completed', (job) => {
  console.log(`🎉 Job completed: ${job.id}`);
});

worker.on('failed', async (job, err) => {
  console.log(`💥 Job failed: ${job?.id}`, err.message);

  if (job?.data?.batchId) {
    await finalizeBatchIfDone(job.data.batchId);
  }
});

worker.on('error', (err) => {
  console.log('❌ Worker error:', err.message);
});

worker.on('stalled', (jobId) => {
  console.log(`⚠️ Job stalled: ${jobId}`);
});

export default worker;