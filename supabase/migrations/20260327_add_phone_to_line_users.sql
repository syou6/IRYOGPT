-- line_usersにphone_number列追加（リマインド用マッチング）
ALTER TABLE line_users ADD COLUMN IF NOT EXISTS phone_number TEXT;
CREATE INDEX IF NOT EXISTS idx_line_users_phone ON line_users(site_id, phone_number);
