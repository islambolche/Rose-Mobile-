-- IYABD Supabase Schema
-- Target: Personal AI Assistant for MD YOUSUF KHAN

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name text DEFAULT 'MD YOUSUF KHAN',
  avatar_url text,
  updated_at timestamptz DEFAULT now()
);

-- 2. User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  language text DEFAULT 'en-US',
  voice_name text DEFAULT 'en-US-Neural2-F',
  speech_speed float DEFAULT 1.0,
  theme text DEFAULT 'dark',
  orb_theme text DEFAULT 'lava',
  updated_at timestamptz DEFAULT now()
);

-- 3. Assistant Settings (Global/Master)
CREATE TABLE IF NOT EXISTS public.assistant_settings (
  id int PRIMARY KEY DEFAULT 1,
  master_access boolean DEFAULT true,
  app_permissions jsonb DEFAULT '{"youtube": true, "facebook": true, "tiktok": true, "whatsapp": true, "imo": true, "email": true}',
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 4. Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title text DEFAULT 'New Chat',
  mode text DEFAULT 'chat', -- chat, image, write
  created_at timestamptz DEFAULT now()
);

-- 5. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id bigserial PRIMARY KEY,
  conversation_id uuid REFERENCES public.conversations ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view assistant settings" ON public.assistant_settings FOR SELECT USING (true);
CREATE POLICY "Admin can update assistant settings" ON public.assistant_settings FOR UPDATE USING (true); -- Simplified for personal use

CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations" ON public.conversations FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert messages in their conversations" ON public.messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND user_id = auth.uid())
);

-- 6. User API Keys
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  gemini_api_key text,
  groq_api_key text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own api keys" ON public.user_api_keys FOR ALL USING (auth.uid() = user_id);

-- 7. Persistent Settings & Chat History
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own settings" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own messages" ON public.chat_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Commands Table
CREATE TABLE IF NOT EXISTS public.commands (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target text NOT NULL,
  action text NOT NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own commands" ON public.commands
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
