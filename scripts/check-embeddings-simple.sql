-- ============================================
-- 埋め込みベクトルの簡単な確認用SQL
-- ============================================

-- 1. 基本的な状態確認
SELECT 
  COUNT(*) as total_documents,
  COUNT(CASE WHEN embedding IS NULL THEN 1 END) as null_embeddings,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as has_embeddings
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

-- 2. サンプルドキュメントの確認
SELECT 
  id,
  CASE 
    WHEN embedding IS NULL THEN 'NULL - 埋め込みなし'
    ELSE 'OK - 埋め込みあり'
  END as embedding_status,
  LEFT(content, 100) as content_preview
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
LIMIT 10;

-- 3. Zettelkastenを含むドキュメントの埋め込み状態
SELECT 
  id,
  CASE 
    WHEN embedding IS NULL THEN 'NULL'
    ELSE 'OK'
  END as embedding_status,
  metadata->>'fileName' as file_name
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  AND content ILIKE '%zettelkasten%'
LIMIT 5;

