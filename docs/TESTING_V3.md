# 🧪 v3機能テストガイド

## 📋 テスト項目

### 1. `/api/chat` のクォータチェックとusage_logs記録

#### テスト手順

1. **開発サーバーを起動**
   ```bash
   npm run dev
   ```

2. **ブラウザでダッシュボードにアクセス**
   - http://localhost:3000/dashboard にアクセス
   - ログイン（既存のアカウントまたは新規作成）

3. **チャットを送信**
   - 学習済みのサイトを選択
   - チャット画面で質問を送信
   - 正常に応答が返ってくることを確認

4. **usage_logsの確認**
   - Supabaseダッシュボード → Table Editor → `usage_logs` を開く
   - 以下のレコードが作成されていることを確認：
     - `action: 'chat'` - チャットの使用ログ
     - `action: 'embedding'` - embeddingの使用ログ
   - `tokens_consumed` と `cost_usd` が記録されていることを確認

5. **クォータチェックの確認**
   - Supabase SQL Editorで以下を実行：
   ```sql
   -- 現在のユーザーの使用状況を確認
   SELECT * FROM get_monthly_usage('YOUR_USER_ID'::uuid);
   
   -- クォータを確認
   SELECT * FROM users WHERE id = 'YOUR_USER_ID'::uuid;
   ```

6. **クォータ超過のテスト（オプション）**
   - `users`テーブルで`chat_quota`を1に設定
   - チャットを1回送信
   - 2回目のチャットでクォータ超過エラーが表示されることを確認

#### 確認ポイント

- ✅ チャットが正常に動作する
- ✅ `usage_logs`に`chat`と`embedding`のレコードが作成される
- ✅ トークン数とコストが正しく計算されている
- ✅ クォータ超過時にエラーメッセージが表示される
- ✅ ブラウザのコンソールにエラーが表示されない

---

## 🔍 デバッグ方法

### サーバー側のログ確認

開発サーバーのターミナルで以下のログが表示されます：

```
[Chat API] Starting chain invoke for question: ...
[Chat API] Chain invoke completed { inputTokens: ..., outputTokens: ..., costUsd: ... }
[Chat API] Sending [DONE]
```

### ブラウザのコンソール確認

開発環境では以下のログが表示されます：

```
[Chat] Connection opened
[Chat] Received message: ...
[Chat] Adding token: ...
[Chat] Stream completed, final pending length: ...
```

### Supabaseでの確認

```sql
-- 最新のusage_logsを確認
SELECT 
  action,
  model_name,
  tokens_consumed,
  cost_usd,
  created_at,
  metadata
FROM usage_logs
ORDER BY created_at DESC
LIMIT 10;

-- 月間使用量を確認
SELECT * FROM get_monthly_usage('YOUR_USER_ID'::uuid);
```

---

## ⚠️ トラブルシューティング

### 問題: クォータチェックでエラーが発生する

**原因**: `check_quota`関数が存在しない、または`users`テーブルにユーザーが存在しない

**解決方法**:
1. `schema_saas_step3_v3.sql`が実行されているか確認
2. Supabase SQL Editorで以下を実行：
   ```sql
   -- 関数が存在するか確認
   SELECT proname FROM pg_proc WHERE proname = 'check_quota';
   
   -- ユーザーが存在するか確認
   SELECT * FROM users;
   ```

### 問題: usage_logsに記録されない

**原因**: エラーが発生している、または`usage_logs`テーブルが存在しない

**解決方法**:
1. サーバーのログを確認
2. Supabaseで`usage_logs`テーブルが存在するか確認
3. RLSポリシーが正しく設定されているか確認

### 問題: トークン数が0になる

**原因**: `outputText`が空、またはストリーミングが正常に動作していない

**解決方法**:
1. ストリーミングが正常に動作しているか確認
2. `outputText`に値が入っているか確認（デバッグログで確認）

---

## 📊 期待される結果

### usage_logsテーブル

チャット1回あたり、以下のレコードが作成されます：

1. **chatレコード**
   - `action: 'chat'`
   - `model_name: 'gpt-4o-mini'`
   - `tokens_consumed: 100-500`（概算）
   - `cost_usd: 0.0001-0.001`（概算）

2. **embeddingレコード**
   - `action: 'embedding'`
   - `model_name: 'text-embedding-3-small'`
   - `tokens_consumed: 512`（概算）
   - `cost_usd: 0.00001`（概算）

---

## ✅ チェックリスト

- [ ] 開発サーバーが起動している
- [ ] ログインしてダッシュボードにアクセスできる
- [ ] 学習済みのサイトがある
- [ ] チャットを送信できる
- [ ] 応答が正常に表示される
- [ ] `usage_logs`にレコードが作成される
- [ ] トークン数とコストが記録されている
- [ ] クォータ超過エラーが正しく表示される（テスト時）







