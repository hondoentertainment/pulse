import { useEffect, useState } from 'react'

export function useLocalPreference<T extends string | boolean>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
      return typeof stored === typeof initial ? stored as T : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }, [key, value])
  return [value, setValue] as const
}
