import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = "https://qnezkeqywwvynlrodbrg.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZXprZXF5d3d2eW5scm9kYnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNjM5MDIsImV4cCI6MjEwOTYzOTkwMn0.lwOMHOqjss4l_618Ymm1aVYy4eWr3S6UCFcFaWeJzqg";

function getSafeStorage() {
  if (typeof window === 'undefined') return undefined;
  try {
    window.localStorage.setItem('__sb_test__', '1');
    window.localStorage.removeItem('__sb_test__');
    return window.localStorage;
  } catch {
    return {
      getItem: (_key: string) => null,
      setItem: (_key: string, _value: string) => {},
      removeItem: (_key: string) => {},
      clear: () => {},
      length: 0,
      key: (_index: number) => null,
    } as Storage;
  }
}

const resolvedUrl =
  (import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL.trim().startsWith('https://')
    ? import.meta.env.VITE_SUPABASE_URL.trim()
    : '') || DEFAULT_SUPABASE_URL;

const rawEnvKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const resolvedKey =
  rawEnvKey &&
  rawEnvKey !== 'your-anon-key' &&
  !rawEnvKey.includes('service_role')
    ? rawEnvKey
    : DEFAULT_SUPABASE_ANON_KEY;

export let supabase: SupabaseClient = createClient(resolvedUrl, resolvedKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: getSafeStorage(),
  },
});

export const isSupabaseConfigured = () => true;

export const initializeSupabase = () => supabase;
