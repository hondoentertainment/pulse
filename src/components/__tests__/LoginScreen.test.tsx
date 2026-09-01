// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginScreen } from '@/components/LoginScreen'

vi.mock('@/hooks/use-supabase-auth', () => ({
  useSupabaseAuth: () => ({
    signIn: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithOtp: vi.fn(),
    isPlaceholder: true,
    authError: null,
    isLoading: false,
  }),
}))

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}))

describe('LoginScreen', () => {
  it('renders the Signal heading on the auth-gated path', () => {
    render(<LoginScreen />)
    expect(screen.getByRole('heading', { name: /Your daily state, in 10 seconds/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument()
  })
})
