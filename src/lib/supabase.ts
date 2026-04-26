import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const PLACEHOLDER_URL = 'https://placeholder-project.supabase.co'
const PLACEHOLDER_ANON_KEY = 'placeholder-anon-key'

/**
 * Returns true when no real Supabase credentials are configured. Used by
 * the data layer feature flag to decide whether to read from Supabase or
 * fall back to local mock fixtures.
 */
export function hasPlaceholderCredentials(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return true
  if (supabaseUrl === PLACEHOLDER_URL || supabaseAnonKey === PLACEHOLDER_ANON_KEY) return true
  if (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) return true
  return false
}

// Create a dummy client if keys are missing so the app doesn't immediately crash,
// but auth and database calls will fail gracefully until the user provides keys.
export const supabase = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseAnonKey || PLACEHOLDER_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)
