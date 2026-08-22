import { createClient } from '@supabase/supabase-js';

// Fixed production Supabase configuration - User modifications not allowed
export const FIXED_SUPABASE_CONFIG = {
  url:
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    'https://ilyxhubihdqjbvkkpalx.supabase.co',
  anonKey:
    (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_I8SaqNGWtFy-wDD2XAkOAA_X7f42g_w',
};

export function getSupabaseKeys() {
  return {
    url: FIXED_SUPABASE_CONFIG.url,
    anonKey: FIXED_SUPABASE_CONFIG.anonKey,
    isCustom: false,
  };
}

export const supabase = createClient(FIXED_SUPABASE_CONFIG.url, FIXED_SUPABASE_CONFIG.anonKey);

export const SUPABASE_CONFIG = FIXED_SUPABASE_CONFIG;



