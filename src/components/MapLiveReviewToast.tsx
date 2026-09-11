import { memo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { EnergyBadge } from '@/components/EnergyBadge'
import type { MapLiveToast } from '@/lib/map-live-reviews'
import { triggerHapticFeedback } from '@/lib/haptics'

const TOAST_MS = 5600

interface MapLiveReviewToastProps {
  toast: MapLiveToast | null
  onDismiss: () => void
  onOpen: (toast: MapLiveToast) => void
}

export const MapLiveReviewToast = memo(function MapLiveReviewToast({ toast, onDismiss, onOpen }: MapLiveReviewToastProps) {
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(onDismiss, TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <motion.div
      key={toast.id}
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      className="pointer-events-auto relative z-40 mt-2 w-full max-w-xl"
    >
      <button
        type="button"
        onClick={() => {
          triggerHapticFeedback('medium')
          onOpen(toast)
        }}
        className="w-full rounded-xl border border-border bg-card/95 px-3.5 py-3 text-left shadow-2xl backdrop-blur-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {toast.headline}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-foreground">
              {toast.snippet || 'New live review'}
            </p>
          </div>
          <EnergyBadge rating={toast.energy} className="shrink-0" />
        </div>
      </button>
    </motion.div>
  )
})
