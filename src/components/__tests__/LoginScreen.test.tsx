// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { ComponentProps, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: ComponentProps<'div'>) => <div {...props}>{children as ReactNode}</div>,
    },
    useReducedMotion: () => true,
  }
})

import { LoginScreen } from '@/components/LoginScreen'

describe('LoginScreen accessibility', () => {
  it('renders skip link and preview region for screen readers', () => {
    render(<LoginScreen />)

    expect(screen.getByRole('link', { name: /Skip to sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Your daily state, in 10 seconds/i })).toHaveAttribute('id', 'login-title')
    expect(screen.getByRole('region', { name: /App preview cards/i })).toBeInTheDocument()
  })
})
