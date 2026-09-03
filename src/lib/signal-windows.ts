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

/** Parse a `YYYY-MM-DD` day key into a local-time Date at noon (DST-safe). */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

/** Shift a day key by whole local days, e.g. `shiftDayKey('2026-08-31', 1) === '2026-09-01'`. */
export function shiftDayKey(key: string, days: number): string {
  const date = parseDayKey(key)
  date.setDate(date.getDate() + days)
  return localDayKey(date)
}
