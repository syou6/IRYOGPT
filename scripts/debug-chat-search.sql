-- ============================================
-- チャット検索のデバッグ用SQL
-- ============================================

-- 1. match_documents関数のシグネチャ確認
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname = 'match_documents';

-- 2. match_documents関数の詳細定義確認
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'match_documents';

-- 3. 埋め込みベクトルの状態確認
SELECT 
  COUNT(*) as total_documents,
  COUNT(CASE WHEN embedding IS NULL THEN 1 END) as null_embeddings,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as has_embeddings
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

-- 3-2. ベクトルの次元数を確認（pgvector拡張の関数を使用）
-- 注意: vector_dims()関数が利用可能な場合
SELECT 
  id,
  CASE 
    WHEN embedding IS NULL THEN 'NULL'
    ELSE 'OK (vector型)'
  END as embedding_status
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
LIMIT 10;

-- 4. Zettelkastenを含むドキュメントの埋め込み状態
SELECT 
  id,
  CASE 
    WHEN embedding IS NULL THEN 'NULL'
    WHEN array_length(embedding::float[], 1) = 512 THEN 'OK'
    ELSE 'ERROR'
  END as embedding_status,
  LEFT(content, 100) as content_preview
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  AND content ILIKE '%zettelkasten%'
LIMIT 5;

-- 5. インデックスの確認
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'documents'
  AND indexname LIKE '%embedding%' OR indexname LIKE '%site_id%';

-- 6. サイトのステータス確認
SELECT 
  id,
  name,
  status,
  is_embed_enabled,
  last_trained_at
FROM sites
WHERE id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

