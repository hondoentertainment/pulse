import { useState, useEffect } from 'react'

export function useCurrentTime(intervalMs = 60_000) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date())
    }, intervalMs)

    return () => clearInterval(interval)
  }, [intervalMs])

  return time
}
