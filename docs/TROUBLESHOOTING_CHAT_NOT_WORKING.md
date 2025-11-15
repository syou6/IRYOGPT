# チャットが回答できない問題のトラブルシューティング

「提供された情報からは質問にお答えできません」というエラーが表示される場合の対処法です。

## 原因の確認

### 1. ドキュメントが正しく保存されているか確認

```sql
-- サイトのドキュメント数を確認
SELECT COUNT(*) as document_count
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;
```

**期待される結果**: 745件程度

### 2. 特定のキーワードを含むドキュメントを確認

```sql
-- Zettelkastenという単語を含むドキュメントを確認
SELECT 
  id,
  LEFT(content, 200) as content_preview,
  metadata->>'fileName' as file_name
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  AND content ILIKE '%zettelkasten%'
LIMIT 5;
```

### 3. match_documents関数の確認

```sql
-- match_documents関数のシグネチャ確認
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'match_documents';
```

**期待される結果**: `match_documents(query_embedding vector(512), match_count integer, filter jsonb, match_site_id uuid)`

### 4. 埋め込みベクトルが正しく保存されているか確認

```sql
-- 埋め込みベクトルの次元数を確認
SELECT 
  id,
  CASE 
    WHEN embedding IS NULL THEN 'NULL'
    WHEN array_length(embedding::float[], 1) = 512 THEN 'OK (512次元)'
    ELSE 'ERROR: ' || array_length(embedding::float[], 1)::text || '次元'
  END as embedding_status
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
LIMIT 10;
```

**期待される結果**: すべて `OK (512次元)`

## よくある問題と解決方法

### 問題1: match_documents関数が古いバージョン

**症状**: `match_site_id`パラメータが存在しない

**解決方法**: `schema_saas_step1.sql`の`match_documents`関数定義を再実行

```sql
-- SupabaseのSQLエディタで実行
-- schema_saas_step1.sql の 73-109行目をコピー＆ペースト
```

### 問題2: 埋め込みベクトルがNULL

**症状**: `embedding_status`が`NULL`と表示される

**解決方法**: 再学習を実行

```bash
npm run train:markdown 64301a5f-50e2-4bd4-8268-b682633a0857 docs/blogs-20251115T024613
```

### 問題3: Similarityスコアが低すぎる

**症状**: ドキュメントは取得されているが、similarityスコアが0.7未満

**解決方法**: 一時的にsimilarityスコアの閾値を下げる（開発環境のみ）

`pages/api/embed/chat.ts`の164行目を変更：

```typescript
// 変更前
const SIMILARITY_THRESHOLD = 0.7;

// 変更後（テスト用）
const SIMILARITY_THRESHOLD = 0.5;
```

**注意**: 本番環境では元に戻してください。

### 問題4: site_idが正しく設定されていない

**症状**: ドキュメントの`site_id`がNULL

**解決方法**: ドキュメントのsite_idを確認

```sql
-- site_idがNULLのドキュメントを確認
SELECT COUNT(*) as null_site_id_count
FROM documents
WHERE site_id IS NULL;
```

NULLの場合は、再学習を実行してください。

## デバッグ方法

### 1. APIログを確認

開発環境でチャットAPIを実行すると、コンソールに以下のログが表示されます：

```
[RAG] Retrieved X documents for site_id: ...
[RAG] Similarity scores: [...]
[RAG] Average similarity: ...
```

### 2. 手動で検索をテスト

SupabaseのSQLエディタで、実際のembeddingベクトルを使って検索：

```sql
-- 注意: このクエリは実際のembeddingベクトルが必要です
-- APIから取得したembeddingベクトルを使用してください

-- 例: クエリ「Zettelkastenとは何ですか」のembeddingベクトルを取得
-- （実際にはAPIから取得する必要があります）
```

### 3. 直接ドキュメントを確認

```sql
-- Zettelkastenに関するドキュメントの内容を確認
SELECT 
  content,
  metadata
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  AND content ILIKE '%zettelkasten%'
LIMIT 1;
```

## 次のステップ

1. 上記の確認クエリを実行
2. 問題が見つかった場合は、該当する解決方法を実行
3. 再テスト

問題が解決しない場合は、APIログとデータベースの状態を確認して、さらに詳しく調査する必要があります。

