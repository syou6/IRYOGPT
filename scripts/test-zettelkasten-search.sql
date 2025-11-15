-- ============================================
-- Zettelkasten検索テスト用SQL
-- ============================================
-- このクエリで、Zettelkastenに関するドキュメントが正しく検索できるか確認します

-- 1. Zettelkastenという単語を含むドキュメントを確認
SELECT 
  id,
  LEFT(content, 300) as content_preview,
  metadata->>'fileName' as file_name,
  metadata->>'title' as title,
  site_id
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  AND (
    content ILIKE '%zettelkasten%' 
    OR content ILIKE '%ツェッテルカステン%'
    OR metadata->>'fileName' ILIKE '%zettelkasten%'
  )
LIMIT 10;

-- 2. 特定のファイル名で確認
SELECT 
  id,
  LEFT(content, 200) as content_preview,
  metadata->>'fileName' as file_name
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  AND metadata->>'fileName' LIKE '%zettelkasten%'
LIMIT 5;

-- 3. match_documents関数が正しく動作するかテスト
-- 注意: このクエリは実際のembeddingベクトルが必要なので、APIから実行する必要があります
-- ここでは関数の存在とシグネチャを確認します

-- match_documents関数のシグネチャ確認
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname = 'match_documents';

-- 4. site_idでフィルタされたドキュメントの数を確認
SELECT 
  COUNT(*) as total_documents,
  COUNT(CASE WHEN content ILIKE '%zettelkasten%' THEN 1 END) as zettelkasten_documents
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

-- 5. 埋め込みベクトルが正しく保存されているか確認
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

