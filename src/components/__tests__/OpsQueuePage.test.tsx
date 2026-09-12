// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OpsQueuePage } from '@/components/OpsQueuePage'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@/hooks/use-supabase-auth', () => ({
  useSupabaseAuth: () => ({
    session: { user: { app_metadata: { role: 'user' } } },
    isPlaceholder: false,
    isLoading: false,
  }),
}))

vi.mock('@/lib/ops-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ops-client')>('@/lib/ops-client')
  return {
    ...actual,
    listOpsClaims: vi.fn(),
    listOpsReports: vi.fn(),
  }
})

describe('OpsQueuePage', () => {
  it('keeps the runbook path when the signed-in user is not admin', () => {
    render(<OpsQueuePage />)
    expect(screen.getByRole('heading', { name: /Tonight’s ops queue/ })).toBeInTheDocument()
    expect(screen.getByText(/Admin role required/)).toBeInTheDocument()
    expect(screen.getByText(/app_metadata.role = admin/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument()
  })
})
