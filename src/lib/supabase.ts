import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://fxlvosnylftnqegdhkha.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4bHZvc255bGZ0bnFlZ2Roa2hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNTY3MzIsImV4cCI6MjEwOTYzMjczMn0.Ky3zFlJnKKeTxtm-RwN5LWmKkT7V0eDBulutEaVTzFI';

export function clearLegacySupabaseStorage() {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove = [
      'supabase_url',
      'supabase_key',
      'supabaseUrl',
      'supabaseKey',
      'rose_supabase_url',
      'rose_supabase_key',
    ];
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }

    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (
        key &&
        key.startsWith('sb-') &&
        key.endsWith('-auth-token') &&
        key !== 'sb-fxlvosnylftnqegdhkha-auth-token'
      ) {
        window.localStorage.removeItem(key);
      }
    }

    const rawApiKeys = window.localStorage.getItem('iyabd_api_keys');
    if (rawApiKeys) {
      const parsed = JSON.parse(rawApiKeys);
      if (parsed && typeof parsed === 'object') {
        parsed.supabaseUrl = DEFAULT_SUPABASE_URL;
        parsed.supabaseKey = DEFAULT_SUPABASE_ANON_KEY;
        window.localStorage.setItem('iyabd_api_keys', JSON.stringify(parsed));
      }
    }
  } catch {
    // Ignore storage access errors
  }
}

clearLegacySupabaseStorage();

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

export let supabase: SupabaseClient = createClient(
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: getSafeStorage(),
    },
  }
);

export const isSupabaseConfigured = () => true;

export const initializeSupabase = () => {
  clearLegacySupabaseStorage();
  return supabase;
};
