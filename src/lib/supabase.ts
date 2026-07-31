import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://ilyxhubihdqjbvkkpalx.supabase.co';

const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_I8SaqNGWtFy-wDD2XAkOAA_X7f42g_w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const SUPABASE_CONFIG = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};

