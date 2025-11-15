-- ============================================
-- 全削除して再学習するためのSQL
-- ============================================
-- 注意: 実行前に必ずバックアップを取ってください

-- 1. バックアップ（オプション）
CREATE TABLE IF NOT EXISTS documents_backup_64301a5f AS 
SELECT * FROM documents 
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

-- 2. 既存のドキュメントを全削除
DELETE FROM documents 
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

-- 3. 削除後の確認
SELECT 
  COUNT(*) as remaining_documents,
  COUNT(DISTINCT metadata->>'fileName') as unique_files
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

-- 期待される結果: remaining_documents = 0, unique_files = 0

-- 4. 再学習を実行
-- ターミナルで以下を実行:
-- pnpm run train:markdown 64301a5f-50e2-4bd4-8268-b682633a0857 docs/blogs-20251115T024613

