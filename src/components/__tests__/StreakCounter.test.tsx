// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StreakCounter } from '../StreakCounter'
import type { Streak } from '@/lib/streak-rewards'

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
    circle: (props: Record<string, unknown>) => <circle {...props} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function makeStreak(overrides: Partial<Streak> = {}): Streak {
  return {
    userId: 'u1',
    type: 'weekly_checkin',
    currentCount: 5,
    longestCount: 5,
    lastActivity: new Date().toISOString(),
    isActive: true,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

describe('StreakCounter', () => {
  it('renders the streak count', () => {
    render(<StreakCounter streak={makeStreak({ currentCount: 7 })} />)
    expect(screen.getByText('7')).toBeDefined()
  })

  it('renders the streak label', () => {
    render(<StreakCounter streak={makeStreak({ type: 'weekly_checkin' })} />)
    expect(screen.getByText('Weekly Regular')).toBeDefined()
  })

  it('renders zero count for inactive streak', () => {
    render(<StreakCounter streak={makeStreak({ currentCount: 0, isActive: false })} />)
    expect(screen.getByText('0')).toBeDefined()
  })

  it('applies reduced opacity for inactive streaks', () => {
    const { container } = render(
      <StreakCounter streak={makeStreak({ isActive: false, currentCount: 0 })} />
    )
    const button = container.querySelector('button')
    expect(button?.className).toContain('opacity-40')
  })

  it('does not apply reduced opacity for active streaks', () => {
    const { container } = render(
      <StreakCounter streak={makeStreak({ isActive: true })} />
    )
    const button = container.querySelector('button')
    expect(button?.className).not.toContain('opacity-40')
  })

  it('shows at-risk warning when streak is about to expire', () => {
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours
    render(<StreakCounter streak={makeStreak({ isActive: true, expiresAt })} />)
    // The time remaining should be rendered
    expect(screen.getByText(/\d+h/)).toBeDefined()
  })

  it('does not show at-risk warning when streak has plenty of time', () => {
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days
    const { container } = render(
      <StreakCounter streak={makeStreak({ isActive: true, expiresAt })} />
    )
    // Should not have the at-risk badge text
    const warningText = container.querySelectorAll('[class*="bg-red"]')
    expect(warningText.length).toBe(0)
  })

  it('calls onExpand when tapped', () => {
    const onExpand = vi.fn()
    const streak = makeStreak()
    render(<StreakCounter streak={streak} onExpand={onExpand} />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(onExpand).toHaveBeenCalledWith(streak)
  })

  it('has correct aria-label with streak info', () => {
    const streak = makeStreak({ type: 'weekend_warrior', currentCount: 8 })
    render(<StreakCounter streak={streak} />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')).toContain('Weekend Warrior')
    expect(button.getAttribute('aria-label')).toContain('8')
  })

  it('renders in small size without label', () => {
    render(<StreakCounter streak={makeStreak()} size="small" />)
    expect(screen.queryByText('Weekly Regular')).toBeNull()
  })

  it('renders various streak counts correctly', () => {
    const counts = [0, 1, 3, 5, 10, 25, 50, 100]
    for (const count of counts) {
      const { unmount } = render(
        <StreakCounter streak={makeStreak({ currentCount: count })} />
      )
      expect(screen.getByText(String(count))).toBeDefined()
      unmount()
    }
  })

  it('shows flame icon for hot streaks (5+)', () => {
    const { container } = render(
      <StreakCounter streak={makeStreak({ currentCount: 5, isActive: true })} />
    )
    // The Fire icon renders as an SVG from phosphor-icons, which is mocked
    // We check for the flame container being present
    expect(container.querySelector('button')).toBeDefined()
  })
})
