import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { AccessibilityFeature } from '@/lib/types'
import { ACCESSIBILITY_FEATURES } from '@/lib/types'

const STORAGE_KEY = 'pulse.filters.accessibility'

export const ACCESSIBILITY_LABELS: Record<AccessibilityFeature, string> = {
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

const ACCESSIBILITY_ICONS: Record<AccessibilityFeature, string> = {
  wheelchair_accessible: '♿',
  step_free_entry: '⬆️',
  accessible_restroom: '🚻',
  gender_neutral_restroom: '⚧',
  sensory_friendly: '🧘',
  quiet_hours: '🔇',
  service_animal_friendly: '🐕‍🦺',
  signer_on_request: '🤟',
  braille_menu: '⠃',
}

interface AccessibilityFilterProps {
  /** Currently-selected features. Controlled. */
  selected: AccessibilityFeature[]
  /** Called whenever the selection changes. */
  onChange: (next: AccessibilityFeature[]) => void
  /** Disable `sessionStorage` persistence. */
  disablePersistence?: boolean
}

/**
 * Read persisted selection from sessionStorage (SSR-safe).
 */
export function readPersistedAccessibilitySelection(): AccessibilityFeature[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is AccessibilityFeature =>
      typeof v === 'string' && (ACCESSIBILITY_FEATURES as readonly string[]).includes(v),
    )
  } catch {
    return []
  }
}

/**
 * Returns true if every selected feature is present on the venue's
 * accessibility_features array.  Empty selection always passes.
 */
export function venuePassesAccessibilityFilter(
  venueFeatures: readonly AccessibilityFeature[] | undefined,
  selected: readonly AccessibilityFeature[],
): boolean {
  if (!selected.length) return true
  if (!venueFeatures || !venueFeatures.length) return false
  const set = new Set(venueFeatures)
  for (const f of selected) {
    if (!set.has(f)) return false
  }
  return true
}

export function AccessibilityFilter({
  selected,
  onChange,
  disablePersistence,
}: AccessibilityFilterProps) {
  const [hydrated, setHydrated] = useState(false)

  // Hydrate once on mount so SSR / first paint matches localStorage.
  useEffect(() => {
    if (disablePersistence || hydrated) {
      setHydrated(true)
      return
    }
    const persisted = readPersistedAccessibilitySelection()
    if (persisted.length && JSON.stringify(persisted) !== JSON.stringify(selected)) {
      onChange(persisted)
    }
    setHydrated(true)
    // Intentionally only running on mount — we don't want to overwrite user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist on every change (after hydration).
  useEffect(() => {
    if (!hydrated || disablePersistence) return
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selected))
      }
    } catch {
      // sessionStorage may be blocked — fail silently.
    }
  }, [selected, hydrated, disablePersistence])

  const toggle = useCallback(
    (feature: AccessibilityFeature) => {
      const next = selected.includes(feature)
        ? selected.filter((f) => f !== feature)
        : [...selected, feature]
      onChange(next)
    },
    [selected, onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, feature: AccessibilityFeature) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        toggle(feature)
      }
    },
    [toggle],
  )

  return (
    <div
      role="group"
      aria-label="Filter venues by accessibility features"
      className="flex flex-wrap gap-2"
    >
      {ACCESSIBILITY_FEATURES.map((feature) => {
        const isOn = selected.includes(feature)
        return (
          <button
            key={feature}
            type="button"
            role="switch"
            aria-pressed={isOn}
            aria-label={ACCESSIBILITY_LABELS[feature]}
            onClick={() => toggle(feature)}
            onKeyDown={(e) => handleKeyDown(e, feature)}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-sm transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1306C]',
              isOn
                ? 'bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] border-transparent text-white'
                : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
            )}
          >
            <span aria-hidden="true">{ACCESSIBILITY_ICONS[feature]}</span>
            <span>{ACCESSIBILITY_LABELS[feature]}</span>
          </button>
        )
      })}
    </div>
  )
}

export { STORAGE_KEY as ACCESSIBILITY_FILTER_STORAGE_KEY }
