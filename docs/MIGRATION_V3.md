# 🚀 SiteGPT.jp v3 マイグレーションガイド

v2 → v3 への移行手順

## 📋 概要

v3では以下の機能が追加されます：

1. **ユーザープラン管理** (`users` テーブル)
2. **埋め込みウィジェット** (`sites.is_embed_enabled`)
3. **モデルポリシー管理** (`model_policies` テーブル)
4. **使用量ログ** (`usage_logs` テーブル)
5. **ジョブキューシステム** (Redis + BullMQ)

---

## 🔧 マイグレーション手順

### Step 1: データベースマイグレーション

Supabaseダッシュボードで `schema_saas_step3_v3.sql` を実行：

```bash
# Supabase SQL Editor で実行
# または Supabase CLI を使用
supabase db reset
supabase migration new v3_migration
# schema_saas_step3_v3.sql の内容をコピー
supabase db push
```

**実行内容**:
- ✅ `users` テーブル作成
- ✅ `sites` テーブルに `is_embed_enabled`, `embed_script_id` 追加
- ✅ `training_jobs` テーブルに `attempt`, `estimated_cost_usd` 追加
- ✅ `documents` テーブルに `version`, `valid_until` 追加
- ✅ `model_policies` テーブル作成
- ✅ `usage_logs` テーブル作成
- ✅ RLSポリシー設定
- ✅ 関数追加 (`get_monthly_usage`, `check_quota`)

### Step 2: 依存関係のインストール

```bash
npm install bullmq ioredis
npm install -D @types/ioredis
```

### Step 3: 環境変数の追加

`.env.local` に以下を追加：

```env
# Redis設定
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 本番環境の場合（Upstashなど）
# REDIS_HOST=your-redis-host.upstash.io
# REDIS_PORT=6379
# REDIS_PASSWORD=your-redis-password
```

### Step 4: コードの更新

#### 4.1 キューシステムの統合

既存の `/api/train/url` を更新してキューを使用：

```typescript
// pages/api/train/url.ts の変更点
import { trainingQueue } from '@/lib/queue';

// ジョブをキューに追加
const job = await trainingQueue.add('train-site', {
  site_id,
  baseUrl,
  sitemapUrl,
  urlList: processedUrlList,
  userId,
  forceRetrain: req.body.force_retrain || false,
}, {
  jobId: jobId, // training_jobs.id を使用
});

// 即座にレスポンス
res.status(200).json({
  job_id: jobId,
  status: 'pending',
  message: 'Training job queued',
});
```

#### 4.2 ワーカーの起動

開発環境：
```bash
npm run worker
```

本番環境（PM2使用例）：
```bash
pm2 start npm --name "training-worker" -- run worker
pm2 save
```

### Step 5: 既存ユーザーの移行

既存のSupabase Authユーザーに対して `users` テーブルにレコードを作成：

```sql
-- 既存ユーザーをデフォルトプランで登録
INSERT INTO users (id, plan, chat_quota, embedding_quota)
SELECT 
  id,
  'starter' as plan,
  1000 as chat_quota,
  100000 as embedding_quota
FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

---

## 🔄 ロールバック手順

問題が発生した場合のロールバック：

### 1. キューシステムを無効化

`/api/train/url` を元の同期処理に戻す

### 2. データベースのロールバック（必要に応じて）

```sql
-- 追加したカラムを削除（注意: データが失われます）
ALTER TABLE sites DROP COLUMN IF EXISTS is_embed_enabled;
ALTER TABLE sites DROP COLUMN IF EXISTS embed_script_id;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS attempt;
ALTER TABLE training_jobs DROP COLUMN IF EXISTS estimated_cost_usd;
ALTER TABLE documents DROP COLUMN IF EXISTS version;
ALTER TABLE documents DROP COLUMN IF EXISTS valid_until;

-- テーブルを削除
DROP TABLE IF EXISTS usage_logs;
DROP TABLE IF EXISTS model_policies;
DROP TABLE IF EXISTS users;
```

---

## ✅ マイグレーション後の確認

### 1. テーブルの確認

```sql
-- テーブル一覧
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 各テーブルのカラム確認
\d users
\d sites
\d training_jobs
\d documents
\d model_policies
\d usage_logs
```

### 2. 関数の確認

```sql
-- 関数一覧
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE proname IN ('get_monthly_usage', 'check_quota');
```

### 3. RLSポリシーの確認

```sql
-- RLS有効化確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'sites', 'usage_logs', 'model_policies');
```

### 4. ワーカーの動作確認

```bash
# ワーカーを起動
npm run worker

# 別ターミナルで学習ジョブを送信
curl -X POST http://localhost:3000/api/train/url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"site_id": "YOUR_SITE_ID", "baseUrl": "https://example.com"}'
```

---

## 📊 パフォーマンステスト

マイグレーション後のパフォーマンス確認：

1. **キュー処理速度**: 1ジョブあたりの処理時間
2. **同時実行**: 複数ジョブの並列処理
3. **エラーハンドリング**: 失敗時のリトライ動作
4. **メモリ使用量**: ワーカーのメモリ消費

---

## 🚨 注意事項

1. **Redis接続**: 本番環境では必ずパスワードを設定
2. **ワーカーの可用性**: ワーカーが停止するとジョブが処理されない
3. **データ整合性**: マイグレーション実行中はアプリを停止推奨
4. **バックアップ**: マイグレーション前にデータベースをバックアップ

---

## 📚 関連ドキュメント

- [アーキテクチャ v3](./architecture_v3.md)
- [ワーカー仕様書](./WORKER_SPEC_V3.md)
- [Supabase マイグレーションガイド](https://supabase.com/docs/guides/cli/local-development#database-migrations)

---

これで **v3マイグレーションガイド完了**。

問題があれば、ロールバック手順に従って元に戻せます。

