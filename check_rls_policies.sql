-- RLSポリシーの確認用SQL
-- SupabaseのSQLエディタで実行してください

-- ============================================
-- 1. テーブルの存在確認とRLS有効化状態
-- ============================================
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('sites', 'training_jobs', 'documents')
ORDER BY tablename;

-- ============================================
-- 2. 各テーブルのRLSポリシー確認
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression
FROM pg_policies 
WHERE tablename IN ('sites', 'training_jobs', 'documents')
ORDER BY tablename, policyname;

-- ============================================
-- 3. sitesテーブルのポリシー詳細確認
-- ============================================
SELECT 
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'sites';

-- ============================================
-- 4. training_jobsテーブルのポリシー詳細確認
-- ============================================
SELECT 
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'training_jobs';

-- ============================================
-- 5. documentsテーブルのポリシー詳細確認
-- ============================================
SELECT 
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies 
WHERE tablename = 'documents';

-- ============================================
-- 6. テーブルが存在するか確認（別の方法）
-- ============================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sites', 'training_jobs', 'documents')
ORDER BY table_name;

