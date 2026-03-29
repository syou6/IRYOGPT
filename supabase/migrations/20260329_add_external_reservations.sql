-- 外部予約テーブル（サロンボード・ミニモの予約を統合管理）
-- よやくらくの空き枠計算時にこのテーブルを参照してダブルブッキングを防止する

CREATE TABLE IF NOT EXISTS external_reservations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('salonboard', 'minimo')),
    external_id TEXT DEFAULT '',
    date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT DEFAULT '',
    staff_name TEXT DEFAULT '',
    customer_name TEXT DEFAULT '',
    menu TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    raw_data JSONB DEFAULT '{}',
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_ext_res_site_date ON external_reservations(site_id, date);
CREATE INDEX IF NOT EXISTS idx_ext_res_source ON external_reservations(source);
CREATE INDEX IF NOT EXISTS idx_ext_res_staff ON external_reservations(site_id, staff_name, date);

-- 重複防止（同じソース・同じ外部ID・同じ日付の予約は1つだけ）
CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_res_unique
    ON external_reservations(site_id, source, external_id, date)
    WHERE external_id != '';

-- RLS（行レベルセキュリティ）
ALTER TABLE external_reservations ENABLE ROW LEVEL SECURITY;

-- サービスロールのみ書き込み可（スクレイパーはサービスキーを使用）
CREATE POLICY "Service role can manage external_reservations"
    ON external_reservations
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 認証済みユーザーは自分のサイトの予約のみ閲覧可
CREATE POLICY "Users can view own site external_reservations"
    ON external_reservations
    FOR SELECT
    USING (
        site_id IN (
            SELECT id FROM sites WHERE user_id = auth.uid()
        )
    );
