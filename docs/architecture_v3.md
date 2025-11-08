# 🧱 SiteGPT.jp SaaS 化設計ドキュメント v3

（フェーズ B+: 拡張運用版）

## 📋 概要

このバージョン（v3）は、v2 の基本構成に加えて、**運用・拡張・収益化**を見据えた仕様を定義する。

ユーザーが増え、サイト数・チャット数が膨らんでも耐えうるプラットフォームを目指す。

---

## 🧩 1️⃣ データモデル拡張

### 1.1 `users` テーブル（既存 Supabase Auth 外補助用）

※Supabase Auth だけだとメタデータ足りない場合用

| カラム            | 型          | 制約          | 説明                             |
| ----------------- | ----------- | ------------- | -------------------------------- |
| `id`              | uuid        | PRIMARY KEY   | 同じ as auth.users.id            |
| `plan`            | text        | NOT NULL      | 'starter' / 'pro' / 'enterprise' |
| `chat_quota`      | int         | NOT NULL      | 月チャット上限                   |
| `embedding_quota` | int         | NOT NULL      | 月 embedding 上限                |
| `created_at`      | timestamptz | DEFAULT now() | 作成日時                         |

### 1.2 `sites` テーブル（v2 ＋追加カラム）

追加カラム：

| カラム             | 型      | 説明                    |
| ------------------ | ------- | ----------------------- |
| `is_embed_enabled` | boolean | 埋め込み JS 利用可否    |
| `embed_script_id`  | text    | 埋め込み用スクリプト ID |

### 1.3 `training_jobs` テーブル（v2 ＋追加カラム）

追加：

| カラム               | 型      | 説明                          |
| -------------------- | ------- | ----------------------------- |
| `attempt`            | int     | リトライ回数                  |
| `estimated_cost_usd` | numeric | 学習で想定されるコスト（USD） |

### 1.4 `documents` テーブル

追加：

| カラム        | 型          | 説明                       |
| ------------- | ----------- | -------------------------- |
| `version`     | int         | 埋め込み版のバージョン番号 |
| `valid_until` | timestamptz | 差分更新機能時の有効期限   |

### 1.5 `model_policies` テーブル（新設）

モデル選択やコスト制御用。

| カラム                     | 型      | 説明                                                  |
| -------------------------- | ------- | ----------------------------------------------------- |
| `id`                       | uuid    | 主キー                                                |
| `name`                     | text    | 'embedding_3_small', 'embedding_3_large', 'local_llm' |
| `type`                     | text    | 'embedding' / 'chat'                                  |
| `cost_per_1000_tokens_usd` | numeric | 単価                                                  |
| `is_default`               | boolean | デフォルトモデルか                                    |

> 実装メモ: 上記 1.1〜1.5 の変更は `supabase/migrations/20240909_v3_schema.sql` に反映済み。

---

## 🧠 2️⃣ API 構造拡張

### 2.1 `/api/train/url`（v2 ＋拡張）

**追加パラメータ**：

```json
{
  "force_retrain": boolean
}
```

**拡張処理**：

- 差分更新モードなら、前回学習日時から更新されたページのみ学習
- `estimated_cost_usd` を `training_jobs` に記録
- キュー方式対応（ジョブ登録後、ワーカーが処理）

### 2.2 `/api/chat`（v2 ＋改良）

**追加レスポンスフィールド**：

```json
{
  "sources": [ ... ],
  "model_used": "<model_name>",
  "tokens_consumed": {
    "embedding": int,
    "chat": int
  },
  "cost_usd": number
}
```

**機能追加**：

- モデル切替サポート（ユーザーが plan に応じて model_policies から選択）
- チャット回数チェック＆quota 超過時はプラン案内

### 2.3 `/api/embed/script`（新設）✅ 実装完了

**GET**

返却：

```js
// 埋め込みスクリプト
(function () {
  /* widget loader for bot */
})();
```

**用途**：

- ユーザーが `<script src=".../embed/script?site_id=..."></script>` を貼るだけ
- `sites.is_embed_enabled` チェック後ロード
- `status='ready'` チェックも実装済み

**実装状況**：

- ✅ `/pages/api/embed/script.ts` 実装完了
- ✅ `is_embed_enabled` チェック実装
- ✅ ウィジェット HTML 生成機能実装
- ✅ テスト成功確認

### 2.3.1 `/api/embed/chat`（新設）✅ 実装完了

**POST**

**機能**：

- 埋め込み用チャット API（認証不要）
- `site_id` と `is_embed_enabled` でセキュリティ確保
- ストリーミングレスポンス対応
- クォータチェック実装済み
- usage_logs への記録実装済み

**実装状況**：

- ✅ `/pages/api/embed/chat.ts` 実装完了
- ✅ クォータチェック機能実装
- ✅ ストリーミングレスポンス実装
- ✅ テスト成功確認

### 2.4 `/api/admin/usage`（新設） ✅ 実装完了

**GET**

返却：

- 各テナントの月別チャット数/埋め込み数/コスト USD

  用途：管理者ダッシュボード用

**実装状況**：

- ✅ `/pages/api/admin/usage.ts` で `usage_logs` を集計して返却
- ✅ `ADMIN_USER_IDS` 環境変数で管理者を制限

---

## 🔁 3️⃣ UI 構造拡張（Next.js）

### `/dashboard/plans` ✅ 実装完了

- プラン比較ページ
- ユーザーが自分のプランを確認・アップグレード申請
- スターター・プロ・エンタープライズプランの比較表示
- 現在のプラン表示
- プラン変更機能（デモモード）

**実装状況**：

- ✅ `/pages/dashboard/plans.tsx` 実装完了
- ✅ プラン比較 UI 実装
- ✅ プラン変更機能実装
- ✅ ダッシュボードへのリンク追加

### `/dashboard/usage` ✅ 実装完了

- 今月の使用状況（埋め込みトークン数・チャット回数・コスト USD）グラフ表示
- プラン情報とクォータ使用率の表示
- 日別使用量グラフ（チャット回数・埋め込みトークン数・コスト）
- 月選択機能

**実装状況**：

- ✅ `/pages/dashboard/usage.tsx` 実装完了
- ✅ `get_monthly_usage` 関数を使用
- ✅ クォータ使用率の可視化
- ✅ 日別グラフ表示

### `/dashboard/sites/[siteId]/embed` ✅ 実装完了

- 埋め込みウィジェット設定画面
- `is_embed_enabled` の切り替え機能
- 埋め込みスクリプトの表示とコピー機能
- サイトステータスチェック（ready でないと埋め込み不可）
- 使用方法の説明

**実装状況**：

- ✅ `/pages/dashboard/sites/[siteId]/embed.tsx` 実装完了
- ✅ 埋め込み有効化スイッチ実装
- ✅ スクリプトタグのコピー機能実装
- ✅ サイト詳細ページへのリンク追加

---

## 📦 4️⃣ 運用・スケーラビリティ仕様

- **ジョブキュー**：Redis + BullMQ などで `/api/train/url` → キュー → ワーカー処理
- **モニタリング**：Prometheus + Grafana で「平均チャンク数」「埋め込みトークン数」「チャット応答時間」を追跡
- **ログ保存**：Cloud Logging に「誰がいつどのサイトをどのモデルで使ったか」を記録
- **バックアップ**：Supabase ストレージに毎日 `documents` テーブルダンプ（差分）を保存

---

## 🛡️ 5️⃣ セキュリティ・ガバナンス

- **データ隔離**：RLS により user_id/site_id 限定アクセス
- **アクセスログ**：チャット API・学習 API 呼出毎に `user_id`, `site_id` をログ
- **コスト遮断**：月間埋め込みトークン数・チャット回数超過時は自動「停止」モード
- **プライバシー**：顧客ドメインのデータを暗号化（at-rest AES-256）を想定

---

## 🚀 6️⃣ 差分更新とモデル切替戦略

### 差分更新

- `documents.valid_until` による有効期限管理
- 前回 `last_trained_at` より更新のあった URL のみ再クロール＆埋め込み
- 古チャンクは `version++` または削除可能

### モデル切替

- `model_policies` テーブルでモデル管理
- プラン別に `type`／`cost_per_1000_tokens_usd` を定義
- チャット時に `model_used` をレスポンスに含め、コストを透明化

---

## ✅ 次アクション（v3 実行版）

1. ✅ `/docs/architecture_v3.md` として保存
2. ✅ マイグレーションファイル（Supabase SQL）を v2 → v3 に更新
   - `schema_saas_step3_v3.sql` 完成
3. ✅ キュー・モニタリング基盤の設計（Redis／BullMQ）
   - `/docs/WORKER_SPEC_V3.md` 完成
   - `/lib/queue.ts` 実装完了
   - `/workers/training-worker.ts` 実装完了
   - `/pages/api/train/url.ts` キュー統合完了
   - Upstash Redis 接続・動作確認完了 ✅
   - ワーカー起動・ジョブ処理成功確認 ✅
   - キュー統計確認スクリプト作成済み
4. ✅ マイグレーションガイド作成
   - `/docs/MIGRATION_V3.md` 完成
5. ✅ 埋め込み API 実装
   - `/pages/api/embed/script.ts` 実装完了・テスト成功
   - `/pages/api/embed/chat.ts` 実装完了・テスト成功
   - クォータチェック機能実装済み
   - usage_logs 記録機能実装済み
6. ✅ 使用状況ページ実装
   - `/pages/dashboard/usage.tsx` 実装完了
   - 月間使用量・クォータ使用率表示
   - 日別グラフ表示
7. ✅ プラン比較ページ実装
   - `/pages/dashboard/plans.tsx` 実装完了
   - プラン比較 UI 実装
   - プラン変更機能実装
8. ✅ 埋め込み設定ページ実装
   - `/pages/dashboard/sites/[siteId]/embed.tsx` 実装完了
   - 埋め込み有効化スイッチ実装
   - スクリプトタグのコピー機能実装

---

## 📚 関連ドキュメント

- [ワーカー仕様書](./WORKER_SPEC_V3.md) - Redis + BullMQ によるジョブキューシステム
- [マイグレーションガイド](./MIGRATION_V3.md) - v2 → v3 への移行手順
- [スキーマ SQL](../schema_saas_step3_v3.sql) - v3 データベースマイグレーション

---

これで **v3 設計・実装準備完了**。

## 📊 実装進捗状況

### ✅ 完了項目

- **データベースマイグレーション**: v3 スキーマ実装完了
- **ジョブキューシステム**: Redis + BullMQ 統合完了・動作確認済み ✅
  - Upstash Redis 接続成功
  - ワーカー起動・ジョブ処理成功
  - キュー統計確認スクリプト作成済み
- **埋め込み API**: `/api/embed/script` と `/api/embed/chat` 実装・テスト成功
- **クォータ管理**: `users`テーブル、`check_quota`関数実装済み
- **使用量ログ**: `usage_logs`テーブル実装済み

### 🔄 次のステップ

1. ✅ Redis サーバーのセットアップ（Upstash Redis 接続完了）
2. ワーカーの本番環境デプロイ設定
3. UI 拡張 ✅ 完了
   - ✅ `/dashboard/usage` 実装完了
   - ✅ `/dashboard/plans` 実装完了
   - ✅ `/dashboard/sites/[siteId]/embed` 実装完了
4. `/api/admin/usage` エンドポイント実装
5. モニタリング・アラート設定（Prometheus + Grafana）
