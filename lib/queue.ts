/**
 * BullMQ キュー設定
 * 
 * 学習ジョブを非同期で処理するためのキューシステム
 */

import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Redis接続設定
// Upstash RedisはTLS接続が必要
const isUpstash = process.env.REDIS_HOST?.includes('upstash.io');
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(isUpstash && {
    tls: {
      rejectUnauthorized: false, // Upstashの証明書を信頼
    },
  }),
});

// 接続エラーハンドリング
connection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

connection.on('connect', () => {
  console.log('✅ Redis connected');
});

// 学習ジョブキュー
export const trainingQueue = new Queue('training-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2秒、4秒、8秒...
    },
    removeOnComplete: {
      age: 3600, // 1時間後に削除
      count: 1000, // 最大1000件保持
    },
    removeOnFail: {
      age: 86400, // 24時間後に削除
    },
  },
});

// キューイベント（進捗監視用）
export const queueEvents = new QueueEvents('training-jobs', {
  connection,
});

// キュー統計を取得
export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    trainingQueue.getWaitingCount(),
    trainingQueue.getActiveCount(),
    trainingQueue.getCompletedCount(),
    trainingQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed,
  };
}

// ジョブを取得
export async function getJob(jobId: string) {
  return await trainingQueue.getJob(jobId);
}

// ジョブを再試行
export async function retryJob(jobId: string) {
  const job = await trainingQueue.getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }
  await job.retry();
  return job;
}

// キューをクリーンアップ（開発用）
export async function cleanQueue() {
  await trainingQueue.obliterate({ force: true });
}

