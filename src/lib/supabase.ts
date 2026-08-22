import { createClient } from '@supabase/supabase-js';

// Absolute Target Supabase Project
const REQUIRED_SUPABASE_URL = 'https://ilyxhubihdqjbvkkpalx.supabase.co';
const REQUIRED_SUPABASE_KEY = 'sb_publishable_I8SaqNGWtFy-wDD2XAkOAA_X7f42g_w';

// Environment variables with strict validation to reject old project ref
let rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
if (!rawUrl || !rawUrl.includes('ilyxhubihdqjbvkkpalx')) {
  rawUrl = REQUIRED_SUPABASE_URL;
}

let rawKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!rawKey || rawKey.includes('d6iYP1Qec')) {
  rawKey = REQUIRED_SUPABASE_KEY;
}

const supabaseUrl = rawUrl;
const supabaseAnonKey = rawKey;

console.log(`[SUPABASE INIT] Connecting to project: ${supabaseUrl}`);

// Single initialized Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-application-name': 'asmaa-pos',
    },
  },
});

export function getSupabaseKeys() {
  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    hasKey: Boolean(supabaseAnonKey),
    isCustom: false,
  };
}

export const SUPABASE_CONFIG = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};

// Automatic Browser Diagnostic Test on initialization
if (typeof window !== 'undefined') {
  (async () => {
    try {
      const keys = getSupabaseKeys();
      const projectRef = keys.url ? keys.url.replace('https://', '').split('.')[0] : 'none';
      console.log('=== [SUPABASE BROWSER TEST] ===');
      console.log('URL configured:', Boolean(keys.url));
      console.log('Project ref:', projectRef);
      console.log('Client initialized:', Boolean(supabase));
      console.log('Request started: true');

      // 1. Direct REST fetch test
      try {
        const directRes = await fetch(`${supabaseUrl}/rest/v1/customers?select=id&limit=1`, {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
        });
        console.log('[BROWSER REST DIRECT FETCH STATUS]:', directRes.status, directRes.statusText);
      } catch (fetchErr: any) {
        console.warn('[BROWSER REST DIRECT FETCH ERROR]:', fetchErr?.message || fetchErr);
      }

      // 2. Supabase SDK Client Test
      const { data, error, status } = await supabase.from('customers').select('*').limit(1);

      console.log('Request completed: true');
      console.log('HTTP status:', status);
      console.log('Data received:', Boolean(data && data.length > 0));
      if (error) {
        console.log('Error name:', error.name || 'Error');
        console.log('Error message:', error.message);
        console.log('Error status:', error.code || status);
      } else {
        console.log('Error name: None');
        console.log('Error message: None');
        console.log('Error status: 200 OK');
        console.log(`[SUPABASE OK] Successfully loaded sample record:`, data?.[0]?.name || 'Record found');
      }
      console.log('==============================');
    } catch (err: any) {
      console.log('Request completed: false');
      console.log('Error name:', err?.name || 'Exception');
      console.log('Error message:', err?.message || String(err));
    }
  })();
}
