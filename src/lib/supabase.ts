import { createClient, SupabaseClient } from '@supabase/supabase-js';

export let supabase: SupabaseClient | null = null;

export const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return !!url && !!key;
};

export const initializeSupabase = () => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (url && key) {
    supabase = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });
  } else {
    supabase = null;
  }
  return supabase;
};

// Initial initialization
initializeSupabase();
