import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Footprints, MapPin, Users } from '@phosphor-icons/react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isFeatureEnabled } from '@/lib/feature-flags'

import { StartSafeWalkSheet } from './StartSafeWalkSheet'
import { ShareNightSheet } from './ShareNightSheet'
import type { SafetyContactSnapshot, StartArgs } from './safety-types'

export interface SafetyHomeCardProps {
  userId: string
  contacts: SafetyContactSnapshot[]
  onOpenContacts?: () => void
  onStartSession?: (input: StartArgs) => Promise<{ ok: boolean; error?: string }>
  userLocation?: { lat: number; lng: number } | null
}

/**
 * Renders null when the feature flag is off so this component can be dropped
 * into the home screen without gating callers.
 */
export function SafetyHomeCard(props: SafetyHomeCardProps) {
  const [walkOpen, setWalkOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  if (!isFeatureEnabled('safetyKit')) return null

  const hasVerifiedContact = props.contacts.some(c => Boolean(c.phone_e164))

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        data-testid="safety-home-card"
      >
        <Card className="p-4 space-y-3 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="flex items-center gap-2">
            <Shield size={18} weight="fill" className="text-primary" />
            <span className="font-bold text-sm">Safety Kit</span>
          </div>
          <p className="text-xs text-muted-foreground">
            One-tap tools for getting home safely. Not an emergency service.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="default"
              className="h-14"
              onClick={() => setWalkOpen(true)}
              aria-label="Start Safe Walk timer"
            >
              <Footprints size={18} weight="fill" />
              Safe Walk
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14"
              onClick={() => setShareOpen(true)}
              aria-label="Share my night"
            >
              <MapPin size={18} weight="fill" />
              Share Night
            </Button>
          </div>

          {!hasVerifiedContact && (
            <button
              type="button"
              onClick={props.onOpenContacts}
              className="w-full text-left p-3 rounded-md bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users size={14} weight="fill" className="text-accent" />
                <span className="text-xs font-medium">Add an emergency contact to enable alerts</span>
              </div>
            </button>
          )}
        </Card>
      </motion.div>

      <StartSafeWalkSheet
        open={walkOpen}
        onClose={() => setWalkOpen(false)}
        contacts={props.contacts}
        userLocation={props.userLocation ?? null}
        onStartSession={props.onStartSession}
      />

      <ShareNightSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        contacts={props.contacts}
        userLocation={props.userLocation ?? null}
        onStartSession={props.onStartSession}
      />
    </>
  )
}
