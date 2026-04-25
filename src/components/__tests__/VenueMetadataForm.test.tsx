// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// ── Toast mock (sonner) ───────────────────────────────────────
const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
    loading: vi.fn(),
  },
}))

// ── Supabase mock (venue-admin-client imports it transitively) ──
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'admin-token' } } }),
    },
  },
}))

import { VenueMetadataForm } from '@/components/venue-admin/VenueMetadataForm'

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
})

describe('VenueMetadataForm', () => {
  it('renders every field label', () => {
    render(<VenueMetadataForm venueId="venue_1" venueName="Test Bar" />)
    expect(screen.getByText('Venue metadata')).toBeInTheDocument()
    expect(screen.getByText(/Editing/)).toBeInTheDocument()
    expect(screen.getByLabelText(/dress code/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cover charge \(cents\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cover charge note/i)).toBeInTheDocument()
    expect(screen.getByText(/accessibility features/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/indoor \/ outdoor/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/capacity hint/i)).toBeInTheDocument()

    // All nine a11y tokens render as checkboxes.
    expect(screen.getByLabelText(/wheelchair accessible/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/braille menu/i)).toBeInTheDocument()
  })

  it('blocks submit and shows inline error on invalid integer input', async () => {
    const submit = vi.fn()
    render(
      <VenueMetadataForm venueId="venue_1" onSubmitOverride={submit} />,
    )

    const coverCharge = screen.getByLabelText(/cover charge \(cents\)/i)
    fireEvent.change(coverCharge, { target: { value: '12.5' } })

    await waitFor(() => {
      expect(
        screen.getByText(/non-negative integer/i),
      ).toBeInTheDocument()
    })

    const saveBtn = screen.getByRole('button', { name: /save metadata/i })
    expect(saveBtn).toBeDisabled()
    fireEvent.click(saveBtn)
    expect(submit).not.toHaveBeenCalled()
  })

  it('shows inline error when capacity_hint is not a non-negative integer', async () => {
    const submit = vi.fn()
    render(
      <VenueMetadataForm venueId="venue_1" onSubmitOverride={submit} />,
    )

    const capacity = screen.getByLabelText(/capacity hint/i)
    fireEvent.change(capacity, { target: { value: '-5' } })

    await waitFor(() => {
      expect(
        screen.getAllByText(/non-negative integer/i).length,
      ).toBeGreaterThan(0)
    })
    expect(screen.getByRole('button', { name: /save metadata/i })).toBeDisabled()
    expect(submit).not.toHaveBeenCalled()
  })

  it('calls the client with a normalised payload on valid submit', async () => {
    const submit = vi.fn().mockResolvedValue({ id: 'venue_1' })
    const onSaved = vi.fn()
    render(
      <VenueMetadataForm
        venueId="venue_1"
        initial={{
          coverChargeCents: 2500,
        }}
        onSubmitOverride={submit}
        onSaved={onSaved}
      />,
    )

    // Toggle an accessibility checkbox + edit the note.
    const stepFree = screen.getByLabelText(/step-free entry/i)
    fireEvent.click(stepFree)

    const note = screen.getByLabelText(/cover charge note/i)
    fireEvent.change(note, { target: { value: 'Free before 11pm' } })

    const capacity = screen.getByLabelText(/capacity hint/i)
    fireEvent.change(capacity, { target: { value: '120' } })

    const saveBtn = screen.getByRole('button', { name: /save metadata/i })
    expect(saveBtn).not.toBeDisabled()
    fireEvent.click(saveBtn)

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    const [venueId, payload] = submit.mock.calls[0]
    expect(venueId).toBe('venue_1')
    expect(payload).toMatchObject({
      cover_charge_cents: 2500,
      cover_charge_note: 'Free before 11pm',
      accessibility_features: ['step_free_entry'],
      capacity_hint: 120,
    })
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    expect(onSaved).toHaveBeenCalledWith(payload)
  })

  it('surfaces server errors as an inline alert', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Admin role required'))
    render(
      <VenueMetadataForm
        venueId="venue_1"
        initial={{ coverChargeCents: 0 }}
        onSubmitOverride={submit}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /save metadata/i }))
    await waitFor(() =>
      expect(screen.getByText('Admin role required')).toBeInTheDocument(),
    )
    expect(toastError).toHaveBeenCalled()
  })
})
