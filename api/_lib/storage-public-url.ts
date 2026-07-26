/**
 * Resolve a Supabase Storage object key to a public HTTPS URL.
 * Used by vibe assess when clients pass `storageKey` instead of a full URL.
 */

import { getSupabaseConfig } from './supabase-server'

const DEFAULT_BUCKET = 'pulse-videos'

/**
 * Build a public object URL for a storage key.
 * Accepts bare keys (`user/photos/x.jpg`) or bucket-prefixed keys.
 */
export function storageKeyToPublicUrl(storageKey: string, bucket = DEFAULT_BUCKET): string | null {
  const trimmed = storageKey.trim()
  if (!trimmed || trimmed.length > 512) return null
  if (trimmed.includes('..') || trimmed.startsWith('/')) return null
  if (!/^[a-zA-Z0-9/_.-]+$/.test(trimmed)) return null

  const { url } = getSupabaseConfig()
  const base = url.replace(/\/$/, '')
  if (!base || base.includes('placeholder')) {
    // Still return a well-formed URL so callers can pass it through;
    // Anthropic will fail clearly if the host is unreachable.
  }

  let objectPath = trimmed
  const bucketPrefix = `${bucket}/`
  if (objectPath.startsWith(bucketPrefix)) {
    objectPath = objectPath.slice(bucketPrefix.length)
  }

  return `${base}/storage/v1/object/public/${bucket}/${objectPath}`
}
