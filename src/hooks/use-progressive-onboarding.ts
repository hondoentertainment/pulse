import { useState, useEffect, useCallback } from 'react'
import {
  getNextOnboardingStep,
  markStepCompleted,
  getOnboardingProgress,
  incrementSessionCount,
  getSessionCount,
  type OnboardingStep,
} from '@/lib/progressive-onboarding'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProgressiveOnboardingReturn {
  /** The step the user should currently see, or null if none is eligible. */
  currentStep: OnboardingStep | null
  /** Call this to dismiss (complete) the currently shown step. */
  dismissStep: () => void
  /** Overall progress through all defined steps. */
  progress: { completed: number; total: number; percentage: number }
  /** True while there is an active step to display. */
  isOnboarding: boolean
  /** The tracked session number (1-based). */
  sessionCount: number
  /** Record an action (e.g. 'first_pulse', 'first_venue_view') so the hook
   *  can unlock steps that depend on user-initiated events. */
  recordAction: (action: string) => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useProgressiveOnboarding`
 *
 * Tracks sessions and completed steps in localStorage, then exposes the
 * next appropriate onboarding step (if any) along with helpers to dismiss
 * it and observe overall progress.
 *
 * Should be mounted once at the app level, **after** initial onboarding
 * (`hasCompletedOnboarding === true`).
 */
export function useProgressiveOnboarding(): ProgressiveOnboardingReturn {
  // Session count — incremented on first mount, then read-only for this session
  const [sessionCount, setSessionCount] = useState<number>(0)

  // Completed step IDs persisted in localStorage
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  // Actions the user has performed this session (e.g. first_pulse)
  const [actions, setActions] = useState<string[]>([])

  // Increment session counter once on mount
  useEffect(() => {
    const newCount = incrementSessionCount()
    setSessionCount(newCount)

    // Also hydrate completed steps from storage on mount
    const stored = getSessionCount()
    // getSessionCount reads from storage AFTER incrementSessionCount already wrote,
    // so we use newCount directly.
    setSessionCount(newCount)

    // Hydrate completed steps
    const _progress = getOnboardingProgress()
    // We reconstruct the completed IDs by querying localStorage via the lib helper.
    // Rather than re-export readCompletedSteps, we derive what we need from _progress;
    // but we do need the actual IDs for getNextOnboardingStep, so we re-read here.
    try {
      const raw = localStorage.getItem('pulse_onboarding_completed_steps')
      const parsed = raw ? JSON.parse(raw) : []
      setCompletedSteps(Array.isArray(parsed) ? parsed : [])
    } catch {
      setCompletedSteps([])
    }

    // Suppress unused warning for `stored`
    void stored
  }, [])

  // Derived: the next step eligible for display
  const currentStep =
    sessionCount > 0
      ? getNextOnboardingStep(completedSteps, sessionCount, actions)
      : null

  // Dismiss (complete) the current step
  const dismissStep = useCallback(() => {
    if (!currentStep) return
    const updated = markStepCompleted(currentStep.id)
    setCompletedSteps(updated)
  }, [currentStep])

  // Record an in-session action that may unlock new steps
  const recordAction = useCallback((action: string) => {
    setActions((prev) => (prev.includes(action) ? prev : [...prev, action]))
  }, [])

  // Progress snapshot
  const progress = getOnboardingProgress()

  return {
    currentStep,
    dismissStep,
    progress,
    isOnboarding: currentStep !== null,
    sessionCount,
    recordAction,
  }
}
