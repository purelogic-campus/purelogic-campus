// js/config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://ykyfdrnkxqfvhasfbehe.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_2bLjUm02NS5XDAJMvVDgTA_rSzQKZAe';

export const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = _supabase;