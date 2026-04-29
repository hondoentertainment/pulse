import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isE2EAuthBypassEnabled = import.meta.env.VITE_E2E_AUTH_BYPASS === 'true'
export const isVisualPreviewEnabled = import.meta.env.VITE_VISUAL_PREVIEW === 'true'
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey) && !isE2EAuthBypassEnabled && !isVisualPreviewEnabled

// Create a dummy client if keys are missing so the app doesn't immediately crash,
// but auth and database calls will fail gracefully until the user provides keys.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)
