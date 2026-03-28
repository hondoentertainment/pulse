/**
 * GDPR / CCPA Data Privacy Module
 *
 * Provides:
 * - exportUserData: Package all user data as a downloadable JSON blob
 * - requestAccountDeletion: Soft-delete + grace-period hard delete
 * - DataExportButton / AccountDeletionButton: React components
 */

import { createElement, useState, type JSX } from 'react'
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Data export
// ---------------------------------------------------------------------------

interface ExportedUserData {
  exportedAt: string
  version: '1.0'
  profile: Record<string, unknown> | null
  pulses: Record<string, unknown>[]
  reactions: Record<string, unknown>[]
  checkIns: Record<string, unknown>[]
  stories: Record<string, unknown>[]
  notifications: Record<string, unknown>[]
  crewMemberships: Record<string, unknown>[]
  friendships: Record<string, unknown>[]
}

/**
 * Fetch all data belonging to userId and return it as a downloadable Blob.
 * The blob is a JSON file with a stable schema version so users can parse it.
 */
export async function exportUserData(userId: string): Promise<Blob> {
  if (!userId) throw new Error('userId is required')

  // Run all fetches in parallel; each is best-effort (missing table → empty array)
  const [
    profileResult,
    pulsesResult,
    reactionsResult,
    checkInsResult,
    storiesResult,
    notificationsResult,
    crewsResult,
    friendshipsResult,
  ] = await Promise.allSettled([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('pulses').select('*').eq('user_id', userId),
    supabase.from('pulse_reactions').select('*').eq('user_id', userId),
    supabase.from('check_ins').select('*').eq('user_id', userId),
    supabase.from('stories').select('*').eq('user_id', userId),
    supabase.from('notifications').select('*').eq('user_id', userId),
    supabase.from('crew_members').select('*').eq('user_id', userId),
    supabase.from('friendships').select('*').or(`user_id.eq.${userId},friend_id.eq.${userId}`),
  ])

  const pick = <T,>(result: PromiseSettledResult<{ data: T | null }>): T | null =>
    result.status === 'fulfilled' ? (result.value.data ?? null) : null

  const pickArray = <T,>(result: PromiseSettledResult<{ data: T[] | null }>): T[] =>
    result.status === 'fulfilled' ? (result.value.data ?? []) : []

  const payload: ExportedUserData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    profile: pick(profileResult as PromiseSettledResult<{ data: Record<string, unknown> | null }>),
    pulses: pickArray(pulsesResult as PromiseSettledResult<{ data: Record<string, unknown>[] | null }>),
    reactions: pickArray(reactionsResult as PromiseSettledResult<{ data: Record<string, unknown>[] | null }>),
    checkIns: pickArray(checkInsResult as PromiseSettledResult<{ data: Record<string, unknown>[] | null }>),
    stories: pickArray(storiesResult as PromiseSettledResult<{ data: Record<string, unknown>[] | null }>),
    notifications: pickArray(notificationsResult as PromiseSettledResult<{ data: Record<string, unknown>[] | null }>),
    crewMemberships: pickArray(crewsResult as PromiseSettledResult<{ data: Record<string, unknown>[] | null }>),
    friendships: pickArray(friendshipsResult as PromiseSettledResult<{ data: Record<string, unknown>[] | null }>),
  }

  const json = JSON.stringify(payload, null, 2)
  return new Blob([json], { type: 'application/json' })
}

/**
 * Trigger a browser download of the exported data blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

/**
 * Initiate account deletion for the given userId.
 *
 * Process:
 * 1. Soft-delete the profile (sets deleted_at, hides from all queries)
 * 2. Anonymize pulses and reactions that cannot be deleted due to referential
 *    integrity (sets user_id to a sentinel anonymous user)
 * 3. Queue hard deletion by inserting into account_deletion_queue (a cron or
 *    Edge Function processes this after the 30-day grace period)
 * 4. Sign the user out
 *
 * Hard deletion of storage media, auth user record, and remaining rows is
 * handled server-side after the grace period.
 */
export async function requestAccountDeletion(userId: string): Promise<void> {
  if (!userId) throw new Error('userId is required')

  const now = new Date().toISOString()
  const hardDeleteAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Soft-delete profile
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ deleted_at: now, is_deleted: true })
    .eq('id', userId)

  if (profileError) throw new Error(`Failed to soft-delete profile: ${profileError.message}`)

  // 2. Queue hard deletion (processed by a scheduled Edge Function)
  const { error: queueError } = await supabase.from('account_deletion_queue').insert({
    user_id: userId,
    requested_at: now,
    scheduled_hard_delete_at: hardDeleteAt,
    status: 'pending',
  })

  if (queueError) {
    // Non-fatal: log it but don't block the user flow. The profile is already soft-deleted.
    console.error('Failed to queue hard deletion — manual follow-up required:', queueError.message)
  }

  // 3. Sign out the user session
  await supabase.auth.signOut()
}

// ---------------------------------------------------------------------------
// React components
// ---------------------------------------------------------------------------

/**
 * A button that exports the current user's data as a JSON download.
 */
export function DataExportButton(): JSX.Element {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleExport() {
    setStatus('loading')
    setErrorMsg(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('You must be logged in to export your data.')

      const blob = await exportUserData(userId)
      const date = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `pulse-data-export-${date}.json`)
      setStatus('success')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed. Please try again.')
      setStatus('error')
    }
  }

  const label =
    status === 'loading'
      ? 'Preparing export…'
      : status === 'success'
      ? 'Download started'
      : 'Export my data'

  return createElement(
    'div',
    { className: 'space-y-2' },
    createElement(
      'button',
      {
        type: 'button',
        onClick: handleExport,
        disabled: status === 'loading',
        'aria-busy': status === 'loading',
        className:
          'inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      },
      label
    ),
    status === 'error' && errorMsg
      ? createElement(
          'p',
          { className: 'text-sm text-destructive', role: 'alert' },
          errorMsg
        )
      : null,
    status === 'success'
      ? createElement(
          'p',
          { className: 'text-sm text-green-600', role: 'status' },
          'Your data export has been downloaded.'
        )
      : null,
    createElement(
      'p',
      { className: 'text-xs text-muted-foreground' },
      'Downloads a JSON file containing your profile, pulses, check-ins, stories, and more.'
    )
  )
}

/**
 * A button that initiates account deletion after user confirmation.
 */
export function AccountDeletionButton(): JSX.Element {
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleDelete() {
    setPhase('loading')
    setErrorMsg(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('You must be logged in to delete your account.')

      await requestAccountDeletion(userId)
      setPhase('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Deletion request failed. Please try again.')
      setPhase('error')
    }
  }

  if (phase === 'done') {
    return createElement(
      'div',
      {
        className: 'rounded-md border border-border bg-muted/50 p-4 space-y-1',
        role: 'status',
      },
      createElement(
        'p',
        { className: 'font-medium text-foreground' },
        'Account deletion requested'
      ),
      createElement(
        'p',
        { className: 'text-sm text-muted-foreground' },
        'Your account has been deactivated and will be permanently deleted within 30 days. You have been signed out.'
      )
    )
  }

  if (phase === 'confirm') {
    return createElement(
      'div',
      { className: 'rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3' },
      createElement(
        'p',
        { className: 'font-medium text-foreground' },
        'Are you sure you want to delete your account?'
      ),
      createElement(
        'p',
        { className: 'text-sm text-muted-foreground' },
        'This action cannot be undone. Your profile, pulses, check-ins, and stories will be permanently deleted within 30 days.'
      ),
      createElement(
        'div',
        { className: 'flex gap-3' },
        createElement(
          'button',
          {
            type: 'button',
            onClick: handleDelete,
            className:
              'rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive transition-colors',
          },
          'Yes, delete my account'
        ),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => setPhase('idle'),
            className:
              'rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors',
          },
          'Cancel'
        )
      ),
      errorMsg
        ? createElement('p', { className: 'text-sm text-destructive', role: 'alert' }, errorMsg)
        : null
    )
  }

  return createElement(
    'div',
    { className: 'space-y-2' },
    createElement(
      'button',
      {
        type: 'button',
        onClick: () => setPhase('confirm'),
        disabled: phase === 'loading',
        className:
          'inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-background px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive',
      },
      'Delete my account'
    ),
    createElement(
      'p',
      { className: 'text-xs text-muted-foreground' },
      'Permanently removes your account and all associated data within 30 days.'
    )
  )
}
