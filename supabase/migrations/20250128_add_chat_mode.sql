-- ハイブリッドモード対応: sitesテーブルにチャットモードカラムを追加

-- チャットモード（rag_only/appointment_only/hybrid）
ALTER TABLE sites ADD COLUMN IF NOT EXISTS chat_mode TEXT DEFAULT 'rag_only';

-- コメント
COMMENT ON COLUMN sites.chat_mode IS 'チャットモード: rag_only（RAGのみ）, appointment_only（予約のみ）, hybrid（ハイブリッド）';

-- 既存のspreadsheet_idが設定されているサイトは appointment_only に移行
UPDATE sites
SET chat_mode = 'appointment_only'
WHERE spreadsheet_id IS NOT NULL
  AND spreadsheet_id != ''
  AND chat_mode IS NULL;
