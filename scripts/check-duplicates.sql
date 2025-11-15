-- ============================================
-- 重複ドキュメントの確認用SQL
-- ============================================

-- 1. ファイル名ごとのドキュメント数を確認
SELECT 
  metadata->>'fileName' as file_name,
  COUNT(*) as document_count,
  COUNT(DISTINCT content) as unique_content_count
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
GROUP BY metadata->>'fileName'
HAVING COUNT(*) > 1
ORDER BY document_count DESC
LIMIT 20;

-- 2. 重複の詳細確認（同じファイル名で複数のドキュメントがある場合）
SELECT 
  id,
  metadata->>'fileName' as file_name,
  LEFT(content, 100) as content_preview,
  created_at
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  AND metadata->>'fileName' = 'zettelkastenとは-レポートが書けない原因を解決する最強のアイデア整理術.md'
ORDER BY created_at DESC;

-- 3. 全体の統計
SELECT 
  COUNT(*) as total_documents,
  COUNT(DISTINCT metadata->>'fileName') as unique_files,
  COUNT(*) / NULLIF(COUNT(DISTINCT metadata->>'fileName'), 0) as avg_chunks_per_file
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

