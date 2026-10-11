// js/config.js
const SUPABASE_URL = 'https://ykyfdrnkxqfvhasfbehe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreWZkcm5kcm5reHFmdmhhc2ZiZWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjcyNjczNzAsImV4cCI6MjA4Mjg0MzM3MH0.1vL7jJtC5v7B_V8C9kX2x5M6n3Q4W1s0A9z8E7r6T5o';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);