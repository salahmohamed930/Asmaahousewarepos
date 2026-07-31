import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://tdhbgwrbqagdgydhwdcd.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_d6iYP1Qec_qpC33Za0JH0Q_gva3IB63';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
