import { useEffect, useState } from 'react'
import { reminderCopy, resolveReminderPermission, shouldSendReminder, type ReminderPermission } from '@/lib/signal-reminder'
import { sendLocalNotification } from '@/lib/pwa'
import { useSignalStore } from '@/stores/use-signal-store'

const hasVapidPublicKey = Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY)

export function useSignalReminder() {
  const entries = useSignalStore((state) => state.entries)
  const reminderEnabled = useSignalStore((state) => state.reminderEnabled)
  const reminderTime = useSignalStore((state) => state.profile?.reminderTime ?? '09:00')
  const [permission, setPermission] = useState<ReminderPermission>(() =>
    resolveReminderPermission(typeof Notification === 'undefined' ? undefined : Notification),
  )
  const [nudge, setNudge] = useState(false)

  useEffect(() => {
    setPermission(resolveReminderPermission(typeof Notification === 'undefined' ? undefined : Notification))
  }, [])

  useEffect(() => {
    if (!reminderEnabled) {
      setNudge(false)
      return
    }

    const tick = () => {
      const now = new Date()
      const due = shouldSendReminder({
        enabled: reminderEnabled,
        reminderTime,
        entries,
        now,
        windowMinutes: 12 * 60,
      })
      setNudge(due)
    }

    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [entries, reminderEnabled, reminderTime])

  useEffect(() => {
    if (!nudge || permission !== 'granted') return
    void sendLocalNotification('Pulse Signal', {
      body: 'Take 10 seconds to log today’s signal.',
      tag: 'signal-daily-reminder',
    })
  }, [nudge, permission])

  return {
    permission,
    hasVapidPublicKey,
    copy: reminderCopy(permission, hasVapidPublicKey),
    nudge,
    dismissNudge: () => setNudge(false),
  }
}
