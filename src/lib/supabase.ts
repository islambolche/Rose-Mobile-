import { createClient, SupabaseClient } from '@supabase/supabase-js';

export let supabase: SupabaseClient | null = null;

export const initializeSupabase = (url?: string, key?: string) => {
  const finalUrl = url || localStorage.getItem("supabase_url") || import.meta.env.VITE_SUPABASE_URL;
  const finalKey = key || localStorage.getItem("supabase_key") || import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (finalUrl && finalKey && finalUrl.startsWith('https://') && !finalKey.includes('service_role')) {
    supabase = createClient(finalUrl, finalKey);
  } else {
    supabase = null;
  }
  return supabase;
};

export const getSupabaseClient = (): SupabaseClient | null => {
  const finalUrl = localStorage.getItem("supabase_url") || import.meta.env.VITE_SUPABASE_URL;
  const finalKey = localStorage.getItem("supabase_key") || import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (finalUrl && finalKey && finalUrl.startsWith('https://') && !finalKey.includes('service_role')) {
    return createClient(finalUrl, finalKey);
  }
  return null;
};

// Initial initialization
initializeSupabase();
