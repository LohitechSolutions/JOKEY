import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HARDCODED_SUPABASE_URL = 'https://ybafpeuelshlofltoebe.supabase.co';
const HARDCODED_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliYWZwZXVlbHNobG9mbHRvZWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTEzNzIsImV4cCI6MjA5MDcyNzM3Mn0.dK0yGi7lPG-xCfta89ZjywJWTesFMSqtrihIyYZOdqQ';

function getEnvVar(key: string, fallback: string = ''): string {
  try {
    const val = process.env[key];
    return typeof val === 'string' && val.trim().length > 0 ? val.trim() : fallback;
  } catch {
    return fallback;
  }
}

const supabaseUrl = getEnvVar('EXPO_PUBLIC_SUPABASE_URL', HARDCODED_SUPABASE_URL);
const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY', HARDCODED_SUPABASE_ANON_KEY);

const hasConfig = supabaseUrl.length > 10 && supabaseAnonKey.length > 10
  && supabaseUrl.startsWith('https://')
  && !supabaseUrl.includes('placeholder');

console.log('[Supabase] URL:', supabaseUrl ? supabaseUrl.substring(0, 40) + '...' : 'NOT SET');
console.log('[Supabase] KEY:', supabaseAnonKey ? `SET (${supabaseAnonKey.length} chars)` : 'NOT SET');
console.log('[Supabase] Configured:', hasConfig);

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

let supabaseInstance: SupabaseClient;
try {
  supabaseInstance = createClient(
    hasConfig ? supabaseUrl : PLACEHOLDER_URL,
    hasConfig ? supabaseAnonKey : PLACEHOLDER_KEY,
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: hasConfig,
        persistSession: hasConfig,
        detectSessionInUrl: false,
      },
    }
  );
} catch (err) {
  console.error('[Supabase] Failed to create client:', err);
  supabaseInstance = createClient(PLACEHOLDER_URL, PLACEHOLDER_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase: SupabaseClient = supabaseInstance;
export const isSupabaseConfigured = hasConfig;

if (!hasConfig) {
  console.log('[Supabase] Running in LOCAL-ONLY mode. Auth and data will be stored locally.');
}
