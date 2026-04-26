// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('framer-motion', () => {
  const strip = (props: Record<string, unknown>) => {
    const filtered: Record<string, unknown> = {}
    const blocked = new Set(['initial','animate','exit','transition','whileHover','whileTap','whileInView','whileDrag','drag','dragConstraints','dragElastic','layout','layoutId','variants','custom','onAnimationComplete'])
    for (const [k, v] of Object.entries(props)) {
      if (blocked.has(k)) continue
      if (typeof v === 'function' && !k.startsWith('on')) continue
      filtered[k] = v
    }
    return filtered
  }
  return {
    motion: {
      div: ({ children, ...props }: any) => <div {...strip(props)}>{children}</div>,
      button: ({ children, ...props }: any) => <button {...strip(props)}>{children}</button>,
      span: ({ children, ...props }: any) => <span {...strip(props)}>{children}</span>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

vi.mock('@phosphor-icons/react', () => ({
  Lightning: (p: any) => <span data-testid="icon-Lightning" {...p} />,
  MapPin: (p: any) => <span data-testid="icon-MapPin" {...p} />,
  Users: (p: any) => <span data-testid="icon-Users" {...p} />,
  Fire: (p: any) => <span data-testid="icon-Fire" {...p} />,
  Compass: (p: any) => <span data-testid="icon-Compass" {...p} />,
  ArrowRight: (p: any) => <span data-testid="icon-ArrowRight" {...p} />,
  Check: (p: any) => <span data-testid="icon-Check" {...p} />,
}))

import { OnboardingFlow } from '@/components/OnboardingFlow'

describe('OnboardingFlow', () => {
  it('renders welcome step by default', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />)
    expect(screen.getByText(/Welcome to Pulse/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument()
  })

  it('advances through all steps to completion event', () => {
    const onComplete = vi.fn()
    render(<OnboardingFlow onComplete={onComplete} />)

    // Welcome -> Categories
    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }))
    expect(screen.getByText(/What's your scene/i)).toBeInTheDocument()

    // Select a category (Continue is disabled otherwise)
    const barsBtn = screen.getByRole('button', { name: /Bars & Pubs/i })
    fireEvent.click(barsBtn)
    const continueBtn = screen.getByRole('button', { name: /^Continue/i })
    expect(continueBtn).not.toBeDisabled()
    fireEvent.click(continueBtn)

    // Times step
    expect(screen.getByText(/When do you go out/i)).toBeInTheDocument()
    // With no selections, the CTA is labeled "Skip"
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }))

    // Permissions step
    expect(screen.getByText(/Enable permissions/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Location Access/i }))
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Continue/i }))

    // Ready step
    expect(screen.getByText(/You're all set/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Start Exploring/i }))

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith({
      favoriteCategories: ['bar'],
      preferredTimes: [],
      enableLocation: true,
      enableNotifications: true,
    })
  })

  it('disables continue on categories step when nothing selected', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }))
    const continueBtn = screen.getByRole('button', { name: /^Continue/i })
    expect(continueBtn).toBeDisabled()
  })

  it('persists selections across steps', () => {
    const onComplete = vi.fn()
    render(<OnboardingFlow onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }))

    // Select 2 categories
    fireEvent.click(screen.getByRole('button', { name: /Bars & Pubs/i }))
    fireEvent.click(screen.getByRole('button', { name: /Nightclubs/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Continue/i }))

    // Select 1 time preference
    fireEvent.click(screen.getByRole('button', { name: /Happy Hour/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Continue/i }))

    // Skip perms
    fireEvent.click(screen.getByRole('button', { name: /^Continue/i }))

    // Ready page shows selected counts
    expect(screen.getByText(/2 venue types selected/i)).toBeInTheDocument()
    expect(screen.getByText(/1 time preference set/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Start Exploring/i }))

    const payload = onComplete.mock.calls[0][0]
    expect(payload.favoriteCategories).toEqual(['bar', 'club'])
    expect(payload.preferredTimes).toEqual(['happy-hour'])
  })

  it('toggling a category twice removes it', () => {
    const onComplete = vi.fn()
    render(<OnboardingFlow onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }))
    const barBtn = screen.getByRole('button', { name: /Bars & Pubs/i })
    fireEvent.click(barBtn)
    fireEvent.click(barBtn)
    // Continue should be disabled again
    expect(screen.getByRole('button', { name: /^Continue/i })).toBeDisabled()
  })

  it('shows "Continue" label on times step when selections exist', () => {
    render(<OnboardingFlow onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Get Started/i }))
    fireEvent.click(screen.getByRole('button', { name: /Bars & Pubs/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /Late Night/i }))
    expect(screen.getByRole('button', { name: /^Continue/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Skip/i })).not.toBeInTheDocument()
  })
})
