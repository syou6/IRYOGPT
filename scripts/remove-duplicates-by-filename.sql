-- ============================================
-- 重複ドキュメントの削除用SQL（ファイル名のみで判定）
-- ============================================
-- 注意: この方法は、同じファイル名のドキュメントをすべて削除して、最新のものだけを残します
-- 実行前に必ずバックアップを取ってください

-- 方法2: ファイル名だけで判定（同じファイル名の2つ目以降を削除）
-- 同じファイル名で、作成日時が古いものを削除
DELETE FROM documents
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          site_id,
          metadata->>'fileName'
        ORDER BY created_at DESC  -- 最新のものを残す
      ) as rn
    FROM documents
    WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid
  ) t
  WHERE rn > 1  -- 2つ目以降を削除
);

-- 削除後の確認
SELECT 
  COUNT(*) as remaining_documents,
  COUNT(DISTINCT metadata->>'fileName') as unique_files
FROM documents
WHERE site_id = '64301a5f-50e2-4bd4-8268-b682633a0857'::uuid;

