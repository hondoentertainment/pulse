export type CheckInWindow = 'morning' | 'evening'

export const MORNING_CUTOFF_HOUR = 12

export function localDayKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function resolveCheckInWindow(date: Date = new Date()): CheckInWindow {
  return date.getHours() < MORNING_CUTOFF_HOUR ? 'morning' : 'evening'
}

export function windowLabel(window: CheckInWindow): string {
  return window === 'morning' ? 'Morning' : 'Evening'
}

export function isValidDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}
