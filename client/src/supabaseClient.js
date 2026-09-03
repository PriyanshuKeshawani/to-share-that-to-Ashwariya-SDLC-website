import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ddjqajadhrwepcybfzam.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkanFhamFkaHJ3ZXBjeWJmemFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTY1NzksImV4cCI6MjEwMzk3MjU3OX0.XPWOh6OFmXKztLOE1f9UJrPdQhC5iJX6Z-CdzYCMV3o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
