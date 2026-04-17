/**
 * Server-side Supabase client factory.
 *
 * Uses the service-role key — NEVER import this from client code.
 * Returns `null` when env vars are absent so Edge Functions can respond
 * with a clean 503 instead of crashing during local dev without secrets.
 *
 * Required env vars:
 *   SUPABASE_URL             — e.g. https://xyz.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — the service role secret
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null | undefined

export function getServiceSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    cached = null
    return null
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
