/**
 * AccessibilitySettings component
 *
 * Provides user-configurable accessibility options:
 * - Reduced motion toggle (defaults to system preference)
 * - High contrast mode toggle (off / increased / high)
 * - Font size adjustment (small / medium / large)
 * - Screen reader live announcement area
 *
 * All settings persist in localStorage and apply CSS classes/variables to
 * document.documentElement so they take effect globally.
 */

import { useCallback, useEffect, useState } from 'react'
import { announce, getHighContrastMode, setHighContrastMode, type HighContrastMode } from '../lib/accessibility'

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'pulse_a11y_settings'

export type FontSize = 'small' | 'medium' | 'large'

export interface A11ySettings {
  reducedMotion: boolean
  highContrast: HighContrastMode
  fontSize: FontSize
}

function getSystemReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function loadSettings(): A11ySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<A11ySettings>
      return {
        reducedMotion: parsed.reducedMotion ?? getSystemReducedMotion(),
        highContrast: parsed.highContrast ?? getHighContrastMode(),
        fontSize: parsed.fontSize ?? 'medium',
      }
    }
  } catch {
    // localStorage unavailable or corrupt
  }
  return {
    reducedMotion: getSystemReducedMotion(),
    highContrast: getHighContrastMode(),
    fontSize: 'medium',
  }
}

function saveSettings(settings: A11ySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Silently fail if storage is unavailable
  }
}

// ---------------------------------------------------------------------------
// Apply settings to DOM
// ---------------------------------------------------------------------------

function applySettings(settings: A11ySettings): void {
  const root = document.documentElement

  // Reduced motion
  root.classList.toggle('reduce-motion', settings.reducedMotion)
  root.style.setProperty(
    '--motion-duration',
    settings.reducedMotion ? '0.01ms' : ''
  )

  // High contrast
  setHighContrastMode(settings.highContrast)

  // Font size
  root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large')
  root.classList.add(`font-size-${settings.fontSize}`)
  const fontSizeMap: Record<FontSize, string> = {
    small: '14px',
    medium: '16px',
    large: '19px',
  }
  root.style.setProperty('--base-font-size', fontSizeMap[settings.fontSize])
}

// ---------------------------------------------------------------------------
// Custom hook (exported for other components to consume)
// ---------------------------------------------------------------------------

export function useA11ySettings() {
  const [settings, setSettingsState] = useState<A11ySettings>(loadSettings)

  useEffect(() => {
    applySettings(settings)
  }, [settings])

  const updateSettings = useCallback((partial: Partial<A11ySettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial }
      saveSettings(next)
      applySettings(next)
      return next
    })
  }, [])

  return { settings, updateSettings }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ToggleRowProps {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-xs text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          checked ? 'bg-accent' : 'bg-muted',
        ].join(' ')}
      >
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
            'transform ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

interface RadioGroupProps<T extends string> {
  legend: string
  name: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  description?: string
}

function RadioGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  description,
}: RadioGroupProps<T>) {
  return (
    <fieldset className="py-3">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      {description && <p className="text-xs text-muted-foreground mt-0.5 mb-2">{description}</p>}
      <div className="flex gap-2 mt-2 flex-wrap">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={[
              'flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm',
              'transition-colors focus-within:ring-2 focus-within:ring-accent',
              value === opt.value
                ? 'border-accent bg-accent/10 text-accent font-medium'
                : 'border-border bg-background text-foreground hover:bg-muted',
            ].join(' ')}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AccessibilitySettingsProps {
  /** Whether to render as a full page or an embeddable panel. Default: panel */
  variant?: 'page' | 'panel'
}

export function AccessibilitySettings({ variant = 'panel' }: AccessibilitySettingsProps) {
  const { settings, updateSettings } = useA11ySettings()

  function handleReducedMotion(checked: boolean) {
    updateSettings({ reducedMotion: checked })
    announce(
      checked ? 'Reduced motion enabled. Animations will be minimized.' : 'Reduced motion disabled.',
      'polite'
    )
  }

  function handleHighContrast(mode: HighContrastMode) {
    updateSettings({ highContrast: mode })
    const labels: Record<HighContrastMode, string> = {
      off: 'Standard contrast.',
      increased: 'Increased contrast enabled.',
      high: 'High contrast enabled.',
    }
    announce(labels[mode], 'polite')
  }

  function handleFontSize(size: FontSize) {
    updateSettings({ fontSize: size })
    announce(`Font size changed to ${size}.`, 'polite')
  }

  const isPage = variant === 'page'

  return (
    <div
      className={
        isPage
          ? 'max-w-lg mx-auto px-4 py-10'
          : 'rounded-lg border border-border bg-background p-5 shadow-sm'
      }
      aria-label="Accessibility settings"
    >
      {isPage && (
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Accessibility Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customize how {/* APP_NAME */}Pulse looks and behaves for your needs.
          </p>
        </header>
      )}

      {!isPage && (
        <h2 className="text-base font-semibold text-foreground mb-1">Accessibility</h2>
      )}

      <div className="divide-y divide-border">
        {/* Reduced Motion */}
        <ToggleRow
          id="a11y-reduced-motion"
          label="Reduce motion"
          description={
            getSystemReducedMotion()
              ? 'Your system prefers reduced motion (this overrides that preference).'
              : 'Minimize animations and transitions throughout the app.'
          }
          checked={settings.reducedMotion}
          onChange={handleReducedMotion}
        />

        {/* High Contrast */}
        <RadioGroup<HighContrastMode>
          legend="Contrast mode"
          name="high-contrast"
          value={settings.highContrast}
          options={[
            { value: 'off', label: 'Standard' },
            { value: 'increased', label: 'Increased' },
            { value: 'high', label: 'High' },
          ]}
          onChange={handleHighContrast}
          description="Increase color contrast to improve readability."
        />

        {/* Font Size */}
        <RadioGroup<FontSize>
          legend="Text size"
          name="font-size"
          value={settings.fontSize}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
          onChange={handleFontSize}
          description="Adjust the base text size across the app."
        />
      </div>

      {/* Reset button */}
      <div className="mt-4 pt-3 border-t border-border">
        <button
          type="button"
          onClick={() => {
            const defaults: A11ySettings = {
              reducedMotion: getSystemReducedMotion(),
              highContrast: 'off',
              fontSize: 'medium',
            }
            updateSettings(defaults)
            announce('Accessibility settings reset to defaults.', 'polite')
          }}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}

export default AccessibilitySettings
