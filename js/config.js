import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://ykyfdrnkxqfvhasfbehe.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreWZkcm5reHFmdmhhc2ZiZWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTQ5NDUsImV4cCI6MjA4NjU5MDk0NX0';

export const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window._supabase = _supabase;