// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthGate } from '@/components/AuthGate'
import { AUTH_GATE_COPY } from '@/lib/guest-discovery'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}))

vi.mock('@phosphor-icons/react', () => ({
  Envelope: () => <span />,
  CircleNotch: () => <span />,
}))

vi.mock('@/hooks/use-supabase-auth', () => ({
  useSupabaseAuth: () => ({
    signInWithOAuth: vi.fn(),
    signInWithOtp: vi.fn(),
    authError: null,
    isLoading: false,
  }),
}))

vi.mock('@/lib/observability/analytics', () => ({
  track: vi.fn(),
}))

describe('AuthGate', () => {
  it('puts email first, explains why sign in, and keeps a map browse escape', () => {
    render(
      <MemoryRouter>
        <AuthGate />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: AUTH_GATE_COPY.title })).toBeInTheDocument()
    expect(screen.getByText(AUTH_GATE_COPY.why)).toBeInTheDocument()
    const email = screen.getByLabelText('Email')
    const magic = screen.getByRole('button', { name: AUTH_GATE_COPY.magicLink })
    const google = screen.getByRole('button', { name: 'Continue with Google' })
    expect(email.compareDocumentPosition(magic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(magic.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('link', { name: AUTH_GATE_COPY.browse })).toHaveAttribute('href', '/')
    expect(screen.queryByText(/signal/i)).not.toBeInTheDocument()
  })
})
