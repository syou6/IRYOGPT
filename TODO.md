# WebGPT 医療予約チャットボット 改善計画

> 最終更新: 2025/01/28

## 現状サマリー

### 完了済み
- [x] Google Sheets API連携（`utils/google-sheets.ts`）
- [x] 予約管理ロジック（`utils/appointment.ts`）
- [x] OpenAI Function Calling ツール定義（`utils/prompts/medical-appointment.ts`）
- [x] チャットチェーン（`utils/makechain-appointment.ts`）
- [x] 予約API群（`pages/api/appointments/`）
- [x] 埋め込みチャットでの予約モード自動切り替え（`pages/api/embed/chat.ts`）
- [x] 管理画面でのスプレッドシートID設定UI（`pages/dashboard/sites/[siteId]/embed.tsx`）
- [x] Supabaseマイグレーション作成（`spreadsheet_id`カラム追加）

### 未完成・課題
- [ ] `getMedicalSystemPrompt()` のルール部分が不完全
- [ ] 定型文クイック選択機能なし
- [ ] 予約確認メール未実装
- [ ] 予約リマインド通知未実装
- [ ] 管理画面での予約一覧表示なし

---

## Phase 1: UX改善（優先度: 高）

### 1.1 定型文クイック選択機能
**目的**: ユーザーのタイピング負荷軽減 & API呼び出し最適化

#### タスク
- [ ] 埋め込みチャットUIにクイックボタン追加
  - ファイル: `public/embed-widget.js` or 該当コンポーネント
  - 表示: チャット開始時、会話の区切り時

- [ ] 定型文の種類を定義
  | 定型文 | スプレッドシート | 処理 |
  |--------|------------------|------|
  | 「予約したい」 | 不要 | 固定応答「ご希望の日時は？」 |
  | 「空き状況を確認」 | 必要 | 日付入力促す → API |
  | 「診療時間を知りたい」 | 必要 | `get_clinic_info` |
  | 「キャンセルしたい」 | 不要 | 固定応答（電話案内） |

- [ ] フロントで固定応答を返す仕組み
  - API呼び出し不要な質問は即座にレスポンス
  - コスト削減 & レスポンス高速化

- [ ] （オプション）管理画面で定型文カスタマイズ
  - `sites`テーブルに`quick_replies` JSONカラム追加

### 1.2 プロンプト改善
- [ ] `getMedicalSystemPrompt()` を完成させる
  - ファイル: `utils/prompts/medical-appointment.ts:8-29`
  - `MEDICAL_SYSTEM_PROMPT` の内容を動的関数にマージ

- [ ] 医院ごとのカスタムプロンプト対応
  - スプレッドシート「設定」シートから追加指示を読み込み
  - 例: 「初診の方には保険証持参を案内」

---

## Phase 2: 通知機能（優先度: 中）

### 2.1 予約確認メール自動送信
- [ ] メール送信サービス選定
  - 候補: SendGrid / AWS SES / Resend
  - 推奨: **Resend**（Next.js親和性高い、無料枠あり）

- [ ] `utils/email.ts` 作成
  - 予約完了時にメール送信
  - `createAppointment()` 成功後に呼び出し

- [ ] メールテンプレート
  ```
  件名: 【○○歯科】ご予約確認
  本文:
  - 日時: 2025/1/30 10:00
  - 患者名: 山田太郎 様
  - 医院住所・電話番号
  - キャンセルポリシー
  ```

- [ ] 管理画面でメール設定
  - 送信元アドレス設定
  - テンプレートカスタマイズ

### 2.2 予約リマインド通知（将来）
- [ ] リマインド送信タイミング設定（前日18:00など）
- [ ] Cron Job 実装（Vercel Cron / Supabase Edge Functions）
- [ ] LINE通知連携（LINE Messaging API）

---

## Phase 3: 管理機能強化（優先度: 中）

### 3.1 予約一覧・管理画面
- [ ] `/dashboard/[siteId]/appointments` ページ作成
  - 日別・週別の予約一覧表示
  - ステータス変更（確定→キャンセル）
  - 手動予約追加機能

- [ ] スプレッドシートとの双方向同期
  - 管理画面からの変更をスプレッドシートに反映

### 3.2 分析ダッシュボード
- [ ] 予約統計表示
  - 日別予約数グラフ
  - キャンセル率
  - 時間帯別人気度

- [ ] チャットログ分析
  - よくある質問ランキング
  - 予約完了率（チャット開始→予約成立）

---

## Phase 4: 拡張機能（優先度: 低）

### 4.1 複数カレンダー/担当者対応
- [ ] 複数シート対応（担当者別、診療科別）
- [ ] 担当者指名予約

### 4.2 外部システム連携
- [ ] Google Calendar API連携（オプション）
- [ ] 既存予約システム（EPARK等）API調査

### 4.3 多言語対応
- [ ] 英語プロンプト
- [ ] 中国語プロンプト

---

## 技術的負債・リファクタリング

- [ ] エラーハンドリング強化
  - スプレッドシート接続エラー時のフォールバック
  - ユーザーへの適切なエラーメッセージ

- [ ] テスト追加
  - `utils/appointment.ts` ユニットテスト
  - E2Eテスト（予約フロー）

- [ ] 型定義の整理
  - `types/appointment.ts` を作成して一元管理

- [ ] 環境変数バリデーション
  - 起動時にGoogle設定をチェック

---

## 環境構築チェックリスト

### 本番運用に必要な設定

#### Supabase
- [ ] マイグレーション実行
  ```bash
  # ローカルからpush
  supabase db push

  # または手動でSQL実行
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS spreadsheet_id TEXT;
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS clinic_type TEXT;
  ```

#### Google Cloud
- [ ] 環境変数設定
  ```env
  GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
  GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  ```

#### スプレッドシート
- [ ] テンプレート準備
  - 「設定」シート（医院名、診療時間など）
  - 「予約表」シート（日付、時間、患者名...）
  - 「休診日」シート

- [ ] サービスアカウントに編集権限付与

---

## 優先度まとめ

| 優先度 | タスク | 工数目安 |
|--------|--------|----------|
| 🔴 高 | 定型文クイック選択 | 1-2日 |
| 🔴 高 | プロンプト完成 | 0.5日 |
| 🟡 中 | 予約確認メール | 1日 |
| 🟡 中 | 予約一覧画面 | 2日 |
| 🟢 低 | リマインド通知 | 2日 |
| 🟢 低 | 分析ダッシュボード | 3日 |

---

## 次のアクション

1. **Phase 1.2** `getMedicalSystemPrompt()` を完成させる
2. **Phase 1.1** 定型文クイック選択機能の実装
   - 埋め込みウィジェットのコード確認
   - クイックボタンUI追加

---

## ファイル構成（現在）

```
pages/
├── api/
│   ├── appointments/           # ✅ 完了
│   │   ├── available-slots.ts
│   │   ├── create.ts
│   │   ├── cancel.ts
│   │   └── chat.ts
│   └── embed/
│       └── chat.ts             # ✅ 予約モード統合済み
├── dashboard/
│   └── sites/[siteId]/
│       └── embed.tsx           # ✅ スプレッドシートID設定UI

utils/
├── google-sheets.ts            # ✅ 完了
├── appointment.ts              # ✅ 完了
├── makechain-appointment.ts    # ✅ 完了
└── prompts/
    └── medical-appointment.ts  # ⚠️ 一部未完成

supabase/
└── migrations/
    └── 20250124_add_spreadsheet_id.sql  # ✅ 作成済み
```

---

## 進捗管理

| Phase | ステータス | 備考 |
|-------|----------|------|
| Phase 1.1 定型文 | ✅ 完了 | クイックボタン実装済み |
| Phase 1.2 プロンプト | ✅ 完了 | getMedicalSystemPrompt()完成 |
| Phase 2 通知 | ✅ 完了 | Resend + 予約確認メール実装済み |
| Phase 3 管理機能 | ✅ 完了 | 予約一覧 + キャンセル機能実装済み |
| Phase 4 拡張 | 🔲 未着手 | |
| **Phase 5 ハイブリッドモード** | 🔲 未着手 | RAG + 予約の統合 |

---

## Phase 5: ハイブリッドモード実装（優先度: 高）

> 詳細仕様: `CLAUDE.md` 「ハイブリッドモード機能仕様書」参照

### 概要

予約機能（スプレッドシート）とRAG機能（WEBサイト情報）を組み合わせ、
患者が予約を取りながら、診療内容・アクセス情報なども回答できるようにする。

---

### Step 1: DBマイグレーション（0.5h）

- [ ] `chat_mode` カラム追加のマイグレーション作成
  ```sql
  -- supabase/migrations/20250128_add_chat_mode.sql
  ALTER TABLE sites ADD COLUMN chat_mode TEXT DEFAULT 'rag_only';
  -- 値: 'rag_only' | 'appointment_only' | 'hybrid'
  ```

- [ ] ローカルでマイグレーション適用テスト
  ```bash
  supabase db push
  ```

**成果物**: `supabase/migrations/20250128_add_chat_mode.sql`

---

### Step 2: ハイブリッドチェーン作成（2h）

- [ ] `utils/makechain-hybrid.ts` 新規作成
  - RAG検索関数の実装
  - RAGコンテキスト構築
  - 予約ツール統合
  - ストリーミング対応

- [ ] RAG検索の実装
  ```typescript
  async function searchRAG(siteId: string, query: string): Promise<string> {
    // ベクトル検索
    // 類似度 >= 0.6 のチャンク取得
    // 上位1-2件（約500トークン）
    // 見つからない場合: "WEBサイト情報は見つかりませんでした"
  }
  ```

- [ ] ハイブリッド用システムプロンプト作成
  ```typescript
  function getHybridSystemPrompt(ragContext: string): string {
    return `あなたは医療機関の予約受付AIアシスタントです。

    【医院のWEBサイト情報】
    ${ragContext}

    【本日の日付】
    ${todayInfo}

    【重要なルール】
    ...`;
  }
  ```

- [ ] `runHybridChat()` 関数作成
  - ① RAG検索実行
  - ② コンテキスト構築
  - ③ LLM + Function Calling
  - ④ ストリーミングレスポンス

**成果物**: `utils/makechain-hybrid.ts`

---

### Step 3: ダッシュボードAPI対応（1h）

- [ ] `pages/api/chat.ts` 修正
  - サイトの `chat_mode` を取得
  - モードに応じて処理を分岐

  ```typescript
  // モード判定
  if (site.chat_mode === 'hybrid') {
    return handleHybridChat(...);
  } else if (site.chat_mode === 'appointment_only') {
    return handleAppointmentChat(...);
  } else {
    // 従来のRAGのみ処理
  }
  ```

- [ ] エラーハンドリング実装
  - RAG検索失敗 → 予約機能のみで続行
  - スプレッドシート接続失敗 → RAG情報のみで回答

**成果物**: `pages/api/chat.ts` 更新

---

### Step 4: 埋め込みAPI対応（1h）

- [ ] `pages/api/embed/chat.ts` 修正
  - ダッシュボードAPIと同様のモード分岐
  - ハイブリッドモード処理追加

- [ ] エラーハンドリング実装

**成果物**: `pages/api/embed/chat.ts` 更新

---

### Step 5: 管理画面UI追加（1h）

- [ ] `pages/dashboard/sites/[siteId]/embed.tsx` 修正
  - チャットモード選択ドロップダウン追加

  ```tsx
  <label>チャットモード</label>
  <select value={chatMode} onChange={...}>
    <option value="rag_only">RAGのみ（WEBサイト情報で回答）</option>
    <option value="appointment_only">予約のみ（スプレッドシート連携）</option>
    <option value="hybrid">ハイブリッド（両方使用）★推奨</option>
  </select>
  ```

- [ ] スプレッドシートID入力の条件付き表示
  - `appointment_only` または `hybrid` 選択時のみ表示

- [ ] 保存API呼び出し修正
  - `chat_mode` を含めて保存

**成果物**: `pages/dashboard/sites/[siteId]/embed.tsx` 更新

---

### Step 6: テスト・動作確認（1h）

- [ ] ダッシュボードチャットでテスト
  - RAGのみモード → WEBサイト情報のみで回答
  - 予約のみモード → スプレッドシートのみ
  - ハイブリッドモード → 両方使用

- [ ] 埋め込みウィジェットでテスト
  - 各モードの動作確認

- [ ] エラーケーステスト
  - スプレッドシートID未設定時
  - RAG検索結果なし時
  - スプレッドシート接続エラー時

- [ ] パフォーマンス確認
  - レスポンス時間計測（目標: 5秒以内）

**成果物**: 動作確認完了

---

### 実装順序チェックリスト

```
□ Step 1: DBマイグレーション
    └── chat_modeカラム追加
□ Step 2: ハイブリッドチェーン
    ├── RAG検索関数
    ├── システムプロンプト
    └── runHybridChat()
□ Step 3: ダッシュボードAPI
    └── /api/chat.ts モード分岐
□ Step 4: 埋め込みAPI
    └── /api/embed/chat.ts モード分岐
□ Step 5: 管理画面UI
    └── モード選択ドロップダウン
□ Step 6: テスト
    └── 各モード動作確認
```

---

### 工数見積もり

| Step | 内容 | 工数 |
|------|------|------|
| Step 1 | DBマイグレーション | 0.5h |
| Step 2 | ハイブリッドチェーン作成 | 2h |
| Step 3 | ダッシュボードAPI対応 | 1h |
| Step 4 | 埋め込みAPI対応 | 1h |
| Step 5 | 管理画面UI追加 | 1h |
| Step 6 | テスト・動作確認 | 1h |
| **合計** | | **6.5h** |

---

### 依存関係

```
Step 1 (DB)
    ↓
Step 2 (チェーン) ─────────────────┐
    ↓                              ↓
Step 3 (Dashboard API)    Step 4 (Embed API)
    ↓                              ↓
    └──────────┬───────────────────┘
               ↓
         Step 5 (UI)
               ↓
         Step 6 (テスト)
```

Step 3 と Step 4 は並列実行可能。

---

### ファイル構成（実装後）

```
utils/
├── makechain.ts                # 既存: RAGのみ
├── makechain-appointment.ts    # 既存: 予約のみ
└── makechain-hybrid.ts         # 🆕 新規: ハイブリッド

pages/api/
├── chat.ts                     # 📝 更新: モード分岐追加
└── embed/
    └── chat.ts                 # 📝 更新: モード分岐追加

pages/dashboard/sites/[siteId]/
└── embed.tsx                   # 📝 更新: モード選択UI

supabase/migrations/
└── 20250128_add_chat_mode.sql  # 🆕 新規: chat_modeカラム
```
