// @vitest-environment jsdom
import type { ButtonHTMLAttributes, JSX } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArrivalPrompt } from '@/components/ArrivalPrompt'
import { GeoLaunchGate } from '@/components/GeoLaunchGate'
import { ScoutProgramCard } from '@/components/ScoutProgramCard'
import { WorthGoingSummary } from '@/components/WorthGoingSummary'
import { parseLaunchedCities } from '@/lib/geo-launch'
import { clearScoutProgram } from '@/lib/scout-program'
import { DEFAULT_VENUE_SIGNAL_MODEL } from '@/lib/venue-signal'
import { buildWorthGoingSummary } from '@/lib/worth-going'

vi.mock('@phosphor-icons/react', () => {
  const icons = ['Binoculars', 'Broadcast', 'Clock', 'Gauge', 'MapPin', 'Queue', 'Sparkle']
  const exports: Record<string, (props: Record<string, unknown>) => JSX.Element> = {}
  for (const name of icons) {
    exports[name] = (props) => <span data-testid={`icon-${name}`} {...props} />
  }
  return exports
})

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

afterEach(() => {
  clearScoutProgram()
})

describe('WorthGoingSummary', () => {
  it('renders verdict, confidence, freshness, friction, and source mix', () => {
    const summary = buildWorthGoingSummary({
      venueId: 'venue-1',
      model_configuration: DEFAULT_VENUE_SIGNAL_MODEL,
      energyScore: 72,
      energyLabel: 'Buzzing',
      confidence: 'high',
      trend: 'rising',
      freshnessMinutes: 6,
      sourceMix: { pulses: 3, liveReports: 2, curatedSeed: true, sources: ['pulse', 'live_intel'] },
      friction: { waitMinutes: 5, lineStatus: 'moving', coverCharge: 10, label: '~5 min door · $10 cover' },
      computedAt: '2026-08-25T23:00:00.000Z',
      withinPropagationSla: true,
    })

    render(<WorthGoingSummary summary={summary} />)

    expect(screen.getByTestId('worth-going-summary')).toBeDefined()
    expect(screen.getByText('Worth going')).toBeDefined()
    expect(screen.getByText('high')).toBeDefined()
    expect(screen.getByText(/Fresh/)).toBeDefined()
    expect(screen.getByText(/5 min door/)).toBeDefined()
    expect(screen.getByText(/3 pulses/)).toBeDefined()
  })
})

describe('ArrivalPrompt', () => {
  it('confirms or reports a mismatch with one tap', () => {
    const onConfirm = vi.fn()
    const onMismatch = vi.fn()
    render(
      <ArrivalPrompt
        watch={{
          id: 'arrival-1',
          venueId: 'venue-1',
          venueName: 'Neumos',
          startedAt: '2026-08-25T23:00:00.000Z',
          windowMs: 45 * 60_000,
          status: 'ready',
        }}
        onConfirm={onConfirm}
        onMismatch={onMismatch}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Matches' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Off' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quieter' }))
    expect(onMismatch).toHaveBeenCalledWith('quieter')
  })
})

describe('ScoutProgramCard', () => {
  it('submits an application for Seattle neighborhoods', () => {
    const onSubmitted = vi.fn()
    render(<ScoutProgramCard userId="user-1" onSubmitted={onSubmitted} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'I can confirm Capitol Hill door times most Friday nights.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply as scout' }))

    expect(onSubmitted).toHaveBeenCalledTimes(1)
    expect(onSubmitted.mock.calls[0][0].city).toBe('Seattle,WA')
    expect(screen.getByText('Application in review')).toBeDefined()
  })
})

describe('GeoLaunchGate', () => {
  it('states the Seattle,WA geo-gate and curated inventory', () => {
    render(
      <GeoLaunchGate markets={parseLaunchedCities('Seattle,WA')} venueCount={32} />,
    )

    expect(screen.getByTestId('geo-launch-gate')).toBeDefined()
    expect(screen.getByText(/Launch cities: Seattle,WA/)).toBeDefined()
    expect(screen.getByText(/32 curated Seattle listings/)).toBeDefined()
  })
})
