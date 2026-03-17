import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  WifiSlash,
  ArrowsClockwise,
  Trash,
  Database,
  CloudArrowUp,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react'
import type { CacheStats } from '@/lib/offline-cache'

// --- Helpers ---

function formatRelativeTime(timestampMs: number): string {
  const seconds = Math.floor((Date.now() - timestampMs) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// --- Offline Banner ---

interface OfflineBannerProps {
  lastSyncTime: number | null
}

export function OfflineBanner({ lastSyncTime }: OfflineBannerProps) {
  const timeLabel = lastSyncTime ? formatRelativeTime(lastSyncTime) : 'unknown'

  return (
    <motion.div
      initial={{ y: -48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -48, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed top-14 left-0 right-0 z-50 bg-amber-500/90 backdrop-blur-sm"
      data-testid="offline-banner"
    >
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium text-amber-950">
        <WifiSlash size={16} weight="bold" className="shrink-0" />
        <span>
          You&apos;re offline — showing cached data from {timeLabel}
        </span>
      </div>
    </motion.div>
  )
}

// --- Sync Progress Indicator ---

interface SyncProgressProps {
  total: number
  synced: number
}

export function SyncProgress({ total, synced }: SyncProgressProps) {
  const progress = total > 0 ? (synced / total) * 100 : 0

  return (
    <motion.div
      initial={{ y: -48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -48, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed top-14 left-0 right-0 z-50 bg-blue-500/90 backdrop-blur-sm"
      data-testid="sync-progress"
    >
      <div className="max-w-2xl mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-white">
          <CloudArrowUp size={16} weight="bold" className="shrink-0" />
          <span>
            Syncing {synced} of {total} queued actions...
          </span>
        </div>
        <div className="mt-1 h-1 rounded-full bg-blue-300/40 overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// --- Venue Cache Badge ---

interface VenueCacheBadgeProps {
  cachedAt: number
}

export function VenueCacheBadge({ cachedAt }: VenueCacheBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
      data-testid="venue-cache-badge"
    >
      <Database size={12} weight="fill" />
      Cached {formatRelativeTime(cachedAt)}
    </span>
  )
}

// --- Cache Manager Panel ---

interface CacheManagerProps {
  stats: CacheStats
  onClear: () => void
  onRefresh: () => void
}

export function CacheManager({ stats, onClear, onRefresh }: CacheManagerProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-testid="cache-manager">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-sm font-semibold text-foreground"
      >
        <div className="flex items-center gap-2">
          <Database size={18} weight="duotone" />
          <span>Offline Cache</span>
        </div>
        {expanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Cached entries</span>
                <span className="font-medium text-foreground">{stats.totalEntries}</span>
              </div>
              <div className="flex justify-between">
                <span>Cache size</span>
                <span className="font-medium text-foreground">{formatBytes(stats.usedBytes)}</span>
              </div>
              <div className="flex justify-between">
                <span>Hit rate</span>
                <span className="font-medium text-foreground">
                  {(stats.hitRate * 100).toFixed(0)}%
                </span>
              </div>
              {stats.oldestEntry && (
                <div className="flex justify-between">
                  <span>Oldest entry</span>
                  <span className="font-medium text-foreground">
                    {formatRelativeTime(stats.oldestEntry)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ArrowsClockwise size={14} weight="bold" />
                Refresh
              </button>
              <button
                type="button"
                onClick={onClear}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                <Trash size={14} weight="bold" />
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- Main Composite Indicator ---

interface OfflineIndicatorProps {
  isOnline: boolean
  lastSyncTime: number | null
  syncProgress: { total: number; synced: number } | null
  cacheStats: CacheStats
  onClearCache: () => void
  onRefreshCache: () => void
}

export function OfflineIndicator({
  isOnline,
  lastSyncTime,
  syncProgress,
  cacheStats,
  onClearCache,
  onRefreshCache,
}: OfflineIndicatorProps) {
  return (
    <>
      <AnimatePresence mode="wait">
        {!isOnline && <OfflineBanner lastSyncTime={lastSyncTime} />}
        {isOnline && syncProgress && (
          <SyncProgress total={syncProgress.total} synced={syncProgress.synced} />
        )}
      </AnimatePresence>
    </>
  )
}

export { formatRelativeTime, formatBytes }
