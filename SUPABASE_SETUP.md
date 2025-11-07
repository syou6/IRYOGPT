# Supabase設定ガイド

## 必要な設定

### 1. RLS (Row Level Security) ポリシーの設定

SupabaseのSQLエディタで `supabase_rls_policies.sql` を実行してください。

このファイルには以下のRLSポリシーが含まれています：

- **sitesテーブル**: ユーザーは自分のサイトのみアクセス可能
- **training_jobsテーブル**: ユーザーは自分のサイトのジョブのみアクセス可能
- **documentsテーブル**: ユーザーは自分のサイトのドキュメントのみ読み取り可能

### 2. スキーマの確認

`schema_saas_step1.sql` が既に実行されていることを確認してください。

このファイルには以下が含まれています：

- `sites` テーブルの作成
- `training_jobs` テーブルの作成
- `documents` テーブルへの `site_id` カラム追加
- `match_documents` 関数の `site_id` 対応

### 3. 確認方法

`check_rls_policies.sql` ファイルをSupabaseのSQLエディタで実行してください。

または、以下のSQLで設定を確認できます：

```sql
-- テーブルの存在確認とRLS有効化状態
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('sites', 'training_jobs', 'documents');

-- ポリシーを確認
SELECT tablename, policyname, cmd as command
FROM pg_policies 
WHERE tablename IN ('sites', 'training_jobs', 'documents')
ORDER BY tablename, policyname;
```

**結果の見方：**
- `rls_enabled` が `true` ならRLSが有効
- ポリシーが表示されれば設定済み
- 「No rows returned」の場合は、テーブルが存在しないか、ポリシーが未設定

## 注意事項

- RLSポリシーは、API RoutesでService Role Keyを使用している場合でも、フロントエンドからの直接アクセスを保護します
- `documents` テーブルへのINSERT/UPDATE/DELETEは、Service Role Keyを使ったAPI経由でのみ実行されます
- 既存の`documents`レコードは`site_id`がNULLのままです（後方互換性のため）

