-- Comprehensive Supabase Schema for Rose AI
-- Run this in your Supabase SQL Editor to fix "Table not found" errors.

-- 1. Tasks Table (for AI Team members)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  instruction TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('assigned', 'working', 'done')),
  reply TEXT,
  result TEXT,
  source TEXT NOT NULL CHECK (source IN ('mobile', 'pc'))
);

-- 2. Commands Table (for general actions)
CREATE TABLE IF NOT EXISTS commands (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  target TEXT,
  action TEXT,
  summary TEXT,
  payload JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Messages Table (for chat history)
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PC Devices Table (for PC Control)
CREATE TABLE IF NOT EXISTS pc_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pair_code TEXT,
  pair_code_expires TIMESTAMPTZ,
  paired BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ,
  info JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PC Commands Table
CREATE TABLE IF NOT EXISTS pc_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES pc_devices(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  risk TEXT NOT NULL DEFAULT 'low',
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- 6. Agent Tasks Table (Internal PC Tasks)
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Realtime for all tables
-- Note: You might need to run these one by one if the publication doesn't exist yet
-- DROP PUBLICATION IF EXISTS supabase_realtime;
-- CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE commands;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE pc_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE pc_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;
