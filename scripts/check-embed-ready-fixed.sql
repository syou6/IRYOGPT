-- ============================================
-- 埋め込みAPIテスト用サイトの確認SQL（修正版）
-- ============================================

-- 各サイトのドキュメント数を確認（テスト可能かどうかも表示）
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

