-- ダブルブッキング防止: slot_locks + write_back_queue
-- slot_locks: チャットボット予約フロー中の楽観的ロック
-- write_back_queue: SalonBoard/minimoへの非同期書き戻しキュー

-- =============================================
-- 1. slot_locks テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS slot_locks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TEXT NOT NULL,
    staff_name TEXT DEFAULT '',
    locked_by TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'expired', 'conflict')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- アクティブなロックを高速検索
CREATE INDEX IF NOT EXISTS idx_slot_locks_active
    ON slot_locks(site_id, date, start_time)
    WHERE status = 'pending';

-- TTL切れロックの定期クリーンアップ用
CREATE INDEX IF NOT EXISTS idx_slot_locks_expires
    ON slot_locks(expires_at)
    WHERE status = 'pending';

COMMENT ON TABLE slot_locks IS '予約フロー中のスロットロック（TTL付き楽観的ロック）';

-- RLS
ALTER TABLE slot_locks ENABLE ROW LEVEL SECURITY;

-- service_role のみアクセス可（API経由のみ）
DROP POLICY IF EXISTS "Service role full access on slot_locks" ON slot_locks;
CREATE POLICY "Service role full access on slot_locks"
    ON slot_locks FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- 2. write_back_queue テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS write_back_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    target_platform TEXT NOT NULL
        CHECK (target_platform IN ('salonboard', 'minimo')),
    action TEXT NOT NULL
        CHECK (action IN ('create', 'cancel', 'block_slot')),
    payload JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'manual')),
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_write_back_queue_pending
    ON write_back_queue(next_retry_at)
    WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_write_back_queue_site
    ON write_back_queue(site_id, created_at DESC);

COMMENT ON TABLE write_back_queue IS 'SalonBoard/minimoへの非同期書き戻しキュー（Outboxパターン）';

-- RLS
ALTER TABLE write_back_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on write_back_queue" ON write_back_queue;
CREATE POLICY "Service role full access on write_back_queue"
    ON write_back_queue FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- 3. external_reservations に 'chatbot' ソースを追加
-- =============================================
-- 既存の CHECK 制約を更新（存在する場合のみ）
DO $$
BEGIN
    -- 既存の制約を削除して再作成
    ALTER TABLE external_reservations
        DROP CONSTRAINT IF EXISTS external_reservations_source_check;
    ALTER TABLE external_reservations
        ADD CONSTRAINT external_reservations_source_check
        CHECK (source IN ('salonboard', 'minimo', 'chatbot'));
EXCEPTION
    WHEN undefined_table THEN
        NULL; -- テーブルが存在しない場合はスキップ
END $$;
