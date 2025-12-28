-- 医療予約システム用: sitesテーブルにスプレッドシート連携カラムを追加

-- スプレッドシートID（Google SheetsのID）
ALTER TABLE sites ADD COLUMN IF NOT EXISTS spreadsheet_id TEXT;

-- 医院タイプ（歯科/内科/皮膚科など）
ALTER TABLE sites ADD COLUMN IF NOT EXISTS clinic_type TEXT;

-- コメント
COMMENT ON COLUMN sites.spreadsheet_id IS '予約管理用GoogleスプレッドシートのID';
COMMENT ON COLUMN sites.clinic_type IS '医院タイプ（dental/clinic/hospital）';
