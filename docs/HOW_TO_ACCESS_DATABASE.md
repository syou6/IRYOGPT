# データベースの確認方法

Supabaseデータベースを確認する方法を説明します。

## 方法1: Supabaseダッシュボード（推奨）

### 1. Supabaseダッシュボードにアクセス

1. **Supabaseダッシュボードにログイン**
   - https://app.supabase.com にアクセス
   - プロジェクトを選択

2. **プロジェクトURLの確認**
   - 環境変数から確認: `NEXT_PUBLIC_SUPABASE_URL`
   - 例: `https://xfasaolwgndciunmkcxy.supabase.co`
   - ダッシュボードのURL: `https://app.supabase.com/project/xfasaolwgndciunmkcxy`

### 2. SQLエディタで確認

1. **SQLエディタを開く**
   - 左メニューから「SQL Editor」を選択
   - 「New query」をクリック

2. **クエリを実行**
   - 以下のSQLをコピー＆ペースト
   - 「Run」ボタンをクリック

#### サイト情報とドキュメント数の確認

```sql
-- サイト情報とドキュメント数を確認
SELECT 
  s.id as site_id,
  s.name as site_name,
  s.status,
  s.base_url,
  s.last_trained_at,
  COUNT(d.id) as document_count
FROM sites s
LEFT JOIN documents d ON s.id = d.site_id
WHERE s.id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
GROUP BY s.id, s.name, s.status, s.base_url, s.last_trained_at;
```

#### ドキュメントの詳細確認

```sql
-- 保存されたドキュメントのサンプルを確認
SELECT 
  id,
  LEFT(content, 200) as content_preview,
  metadata->>'title' as title,
  metadata->>'fileName' as file_name,
  created_at
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
ORDER BY created_at DESC
LIMIT 10;
```

#### 統計情報の確認

```sql
-- ドキュメントの統計情報
SELECT 
  COUNT(*) as total_chunks,
  COUNT(DISTINCT metadata->>'fileName') as unique_files,
  AVG(LENGTH(content)) as avg_content_length
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;
```

### 3. Table Editorで確認

1. **Table Editorを開く**
   - 左メニューから「Table Editor」を選択
   - テーブル一覧から確認したいテーブルを選択

2. **確認できるテーブル**
   - `sites` - サイト情報
   - `documents` - 学習済みドキュメント
   - `training_jobs` - 学習ジョブ履歴
   - `users` - ユーザー情報
   - `chat_logs` - チャットログ（Parole機能）

3. **フィルター機能**
   - テーブル上部のフィルターアイコンをクリック
   - `site_id` でフィルターを設定可能

## 方法2: プロジェクトのSQLファイルを使用

プロジェクト内のSQLファイルをSupabaseのSQLエディタで実行：

### 確認用SQLファイル

- `scripts/check-site-documents.sql` - サイトのドキュメント確認用
- `check_saas_step1.sql` - スキーマ確認用
- `check_rls_policies.sql` - RLSポリシー確認用

**使用方法：**
1. ファイルを開いて内容をコピー
2. SupabaseのSQLエディタに貼り付け
3. 「Run」ボタンをクリック

## 方法3: Supabase CLI（開発者向け）

### インストール

```bash
npm install -g supabase
```

### ログイン

```bash
supabase login
```

### プロジェクトをリンク

```bash
supabase link --project-ref xfasaolwgndciunmkcxy
```

### SQLを実行

```bash
# ファイルから実行
supabase db execute -f scripts/check-site-documents.sql

# 直接SQLを実行
supabase db execute "SELECT COUNT(*) FROM documents WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;"
```

## よくある確認クエリ

### すべてのサイトを確認

```sql
SELECT 
  id,
  name,
  base_url,
  status,
  is_embed_enabled,
  last_trained_at,
  created_at
FROM sites
ORDER BY created_at DESC;
```

### サイトごとのドキュメント数

```sql
SELECT 
  s.id,
  s.name,
  COUNT(d.id) as document_count
FROM sites s
LEFT JOIN documents d ON s.id = d.site_id
GROUP BY s.id, s.name
ORDER BY document_count DESC;
```

### 最近の学習ジョブ

```sql
SELECT 
  id,
  site_id,
  status,
  processed_pages,
  total_pages,
  created_at,
  finished_at
FROM training_jobs
ORDER BY created_at DESC
LIMIT 10;
```

### 特定のサイトのドキュメント一覧

```sql
SELECT 
  metadata->>'fileName' as file_name,
  COUNT(*) as chunk_count
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
GROUP BY metadata->>'fileName'
ORDER BY chunk_count DESC;
```

## トラブルシューティング

### SQLエディタにアクセスできない場合

1. プロジェクトのオーナーまたはコラボレーター権限があるか確認
2. ブラウザのキャッシュをクリア
3. 別のブラウザで試す

### テーブルが表示されない場合

1. 左メニューの「Table Editor」でテーブル一覧を確認
2. スキーマが `public` になっているか確認
3. RLSポリシーでアクセスが制限されていないか確認

### クエリが実行できない場合

1. SQLの構文エラーを確認
2. テーブル名やカラム名のスペルを確認
3. 権限があるか確認（Service Role Keyが必要な場合あり）

## 参考リンク

- [Supabaseダッシュボード](https://app.supabase.com)
- [Supabase SQL Editor ドキュメント](https://supabase.com/docs/guides/database/overview)
- [Supabase CLI ドキュメント](https://supabase.com/docs/guides/cli)

