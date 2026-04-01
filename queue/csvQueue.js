import 'dotenv/config';

import IORedis from 'ioredis';
import { Queue } from 'bullmq';

console.log('🔍 REDIS_URL:', process.env.REDIS_URL ? 'Loaded ✅' : 'Missing ❌');

// =======================
// 🔌 REDIS CONNECTION
// =======================
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,

  // 🔐 TLS only if needed
  ...(process.env.REDIS_URL?.startsWith('rediss://') ? { tls: {} } : {}),

  retryStrategy(times) {
    console.log(`🔁 Redis retry attempt: ${times}`);
    return Math.min(times * 100, 2000);
  },
});

// =======================
// 📡 REDIS EVENTS
// =======================
connection.on('connect', () => {
  console.log('✅ Redis CONNECT');
});

connection.on('ready', () => {
  console.log('🚀 Redis READY');
});

connection.on('error', (err) => {
  console.log('❌ Redis ERROR:', err.message);
});

connection.on('close', () => {
  console.log('🔒 Redis CLOSED');
});

connection.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

// =======================
// 🧱 BULLMQ QUEUE
// =======================
export const csvQueue = new Queue('csv-import', {
  connection,

  defaultJobOptions: {
    attempts: 3, 
    backoff: {
      type: 'exponential',
      delay: 2000,
    },

    removeOnComplete: 1000, 
    removeOnFail: false, 
  },
});

// =======================
// 🔁 EXPORT CONNECTION
// =======================
export { connection };