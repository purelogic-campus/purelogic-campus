import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://ykyfdrnkxqfvhasfbehe.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_2bLjUm02NS5XDAJMvVDgTA_rSzQKsW.tz2K4e94b15ff';

export const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = _supabase;