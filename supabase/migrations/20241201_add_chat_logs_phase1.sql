-- ============================================
-- Parole機能 Phase 1: chat_logsテーブル作成
-- チャットボットの質問と回答を保存するテーブル
-- Phase 1ではベクトル機能は含まない
-- ============================================

-- 1. chat_logs テーブル作成
CREATE TABLE IF NOT EXISTS chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  
  -- 質問と回答
  question text NOT NULL,
  answer text NOT NULL,
  
  -- メタデータ
  session_id text, -- セッション追跡用（将来的に購入前/後判定に使用）
  source text DEFAULT 'embed' CHECK (source IN ('embed', 'dashboard')), -- 質問の発生元
  user_agent text, -- ユーザーエージェント
  referrer text, -- リファラー
  
  -- タグ（将来的に拡張）
  tags jsonb DEFAULT '[]'::jsonb, -- ['購入前', '価格', '機能'] など
  
  -- ベクトルとクラスタリングはPhase 2で追加
  -- question_embedding vector(512), -- Phase 2で追加
  -- cluster_id uuid, -- Phase 2で追加
  
  created_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id ON chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_site_id ON chat_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_session_id ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_source ON chat_logs(source);

-- 全文検索用インデックス（質問の検索を高速化）
CREATE INDEX IF NOT EXISTS idx_chat_logs_question_search ON chat_logs USING gin(to_tsvector('japanese', question));

-- コメント
COMMENT ON TABLE chat_logs IS 'チャットボットの質問と回答を保存するテーブル（Parole機能 Phase 1）';
COMMENT ON COLUMN chat_logs.question IS 'ユーザーの質問内容';
COMMENT ON COLUMN chat_logs.answer IS 'AIの回答内容';
COMMENT ON COLUMN chat_logs.session_id IS 'セッションID（購入前/後判定に使用）';
COMMENT ON COLUMN chat_logs.source IS '質問の発生元: embed（埋め込み）またはdashboard（ダッシュボード）';
COMMENT ON COLUMN chat_logs.tags IS 'タグ配列（例: ["購入前", "価格", "機能"]）';

-- ============================================
-- 2. RLS (Row Level Security) ポリシー
-- ============================================

ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のサイトのログのみ閲覧可能
DROP POLICY IF EXISTS "Users can view their own chat logs" ON chat_logs;
CREATE POLICY "Users can view their own chat logs"
  ON chat_logs FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = chat_logs.site_id
      AND sites.user_id = auth.uid()
    )
  );

-- システム（API）のみログを挿入可能
DROP POLICY IF EXISTS "System can insert chat logs" ON chat_logs;
CREATE POLICY "System can insert chat logs"
  ON chat_logs FOR INSERT
  WITH CHECK (true); -- API経由でのみ挿入されるため、認証はAPI層で行う

-- ユーザーは自分のログを更新可能（タグ付けなど）
DROP POLICY IF EXISTS "Users can update their own chat logs" ON chat_logs;
CREATE POLICY "Users can update their own chat logs"
  ON chat_logs FOR UPDATE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = chat_logs.site_id
      AND sites.user_id = auth.uid()
    )
  );

-- ============================================
-- 3. 便利な関数（分析用）
-- ============================================

-- 質問ランキングを取得する関数
CREATE OR REPLACE FUNCTION get_question_ranking(
  p_site_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  question text,
  count bigint,
  first_asked_at timestamptz,
  last_asked_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.question,
    COUNT(*)::bigint as count,
    MIN(cl.created_at) as first_asked_at,
    MAX(cl.created_at) as last_asked_at
  FROM chat_logs cl
  WHERE cl.site_id = p_site_id
    AND (p_start_date IS NULL OR cl.created_at >= p_start_date)
    AND (p_end_date IS NULL OR cl.created_at <= p_end_date)
  GROUP BY cl.question
  ORDER BY count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- キーワード出現頻度を取得する関数（簡易版）
CREATE OR REPLACE FUNCTION get_keyword_frequency(
  p_site_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  keyword text,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH words AS (
    SELECT unnest(string_to_array(lower(regexp_replace(cl.question, '[^\w\s]', '', 'g')), ' ')) as word
    FROM chat_logs cl
    WHERE cl.site_id = p_site_id
      AND (p_start_date IS NULL OR cl.created_at >= p_start_date)
      AND (p_end_date IS NULL OR cl.created_at <= p_end_date)
      AND length(cl.question) > 0
  ),
  filtered_words AS (
    SELECT word
    FROM words
    WHERE length(word) > 2 -- 2文字以下の単語を除外
      AND word NOT IN ('の', 'は', 'を', 'に', 'が', 'と', 'で', 'も', 'から', 'まで', 'より', 'など', 'について', 'です', 'ます', 'する', 'した', 'ある', 'ない') -- ストップワード
  )
  SELECT 
    word as keyword,
    COUNT(*)::bigint as count
  FROM filtered_words
  GROUP BY word
  ORDER BY count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 時系列データを取得する関数
CREATE OR REPLACE FUNCTION get_question_timeline(
  p_site_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_interval text DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS TABLE (
  period_start timestamptz,
  question_count bigint
) AS $$
DECLARE
  v_interval_expression text;
BEGIN
  -- インターバルに応じた日付切り捨て式を設定
  CASE p_interval
    WHEN 'day' THEN
      v_interval_expression := 'date_trunc(''day'', created_at)';
    WHEN 'week' THEN
      v_interval_expression := 'date_trunc(''week'', created_at)';
    WHEN 'month' THEN
      v_interval_expression := 'date_trunc(''month'', created_at)';
    ELSE
      v_interval_expression := 'date_trunc(''day'', created_at)';
  END CASE;

  RETURN QUERY
  EXECUTE format('
    SELECT 
      %s as period_start,
      COUNT(*)::bigint as question_count
    FROM chat_logs
    WHERE site_id = $1
      AND ($2 IS NULL OR created_at >= $2)
      AND ($3 IS NULL OR created_at <= $3)
    GROUP BY period_start
    ORDER BY period_start ASC
  ', v_interval_expression)
  USING p_site_id, p_start_date, p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

