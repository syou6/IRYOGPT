-- ============================================
-- starterプランのユーザーのchat_quotaを1000に更新
-- ============================================

-- 更新前の状態を確認
SELECT 
  id,
  plan,
  chat_quota,
  embedding_quota,
  created_at
FROM users
WHERE plan = 'starter' AND chat_quota < 1000
ORDER BY created_at DESC;

-- 更新実行（コメントアウトを外して実行）
-- UPDATE users
-- SET chat_quota = 1000
-- WHERE plan = 'starter' AND chat_quota < 1000;

-- 更新後の確認
-- SELECT 
--   id,
--   plan,
--   chat_quota,
--   embedding_quota,
--   updated_at
-- FROM users
-- WHERE plan = 'starter'
-- ORDER BY updated_at DESC;

