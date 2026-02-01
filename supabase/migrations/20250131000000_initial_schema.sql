-- Sales Call Analysis 初期スキーマ
-- Supabase SQL Editorで実行

-- ===========================================
-- ENUM型
-- ===========================================
CREATE TYPE recordings_status AS ENUM (
  'pending', 'downloading', 'ready',
  'transcribing', 'transcribed',
  'analyzing', 'completed', 'failed'
);

CREATE TYPE feedbacks_status AS ENUM ('draft', 'shared');
CREATE TYPE user_role AS ENUM ('admin', 'sales');

-- ===========================================
-- profiles テーブル
-- ===========================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'sales',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 新規ユーザー作成時に自動でprofileを作成
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===========================================
-- zoom_accounts テーブル
-- ===========================================
CREATE TABLE IF NOT EXISTS zoom_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  zoom_user_email TEXT NOT NULL,
  zoom_account_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- zoom_account_tokens テーブル（暗号化トークン）
-- ===========================================
CREATE TABLE IF NOT EXISTS zoom_account_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_account_id UUID NOT NULL REFERENCES zoom_accounts(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- recordings テーブル
-- ===========================================
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_account_id UUID NOT NULL REFERENCES zoom_accounts(id) ON DELETE CASCADE,
  zoom_recording_id TEXT NOT NULL UNIQUE,
  topic TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  duration INTEGER,
  video_url TEXT,
  file_path TEXT,
  status recordings_status NOT NULL DEFAULT 'pending',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recordings_zoom_account_id ON recordings(zoom_account_id);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_created_at ON recordings(created_at DESC);
CREATE INDEX idx_recordings_active ON recordings(zoom_account_id, status, created_at DESC) WHERE deleted_at IS NULL;

-- ===========================================
-- knowledge_rules テーブル
-- ===========================================
CREATE TABLE IF NOT EXISTS knowledge_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  content TEXT NOT NULL,
  prompt_instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- analyses テーブル
-- ===========================================
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL UNIQUE REFERENCES recordings(id) ON DELETE CASCADE,
  transcript_json JSONB,
  issues_json JSONB,
  summary_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analyses_recording_id ON analyses(recording_id);

-- ===========================================
-- feedbacks テーブル
-- ===========================================
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  target_user_id UUID NOT NULL REFERENCES profiles(id),
  clip_url TEXT,
  clip_start_ms INTEGER,
  clip_end_ms INTEGER,
  content TEXT NOT NULL,
  status feedbacks_status NOT NULL DEFAULT 'draft',
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedbacks_recording_id ON feedbacks(recording_id);
CREATE INDEX idx_feedbacks_target_user_id ON feedbacks(target_user_id);

-- ===========================================
-- webhook_events テーブル（べき等性用）
-- ===========================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at);

-- ===========================================
-- RLSポリシー
-- ===========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- zoom_accounts
CREATE POLICY "Users can view own zoom accounts" ON zoom_accounts
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Admins can manage all zoom accounts" ON zoom_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- zoom_account_tokens (サービスロール専用)
CREATE POLICY "No direct access to tokens" ON zoom_account_tokens
  FOR ALL USING (false);

-- recordings
CREATE POLICY "Users can view own recordings" ON recordings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM zoom_accounts
      WHERE zoom_accounts.id = recordings.zoom_account_id
      AND zoom_accounts.owner_id = auth.uid()
    )
  );
CREATE POLICY "Admins can view all recordings" ON recordings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- knowledge_rules
CREATE POLICY "Everyone can view active rules" ON knowledge_rules
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage rules" ON knowledge_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- analyses
CREATE POLICY "Users can view own analyses" ON analyses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM recordings r
      JOIN zoom_accounts za ON za.id = r.zoom_account_id
      WHERE r.id = analyses.recording_id AND za.owner_id = auth.uid()
    )
  );
CREATE POLICY "Admins can view all analyses" ON analyses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- feedbacks
CREATE POLICY "Users can view own feedbacks" ON feedbacks
  FOR SELECT USING (target_user_id = auth.uid());
CREATE POLICY "Admins can manage all feedbacks" ON feedbacks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
