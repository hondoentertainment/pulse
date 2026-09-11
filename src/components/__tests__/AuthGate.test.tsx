// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthGate } from '@/components/AuthGate'
import { WRITE_AUTH_COPY } from '@/lib/guest-discovery'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}))

vi.mock('@phosphor-icons/react', () => ({
  Lightning: () => <span />,
  Envelope: () => <span />,
  CircleNotch: () => <span />,
  WarningCircle: () => <span />,
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
  it('keeps the write gate with hairline chrome and a map browse escape', () => {
    render(
      <MemoryRouter>
        <AuthGate />
      </MemoryRouter>,
    )
    expect(screen.getByText(WRITE_AUTH_COPY.create.title)).toBeInTheDocument()
    expect(screen.getByText(WRITE_AUTH_COPY.create.description)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome to Pulse' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send Magic Link' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Keep browsing the map' })).toHaveAttribute('href', '/')
  })
})
