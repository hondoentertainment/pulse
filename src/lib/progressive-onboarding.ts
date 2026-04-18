// ---------------------------------------------------------------------------
// Progressive Onboarding
//
// Introduces features to new users incrementally across their first few
// sessions rather than overwhelming them all at once.
// ---------------------------------------------------------------------------

export interface OnboardingStep {
  id: string
  feature: string
  title: string
  description: string
  targetSelector?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  triggerAfter:
    | 'signup'
    | 'first_pulse'
    | 'first_venue_view'
    | 'second_session'
    | 'third_session'
  completed: boolean
}

// ---------------------------------------------------------------------------
// Step definitions grouped by session
// ---------------------------------------------------------------------------

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // --- Session 1 (trigger: signup / first_venue_view) ---------------------
  {
    id: 'tonights-pick',
    feature: 'tonights_pick',
    title: "Tonight's Pick",
    description:
      "We picked tonight's hottest spot just for you. Tap it to see what's buzzing and why we think you'll love it.",
    targetSelector: '[data-onboarding="tonights-pick"]',
    position: 'bottom',
    triggerAfter: 'signup',
    completed: false,
  },
  {
    id: 'emoji-reactions',
    feature: 'emoji_reactions',
    title: 'React to the Vibe',
    description:
      'Tap a pulse to drop a reaction — fire, skull, lightning, or eyes. Your reactions shape the energy score in real time.',
    targetSelector: '[data-onboarding="emoji-reactions"]',
    position: 'top',
    triggerAfter: 'first_venue_view',
    completed: false,
  },

  // --- Session 2 (trigger: second_session) --------------------------------
  {
    id: 'live-activity-feed',
    feature: 'live_activity_feed',
    title: 'Live Activity Feed',
    description:
      'See what\'s happening right now across the city. New pulses appear here the moment they\'re posted.',
    targetSelector: '[data-onboarding="live-activity-feed"]',
    position: 'bottom',
    triggerAfter: 'second_session',
    completed: false,
  },
  {
    id: 'going-tonight',
    feature: 'going_tonight',
    title: 'Going Tonight?',
    description:
      "Let your friends know where you're headed. Tap \"Going Tonight\" on any venue to share your plans.",
    targetSelector: '[data-onboarding="going-tonight"]',
    position: 'top',
    triggerAfter: 'second_session',
    completed: false,
  },

  // --- Session 3 (trigger: third_session) ---------------------------------
  {
    id: 'streaks',
    feature: 'streaks',
    title: 'Build Your Streak',
    description:
      'Check in to venues three nights in a row and you\'ll earn a streak badge. Keep it alive for bonus bragging rights.',
    targetSelector: '[data-onboarding="streaks"]',
    position: 'bottom',
    triggerAfter: 'third_session',
    completed: false,
  },
  {
    id: 'venue-comparison',
    feature: 'venue_comparison',
    title: 'Compare Venues',
    description:
      "Can't decide? Select two venues and we'll compare their energy, crowd vibe, and friend activity side by side.",
    targetSelector: '[data-onboarding="venue-comparison"]',
    position: 'top',
    triggerAfter: 'third_session',
    completed: false,
  },

  // --- Session 4 (trigger: third_session + actions) -----------------------
  {
    id: 'neighborhood-walkthrough',
    feature: 'neighborhood_walkthrough',
    title: 'Explore by Neighborhood',
    description:
      'Discover which neighborhoods are heating up tonight. Swipe through the neighborhood map for a curated tour.',
    targetSelector: '[data-onboarding="neighborhood-walkthrough"]',
    position: 'bottom',
    triggerAfter: 'third_session',
    completed: false,
  },
  {
    id: 'energy-timeline',
    feature: 'energy_timeline',
    title: 'Energy Timeline',
    description:
      "See how a venue's energy rises and falls throughout the night. Use the timeline to pick the perfect arrival time.",
    targetSelector: '[data-onboarding="energy-timeline"]',
    position: 'top',
    triggerAfter: 'third_session',
    completed: false,
  },
]

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY_COMPLETED = 'pulse_onboarding_completed_steps'
const STORAGE_KEY_SESSION = 'pulse_session_count'

function readCompletedSteps(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMPLETED)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeCompletedSteps(steps: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify(steps))
  } catch {
    // Silently ignore write errors (e.g. private-browsing quota exceeded)
  }
}

function readSessionCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION)
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

function writeSessionCount(count: number): void {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, String(count))
  } catch {
    // Silently ignore
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the next onboarding step that should be shown given:
 *  - which steps have already been completed
 *  - how many sessions the user has had
 *  - which in-app actions have been performed this session
 *
 * Returns `null` when every eligible step has been completed or no step
 * matches the current context.
 */
export function getNextOnboardingStep(
  completedStepIds: string[],
  sessionCount: number,
  actions: string[],
): OnboardingStep | null {
  const completedSet = new Set(completedStepIds)

  for (const step of ONBOARDING_STEPS) {
    if (completedSet.has(step.id)) continue

    const eligible = isStepEligible(step, sessionCount, actions)
    if (eligible) {
      return { ...step, completed: false }
    }
  }

  return null
}

function isStepEligible(
  step: OnboardingStep,
  sessionCount: number,
  actions: string[],
): boolean {
  switch (step.triggerAfter) {
    case 'signup':
      // Show immediately on first session
      return sessionCount >= 1

    case 'first_pulse':
      return actions.includes('first_pulse')

    case 'first_venue_view':
      return actions.includes('first_venue_view')

    case 'second_session':
      return sessionCount >= 2

    case 'third_session':
      return sessionCount >= 3

    default:
      return false
  }
}

/**
 * Persists a completed step to localStorage and returns the updated list.
 */
export function markStepCompleted(stepId: string): string[] {
  const current = readCompletedSteps()
  if (current.includes(stepId)) return current
  const updated = [...current, stepId]
  writeCompletedSteps(updated)
  return updated
}

/**
 * Returns overall progress through all defined onboarding steps.
 */
export function getOnboardingProgress(): {
  completed: number
  total: number
  percentage: number
} {
  const completed = readCompletedSteps()
  const total = ONBOARDING_STEPS.length
  const done = completed.filter((id) => ONBOARDING_STEPS.some((s) => s.id === id)).length
  const percentage = total === 0 ? 100 : Math.round((done / total) * 100)
  return { completed: done, total, percentage }
}

/**
 * Reads the stored session count without mutating it (useful in tests).
 */
export function getSessionCount(): number {
  return readSessionCount()
}

/**
 * Increments the session counter by 1 and returns the new value.
 * Should be called once per app mount after initial onboarding is done.
 */
export function incrementSessionCount(): number {
  const current = readSessionCount()
  const next = current + 1
  writeSessionCount(next)
  return next
}

/**
 * Resets all onboarding state (useful for testing or "reset account").
 */
export function resetOnboardingState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_COMPLETED)
    localStorage.removeItem(STORAGE_KEY_SESSION)
  } catch {
    // Silently ignore
  }
}
