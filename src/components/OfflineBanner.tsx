import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { draftSnippet, readPulseDraft } from '@/lib/pulse-draft'

type ConnectionStatus = 'online' | 'offline' | 'reconnected'

export function OfflineBanner() {
  const [status, setStatus] = useState<ConnectionStatus>(
    typeof navigator === 'undefined' || navigator.onLine ? 'online' : 'offline',
  )
  const [dismissed, setDismissed] = useState(false)
  const [draftLine, setDraftLine] = useState('')

  const handleOnline = useCallback(() => {
    setStatus('reconnected')
    setDismissed(false)
  }, [])

  const handleOffline = useCallback(() => {
    setStatus('offline')
    setDismissed(false)
    setDraftLine(draftSnippet(readPulseDraft()))
  }, [])

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setDraftLine(draftSnippet(readPulseDraft()))
    }
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  useEffect(() => {
    if (status !== 'reconnected') return
    const timer = setTimeout(() => setStatus('online'), 3000)
    return () => clearTimeout(timer)
  }, [status])

  const isVisible = !dismissed && (status === 'offline' || status === 'reconnected')

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={status}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-50 bg-[#0B0B0E]/95 px-5 pb-4 pt-6 backdrop-blur-md"
          role="status"
        >
          {status === 'offline' ? (
            <div className="mx-auto max-w-2xl space-y-3">
              <h2 className="text-[22px] font-bold text-white">You’re offline</h2>
              <p className="text-sm text-muted-foreground">
                Map shows last known energy. Pulses queue until you’re back.
              </p>
              {draftLine && (
                <div className="rounded-[18px] bg-[#17171C] p-3.5">
                  <p className="text-sm font-semibold text-white">Draft saved</p>
                  <p className="mt-1 text-xs text-muted-foreground">{draftLine}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="h-12 w-full rounded-2xl bg-[#1F1F24] text-[15px] font-semibold text-white"
              >
                Keep browsing
              </button>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl py-2 text-sm font-medium text-white">
              Back online! Syncing queued pulses…
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
