// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OfflineBanner } from '@/components/OfflineBanner'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}))

describe('OfflineBanner', () => {
  it('shows Figma offline copy and keep browsing', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    render(<OfflineBanner />)
    expect(screen.getByText(/You’re offline/)).toBeInTheDocument()
    expect(screen.getByText(/last known energy/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Keep browsing/i }))
    expect(screen.queryByText(/You’re offline/)).not.toBeInTheDocument()
  })

  it('shows Back online after a reconnect', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    render(<OfflineBanner />)
    expect(screen.getByText(/You’re offline/)).toBeInTheDocument()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    fireEvent(window, new Event('online'))
    expect(screen.getByText(/Back online/)).toBeInTheDocument()
    expect(screen.queryByText(/You’re offline/)).not.toBeInTheDocument()
  })
})
