# 🗄️ Parole Phase 1 データベースマイグレーションガイド

## 概要

Parole機能 Phase 1のデータベースマイグレーション手順です。

---

## 📋 マイグレーション前の確認

### **1. Supabaseプロジェクトの確認**

- Supabaseダッシュボードにログイン
- プロジェクトのデータベースURLを確認
- SQL Editorにアクセスできることを確認

### **2. バックアップの取得（推奨）**

```sql
-- 既存のテーブル構造を確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

---

## 🚀 マイグレーション実行手順

### **Step 1: マイグレーションファイルの確認**

```bash
# マイグレーションファイルを確認
cat supabase/migrations/20241201_add_chat_logs_phase1.sql
```

### **Step 2: Supabaseダッシュボードで実行**

1. Supabaseダッシュボードにログイン
2. 左メニューから「SQL Editor」を選択
3. 「New query」をクリック
4. `supabase/migrations/20241201_add_chat_logs_phase1.sql` の内容をコピー＆ペースト
5. 「Run」ボタンをクリック

### **Step 3: 実行結果の確認**

エラーが表示されないことを確認してください。

---

## ✅ マイグレーション後の確認

### **1. テーブルの確認**

```sql
-- chat_logsテーブルが作成されたか確認
SELECT * FROM chat_logs LIMIT 1;

-- テーブル構造の確認
\d chat_logs
```

### **2. インデックスの確認**

```sql
-- インデックスが作成されたか確認
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'chat_logs';
```

### **3. RLSポリシーの確認**

```sql
-- RLSポリシーが設定されたか確認
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'chat_logs';
```

### **4. 関数の確認**

```sql
-- 関数が作成されたか確認
SELECT proname 
FROM pg_proc 
WHERE proname LIKE 'get_question%' 
   OR proname LIKE 'get_keyword%'
   OR proname LIKE 'get_timeline%';

-- 関数の詳細を確認
\df get_question_ranking
\df get_keyword_frequency
\df get_question_timeline
```

---

## 🧪 動作確認テスト

### **1. テーブルへの挿入テスト**

```sql
-- テストデータの挿入（実際のuser_idとsite_idを使用）
INSERT INTO chat_logs (
  user_id,
  site_id,
  question,
  answer,
  session_id,
  source
) VALUES (
  'your-user-id-here'::uuid,
  'your-site-id-here'::uuid,
  'テスト質問',
  'テスト回答',
  'test-session-123',
  'dashboard'
);

-- 挿入されたデータを確認
SELECT * FROM chat_logs WHERE question = 'テスト質問';
```

### **2. 関数の動作確認**

```sql
-- 質問ランキング関数のテスト
SELECT * FROM get_question_ranking(
  'your-site-id-here'::uuid,
  NULL,
  NULL,
  10
);

-- キーワード出現頻度関数のテスト
SELECT * FROM get_keyword_frequency(
  'your-site-id-here'::uuid,
  NULL,
  NULL,
  20
);

-- 時系列データ関数のテスト
SELECT * FROM get_question_timeline(
  'your-site-id-here'::uuid,
  NULL,
  NULL,
  'day'
);
```

---

## ⚠️ トラブルシューティング

### **エラー1: テーブルが既に存在する**

```sql
-- テーブルを削除してから再実行（注意: データが失われます）
DROP TABLE IF EXISTS chat_logs CASCADE;
-- その後、マイグレーションファイルを再実行
```

### **エラー2: 外部キー制約エラー**

```sql
-- auth.usersテーブルが存在するか確認
SELECT * FROM auth.users LIMIT 1;

-- sitesテーブルが存在するか確認
SELECT * FROM sites LIMIT 1;
```

### **エラー3: RLSポリシーのエラー**

```sql
-- RLSが有効になっているか確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'chat_logs';

-- RLSポリシーを確認
SELECT * FROM pg_policies WHERE tablename = 'chat_logs';
```

---

## 📝 次のステップ

マイグレーションが完了したら、次のステップに進みます：

1. ✅ **データベーススキーマ作成** ← 現在ここ
2. ⏭️ **チャットAPI修正** - `/api/chat` と `/api/embed/chat` にログ保存機能を追加
3. ⏭️ **分析APIの動作確認** - 既存のAPIエンドポイントをテスト
4. ⏭️ **ダッシュボードUI作成** - `/dashboard/[siteId]/insights` ページを作成

---

## 🔄 ロールバック手順

問題が発生した場合のロールバック手順：

```sql
-- 関数を削除
DROP FUNCTION IF EXISTS get_question_ranking(uuid, timestamptz, timestamptz, int);
DROP FUNCTION IF EXISTS get_keyword_frequency(uuid, timestamptz, timestamptz, int);
DROP FUNCTION IF EXISTS get_question_timeline(uuid, timestamptz, timestamptz, text);

-- RLSポリシーを削除
DROP POLICY IF EXISTS "Users can view their own chat logs" ON chat_logs;
DROP POLICY IF EXISTS "System can insert chat logs" ON chat_logs;
DROP POLICY IF EXISTS "Users can update their own chat logs" ON chat_logs;

-- テーブルを削除（注意: データが失われます）
DROP TABLE IF EXISTS chat_logs CASCADE;
```

---

## ✅ チェックリスト

- [ ] マイグレーションファイルを確認
- [ ] SupabaseダッシュボードでSQLを実行
- [ ] エラーがないことを確認
- [ ] テーブルが作成されたことを確認
- [ ] インデックスが作成されたことを確認
- [ ] RLSポリシーが設定されたことを確認
- [ ] 関数が作成されたことを確認
- [ ] 動作確認テストを実行

すべて完了したら、次のステップ（チャットAPI修正）に進みましょう！

