-- ============================================
-- 埋め込みAPIテスト用サイトの確認SQL
-- ============================================

-- 1. すべてのサイトの状態を確認
SELECT 
  id,
  name,
  base_url,
  status,
  is_embed_enabled,
  user_id,
  created_at,
  last_trained_at,
  CASE 
    WHEN status = 'ready' AND is_embed_enabled = true THEN '✅ テスト可能'
    WHEN status = 'ready' AND is_embed_enabled = false THEN '⚠️  is_embed_enabledをtrueに設定'
    WHEN status != 'ready' THEN '⚠️  学習が必要（statusをreadyに）'
    ELSE '❌ 設定が必要'
  END as test_status
FROM sites
ORDER BY created_at DESC;

-- 2. 各サイトのドキュメント数を確認
SELECT 
  s.id as site_id,
  s.name as site_name,
  s.status,
  s.is_embed_enabled,
  COUNT(d.id) as document_count,
  CASE 
    WHEN s.status = 'ready' AND s.is_embed_enabled = true AND COUNT(d.id) > 0 
    THEN '✅ テスト可能'
    WHEN COUNT(d.id) = 0 THEN '⚠️  ドキュメントなし（学習が必要）'
    WHEN s.is_embed_enabled = false THEN '⚠️  is_embed_enabledをtrueに設定'
    WHEN s.status != 'ready' THEN '⚠️  学習が必要（statusをreadyに）'
    ELSE '❌ 設定が必要'
  END as test_status
FROM sites s
LEFT JOIN documents d ON s.id = d.site_id
GROUP BY s.id, s.name, s.status, s.is_embed_enabled
ORDER BY s.created_at DESC;

-- 3. 特定のサイトIDで詳細確認（YOUR_SITE_IDを実際のIDに置き換える）
-- SELECT 
--   s.id,
--   s.name,
--   s.status,
--   s.is_embed_enabled,
--   COUNT(d.id) as document_count,
--   CASE 
--     WHEN s.status = 'ready' AND s.is_embed_enabled = true AND COUNT(d.id) > 0 
--     THEN '✅ テスト可能'
--     ELSE '❌ 設定が必要'
--   END as test_status
-- FROM sites s
-- LEFT JOIN documents d ON s.id = d.site_id
-- WHERE s.id = 'YOUR_SITE_ID'::uuid
-- GROUP BY s.id, s.name, s.status, s.is_embed_enabled;

-- 4. サイトをテスト可能な状態に設定（YOUR_SITE_IDを実際のIDに置き換える）
-- UPDATE sites
-- SET 
--   is_embed_enabled = true,
--   status = 'ready'
-- WHERE id = 'YOUR_SITE_ID'::uuid
-- RETURNING id, name, status, is_embed_enabled;






