const WELCOME_SEEN_KEY = 'pulse-welcome-seen'

export function hasSeenWelcome(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markWelcomeSeen(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, '1')
  } catch {
    /* ignore quota */
  }
}

export function clearWelcomeSeenForTests(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(WELCOME_SEEN_KEY)
}

/** First visit to `/` should see the Seattle landing once. */
export function shouldRedirectToWelcome(pathname: string): boolean {
  return pathname === '/' && !hasSeenWelcome()
}
