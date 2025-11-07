-- Supabase RLS (Row Level Security) ポリシー設定
-- このファイルをSupabaseのSQLエディタで実行してください

-- ============================================
-- 1. sites テーブルのRLS設定
-- ============================================
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Allow site owner full access" ON sites;

-- サイト所有者は自分のサイトにフルアクセス可能
CREATE POLICY "Allow site owner full access"
ON sites FOR ALL
USING (auth.uid() = user_id);

-- ============================================
-- 2. training_jobs テーブルのRLS設定
-- ============================================
ALTER TABLE training_jobs ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Users can access jobs for their sites" ON training_jobs;

-- ユーザーは自分のサイトのジョブにアクセス可能
CREATE POLICY "Users can access jobs for their sites"
ON training_jobs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = training_jobs.site_id
    AND s.user_id = auth.uid()
  )
);

-- ============================================
-- 3. documents テーブルのRLS設定
-- ============================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Users can read their own site's documents" ON documents;

-- ユーザーは自分のサイトのドキュメントを読み取り可能
CREATE POLICY "Users can read their own site's documents"
ON documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sites s
    WHERE s.id = documents.site_id
    AND s.user_id = auth.uid()
  )
);

-- 注意: documentsテーブルへのINSERT/UPDATE/DELETEは
-- サービスロールキーを使ったAPI経由でのみ実行されるため、
-- SELECTポリシーのみで十分です

