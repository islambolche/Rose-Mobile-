-- IYABD Supabase Schema (Updated with Identity & Subscriptions)
-- Target: Personal AI Assistant for MD YOUSUF KHAN

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text DEFAULT 'MD YOUSUF KHAN',
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  consent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 3. Login Events Table
CREATE TABLE IF NOT EXISTS public.login_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip text,
  city text,
  country text,
  device text,
  created_at timestamptz DEFAULT now()
);

-- 4. User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  language text DEFAULT 'en-US',
  voice_name text DEFAULT 'en-US-Neural2-F',
  speech_speed float DEFAULT 1.0,
  theme text DEFAULT 'dark',
  orb_theme text DEFAULT 'lava',
  updated_at timestamptz DEFAULT now()
);

-- 5. Assistant Settings (Global/Master)
CREATE TABLE IF NOT EXISTS public.assistant_settings (
  id int PRIMARY KEY DEFAULT 1,
  master_access boolean DEFAULT true,
  app_permissions jsonb DEFAULT '{"youtube": true, "facebook": true, "tiktok": true, "whatsapp": true, "imo": true, "email": true}',
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 6. Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title text DEFAULT 'New Chat',
  mode text DEFAULT 'chat', -- chat, image, write
  created_at timestamptz DEFAULT now()
);

-- 7. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id bigserial PRIMARY KEY,
  conversation_id uuid REFERENCES public.conversations ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

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

-- 9. User API Keys
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  gemini_api_key text,
  groq_api_key text,
  updated_at timestamptz DEFAULT now()
);

-- 10. Functions & Triggers

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, email, full_name, phone)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  
  INSERT INTO public.subscriptions(user_id) 
  VALUES (new.id);
  
  INSERT INTO public.user_preferences(user_id)
  VALUES (new.id);
  
  RETURN new;
END $$;

-- Drop if exists to avoid errors on re-run
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- Policies

-- Profiles
CREATE POLICY "own profile read" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "admin profile read" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (id = auth.uid());
-- REVOKE UPDATE ON public.profiles FROM authenticated; -- Be careful with direct REVOKE in schema files if you don't know the environment
-- GRANT UPDATE (full_name, phone, consent_at) ON public.profiles TO authenticated;

-- Subscriptions
CREATE POLICY "own sub read" ON public.subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin sub read" ON public.subscriptions FOR SELECT USING (public.is_admin());

-- Login Events
CREATE POLICY "own login read" ON public.login_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin login read" ON public.login_events FOR SELECT USING (public.is_admin());

-- User Preferences
CREATE POLICY "own prefs read" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own prefs all" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

-- Conversations & Messages
CREATE POLICY "own convs select" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own convs insert" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own convs delete" ON public.conversations FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own messages select" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "own messages insert" ON public.messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND user_id = auth.uid())
);

-- Commands
CREATE POLICY "own commands all" ON public.commands FOR ALL USING (auth.uid() = user_id);

-- 11. Profile Settings (Admin/Public Info)
CREATE TABLE IF NOT EXISTS public.profile_settings (
  id int PRIMARY KEY DEFAULT 1,
  name text DEFAULT 'MD YOUSUF KHAN',
  subtitle text DEFAULT 'Web Developer',
  banner_url text,
  links jsonb DEFAULT '{"facebook": "", "youtube": "", "instagram": "", "tiktok": "", "whatsapp": "", "telegram": "", "website": ""}',
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row_profile CHECK (id = 1)
);

ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public profile read" ON public.profile_settings FOR SELECT USING (true);
CREATE POLICY "admin profile update" ON public.profile_settings FOR ALL USING (public.is_admin());
