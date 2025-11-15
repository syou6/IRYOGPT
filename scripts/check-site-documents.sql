-- ============================================
-- サイトのドキュメント確認用SQL
-- ============================================

-- 特定のサイトIDのドキュメント数を確認
-- サイトID: 64301a5f-50e2-4bd4-8268-b682633a0857

-- 1. サイト情報とドキュメント数の確認
SELECT 
  s.id as site_id,
  s.name as site_name,
  s.status,
  s.base_url,
  s.last_trained_at,
  COUNT(d.id) as document_count,
  CASE 
    WHEN COUNT(d.id) > 0 THEN '✅ ドキュメントあり'
    ELSE '❌ ドキュメントなし'
  END as status_check
FROM sites s
LEFT JOIN documents d ON s.id = d.site_id
WHERE s.id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
GROUP BY s.id, s.name, s.status, s.base_url, s.last_trained_at;

-- 2. ドキュメントの詳細確認（最初の10件）
SELECT 
  id,
  LEFT(content, 100) as content_preview,
  metadata->>'title' as title,
  metadata->>'fileName' as file_name,
  metadata->>'source' as source,
  created_at
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
ORDER BY created_at DESC
LIMIT 10;

-- 3. ドキュメントの統計情報
SELECT 
  COUNT(*) as total_documents,
  COUNT(DISTINCT metadata->>'fileName') as unique_files,
  AVG(LENGTH(content)) as avg_content_length,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

-- 4. ファイル名別のドキュメント数
SELECT 
  metadata->>'fileName' as file_name,
  COUNT(*) as chunk_count,
  SUM(LENGTH(content)) as total_length
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
GROUP BY metadata->>'fileName'
ORDER BY chunk_count DESC
LIMIT 20;

