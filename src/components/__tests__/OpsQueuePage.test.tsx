// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsQueuePage } from '@/components/OpsQueuePage'

const { authState, decideOpsClaim, listOpsClaims, listOpsReports } = vi.hoisted(() => ({
  authState: {
    session: { user: { app_metadata: { role: 'user' } } } as {
      user: { app_metadata: { role: string } }
    },
    isPlaceholder: false,
    isLoading: false,
  },
  decideOpsClaim: vi.fn(),
  listOpsClaims: vi.fn(),
  listOpsReports: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@/hooks/use-supabase-auth', () => ({
  useSupabaseAuth: () => authState,
}))

vi.mock('@/lib/ops-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ops-client')>('@/lib/ops-client')
  return {
    ...actual,
    decideOpsClaim,
    listOpsClaims,
    listOpsReports,
  }
})

describe('OpsQueuePage', () => {
  beforeEach(() => {
    authState.session = { user: { app_metadata: { role: 'user' } } }
    authState.isPlaceholder = false
    authState.isLoading = false
    decideOpsClaim.mockReset()
    decideOpsClaim.mockResolvedValue(undefined)
    listOpsClaims.mockReset()
    listOpsReports.mockReset()
    listOpsReports.mockResolvedValue([])
  })

  it('keeps the runbook path when the signed-in user is not admin', () => {
    render(<OpsQueuePage />)
    expect(screen.getByRole('heading', { name: /Tonight’s ops queue/ })).toBeInTheDocument()
    expect(screen.getByText(/Admin role required/)).toBeInTheDocument()
    expect(screen.getAllByText(/app_metadata.role = admin/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument()
  })

  it('shows venue, neighborhood, status, and submitted time, and keeps Verify and Reject', async () => {
    authState.session = { user: { app_metadata: { role: 'admin' } } }
    listOpsClaims.mockResolvedValue([{
      id: 'c1',
      venue_id: 'v1',
      status: 'pending',
      created_at: '2026-09-12T01:00:00.000Z',
      venue_name: 'Neumos',
      neighborhood: 'Capitol Hill',
      user_id: 'user-9',
      evidence: 'lease paperwork',
      notes: 'operator note',
      work_email: 'gm@neumos.com',
    }])
    listOpsReports.mockResolvedValue([{
      id: 'r1',
      pulse_id: 'p1',
      reporter_id: 'reporter-secret',
      reason: 'spam',
      details: 'bots in the line',
      created_at: '2026-09-12T01:00:00.000Z',
      status: 'pending',
      reviewed_at: null,
    }])

    render(<OpsQueuePage />)

    expect(await screen.findByText('Neumos')).toBeInTheDocument()
    expect(screen.getByText(/Capitol Hill · pending ·/)).toBeInTheDocument()
    expect(screen.getByText('spam')).toBeInTheDocument()
    expect(screen.getByText('bots in the line')).toBeInTheDocument()
    expect(screen.queryByText(/Admin role required/)).not.toBeInTheDocument()
    for (const secret of ['lease paperwork', 'user-9', 'operator note', 'gm@neumos.com', 'reporter-secret']) {
      expect(screen.queryByText(secret)).not.toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    await waitFor(() => {
      expect(decideOpsClaim).toHaveBeenCalledWith({ claimId: 'c1', status: 'verified' })
      expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() => {
      expect(decideOpsClaim).toHaveBeenCalledWith({
        claimId: 'c1',
        status: 'rejected',
        notes: 'Rejected from /ops',
      })
    })
  })
})
