// js/config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://ykyfdrnkxqfvhasfbehe.supabase.co';
// Ersetze diesen String mit deinem vollständigen Publishable Key aus dem Supabase Dashboard:
export const SUPABASE_ANON_KEY = 'sb_publishable_2bLjUm02NS5XDAJMVvDGTa_rSzQK...';

export const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = _supabase;