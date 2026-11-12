-- Vexa - Database Schema (idempotent)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/urenbjultzmpmamcaogv/sql/new

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'User',
  avatar_url TEXT,
  roblox_user_id BIGINT,
  open_cloud_api_key TEXT,
  discord_id TEXT,
  discord_username TEXT,
  discord_avatar TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service role full access" ON profiles FOR ALL USING (auth.role() = 'service_role');

-- 2. Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  place_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own projects" ON projects;
DROP POLICY IF EXISTS "Service role full access" ON projects;
CREATE POLICY "Users can CRUD own projects" ON projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON projects FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_place_id ON projects(place_id);

-- 3. Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON messages;
DROP POLICY IF EXISTS "Service role full access" ON messages;
CREATE POLICY "Users can read own messages" ON messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- 4. Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert feedback" ON feedback;
DROP POLICY IF EXISTS "Service role full access" ON feedback;
CREATE POLICY "Anyone can insert feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role full access" ON feedback FOR ALL USING (auth.role() = 'service_role');

-- 5. Plugin Tokens (device codes for Roblox Studio linking)
CREATE TABLE IF NOT EXISTS plugin_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  device_code TEXT UNIQUE NOT NULL,
  authorized BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plugin_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON plugin_tokens;
CREATE POLICY "Service role full access" ON plugin_tokens FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_plugin_tokens_device_code ON plugin_tokens(device_code);
CREATE INDEX IF NOT EXISTS idx_plugin_tokens_token ON plugin_tokens(token);

-- 6. Plugin Sessions
CREATE TABLE IF NOT EXISTS plugin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plugin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON plugin_sessions;
CREATE POLICY "Service role full access" ON plugin_sessions FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_plugin_sessions_token ON plugin_sessions(token);

-- 7. Plugin Heartbeats
CREATE TABLE IF NOT EXISTS plugin_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plugin_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON plugin_heartbeats;
CREATE POLICY "Service role full access" ON plugin_heartbeats FOR ALL USING (auth.role() = 'service_role');

-- 8. Game Models (Roblox game instance tree from Studio plugin)
CREATE TABLE IF NOT EXISTS game_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  model_json TEXT NOT NULL,
  place_id BIGINT,
  universe_id BIGINT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE game_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON game_models;
CREATE POLICY "Service role full access" ON game_models FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_game_models_user_id ON game_models(user_id);

-- 9. Discord Verify Codes
CREATE TABLE IF NOT EXISTS discord_verify_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  discord_id TEXT,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE discord_verify_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON discord_verify_codes;
CREATE POLICY "Service role full access" ON discord_verify_codes FOR ALL USING (auth.role() = 'service_role');

-- 10. Prompt Usage (rate limiting)
CREATE TABLE IF NOT EXISTS prompt_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  prompt_count INT DEFAULT 1,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE prompt_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON prompt_usage;
CREATE POLICY "Service role full access" ON prompt_usage FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_prompt_usage_user_date ON prompt_usage(user_id, date);
