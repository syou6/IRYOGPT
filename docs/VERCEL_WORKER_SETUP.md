# 🚀 Vercel でのワーカー設定ガイド

VercelはServerless Functionsのため、常時起動するワーカーを直接実行できません。以下の方法でワーカーを実行できます。

---

## 📋 方法1: Vercel Cron Jobs（推奨）

Vercel Cron Jobsを使って、定期的にジョブを処理するAPI Routeを作成します。

### 1. `vercel.json` を作成

プロジェクトルートに `vercel.json` を作成：

```json
{
  "crons": [
    {
      "path": "/api/worker/process",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

**スケジュール設定**:
- `*/1 * * * *` - 毎分実行（開発用）
- `*/5 * * * *` - 5分ごと（本番推奨）
- `*/10 * * * *` - 10分ごと（コスト削減）

### 2. ワーカー処理API Route を作成

`pages/api/worker/process.ts` を作成：

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { trainingQueue } from '@/lib/queue';
import { supabaseClient } from '@/utils/supabase-client';

/**
 * GET /api/worker/process
 * 
 * Vercel Cron Jobsから呼び出される
 * キューからジョブを取得して処理する
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Cron Jobsからのリクエストか確認（オプション）
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // キューから待機中のジョブを取得
    const waitingJobs = await trainingQueue.getWaiting();
    const activeJobs = await trainingQueue.getActive();

    // 既に処理中のジョブがある場合はスキップ
    if (activeJobs.length > 0) {
      return res.status(200).json({
        message: 'Jobs already processing',
        active: activeJobs.length,
        waiting: waitingJobs.length,
      });
    }

    // 待機中のジョブがない場合は終了
    if (waitingJobs.length === 0) {
      return res.status(200).json({
        message: 'No jobs in queue',
        waiting: 0,
      });
    }

    // 最初のジョブを処理（ワーカーが自動的に処理する）
    // このAPIは単にキュー状態を確認するだけ
    return res.status(200).json({
      message: 'Queue checked',
      waiting: waitingJobs.length,
      active: activeJobs.length,
    });
  } catch (error) {
    console.error('[Worker Process] Error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

**注意**: この方法では、実際のジョブ処理は別の方法で行う必要があります。

---

## 📋 方法2: 外部サービスでワーカーを実行（推奨）

Vercelとは別のサービスでワーカーを常時起動します。

### Railway（推奨）

1. **Railwayアカウント作成**: https://railway.app
2. **新しいプロジェクト作成**
3. **GitHubリポジトリを接続**
4. **環境変数を設定**:
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
5. **Start Command を設定**: `npm run worker`
6. **デプロイ**

### Render

1. **Renderアカウント作成**: https://render.com
2. **New → Background Worker**
3. **設定**:
   - **Build Command**: `npm install`
   - **Start Command**: `npm run worker`
   - **Environment Variables**: 上記と同じ

### Fly.io

1. **Fly.ioアカウント作成**: https://fly.io
2. **`fly.toml` を作成**:

```toml
app = "sitegpt-worker"
primary_region = "nrt"

[build]

[env]
  REDIS_HOST = "your-redis-host"
  REDIS_PORT = "6379"
  REDIS_PASSWORD = "your-redis-password"

[[services]]
  internal_port = 8080
  protocol = "tcp"
```

3. **デプロイ**: `fly deploy`

---

## 📋 方法3: Upstash QStash（推奨）

Upstash QStashは、Serverless環境向けのジョブキューサービスです。

### 1. Upstash QStash をセットアップ

1. **Upstashダッシュボード**: https://console.upstash.com
2. **QStash を作成**
3. **API Key を取得**

### 2. QStash用のAPI Route を作成

`pages/api/worker/qstash.ts` を作成：

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { Client } from '@upstash/qstash';
import { trainingQueue } from '@/lib/queue';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // QStashからのリクエストか確認
  const signature = req.headers['upstash-signature'];
  if (!signature) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // キューからジョブを取得して処理
    const worker = new Worker('training-jobs', async (job) => {
      // ジョブ処理ロジック
    }, {
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    });

    return res.status(200).json({ message: 'Job processed' });
  } catch (error) {
    console.error('[QStash Worker] Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
```

---

## 📋 方法4: Vercel Edge Functions + ポーリング

Edge Functionsを使って、定期的にキューをポーリングします。

### 1. Edge Function を作成

`api/worker-edge.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Redis from 'ioredis';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  });

  // キューからジョブを取得
  const jobs = await redis.lrange('bull:training-jobs:waiting', 0, 0);
  
  if (jobs.length === 0) {
    return res.status(200).json({ message: 'No jobs' });
  }

  // ジョブを処理（実際の処理は別のAPI Routeで）
  // ここではキューから取得するだけ

  return res.status(200).json({ message: 'Job found', count: jobs.length });
}
```

---

## ✅ 推奨構成

**本番環境での推奨構成**:

1. **Vercel**: Next.jsアプリケーション（API Routes + Frontend）
2. **Railway/Render**: ワーカープロセス（常時起動）
3. **Upstash Redis**: ジョブキュー

**コスト比較**:
- **Railway**: $5/月〜（ワーカー用）
- **Render**: $7/月〜（ワーカー用）
- **Vercel Cron**: 無料（Hobbyプラン）、制限あり

---

## 🔧 環境変数の設定

Vercelダッシュボードで以下を設定：

```
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
CRON_SECRET=your-random-secret-key
```

---

## 📊 モニタリング

### キュー状態の確認

```bash
# ローカルから確認
npm run check:queue
```

### Vercel Logs

Vercelダッシュボードの「Logs」タブで、Cron Jobsの実行ログを確認できます。

---

## 🚨 トラブルシューティング

### ジョブが処理されない

1. **Redis接続を確認**: `npm run test:redis`
2. **ワーカーが起動しているか確認**: Railway/Renderのログを確認
3. **キューにジョブがあるか確認**: `npm run check:queue`

### Vercel Cron Jobsが動作しない

1. **`vercel.json` が正しく設定されているか確認**
2. **VercelプロジェクトにCron Jobsが有効になっているか確認**
3. **環境変数 `CRON_SECRET` が設定されているか確認**

---

## 📚 参考リンク

- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Railway Documentation](https://docs.railway.app)
- [Render Documentation](https://render.com/docs)
- [Upstash QStash](https://docs.upstash.com/qstash)

