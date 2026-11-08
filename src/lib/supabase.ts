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

  let storage = window.localStorage;
  try {
    window.localStorage.setItem('test', 'test');
    window.localStorage.removeItem('test');
  } catch (e) {
    storage = {
      getItem: (key: string) => null,
      setItem: (key: string, value: string) => {},
      removeItem: (key: string) => {},
      clear: () => {},
      length: 0,
      key: (index: number) => null
    } as any;
  }

  if (url && key) {
    supabase = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: storage
      }
    });
  } else {
    supabase = null;
  }
  return supabase;
};

// Initial initialization
initializeSupabase();
