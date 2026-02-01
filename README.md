# よやくらく

医療機関向けAI予約チャットボットシステム

## 概要

「よやくらく」は、歯科医院・クリニック向けのAI予約受付システムです。24時間自動で予約対応を行い、受付業務の負担を軽減します。

### 主な機能

- 🤖 **AIチャットボット** - 自然な会話で予約受付
- 📅 **Googleスプレッドシート連携** - 既存の予約管理に統合可能
- 📧 **自動メール送信** - 予約確認・リマインドメール
- 🔗 **埋め込みウィジェット** - 1行のコードでHPに設置
- 📊 **管理ダッシュボード** - 予約状況・チャット履歴の確認

## システム構成

```
患者 → 埋め込みウィジェット → Vercel (Next.js)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                 OpenAI         Supabase      Google Sheets
              (GPT-4o-mini)    (DB/認証)       (予約データ)
                                    │
                                    ▼
                                 Resend
                              (メール送信)
```

## 技術スタック

- **フロントエンド**: Next.js 15, React, TailwindCSS
- **バックエンド**: Next.js API Routes
- **AI**: OpenAI GPT-4o-mini, text-embedding-3-small
- **データベース**: Supabase (PostgreSQL + pgvector)
- **予約データ**: Google Sheets API
- **メール**: Resend
- **ホスティング**: Vercel
- **認証**: Supabase Auth (Google OAuth)

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/syou6/IRYOGPT.git
cd IRYOGPT
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local` を作成し、以下の変数を設定:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Resend (メール送信)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=info@yoyakuraku.com

# Cron (リマインドメール)
CRON_SECRET=your-secret-key

# その他
NEXT_PUBLIC_SITE_URL=https://yoyakuraku.com
```

### 4. データベースのセットアップ

Supabaseで以下のマイグレーションを実行:

```bash
# supabase/migrations/ 内のSQLファイルを順番に実行
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセス可能

## ディレクトリ構成

```
├── components/          # Reactコンポーネント
│   └── lp/             # ランディングページ用
├── pages/
│   ├── api/            # APIエンドポイント
│   │   ├── embed/      # 埋め込みウィジェット用
│   │   └── cron/       # Cronジョブ
│   ├── dashboard/      # 管理画面
│   └── legal/          # 法的ページ
├── utils/
│   ├── makechain-*.ts  # チャット処理
│   ├── appointment.ts  # 予約処理
│   └── email.ts        # メール送信
├── docs/
│   └── contracts/      # 契約書テンプレート
└── supabase/
    └── migrations/     # DBマイグレーション
```

## チャットモード

| モード | 説明 |
|--------|------|
| `rag_only` | WEBサイト情報で質問回答（FAQ対応） |
| `appointment_only` | スプレッドシート連携で予約対応 |
| `hybrid` | 両方を使用（推奨） |

## デプロイ

Vercelへのデプロイ:

```bash
vercel --prod
```

## ライセンス

Proprietary - All Rights Reserved

## 運営

合同会社AMOR
- Web: https://yoyakuraku.com
- Email: info@yoyakuraku.com
