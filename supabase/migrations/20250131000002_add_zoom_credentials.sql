-- Zoom認証情報カラムを追加
ALTER TABLE zoom_accounts ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE zoom_accounts ADD COLUMN IF NOT EXISTS client_secret TEXT;
