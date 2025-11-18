-- sitesテーブルにicon_urlカラムを追加
-- 埋め込みチャットボットのFABボタンに表示するアイコン画像URL

ALTER TABLE sites 
  ADD COLUMN IF NOT EXISTS icon_url text;

-- コメント追加
COMMENT ON COLUMN sites.icon_url IS '埋め込みチャットボットのFABボタンに表示するアイコン画像URL（オプション）';

