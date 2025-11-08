# 🔧 SiteGPT.jp v3 ワーカー仕様書

（Redis + BullMQ によるジョブキューシステム）

## 📋 概要

v3では、学習ジョブを**非同期キューシステム**で処理することで、スケーラビリティと信頼性を向上させます。

現在の実装（`/api/train/url`）は、APIリクエスト内で同期的に処理を開始していますが、v3では以下のように変更します：

```
[API] → [Redis Queue] → [Worker] → [Supabase]
```

---

## 🏗️ アーキテクチャ

### コンポーネント構成

```
┌─────────────┐
│  Next.js    │
│  API Route  │  POST /api/train/url
└──────┬──────┘
       │ 1. ジョブをキューに追加
       ▼
┌─────────────┐
│   Redis     │  BullMQ Queue: "training-jobs"
└──────┬──────┘
       │ 2. ワーカーがジョブを取得
       ▼
┌─────────────┐
│   Worker    │  Node.js プロセス（独立）
│  (tsx/ts-node)│  - クロール
│             │  - 埋め込み生成
│             │  - Supabase保存
└──────┬──────┘
       │ 3. 結果をSupabaseに保存
       ▼
┌─────────────┐
│  Supabase   │  training_jobs.status更新
└─────────────┘
```

### データフロー

1. **APIリクエスト受信** (`/api/train/url`)
   - 認証チェック
   - `training_jobs` にレコード作成（`status='pending'`）
   - Redisキューにジョブを追加
   - 即座に `job_id` を返す

2. **ワーカーがジョブを処理**
   - Redisからジョブを取得
   - `training_jobs.status` を `'running'` に更新
   - サイトマップ/URLリストからページをクロール
   - 各ページを埋め込み化
   - `documents` テーブルに保存
   - 完了時に `status='completed'` に更新

3. **エラーハンドリング**
   - 失敗時は `status='failed'` に更新
   - `attempt` をインクリメント
   - 最大リトライ回数まで自動リトライ

---

## 📦 依存関係

### 必要なパッケージ

```json
{
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.2"
  },
  "devDependencies": {
    "@types/ioredis": "^5.0.0"
  }
}
```

### Redis セットアップ

**ローカル開発環境**:
```bash
# Docker Compose を使用
docker run -d -p 6379:6379 redis:7-alpine
```

**本番環境**:
- Upstash Redis（推奨）
- AWS ElastiCache
- Supabase Edge Functions 内で Redis を使用

---

## 🔨 実装仕様

### 1. キュー設定 (`lib/queue.ts`)

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const trainingQueue = new Queue('training-jobs', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // 1時間後に削除
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // 24時間後に削除
    },
  },
});

export const queueEvents = new QueueEvents('training-jobs', {
  connection,
});
```

### 2. APIエンドポイント変更 (`pages/api/train/url.ts`)

**変更前**: 同期的に処理を開始

**変更後**: キューにジョブを追加して即座に返す

```typescript
// ジョブデータ
const jobData = {
  site_id,
  baseUrl,
  sitemapUrl,
  urlList: processedUrlList,
  userId,
  forceRetrain: req.body.force_retrain || false,
};

// キューに追加
const job = await trainingQueue.add('train-site', jobData, {
  jobId: jobId, // training_jobs.id を使用
  priority: 1,
});

// 即座にレスポンス
res.status(200).json({
  job_id: jobId,
  status: 'pending',
  message: 'Training job queued',
});
```

### 3. ワーカー実装 (`workers/training-worker.ts`)

```typescript
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';
// ... 既存のクロール・埋め込み処理をインポート

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const worker = new Worker(
  'training-jobs',
  async (job: Job) => {
    const { site_id, baseUrl, sitemapUrl, urlList, userId, forceRetrain } = job.data;

    try {
      // 1. ステータスを 'running' に更新
      await supabase
        .from('training_jobs')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // 2. サイト情報を取得
      const { data: site } = await supabase
        .from('sites')
        .select('*')
        .eq('id', site_id)
        .single();

      if (!site) {
        throw new Error('Site not found');
      }

      // 3. クロール処理（既存のロジックを再利用）
      const urls = await crawlSitemap(baseUrl, sitemapUrl, urlList);
      
      // 4. 差分更新チェック（forceRetrain=false の場合）
      let urlsToProcess = urls;
      if (!forceRetrain && site.last_trained_at) {
        // 前回学習以降に更新されたURLのみ処理
        urlsToProcess = await filterUpdatedUrls(urls, site.last_trained_at);
      }

      // 5. 埋め込み処理
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY!,
      });

      let processedPages = 0;
      const totalPages = urlsToProcess.length;

      for (const url of urlsToProcess) {
        // 進捗を更新
        await job.updateProgress({
          processed: processedPages,
          total: totalPages,
        });

        // ページをクロール・埋め込み
        await processPage(url, site_id, embeddings);
        processedPages++;
      }

      // 6. 完了処理
      await supabase
        .from('training_jobs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          processed_pages: processedPages,
          total_pages: totalPages,
        })
        .eq('id', job.id);

      await supabase
        .from('sites')
        .update({
          status: 'ready',
          last_trained_at: new Date().toISOString(),
        })
        .eq('id', site_id);

      return { success: true, processedPages, totalPages };
    } catch (error) {
      // エラー処理
      await supabase
        .from('training_jobs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: error.message,
          attempt: job.attemptsMade + 1,
        })
        .eq('id', job.id);

      await supabase
        .from('sites')
        .update({ status: 'error' })
        .eq('id', site_id);

      throw error;
    }
  },
  {
    connection,
    concurrency: 3, // 同時実行数
    limiter: {
      max: 5, // 最大5ジョブ/秒
      duration: 1000,
    },
  }
);

// エラーハンドリング
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

// シグナルハンドリング
process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
```

### 4. ワーカー起動スクリプト (`scripts/start-worker.ts`)

```typescript
#!/usr/bin/env tsx
import 'dotenv/config';
import './workers/training-worker';

console.log('🚀 Training worker started');
console.log(`Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
```

**package.json に追加**:
```json
{
  "scripts": {
    "worker": "tsx -r dotenv/config scripts/start-worker.ts"
  }
}
```

---

## 📊 モニタリング

### 1. キュー状態の確認

```typescript
// lib/queue.ts に追加
export async function getQueueStats() {
  const waiting = await trainingQueue.getWaitingCount();
  const active = await trainingQueue.getActiveCount();
  const completed = await trainingQueue.getCompletedCount();
  const failed = await trainingQueue.getFailedCount();

  return {
    waiting,
    active,
    completed,
    failed,
  };
}
```

### 2. ジョブ進捗の取得

```typescript
// API: GET /api/train/status?job_id=...
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { job_id } = req.query;
  
  const job = await trainingQueue.getJob(job_id as string);
  if (!job) {
    return res.status(404).json({ message: 'Job not found' });
  }

  const state = await job.getState();
  const progress = job.progress;

  res.json({
    job_id,
    state,
    progress,
    attemptsMade: job.attemptsMade,
  });
}
```

### 3. Bull Board（ダッシュボード）

```typescript
// pages/api/admin/queue.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { trainingQueue } from '@/lib/queue';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queue');

createBullBoard({
  queues: [new BullMQAdapter(trainingQueue)],
  serverAdapter,
});

// Express ミドルウェアとして使用
```

---

## 🔄 マイグレーション手順

### Step 1: 依存関係のインストール

```bash
npm install bullmq ioredis
npm install -D @types/ioredis
```

### Step 2: 環境変数の追加

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Step 3: コードの移行

1. `lib/queue.ts` を作成
2. `pages/api/train/url.ts` を修正（キューに追加するように変更）
3. `workers/training-worker.ts` を作成
4. 既存のクロール・埋め込み処理をワーカーに移動

### Step 4: ワーカーの起動

**開発環境**:
```bash
npm run worker
```

**本番環境**:
- PM2 を使用
- Docker Compose でワーカーコンテナを起動
- Vercel Cron Jobs（制限あり）

---

## 🚨 エラーハンドリングとリトライ

### 自動リトライ

- **最大試行回数**: 3回
- **バックオフ**: 指数バックオフ（2秒、4秒、8秒）
- **リトライ条件**: ネットワークエラー、タイムアウト

### 手動リトライ

```typescript
// API: POST /api/train/retry?job_id=...
const job = await trainingQueue.getJob(job_id);
if (job) {
  await job.retry();
}
```

---

## 📈 パフォーマンス最適化

### 1. 並列処理

- **concurrency**: 3（同時実行ジョブ数）
- **limiter**: 最大5ジョブ/秒

### 2. バッチ処理

大量のURLを処理する場合、バッチ単位で処理：

```typescript
const BATCH_SIZE = 10;
for (let i = 0; i < urls.length; i += BATCH_SIZE) {
  const batch = urls.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(url => processPage(url)));
}
```

### 3. メモリ管理

- 完了したジョブは自動削除（1時間後）
- 失敗したジョブは24時間保持

---

## ✅ チェックリスト

- [ ] Redis サーバーのセットアップ
- [ ] `bullmq` と `ioredis` のインストール
- [ ] `lib/queue.ts` の作成
- [ ] `/api/train/url` の修正（キュー追加）
- [ ] `workers/training-worker.ts` の作成
- [ ] ワーカー起動スクリプトの作成
- [ ] 環境変数の設定
- [ ] モニタリングダッシュボードのセットアップ（オプション）
- [ ] 本番環境でのワーカー起動方法の決定

---

## 🔗 参考リンク

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/docs/)
- [Upstash Redis](https://upstash.com/)（サーバーレスRedis）

---

これで **v3ワーカー仕様書完了**。

次は実装に進むか、追加の仕様が必要なら教えてね！

