-- ============================================
-- 重複ドキュメントの削除用SQL
-- ============================================
-- 注意: 実行前に必ずバックアップを取ってください

-- 方法1: ファイル名 + 内容が完全に同じものを削除（推奨）
-- 同じファイル名で、同じ内容のドキュメントの2つ目以降を削除
DELETE FROM documents
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          site_id,
          metadata->>'fileName',
          content
        ORDER BY created_at ASC
      ) as rn
    FROM documents
    WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  ) t
  WHERE rn > 1
);

-- 削除後の確認
SELECT 
  COUNT(*) as remaining_documents,
  COUNT(DISTINCT metadata->>'fileName') as unique_files
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

