/**
 * Server-side Supabase client factory for Edge Functions.
 *
 * Design decision: we prefer the **user JWT** approach over the service role
 * key. Rationale:
 *   1. The service role key bypasses RLS. Shipping it in any code path where a
 *      bug could leak it into a response is a large blast radius.
 *   2. RLS policies in `supabase/migrations/*_rls_policies_enforcement.sql`
 *      are the real source of authorization. Passing the user's JWT through
 *      means RLS runs on every write, which matches local dev behaviour.
 *   3. If a future feature needs elevated privileges (e.g. administrative
 *      backfills), add a clearly-named `createAdminClient()` helper and use it
 *      only from jobs/cron — never from user-facing endpoints.
 *
 * Environment variables honoured:
 *   - `SUPABASE_URL` (or `VITE_SUPABASE_URL` as fallback for parity with the
 *     Vite client in `src/lib/supabase.ts`)
 *   - `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`)
 *
 * We intentionally do NOT read `SUPABASE_SERVICE_ROLE_KEY` here.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const readEnv = (...keys: string[]): string | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).process?.env ?? {}
  for (const key of keys) {
    if (env[key]) return env[key] as string
  }
  return undefined
}

export const getSupabaseConfig = (): { url: string; anonKey: string } => {
  const url =
    readEnv('SUPABASE_URL', 'VITE_SUPABASE_URL') ||
    'https://placeholder-project.supabase.co'
  const anonKey =
    readEnv('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') ||
    'placeholder-anon-key'
  return { url, anonKey }
}

/**
 * Build a Supabase client that acts on behalf of the caller.
 *
 * The user's JWT is forwarded in `Authorization` so PostgREST+RLS see the real
 * `auth.uid()`. Sessions are disabled — each invocation is stateless.
 */
export const createUserClient = (userJwt: string): SupabaseClient => {
  const { url, anonKey } = getSupabaseConfig()
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`,
      },
    },
  })
}

/**
 * Build a Supabase client using the service-role key.
 *
 * CAUTION — this client bypasses RLS. Use ONLY from:
 *   - Stripe / other webhook handlers where the event is signature-verified
 *   - Internal cron jobs
 *   - Admin-only migrations/backfills
 *
 * Never from a user-facing endpoint. Returns `null` if the service key isn't
 * configured so callers can degrade gracefully in dev/preview.
 */
export const getServiceSupabase = (): SupabaseClient | null => {
  const url = readEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
