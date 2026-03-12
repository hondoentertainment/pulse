import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WifiSlash, WifiHigh } from '@phosphor-icons/react'

type ConnectionStatus = 'online' | 'offline' | 'reconnected'

export function OfflineBanner() {
  const [status, setStatus] = useState<ConnectionStatus>(
    navigator.onLine ? 'online' : 'offline'
  )

  const handleOnline = useCallback(() => {
    setStatus('reconnected')
  }, [])

  const handleOffline = useCallback(() => {
    setStatus('offline')
  }, [])

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  useEffect(() => {
    if (status !== 'reconnected') return

    const timer = setTimeout(() => {
      setStatus('online')
    }, 3000)

    return () => clearTimeout(timer)
  }, [status])

  const isVisible = status === 'offline' || status === 'reconnected'

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={status}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed top-14 left-0 right-0 z-50 ${
            status === 'offline'
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-green-600 text-white'
          }`}
        >
          <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium">
            {status === 'offline' ? (
              <>
                <WifiSlash size={18} weight="bold" className="shrink-0" />
                <span>
                  You&apos;re offline — pulses will sync when reconnected
                </span>
              </>
            ) : (
              <>
                <WifiHigh size={18} weight="bold" className="shrink-0" />
                <span>Back online! Syncing...</span>
                <motion.div
                  className="ml-1 h-1 w-1 rounded-full bg-white"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
