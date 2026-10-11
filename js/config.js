// js/config.js
const SUPABASE_URL = 'https://ykyfdrnkxqfvhasfbehe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreWZkcm5reHFmdmhhc2ZiZWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3Nzc5ODQsImV4cCI6MjEwMzM1Mzk4NH0.KaFc9dUmxR_5rFTDWUHwk4YqPKvYF0uqkqxB4QB5gKQ';

export const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabase = _supabase;
window._supabase = _supabase;