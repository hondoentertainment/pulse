import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, X, Plus, Shield } from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { PanicButton } from './PanicButton'
import type { SafetyContactSnapshot } from './safety-types'

export interface ActiveSession {
  id: string
  state: 'armed' | 'active' | 'alerted'
  kind: 'safe_walk' | 'share_night' | 'panic'
  destinationLabel?: string | null
  contacts: SafetyContactSnapshot[]
}

export interface ActiveSessionBannerProps {
  session: ActiveSession
  secondsRemaining: number | null
  onEnd: () => void
  onExtend: (minutes: number) => void
  onPanic: () => void
  permission: 'idle' | 'prompted' | 'granted' | 'denied' | 'unavailable'
}

function formatSeconds(s: number | null): string {
  if (s == null) return '--:--'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function ActiveSessionBanner(props: ActiveSessionBannerProps) {
  const [expanded, setExpanded] = useState(false)

  const kindLabel =
    props.session.kind === 'safe_walk'
      ? 'Safe Walk'
      : props.session.kind === 'share_night'
        ? 'Sharing Night'
        : 'Panic'

  const alerted = props.session.state === 'alerted'

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      className={cn(
        'sticky top-0 z-30 border-b shadow-sm',
        alerted
          ? 'bg-destructive text-destructive-foreground border-destructive'
          : 'bg-primary/10 text-foreground border-primary/30',
      )}
      data-testid="active-session-banner"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-3">
        <Shield size={16} weight="fill" className={alerted ? 'text-white' : 'text-primary'} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide">
            {alerted ? 'Alert sent to contacts' : kindLabel}
          </p>
          <p className="text-sm font-medium truncate">
            {props.session.destinationLabel ?? 'Heading out'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 font-mono text-sm">
            <Clock size={14} weight="fill" />
            {formatSeconds(props.secondsRemaining)}
          </div>
          <Button
            size="sm"
            variant={alerted ? 'secondary' : 'outline'}
            onClick={() => setExpanded(prev => !prev)}
            className="h-8 px-2 text-xs"
            aria-expanded={expanded}
          >
            {expanded ? 'Hide' : 'Details'}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-w-2xl mx-auto px-4 pb-3 space-y-3">
              {props.permission === 'denied' && (
                <p className="text-xs p-2 rounded-md bg-yellow-500/15 text-yellow-700 dark:text-yellow-300">
                  Location permission is off. SMS will still fire, but without a
                  map link.
                </p>
              )}
              <div className="text-xs space-y-1">
                <p className="font-semibold">Notifying:</p>
                <ul className="list-disc pl-4">
                  {props.session.contacts.map(c => (
                    <li key={c.id}>
                      {c.name} <span className="text-muted-foreground">· {c.phone_e164}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => props.onExtend(10)}
                  disabled={alerted}
                >
                  <Plus size={14} /> +10m
                </Button>
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => props.onExtend(30)}
                  disabled={alerted}
                >
                  <Plus size={14} /> +30m
                </Button>
                <Button
                  variant="secondary"
                  className="h-12"
                  onClick={props.onEnd}
                >
                  <X size={14} /> End
                </Button>
              </div>

              <PanicButton onTrigger={props.onPanic} disabled={alerted} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
