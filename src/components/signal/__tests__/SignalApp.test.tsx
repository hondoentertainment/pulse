// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SignalEntry, SignalProfile } from '@/lib/signal-insights'
import { useSignalStore } from '@/stores/use-signal-store'

const downloadTextFile = vi.fn()

vi.mock('@/lib/signal-export', async () => {
  const actual = await vi.importActual<typeof import('@/lib/signal-export')>('@/lib/signal-export')
  return {
    ...actual,
    downloadTextFile: (...args: unknown[]) => downloadTextFile(...args),
  }
})

vi.mock('@/hooks/use-supabase-auth', () => ({
  useSupabaseAuth: () => ({
    user: { id: 'user-1' },
    session: { access_token: 'jwt-token' },
    signOut: vi.fn(),
    isLoading: false,
  }),
}))

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    hasSupabaseConfig: false,
  }
})

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

import { SignalApp } from '@/components/signal/SignalApp'

const profile: SignalProfile = {
  trackingFocus: 'energy',
  goal: 'more_energy',
}

const entry = (overrides: Partial<SignalEntry> = {}): SignalEntry => ({
  id: overrides.id ?? 'morning-1',
  userId: 'user-1',
  createdAt: overrides.createdAt ?? '2026-08-16T09:00:00.000Z',
  focus: 'energy',
  score: overrides.score ?? 72,
  energy: 7,
  mood: 7,
  stress: 4,
  sleepQuality: 7,
  tags: overrides.tags ?? ['calm'],
  window: overrides.window ?? 'morning',
  dayKey: overrides.dayKey ?? '2026-08-16',
})

function resetStore(entries: SignalEntry[]) {
  useSignalStore.setState({
    profile,
    entries,
    draft: { energy: 7, mood: 7, stress: 4, sleepQuality: 7, tags: ['calm'] },
    savedAt: null,
    firstWinOpen: false,
    reminderEnabled: false,
  })
}

function renderSignal() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <SignalApp />
    </QueryClientProvider>,
  )
}

describe('SignalApp shipping flows', () => {
  beforeEach(() => {
    localStorage.clear()
    downloadTextFile.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('shows Today is logged when the current window is already saved', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 7, 16, 9, 30))
    resetStore([entry()])
    renderSignal()
    expect(await screen.findByText(/Today is logged/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save today's signal/i })).not.toBeInTheDocument()
  })

  it('opens the evening check-in after noon when morning is logged', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 7, 16, 15, 30))
    resetStore([entry()])
    renderSignal()
    expect(await screen.findByRole('button', { name: /Save today's signal/i })).toBeInTheDocument()
    expect(screen.queryByText(/Today is logged/i)).not.toBeInTheDocument()
    expect(screen.getByText(/ready when you are/i)).toBeInTheDocument()
  })

  it('shows weekly summary and tag patterns on Trends', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 7, 30, 21))
    resetStore([
      entry({ id: 'm', score: 60, tags: ['calm'], window: 'morning', dayKey: '2026-08-28', createdAt: '2026-08-28T08:00:00.000Z' }),
      entry({ id: 'e', score: 80, tags: ['calm'], window: 'evening', dayKey: '2026-08-28', createdAt: '2026-08-28T20:00:00.000Z' }),
    ])
    renderSignal()
    fireEvent.click(screen.getByRole('link', { name: /Trends/i }))
    expect(await screen.findByText(/Weekly summary/i)).toBeInTheDocument()
    expect(screen.getByText(/Tag patterns/i)).toBeInTheDocument()
    expect(screen.getByText(/2 check-ins/i)).toBeInTheDocument()
  })

  it('exports a CSV of this account’s rows', async () => {
    resetStore([
      entry({ id: 'mine', score: 74, dayKey: '2026-08-16', window: 'morning' }),
    ])
    renderSignal()
    fireEvent.click(screen.getByRole('link', { name: /Settings/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Export CSV/i }))
    expect(downloadTextFile).toHaveBeenCalledTimes(1)
    const [filename, csv] = downloadTextFile.mock.calls[0] as [string, string]
    expect(filename).toMatch(/pulse-signal-.*\.csv/)
    expect(csv).toContain('day_key,window,score')
    expect(csv).toContain('2026-08-16,morning,74')
    expect(csv.split('\n')).toHaveLength(2)
  })

  it('posts Delete my data to the account-delete handler', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    resetStore([entry()])
    renderSignal()
    fireEvent.click(screen.getByRole('link', { name: /Settings/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Delete my data/i }))
    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/i), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: /^Delete data$/i }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/signal/account-delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ confirm: 'DELETE' }),
        }),
      )
    })
  })
})
