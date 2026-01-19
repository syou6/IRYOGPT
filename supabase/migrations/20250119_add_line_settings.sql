-- LINE Messaging API 連携用のカラムとテーブルを追加

-- ==============================================
-- 1. sites テーブルに LINE 設定カラムを追加
-- ==============================================

-- LINE チャネルID
ALTER TABLE sites ADD COLUMN IF NOT EXISTS line_channel_id TEXT;

-- LINE チャネルシークレット（暗号化して保存推奨だが、まずはテキストで）
ALTER TABLE sites ADD COLUMN IF NOT EXISTS line_channel_secret TEXT;

-- LINE チャネルアクセストークン（暗号化して保存推奨だが、まずはテキストで）
ALTER TABLE sites ADD COLUMN IF NOT EXISTS line_channel_access_token TEXT;

-- LINE 連携有効フラグ
ALTER TABLE sites ADD COLUMN IF NOT EXISTS line_enabled BOOLEAN DEFAULT false;

-- コメント
COMMENT ON COLUMN sites.line_channel_id IS 'LINE Messaging API チャネルID';
COMMENT ON COLUMN sites.line_channel_secret IS 'LINE Messaging API チャネルシークレット';
COMMENT ON COLUMN sites.line_channel_access_token IS 'LINE Messaging API チャネルアクセストークン';
COMMENT ON COLUMN sites.line_enabled IS 'LINE連携を有効にするかどうか';

-- ==============================================
-- 2. line_users テーブル（LINEユーザーとサイトのマッピング）
-- ==============================================

CREATE TABLE IF NOT EXISTS line_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  status_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, line_user_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_line_users_site_id ON line_users(site_id);
CREATE INDEX IF NOT EXISTS idx_line_users_line_user_id ON line_users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_users_created_at ON line_users(created_at DESC);

-- コメント
COMMENT ON TABLE line_users IS 'LINE ユーザーとサイトのマッピングテーブル';
COMMENT ON COLUMN line_users.site_id IS '関連するサイトID';
COMMENT ON COLUMN line_users.line_user_id IS 'LINE ユーザーID';
COMMENT ON COLUMN line_users.display_name IS 'LINE 表示名';
COMMENT ON COLUMN line_users.picture_url IS 'LINE プロフィール画像URL';
COMMENT ON COLUMN line_users.status_message IS 'LINE ステータスメッセージ';

-- ==============================================
-- 3. RLS (Row Level Security) ポリシー
-- ==============================================

ALTER TABLE line_users ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のサイトのLINEユーザーのみ閲覧可能
DROP POLICY IF EXISTS "Users can view their own site line_users" ON line_users;
CREATE POLICY "Users can view their own site line_users"
  ON line_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = line_users.site_id
      AND sites.user_id = auth.uid()
    )
  );

-- システム（API）のみ挿入・更新可能
DROP POLICY IF EXISTS "System can insert line_users" ON line_users;
CREATE POLICY "System can insert line_users"
  ON line_users FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update line_users" ON line_users;
CREATE POLICY "System can update line_users"
  ON line_users FOR UPDATE
  USING (true);

-- ==============================================
-- 4. chat_logs テーブルに LINE 用の source 値を追加
-- ==============================================

-- source カラムのCHECK制約を更新（'line'を追加）
-- まず既存の制約を削除
ALTER TABLE chat_logs DROP CONSTRAINT IF EXISTS chat_logs_source_check;

-- 新しい制約を追加（'embed', 'dashboard', 'line'を許可）
ALTER TABLE chat_logs ADD CONSTRAINT chat_logs_source_check
  CHECK (source IN ('embed', 'dashboard', 'line'));

-- ==============================================
-- 5. 更新日時を自動更新するトリガー
-- ==============================================

-- 更新日時を自動更新する関数（既存の場合はスキップ）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- line_users テーブルのトリガー
DROP TRIGGER IF EXISTS update_line_users_updated_at ON line_users;
CREATE TRIGGER update_line_users_updated_at
  BEFORE UPDATE ON line_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
