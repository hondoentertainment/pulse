// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// ── Framer Motion ──────────────────────────────────────────────
vi.mock('framer-motion', () => {
  const strip = (props: Record<string, unknown>) => {
    const filtered: Record<string, unknown> = {}
    const blocked = new Set(['initial','animate','exit','transition','whileHover','whileTap','whileInView','whileDrag','drag','dragConstraints','dragElastic','layout','layoutId','variants','custom','onAnimationComplete','style'])
    for (const [k, v] of Object.entries(props)) {
      if (blocked.has(k)) continue
      if (typeof v === 'function' && !k.startsWith('on')) continue
      filtered[k] = v
    }
    return filtered
  }
  return {
    motion: {
      div: ({ children, ...p }: any) => <div {...strip(p)}>{children}</div>,
      button: ({ children, ...p }: any) => <button {...strip(p)}>{children}</button>,
      span: ({ children, ...p }: any) => <span {...strip(p)}>{children}</span>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

vi.mock('@phosphor-icons/react', () => ({
  X: (p: any) => <span data-testid="icon-X" {...p} />,
  VideoCamera: (p: any) => <span data-testid="icon-VideoCamera" {...p} />,
  CheckCircle: (p: any) => <span data-testid="icon-CheckCircle" {...p} />,
  Hash: (p: any) => <span data-testid="icon-Hash" {...p} />,
  Camera: (p: any) => <span data-testid="icon-Camera" {...p} />,
  Sparkle: (p: any) => <span data-testid="icon-Sparkle" {...p} />,
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: () => false,
}))

vi.mock('@/lib/platform/platform', () => ({
  Platform: {
    camera: {
      pick: vi.fn(async () => null),
    },
  },
}))

vi.mock('@/lib/vibe-photo-flow', () => ({
  preparePulsePhoto: vi.fn(),
  assessPreparedPhoto: vi.fn(),
  photosForPulseSubmit: () => [],
}))

vi.mock('@github/spark/hooks', () => ({
  useKV: (_key: string, defaultValue: any) => [defaultValue, vi.fn()],
}))

// ── Toast ──────────────────────────────────────────────────────
const toastError = vi.fn()
const toastSuccess = vi.fn()
const toastLoading = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: any[]) => toastError(...args),
    success: (...args: any[]) => toastSuccess(...args),
    loading: (...args: any[]) => toastLoading(...args),
    info: vi.fn(),
  },
}))

// ── Lib mocks ──────────────────────────────────────────────────
const screenContentMock = vi.fn((text: string) => {
  if (text.toLowerCase().includes('badword')) return ['Inappropriate language detected']
  return []
})
vi.mock('@/lib/content-moderation', () => ({
  screenContent: (t: string) => screenContentMock(t),
}))

// Authoritative server-side moderation lives in a separate module; without a
// mock it would try to call supabase/fetch and block submit in tests.
vi.mock('@/lib/moderation-client', () => ({
  moderateServer: vi.fn(async () => ({ allowed: true, reasons: [], severity: 'low' })),
}))

vi.mock('@/lib/seeded-hashtags', () => ({
  suggestHashtags: () => [],
  getTimeOfDay: () => 'night',
  getDayOfWeek: () => 'friday',
}))

vi.mock('@/lib/video-compression', () => ({
  compressVideo: vi.fn(),
  formatFileSize: (b: number) => `${b} B`,
  getCompressionRatio: () => 50,
}))

vi.mock('@/lib/haptics', () => ({
  triggerEnergyChangeHaptic: vi.fn(),
}))

// ── Child mocks ────────────────────────────────────────────────
vi.mock('@/components/EnergySlider', () => ({
  EnergySlider: ({ value, onChange }: any) => (
    <div data-testid="energy-slider">
      <p data-testid="current-energy">{value}</p>
      <button onClick={() => onChange('electric')}>Set Electric</button>
      <button onClick={() => onChange('buzzing')}>Set Buzzing</button>
      <button onClick={() => onChange('dead')}>Set Dead</button>
    </div>
  ),
}))

// ── Imports (after mocks) ─────────────────────────────────────
import { CreatePulseDialog } from '@/components/CreatePulseDialog'
import type { Venue } from '@/lib/types'

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-1',
    name: 'Test Venue',
    location: { lat: 40.7, lng: -74.0, address: '123 Main St' },
    pulseScore: 65,
    category: 'Bar',
    ...overrides,
  }
}

describe('CreatePulseDialog', () => {
  beforeEach(() => {
    toastError.mockClear()
    toastSuccess.mockClear()
    toastLoading.mockClear()
    screenContentMock.mockClear()
  })

  it('does not render when open=false', () => {
    const onClose = vi.fn()
    const onSubmit = vi.fn()
    render(
      <CreatePulseDialog
        open={false}
        onClose={onClose}
        venue={makeVenue()}
        onSubmit={onSubmit}
      />
    )
    expect(screen.queryByText(/Photo review at Test Venue/)).not.toBeInTheDocument()
  })

  it('renders venue name in title when open', () => {
    render(
      <CreatePulseDialog
        open
        onClose={vi.fn()}
        venue={makeVenue({ name: 'The Buzzy Bar' })}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText(/Photo review at The Buzzy Bar/)).toBeInTheDocument()
  })

  it('fills caption and enforces 140 char cap', () => {
    render(
      <CreatePulseDialog open onClose={vi.fn()} venue={makeVenue()} onSubmit={vi.fn()} />
    )
    const textarea = screen.getByPlaceholderText(/Tip for others/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Amazing night!' } })
    expect(textarea.value).toBe('Amazing night!')
    expect(screen.getByText(/14\/140/)).toBeInTheDocument()

    // Exceed 140 — should be capped
    const long = 'a'.repeat(200)
    fireEvent.change(textarea, { target: { value: long } })
    expect(textarea.value.length).toBe(140)
  })

  it('updates energy via slider interaction', () => {
    render(
      <CreatePulseDialog open onClose={vi.fn()} venue={makeVenue()} onSubmit={vi.fn()} />
    )
    expect(screen.getByTestId('current-energy').textContent).toBe('chill')
    fireEvent.click(screen.getByText('Set Electric'))
    expect(screen.getByTestId('current-energy').textContent).toBe('electric')
  })

  it('shows Add photo control', () => {
    render(
      <CreatePulseDialog open onClose={vi.fn()} venue={makeVenue()} onSubmit={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /Add photo/i })).toBeInTheDocument()
    expect(screen.getByTestId('energy-slider')).toBeInTheDocument()
  })

  it('submits with caption and energy', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <CreatePulseDialog
        open
        onClose={onClose}
        venue={makeVenue()}
        onSubmit={onSubmit}
      />
    )
    fireEvent.change(screen.getByPlaceholderText(/Tip for others/i), {
      target: { value: 'Great vibes' },
    })
    fireEvent.click(screen.getByText('Set Buzzing'))

    fireEvent.click(screen.getByRole('button', { name: /Post live review/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.energyRating).toBe('buzzing')
    expect(payload.caption).toBe('Great vibes')
    expect(payload.photos).toEqual([])
    expect(onClose).toHaveBeenCalled()
  })

  it('blocks submit on moderation failure', async () => {
    const onSubmit = vi.fn()
    render(
      <CreatePulseDialog
        open
        onClose={vi.fn()}
        venue={makeVenue()}
        onSubmit={onSubmit}
      />
    )
    fireEvent.change(screen.getByPlaceholderText(/Tip for others/i), {
      target: { value: 'this has badword inside' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Post live review/i }))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Cancel button calls onClose without submitting', () => {
    const onClose = vi.fn()
    const onSubmit = vi.fn()
    render(
      <CreatePulseDialog
        open
        onClose={onClose}
        venue={makeVenue()}
        onSubmit={onSubmit}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }))
    expect(onClose).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does nothing when venue is null on submit', async () => {
    const onSubmit = vi.fn()
    render(
      <CreatePulseDialog open onClose={vi.fn()} venue={null} onSubmit={onSubmit} />
    )
    // Button still renders; click should be a no-op
    fireEvent.click(screen.getByRole('button', { name: /Post live review/i }))
    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })
})
