/**
 * VenueMetadataForm
 *
 * Admin-only editor for the structured metadata introduced in
 * `supabase/migrations/20260417000006_venue_structured_metadata.sql`:
 *
 *   - dress_code              (enum select)
 *   - cover_charge_cents      (non-negative integer)
 *   - cover_charge_note       (string, up to 120 chars)
 *   - accessibility_features  (multi-checkbox from ACCESSIBILITY_FEATURES)
 *   - indoor_outdoor          (enum select)
 *   - capacity_hint           (non-negative integer)
 *
 * Validation is inline; the submit button is blocked until the form is
 * clean. This component doesn't own an admin gate on its own — wrap it in
 * a route-level guard (see `/admin/venues/:id/metadata` in AppRoutes).
 */

import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ACCESSIBILITY_FEATURES,
  type AccessibilityFeature,
  type VenueDressCode,
  type VenueIndoorOutdoor,
} from '@/lib/types'
import {
  COVER_CHARGE_NOTE_MAX,
  VENUE_DRESS_CODES,
  VENUE_INDOOR_OUTDOOR,
  updateVenueMetadata,
  type VenueMetadataPayload,
} from '@/lib/venue-admin-client'

const NONE_SENTINEL = '__none__'

const DRESS_CODE_LABELS: Record<VenueDressCode, string> = {
  casual: 'Casual',
  smart_casual: 'Smart casual',
  upscale: 'Upscale',
  formal: 'Formal',
  costume_required: 'Costume required',
  no_code: 'No dress code',
}

const INDOOR_OUTDOOR_LABELS: Record<VenueIndoorOutdoor, string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  both: 'Both (indoor + outdoor)',
}

const ACCESSIBILITY_LABELS: Record<AccessibilityFeature, string> = {
  wheelchair_accessible: 'Wheelchair accessible',
  step_free_entry: 'Step-free entry',
  accessible_restroom: 'Accessible restroom',
  gender_neutral_restroom: 'Gender-neutral restroom',
  sensory_friendly: 'Sensory-friendly',
  quiet_hours: 'Quiet hours',
  service_animal_friendly: 'Service-animal friendly',
  signer_on_request: 'Signer on request',
  braille_menu: 'Braille menu',
}

export interface VenueMetadataFormInitial {
  dressCode?: VenueDressCode | null
  coverChargeCents?: number | null
  coverChargeNote?: string | null
  accessibilityFeatures?: AccessibilityFeature[] | null
  indoorOutdoor?: VenueIndoorOutdoor | null
  capacityHint?: number | null
}

export interface VenueMetadataFormProps {
  venueId: string
  venueName?: string
  initial?: VenueMetadataFormInitial
  /** Injected in tests so we can assert outbound calls without a fetch mock. */
  onSubmitOverride?: typeof updateVenueMetadata
  onSaved?: (payload: VenueMetadataPayload) => void
}

type FieldErrors = Partial<{
  coverChargeCents: string
  coverChargeNote: string
  capacityHint: string
}>

interface FormState {
  dressCode: string
  coverChargeCents: string
  coverChargeNote: string
  accessibility: Set<AccessibilityFeature>
  indoorOutdoor: string
  capacityHint: string
}

function toFormState(initial: VenueMetadataFormInitial | undefined): FormState {
  return {
    dressCode: initial?.dressCode ?? NONE_SENTINEL,
    coverChargeCents:
      initial?.coverChargeCents !== undefined && initial.coverChargeCents !== null
        ? String(initial.coverChargeCents)
        : '',
    coverChargeNote: initial?.coverChargeNote ?? '',
    accessibility: new Set(initial?.accessibilityFeatures ?? []),
    indoorOutdoor: initial?.indoorOutdoor ?? NONE_SENTINEL,
    capacityHint:
      initial?.capacityHint !== undefined && initial.capacityHint !== null
        ? String(initial.capacityHint)
        : '',
  }
}

function parseIntField(value: string): number | null | 'invalid' {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  const n = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(n) || n < 0) return 'invalid'
  return n
}

function validate(state: FormState): FieldErrors {
  const errors: FieldErrors = {}

  const cents = parseIntField(state.coverChargeCents)
  if (cents === 'invalid') errors.coverChargeCents = 'Must be a non-negative integer (cents).'

  if (state.coverChargeNote.length > COVER_CHARGE_NOTE_MAX) {
    errors.coverChargeNote = `Up to ${COVER_CHARGE_NOTE_MAX} characters.`
  }

  const capacity = parseIntField(state.capacityHint)
  if (capacity === 'invalid') errors.capacityHint = 'Must be a non-negative integer.'

  return errors
}

function toPayload(state: FormState): VenueMetadataPayload {
  const cents = parseIntField(state.coverChargeCents)
  const capacity = parseIntField(state.capacityHint)
  return {
    dress_code: state.dressCode === NONE_SENTINEL ? null : (state.dressCode as VenueDressCode),
    cover_charge_cents: cents === 'invalid' ? null : cents,
    cover_charge_note: state.coverChargeNote.trim() === '' ? null : state.coverChargeNote.trim(),
    accessibility_features: Array.from(state.accessibility),
    indoor_outdoor:
      state.indoorOutdoor === NONE_SENTINEL ? null : (state.indoorOutdoor as VenueIndoorOutdoor),
    capacity_hint: capacity === 'invalid' ? null : capacity,
  }
}

export function VenueMetadataForm({
  venueId,
  venueName,
  initial,
  onSubmitOverride,
  onSaved,
}: VenueMetadataFormProps) {
  const [state, setState] = useState<FormState>(() => toFormState(initial))
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const errors = useMemo(() => validate(state), [state])
  const hasErrors = Object.keys(errors).length > 0

  const toggleAccessibility = (feature: AccessibilityFeature) => {
    setState((prev) => {
      const next = new Set(prev.accessibility)
      if (next.has(feature)) next.delete(feature)
      else next.add(feature)
      return { ...prev, accessibility: next }
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (hasErrors) return
    setSubmitting(true)
    setServerError(null)
    const payload = toPayload(state)
    try {
      const submit = onSubmitOverride ?? updateVenueMetadata
      await submit(venueId, payload)
      toast.success('Venue metadata saved')
      onSaved?.(payload)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save venue metadata'
      setServerError(msg)
      toast.error('Save failed', { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-5 space-y-5 border-border" data-testid="venue-metadata-form-card">
      <div>
        <h2 className="text-lg font-bold">Venue metadata</h2>
        {venueName && (
          <p className="text-sm text-muted-foreground">
            Editing <span className="font-medium">{venueName}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Admin-only. Fields default to <em>Not set</em>; leave blank to clear.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Dress code */}
        <div className="space-y-2">
          <Label htmlFor="venue-dress-code">Dress code</Label>
          <Select
            value={state.dressCode}
            onValueChange={(v) => setState((prev) => ({ ...prev, dressCode: v }))}
          >
            <SelectTrigger id="venue-dress-code" className="w-full">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_SENTINEL}>Not set</SelectItem>
              {VENUE_DRESS_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {DRESS_CODE_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cover charge cents */}
        <div className="space-y-2">
          <Label htmlFor="venue-cover-charge">Cover charge (cents)</Label>
          <Input
            id="venue-cover-charge"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="e.g. 2500 = $25.00"
            value={state.coverChargeCents}
            aria-invalid={!!errors.coverChargeCents || undefined}
            aria-describedby={errors.coverChargeCents ? 'venue-cover-charge-error' : undefined}
            onChange={(e) =>
              setState((prev) => ({ ...prev, coverChargeCents: e.target.value }))
            }
          />
          {errors.coverChargeCents && (
            <p
              id="venue-cover-charge-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.coverChargeCents}
            </p>
          )}
        </div>

        {/* Cover charge note */}
        <div className="space-y-2">
          <Label htmlFor="venue-cover-note">Cover charge note</Label>
          <Input
            id="venue-cover-note"
            type="text"
            maxLength={COVER_CHARGE_NOTE_MAX + 20}
            placeholder="Free before 11pm"
            value={state.coverChargeNote}
            aria-invalid={!!errors.coverChargeNote || undefined}
            aria-describedby={errors.coverChargeNote ? 'venue-cover-note-error' : undefined}
            onChange={(e) =>
              setState((prev) => ({ ...prev, coverChargeNote: e.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">
            {state.coverChargeNote.length}/{COVER_CHARGE_NOTE_MAX}
          </p>
          {errors.coverChargeNote && (
            <p
              id="venue-cover-note-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.coverChargeNote}
            </p>
          )}
        </div>

        {/* Accessibility features */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Accessibility features</legend>
          <p className="text-xs text-muted-foreground">
            Toggle every feature this venue supports.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {ACCESSIBILITY_FEATURES.map((feature) => {
              const id = `venue-a11y-${feature}`
              const checked = state.accessibility.has(feature)
              return (
                <label
                  key={feature}
                  htmlFor={id}
                  className="flex items-start gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => toggleAccessibility(feature)}
                  />
                  <span>{ACCESSIBILITY_LABELS[feature]}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {/* Indoor / outdoor */}
        <div className="space-y-2">
          <Label htmlFor="venue-indoor-outdoor">Indoor / outdoor</Label>
          <Select
            value={state.indoorOutdoor}
            onValueChange={(v) => setState((prev) => ({ ...prev, indoorOutdoor: v }))}
          >
            <SelectTrigger id="venue-indoor-outdoor" className="w-full">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_SENTINEL}>Not set</SelectItem>
              {VENUE_INDOOR_OUTDOOR.map((v) => (
                <SelectItem key={v} value={v}>
                  {INDOOR_OUTDOOR_LABELS[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Capacity hint */}
        <div className="space-y-2">
          <Label htmlFor="venue-capacity-hint">Capacity hint</Label>
          <Input
            id="venue-capacity-hint"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="e.g. 120"
            value={state.capacityHint}
            aria-invalid={!!errors.capacityHint || undefined}
            aria-describedby={errors.capacityHint ? 'venue-capacity-hint-error' : undefined}
            onChange={(e) =>
              setState((prev) => ({ ...prev, capacityHint: e.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Rough occupancy used by the wait-time estimator.
          </p>
          {errors.capacityHint && (
            <p
              id="venue-capacity-hint-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {errors.capacityHint}
            </p>
          )}
        </div>

        {serverError && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/30 p-2 text-xs text-destructive"
          >
            {serverError}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" disabled={submitting || hasErrors}>
            {submitting ? 'Saving…' : 'Save metadata'}
          </Button>
          {hasErrors && (
            <span className="text-xs text-muted-foreground">
              Resolve field errors above to enable save.
            </span>
          )}
        </div>
      </form>
    </Card>
  )
}

export default VenueMetadataForm
