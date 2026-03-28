/**
 * ConnectionStatus — Ambient connectivity & sync status banner
 *
 * Renders a thin, non-intrusive banner at the top of the app that communicates:
 * - Offline (yellow): network is unavailable, pulses are queued
 * - Reconnecting (amber): Supabase Realtime is attempting to re-establish WebSocket
 * - Syncing (blue): back online, flushing offline queue
 * - Synced (green, auto-dismisses after 3s): all queued items sent
 *
 * The banner uses `position: fixed` and does NOT push page content down.
 * It sits above the AppHeader (z-50) and slides in from the top.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WifiSlash, WifiHigh, ArrowsClockwise, CloudCheck } from '@phosphor-icons/react'
import type { ConnectionStatus as RealtimeStatus } from '@/hooks/use-realtime-subscription'
import { onQueueEvent, getPendingCountSync } from '@/lib/offline-queue'

// ── Types ──────────────────────────────────────────────────────────────────

type BannerState =
  | 'hidden'
  | 'offline'
  | 'reconnecting'
  | 'syncing'
  | 'synced'

// ── Props ──────────────────────────────────────────────────────────────────

interface ConnectionStatusProps {
  /** Status from useRealtimeSubscription — drives the reconnecting banner */
  realtimeStatus?: RealtimeStatus
}

// ── Component ──────────────────────────────────────────────────────────────

export function ConnectionStatus({ realtimeStatus }: ConnectionStatusProps) {
  const [isNetworkOnline, setIsNetworkOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState(() => getPendingCountSync())
  const [banner, setBanner] = useState<BannerState>('hidden')
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── Network listeners ────────────────────────────────────────────────────

  const handleOnline = useCallback(() => {
    setIsNetworkOnline(true)
    setBanner(pendingCount > 0 ? 'syncing' : 'synced')
  }, [pendingCount])

  const handleOffline = useCallback(() => {
    setIsNetworkOnline(false)
    setBanner('offline')
  }, [])

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleOnline, handleOffline])

  // ── Queue event listener ─────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onQueueEvent((event) => {
      if (event.type === 'enqueued') {
        setPendingCount(prev => prev + 1)
      } else if (event.type === 'synced') {
        setPendingCount(prev => Math.max(0, prev - 1))
      } else if (event.type === 'status-changed' && event.stats?.pendingCount !== undefined) {
        setPendingCount(event.stats.pendingCount)
      } else if (event.type === 'cleared') {
        setPendingCount(0)
      }
    })
    return unsub
  }, [])

  // ── Realtime status → banner ─────────────────────────────────────────────

  useEffect(() => {
    if (!realtimeStatus) return
    if (realtimeStatus === 'reconnecting') {
      setBanner('reconnecting')
    } else if (realtimeStatus === 'connected' && banner === 'reconnecting') {
      // Was reconnecting, now connected — show brief synced state
      setBanner('synced')
    }
  }, [realtimeStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pending count → banner ───────────────────────────────────────────────

  useEffect(() => {
    if (!isNetworkOnline) return
    if (pendingCount > 0) {
      setBanner('syncing')
    } else if (banner === 'syncing') {
      // Queue just drained
      setBanner('synced')
    }
  }, [pendingCount, isNetworkOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-dismiss synced/reconnected states ───────────────────────────────

  useEffect(() => {
    if (banner !== 'synced') return
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    autoDismissRef.current = setTimeout(() => setBanner('hidden'), 3000)
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    }
  }, [banner])

  // ── Render ───────────────────────────────────────────────────────────────

  const config = BANNER_CONFIG[banner]

  return (
    <AnimatePresence>
      {banner !== 'hidden' && config && (
        <motion.div
          key={banner}
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className={`fixed top-0 left-0 right-0 z-[60] ${config.bg}`}
          role="status"
          aria-live="polite"
          aria-label={config.ariaLabel}
        >
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
            <config.Icon size={16} weight="bold" className="shrink-0" />
            <span>{config.message(pendingCount)}</span>
            {banner === 'reconnecting' && <SpinnerDot />}
            {banner === 'syncing' && pendingCount > 0 && (
              <span className="ml-1 opacity-70 text-xs">
                ({pendingCount} pending)
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Banner config ──────────────────────────────────────────────────────────

interface BannerConfig {
  bg: string
  Icon: React.ElementType
  message: (pendingCount: number) => string
  ariaLabel: string
}

const BANNER_CONFIG: Partial<Record<BannerState, BannerConfig>> = {
  offline: {
    bg: 'bg-amber-500 text-white',
    Icon: WifiSlash,
    message: (n) =>
      n > 0
        ? `You're offline — ${n} pulse${n === 1 ? '' : 's'} queued`
        : "You're offline — pulses will sync when reconnected",
    ariaLabel: 'Offline notification',
  },
  reconnecting: {
    bg: 'bg-orange-500 text-white',
    Icon: ArrowsClockwise,
    message: () => 'Reconnecting to live updates...',
    ariaLabel: 'Reconnecting to server',
  },
  syncing: {
    bg: 'bg-blue-500 text-white',
    Icon: ArrowsClockwise,
    message: (n) => (n > 0 ? `Syncing ${n} queued pulse${n === 1 ? '' : 's'}...` : 'Syncing...'),
    ariaLabel: 'Syncing queued items',
  },
  synced: {
    bg: 'bg-green-600 text-white',
    Icon: CloudCheck,
    message: () => 'Back online — all synced',
    ariaLabel: 'Back online',
  },
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SpinnerDot() {
  return (
    <motion.span
      className="inline-block h-1.5 w-1.5 rounded-full bg-white ml-1"
      animate={{ opacity: [1, 0.3, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    />
  )
}
