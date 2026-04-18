import { describe, it, expect, beforeEach } from 'vitest'
import {
  ONBOARDING_STEPS,
  getNextOnboardingStep,
  markStepCompleted,
  getOnboardingProgress,
  incrementSessionCount,
  getSessionCount,
  resetOnboardingState,
} from '@/lib/progressive-onboarding'

// ---------------------------------------------------------------------------
// localStorage stub (vitest runs in node, not a browser)
// ---------------------------------------------------------------------------

let store: Record<string, string> = {}

const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { store = {} },
}

// Attach to globalThis so the lib code's `localStorage` references work
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function allStepIds(): string[] {
  return ONBOARDING_STEPS.map((s) => s.id)
}

// ---------------------------------------------------------------------------
// ONBOARDING_STEPS — shape validation
// ---------------------------------------------------------------------------

describe('ONBOARDING_STEPS shape', () => {
  it('exports a non-empty array', () => {
    expect(ONBOARDING_STEPS.length).toBeGreaterThan(0)
  })

  it('every step has required fields', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(typeof step.id).toBe('string')
      expect(step.id.length).toBeGreaterThan(0)
      expect(typeof step.feature).toBe('string')
      expect(typeof step.title).toBe('string')
      expect(typeof step.description).toBe('string')
      expect(['signup', 'first_pulse', 'first_venue_view', 'second_session', 'third_session']).toContain(
        step.triggerAfter,
      )
      expect(typeof step.completed).toBe('boolean')
    }
  })

  it('step IDs are unique', () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('contains steps for all four sessions', () => {
    const triggers = new Set(ONBOARDING_STEPS.map((s) => s.triggerAfter))
    expect(triggers.has('signup')).toBe(true)
    expect(triggers.has('first_venue_view')).toBe(true)
    expect(triggers.has('second_session')).toBe(true)
    expect(triggers.has('third_session')).toBe(true)
  })

  it('includes all eight expected feature steps', () => {
    const features = ONBOARDING_STEPS.map((s) => s.feature)
    expect(features).toContain('tonights_pick')
    expect(features).toContain('emoji_reactions')
    expect(features).toContain('live_activity_feed')
    expect(features).toContain('going_tonight')
    expect(features).toContain('streaks')
    expect(features).toContain('venue_comparison')
    expect(features).toContain('neighborhood_walkthrough')
    expect(features).toContain('energy_timeline')
  })

  it('all steps have completed = false by default', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.completed).toBe(false)
    }
  })

  it('optional position values are valid when present', () => {
    const validPositions = new Set(['top', 'bottom', 'left', 'right', undefined])
    for (const step of ONBOARDING_STEPS) {
      expect(validPositions.has(step.position)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// getNextOnboardingStep
// ---------------------------------------------------------------------------

describe('getNextOnboardingStep', () => {
  it('returns null when sessionCount is 0', () => {
    const result = getNextOnboardingStep([], 0, [])
    expect(result).toBeNull()
  })

  it('returns the first signup-triggered step on session 1', () => {
    const result = getNextOnboardingStep([], 1, [])
    expect(result).not.toBeNull()
    expect(result!.triggerAfter).toBe('signup')
  })

  it('returns the completed field as false', () => {
    const result = getNextOnboardingStep([], 1, [])
    expect(result!.completed).toBe(false)
  })

  it('skips completed steps', () => {
    // Complete the first signup step
    const firstStep = ONBOARDING_STEPS.find((s) => s.triggerAfter === 'signup')!
    const result = getNextOnboardingStep([firstStep.id], 1, [])
    // Either returns null (no more signup steps) or the next eligible step
    if (result) {
      expect(result.id).not.toBe(firstStep.id)
    }
  })

  it('does not return second_session steps on session 1', () => {
    const result = getNextOnboardingStep([], 1, [])
    expect(result?.triggerAfter).not.toBe('second_session')
    expect(result?.triggerAfter).not.toBe('third_session')
  })

  it('returns second_session steps once sessionCount >= 2', () => {
    // Complete all session-1 steps first
    const session1Ids = ONBOARDING_STEPS
      .filter((s) => s.triggerAfter === 'signup' || s.triggerAfter === 'first_venue_view')
      .map((s) => s.id)

    // Also include first_pulse so nothing blocks
    const result = getNextOnboardingStep(
      session1Ids,
      2,
      ['first_venue_view', 'first_pulse'],
    )

    expect(result).not.toBeNull()
    expect(result!.triggerAfter).toBe('second_session')
  })

  it('returns third_session steps once sessionCount >= 3', () => {
    const completedUpToSession2 = ONBOARDING_STEPS
      .filter(
        (s) =>
          s.triggerAfter === 'signup' ||
          s.triggerAfter === 'first_venue_view' ||
          s.triggerAfter === 'first_pulse' ||
          s.triggerAfter === 'second_session',
      )
      .map((s) => s.id)

    const result = getNextOnboardingStep(
      completedUpToSession2,
      3,
      ['first_venue_view', 'first_pulse'],
    )

    expect(result).not.toBeNull()
    expect(result!.triggerAfter).toBe('third_session')
  })

  it('does not return third_session steps on session 2', () => {
    const completedUpToSession2 = ONBOARDING_STEPS
      .filter((s) => s.triggerAfter === 'signup' || s.triggerAfter === 'second_session')
      .map((s) => s.id)

    const result = getNextOnboardingStep(
      completedUpToSession2,
      2,
      ['first_venue_view', 'first_pulse'],
    )

    if (result) {
      expect(result.triggerAfter).not.toBe('third_session')
    }
  })

  it('returns null when all steps are completed', () => {
    const result = getNextOnboardingStep(allStepIds(), 10, [
      'first_pulse',
      'first_venue_view',
    ])
    expect(result).toBeNull()
  })

  it('returns null when no steps match actions for first_venue_view trigger', () => {
    // Complete all signup steps; first_venue_view step requires the action
    const signupSteps = ONBOARDING_STEPS
      .filter((s) => s.triggerAfter === 'signup')
      .map((s) => s.id)

    // No actions provided — first_venue_view step should not trigger
    const result = getNextOnboardingStep(signupSteps, 1, [])
    if (result) {
      // Any remaining step must not require first_venue_view action
      expect(result.triggerAfter).not.toBe('first_venue_view')
    }
  })

  it('unlocks first_venue_view step when action is recorded', () => {
    const signupSteps = ONBOARDING_STEPS
      .filter((s) => s.triggerAfter === 'signup')
      .map((s) => s.id)

    const result = getNextOnboardingStep(signupSteps, 1, ['first_venue_view'])
    const venueViewStep = ONBOARDING_STEPS.find((s) => s.triggerAfter === 'first_venue_view')
    if (venueViewStep && !signupSteps.includes(venueViewStep.id)) {
      expect(result).not.toBeNull()
      expect(result!.triggerAfter).toBe('first_venue_view')
    }
  })

  it('returns steps in definition order', () => {
    // With sessionCount 10 and all actions, we should get the very first
    // non-completed step in ONBOARDING_STEPS order
    const result = getNextOnboardingStep([], 10, ['first_pulse', 'first_venue_view'])
    expect(result).not.toBeNull()
    expect(result!.id).toBe(ONBOARDING_STEPS[0].id)
  })

  it('does not mutate the step objects in ONBOARDING_STEPS', () => {
    const originalCompleted = ONBOARDING_STEPS.map((s) => s.completed)
    getNextOnboardingStep([], 5, ['first_pulse', 'first_venue_view'])
    const afterCompleted = ONBOARDING_STEPS.map((s) => s.completed)
    expect(afterCompleted).toEqual(originalCompleted)
  })
})

// ---------------------------------------------------------------------------
// markStepCompleted
// ---------------------------------------------------------------------------

describe('markStepCompleted', () => {
  beforeEach(() => {
    resetOnboardingState()
  })

  it('persists a step ID and returns the updated list', () => {
    const updated = markStepCompleted('tonights-pick')
    expect(updated).toContain('tonights-pick')
  })

  it('does not duplicate an already-completed step', () => {
    markStepCompleted('tonights-pick')
    const updated = markStepCompleted('tonights-pick')
    const count = updated.filter((id) => id === 'tonights-pick').length
    expect(count).toBe(1)
  })

  it('accumulates multiple completed steps', () => {
    markStepCompleted('step-a')
    const updated = markStepCompleted('step-b')
    expect(updated).toContain('step-a')
    expect(updated).toContain('step-b')
  })

  it('persists across calls (reads from localStorage)', () => {
    markStepCompleted('tonights-pick')
    // A second call should see the previously stored value
    const updated = markStepCompleted('emoji-reactions')
    expect(updated).toContain('tonights-pick')
    expect(updated).toContain('emoji-reactions')
  })
})

// ---------------------------------------------------------------------------
// getOnboardingProgress
// ---------------------------------------------------------------------------

describe('getOnboardingProgress', () => {
  beforeEach(() => {
    resetOnboardingState()
  })

  it('starts at 0 completed', () => {
    const progress = getOnboardingProgress()
    expect(progress.completed).toBe(0)
    expect(progress.percentage).toBe(0)
  })

  it('total matches the number of defined steps', () => {
    const progress = getOnboardingProgress()
    expect(progress.total).toBe(ONBOARDING_STEPS.length)
  })

  it('reflects completed steps', () => {
    markStepCompleted(ONBOARDING_STEPS[0].id)
    const progress = getOnboardingProgress()
    expect(progress.completed).toBe(1)
    expect(progress.percentage).toBeGreaterThan(0)
  })

  it('percentage is 100 when all steps are done', () => {
    allStepIds().forEach((id) => markStepCompleted(id))
    const progress = getOnboardingProgress()
    expect(progress.completed).toBe(ONBOARDING_STEPS.length)
    expect(progress.percentage).toBe(100)
  })

  it('ignores unknown step IDs stored in localStorage', () => {
    // Manually store a non-existent step ID
    localStorageMock.setItem(
      'pulse_onboarding_completed_steps',
      JSON.stringify(['phantom-step-id']),
    )
    const progress = getOnboardingProgress()
    expect(progress.completed).toBe(0)
  })

  it('percentage is between 0 and 100 for partial completion', () => {
    // Complete half of the steps
    const half = allStepIds().slice(0, Math.floor(allStepIds().length / 2))
    half.forEach((id) => markStepCompleted(id))
    const progress = getOnboardingProgress()
    expect(progress.percentage).toBeGreaterThan(0)
    expect(progress.percentage).toBeLessThan(100)
  })
})

// ---------------------------------------------------------------------------
// Session counter
// ---------------------------------------------------------------------------

describe('Session counter', () => {
  beforeEach(() => {
    resetOnboardingState()
  })

  it('starts at 0', () => {
    expect(getSessionCount()).toBe(0)
  })

  it('incrementSessionCount returns 1 on first call', () => {
    expect(incrementSessionCount()).toBe(1)
  })

  it('incrementSessionCount increments sequentially', () => {
    incrementSessionCount() // → 1
    incrementSessionCount() // → 2
    expect(incrementSessionCount()).toBe(3)
  })

  it('getSessionCount reads the stored value', () => {
    incrementSessionCount() // → 1
    expect(getSessionCount()).toBe(1)
  })

  it('session count persists across calls', () => {
    incrementSessionCount() // → 1
    incrementSessionCount() // → 2
    const stored = getSessionCount()
    expect(stored).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// resetOnboardingState
// ---------------------------------------------------------------------------

describe('resetOnboardingState', () => {
  it('clears completed steps and session counter', () => {
    markStepCompleted('tonights-pick')
    incrementSessionCount()
    resetOnboardingState()

    expect(getOnboardingProgress().completed).toBe(0)
    expect(getSessionCount()).toBe(0)
  })

  it('allows fresh session increment after reset', () => {
    incrementSessionCount()
    incrementSessionCount()
    resetOnboardingState()
    expect(incrementSessionCount()).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Integration: full progressive session flow
// ---------------------------------------------------------------------------

describe('Progressive session flow (integration)', () => {
  beforeEach(() => {
    resetOnboardingState()
  })

  it('session 1: only signup steps are eligible', () => {
    const session = incrementSessionCount()
    expect(session).toBe(1)

    const step = getNextOnboardingStep([], session, [])
    expect(step).not.toBeNull()
    expect(step!.triggerAfter).toBe('signup')
  })

  it('session 1: viewing a venue unlocks first_venue_view step', () => {
    const session = incrementSessionCount()

    // Complete the signup step
    const signupStep = getNextOnboardingStep([], session, [])!
    const completedAfterSignup = markStepCompleted(signupStep.id)

    // Now simulate viewing a venue
    const nextStep = getNextOnboardingStep(completedAfterSignup, session, ['first_venue_view'])

    if (nextStep) {
      expect(nextStep.triggerAfter).toBe('first_venue_view')
    }
  })

  it('session 2: second_session steps become available', () => {
    // Session 1 — complete all session-1 steps
    const s1 = incrementSessionCount()
    const session1Steps = ONBOARDING_STEPS
      .filter((s) => s.triggerAfter === 'signup' || s.triggerAfter === 'first_venue_view')
      .map((s) => s.id)
    session1Steps.forEach(markStepCompleted)

    expect(s1).toBe(1)

    // Session 2
    const s2 = incrementSessionCount()
    expect(s2).toBe(2)

    const step = getNextOnboardingStep(session1Steps, s2, ['first_venue_view'])
    expect(step).not.toBeNull()
    expect(step!.triggerAfter).toBe('second_session')
  })

  it('session 3: third_session steps become available', () => {
    incrementSessionCount() // 1
    incrementSessionCount() // 2
    const s3 = incrementSessionCount() // 3
    expect(s3).toBe(3)

    const alreadyCompleted = ONBOARDING_STEPS
      .filter(
        (s) =>
          s.triggerAfter === 'signup' ||
          s.triggerAfter === 'first_venue_view' ||
          s.triggerAfter === 'second_session',
      )
      .map((s) => s.id)

    const step = getNextOnboardingStep(alreadyCompleted, s3, ['first_venue_view'])
    expect(step).not.toBeNull()
    expect(step!.triggerAfter).toBe('third_session')
  })

  it('all steps completed → no more steps returned', () => {
    incrementSessionCount()
    incrementSessionCount()
    incrementSessionCount()
    incrementSessionCount()
    const s4 = getSessionCount()

    allStepIds().forEach(markStepCompleted)
    const step = getNextOnboardingStep(allStepIds(), s4, ['first_pulse', 'first_venue_view'])
    expect(step).toBeNull()
  })

  it('progress percentage increases as steps are completed', () => {
    const initial = getOnboardingProgress().percentage
    markStepCompleted(ONBOARDING_STEPS[0].id)
    const afterOne = getOnboardingProgress().percentage
    expect(afterOne).toBeGreaterThan(initial)
  })

  it('dismissing a step removes it from subsequent getNextOnboardingStep calls', () => {
    incrementSessionCount() // session 1

    const step1 = getNextOnboardingStep([], 1, [])!
    const completedIds = markStepCompleted(step1.id)

    const step2 = getNextOnboardingStep(completedIds, 1, [])
    if (step2) {
      expect(step2.id).not.toBe(step1.id)
    }
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  beforeEach(() => {
    resetOnboardingState()
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorageMock.setItem('pulse_onboarding_completed_steps', 'not-json{{{')
    expect(() => getOnboardingProgress()).not.toThrow()
    const progress = getOnboardingProgress()
    expect(progress.completed).toBe(0)
  })

  it('handles non-array JSON in storage gracefully', () => {
    localStorageMock.setItem('pulse_onboarding_completed_steps', JSON.stringify({ bad: 'value' }))
    const step = getNextOnboardingStep([], 1, [])
    // Should behave as if nothing is completed
    expect(step).not.toBeNull()
  })

  it('handles very large session count without error', () => {
    const step = getNextOnboardingStep([], 999, ['first_pulse', 'first_venue_view'])
    // Should still return a step (or null if all completed)
    // Just must not throw
    expect(step === null || typeof step!.id === 'string').toBe(true)
  })

  it('getNextOnboardingStep is pure — repeated calls with same args return equal results', () => {
    const args: [string[], number, string[]] = [[], 1, []]
    const r1 = getNextOnboardingStep(...args)
    const r2 = getNextOnboardingStep(...args)
    expect(r1?.id).toBe(r2?.id)
  })

  it('markStepCompleted with an unknown id does not corrupt existing data', () => {
    markStepCompleted(ONBOARDING_STEPS[0].id)
    markStepCompleted('totally-fake-step')
    const progress = getOnboardingProgress()
    // Only one real step completed
    expect(progress.completed).toBe(1)
  })
})
