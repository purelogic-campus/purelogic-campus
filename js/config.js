// js/config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://ykyfdrnkxqfvhasfbehe.supabase.co';
const SUPABASE_ANON_KEY = 'DEIN_SUPABASE_ANON_KEY'; // <-- Hier deinen echten Supabase Anon Key einfügen!

// Exportiert den Client direkt und stellt ihn zusätzlich global bereit
export const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = _supabase;