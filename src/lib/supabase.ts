import { createClient } from '@supabase/supabase-js';

const LOCAL_STORAGE_KEY = 'asmaa_pos_state_ar_v3';

export function getSupabaseKeys() {
  try {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_settings`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
        return {
          url: parsed.supabaseUrl.trim(),
          anonKey: parsed.supabaseAnonKey.trim(),
          isCustom: true,
        };
      }
    }
  } catch (e) {
    console.warn('Error reading saved database settings:', e);
  }

  return {
    url:
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      'https://ilyxhubihdqjbvkkpalx.supabase.co',
    anonKey:
      (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      'sb_publishable_I8SaqNGWtFy-wDD2XAkOAA_X7f42g_w',
    isCustom: false,
  };
}

const initialKeys = getSupabaseKeys();

export let supabase = createClient(initialKeys.url, initialKeys.anonKey);

export function updateSupabaseClient(url: string, anonKey: string) {
  supabase = createClient(url, anonKey);
}

export const SUPABASE_CONFIG = {
  url: initialKeys.url,
  anonKey: initialKeys.anonKey,
};


