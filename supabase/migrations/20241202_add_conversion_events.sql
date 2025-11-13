-- ============================================
-- Parole機能 Phase 2: 購入前/購入後分析用テーブル作成
-- コンバージョンイベントを記録するテーブル
-- ============================================

-- 1. conversion_events テーブル作成
CREATE TABLE IF NOT EXISTS conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  
  -- セッション情報
  session_id text NOT NULL, -- チャットログのsession_idと紐づけ
  
  -- コンバージョン情報
  event_type text NOT NULL CHECK (event_type IN ('purchase', 'signup', 'trial_start', 'contact', 'download')), -- イベントタイプ
  event_value numeric DEFAULT 0, -- イベントの価値（購入金額など）
  currency text DEFAULT 'JPY', -- 通貨コード
  
  -- メタデータ
  metadata jsonb DEFAULT '{}'::jsonb, -- 追加情報（商品名、プラン名など）
  
  created_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_conversion_events_user_id ON conversion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_site_id ON conversion_events(site_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_session_id ON conversion_events(session_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_event_type ON conversion_events(event_type);
CREATE INDEX IF NOT EXISTS idx_conversion_events_created_at ON conversion_events(created_at DESC);

-- セッションIDとイベントタイプの複合インデックス（購入前/後分析で使用）
CREATE INDEX IF NOT EXISTS idx_conversion_events_session_type ON conversion_events(session_id, event_type);

-- コメント
COMMENT ON TABLE conversion_events IS 'コンバージョンイベントを記録するテーブル（購入前/後分析用）';
COMMENT ON COLUMN conversion_events.session_id IS 'チャットログのsession_idと紐づけ';
COMMENT ON COLUMN conversion_events.event_type IS 'イベントタイプ: purchase（購入）, signup（登録）, trial_start（トライアル開始）, contact（問い合わせ）, download（ダウンロード）';
COMMENT ON COLUMN conversion_events.event_value IS 'イベントの価値（購入金額など）';
COMMENT ON COLUMN conversion_events.metadata IS '追加情報（商品名、プラン名、カテゴリなど）';

-- RLS（Row Level Security）ポリシー
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のサイトのコンバージョンイベントのみ閲覧可能
CREATE POLICY "Users can view conversion events for their own sites"
  ON conversion_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = conversion_events.site_id
      AND sites.user_id = auth.uid()
    )
  );

-- ユーザーは自分のサイトのコンバージョンイベントを作成可能
CREATE POLICY "Users can insert conversion events for their own sites"
  ON conversion_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = conversion_events.site_id
      AND sites.user_id = auth.uid()
    )
  );

-- ユーザーは自分のサイトのコンバージョンイベントを更新可能
CREATE POLICY "Users can update conversion events for their own sites"
  ON conversion_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = conversion_events.site_id
      AND sites.user_id = auth.uid()
    )
  );

-- ユーザーは自分のサイトのコンバージョンイベントを削除可能
CREATE POLICY "Users can delete conversion events for their own sites"
  ON conversion_events
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = conversion_events.site_id
      AND sites.user_id = auth.uid()
    )
  );

-- ============================================
-- 分析用関数: 購入前/購入後の質問パターンを取得
-- ============================================

CREATE OR REPLACE FUNCTION get_pre_post_question_analysis(
  p_site_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  question text,
  pre_count bigint,
  post_count bigint,
  total_count bigint,
  conversion_rate numeric,
  first_asked_at timestamptz,
  last_asked_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  WITH conversion_sessions AS (
    -- コンバージョンが発生したセッションIDを取得
    SELECT DISTINCT session_id
    FROM conversion_events
    WHERE site_id = p_site_id
      AND event_type = 'purchase'
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
  ),
  session_conversion_times AS (
    -- 各セッションのコンバージョン発生時刻を取得
    SELECT 
      session_id,
      MIN(created_at) as conversion_time
    FROM conversion_events
    WHERE site_id = p_site_id
      AND event_type = 'purchase'
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
    GROUP BY session_id
  ),
  question_timings AS (
    -- 各質問が購入前か購入後かを判定
    SELECT 
      cl.question,
      cl.session_id,
      cl.created_at,
      CASE 
        WHEN sct.conversion_time IS NULL THEN 'pre' -- コンバージョンなし
        WHEN cl.created_at < sct.conversion_time THEN 'pre' -- 購入前
        ELSE 'post' -- 購入後
      END as timing
    FROM chat_logs cl
    LEFT JOIN session_conversion_times sct ON cl.session_id = sct.session_id
    WHERE cl.site_id = p_site_id
      AND (p_start_date IS NULL OR cl.created_at >= p_start_date)
      AND (p_end_date IS NULL OR cl.created_at <= p_end_date)
  )
  SELECT 
    qt.question,
    COUNT(*) FILTER (WHERE qt.timing = 'pre')::bigint as pre_count,
    COUNT(*) FILTER (WHERE qt.timing = 'post')::bigint as post_count,
    COUNT(*)::bigint as total_count,
    CASE 
      WHEN COUNT(*) FILTER (WHERE qt.timing = 'pre') > 0 THEN
        ROUND(
          (COUNT(*) FILTER (WHERE qt.timing = 'post')::numeric / 
           COUNT(*) FILTER (WHERE qt.timing = 'pre')::numeric) * 100,
          2
        )
      ELSE 0
    END as conversion_rate,
    MIN(qt.created_at) as first_asked_at,
    MAX(qt.created_at) as last_asked_at
  FROM question_timings qt
  GROUP BY qt.question
  HAVING COUNT(*) > 0
  ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_pre_post_question_analysis IS '購入前/購入後の質問パターンを分析する関数';

-- ============================================
-- 分析用関数: コンバージョンに影響する質問を取得
-- ============================================

CREATE OR REPLACE FUNCTION get_conversion_impact_questions(
  p_site_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  question text,
  conversion_count bigint,
  non_conversion_count bigint,
  conversion_rate numeric,
  impact_score numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH conversion_sessions AS (
    -- コンバージョンが発生したセッションIDを取得
    SELECT DISTINCT session_id
    FROM conversion_events
    WHERE site_id = p_site_id
      AND event_type = 'purchase'
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
  ),
  question_conversion_stats AS (
    SELECT 
      cl.question,
      COUNT(*) FILTER (WHERE cs.session_id IS NOT NULL)::bigint as conversion_count,
      COUNT(*) FILTER (WHERE cs.session_id IS NULL)::bigint as non_conversion_count
    FROM chat_logs cl
    LEFT JOIN conversion_sessions cs ON cl.session_id = cs.session_id
    WHERE cl.site_id = p_site_id
      AND (p_start_date IS NULL OR cl.created_at >= p_start_date)
      AND (p_end_date IS NULL OR cl.created_at <= p_end_date)
    GROUP BY cl.question
  )
  SELECT 
    qcs.question,
    qcs.conversion_count,
    qcs.non_conversion_count,
    CASE 
      WHEN (qcs.conversion_count + qcs.non_conversion_count) > 0 THEN
        ROUND(
          (qcs.conversion_count::numeric / 
           (qcs.conversion_count + qcs.non_conversion_count)::numeric) * 100,
          2
        )
      ELSE 0
    END as conversion_rate,
    -- インパクトスコア: コンバージョン率 × 質問数（コンバージョンに寄与する質問を優先）
    CASE 
      WHEN (qcs.conversion_count + qcs.non_conversion_count) > 0 THEN
        ROUND(
          (qcs.conversion_count::numeric / 
           (qcs.conversion_count + qcs.non_conversion_count)::numeric) * 
          (qcs.conversion_count + qcs.non_conversion_count)::numeric,
          2
        )
      ELSE 0
    END as impact_score
  FROM question_conversion_stats qcs
  WHERE qcs.conversion_count > 0 -- コンバージョンが発生したセッションでのみ質問
  ORDER BY impact_score DESC, conversion_rate DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_conversion_impact_questions IS 'コンバージョンに影響する質問を取得する関数（コンバージョン率とインパクトスコアでランキング）';

