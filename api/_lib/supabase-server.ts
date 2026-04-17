/**
 * Server-side Supabase client. Uses service role key — never import this
 * from anything under `src/` that runs in the browser.
 *
 * Env vars:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function getServerSupabase(): SupabaseClient {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    // Return a placeholder client so test harnesses don't crash on import.
    cached = createClient('https://placeholder.supabase.co', 'placeholder-key')
    return cached
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
