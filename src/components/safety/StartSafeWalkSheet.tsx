import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Clock, MapPin, Users, WarningCircle } from '@phosphor-icons/react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import type { SafetyContactSnapshot, StartArgs } from './safety-types'

export interface StartSafeWalkSheetProps {
  open: boolean
  onClose: () => void
  contacts: SafetyContactSnapshot[]
  userLocation: { lat: number; lng: number } | null
  onStartSession?: (input: StartArgs) => Promise<{ ok: boolean; error?: string }>
}

const DURATION_PRESETS = [10, 20, 30, 45, 60] as const

export function StartSafeWalkSheet(props: StartSafeWalkSheetProps) {
  const [destinationLabel, setDestinationLabel] = useState('')
  const [duration, setDuration] = useState<number>(20)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(
    () => new Set(props.contacts.filter(c => c.verified_at).slice(0, 3).map(c => c.id)),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const verifiedContacts = useMemo(
    () => props.contacts.filter(c => c.verified_at),
    [props.contacts],
  )

  const toggleContact = (id: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleStart = async () => {
    if (!props.onStartSession) return
    const contacts = verifiedContacts.filter(c => selectedContactIds.has(c.id))
    if (contacts.length === 0) {
      toast.error('Pick at least one verified contact to notify.')
      return
    }
    setIsSubmitting(true)
    const result = await props.onStartSession({
      kind: 'safe_walk',
      expectedDurationMinutes: duration,
      destination: destinationLabel
        ? { label: destinationLabel }
        : props.userLocation
          ? { lat: props.userLocation.lat, lng: props.userLocation.lng }
          : undefined,
      contacts,
    })
    setIsSubmitting(false)
    if (result.ok) {
      toast.success('Safe Walk started. Stay safe out there.')
      props.onClose()
    } else {
      toast.error(result.error ?? 'Could not start Safe Walk')
    }
  }

  return (
    <Sheet open={props.open} onOpenChange={o => !o && props.onClose()}>
      <SheetContent side="bottom" className="h-[88vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Start Safe Walk</SheetTitle>
          <SheetDescription>
            We'll ping your contacts if you don't check in by your ETA. Not an emergency service.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pt-4">
          <section className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin size={14} weight="fill" className="text-primary" /> Destination
            </Label>
            <Input
              placeholder="e.g. Home, 123 Main St, or a venue name"
              value={destinationLabel}
              onChange={event => setDestinationLabel(event.target.value)}
              className="h-12"
              inputMode="text"
              autoComplete="street-address"
            />
          </section>

          <Separator />

          <section className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Clock size={14} weight="fill" className="text-accent" /> Expected duration
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {DURATION_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDuration(preset)}
                  className={cn(
                    'h-12 rounded-md text-sm font-medium transition-all',
                    duration === preset
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                >
                  {preset}m
                </button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Users size={14} weight="fill" className="text-primary" /> Contacts to notify
            </Label>
            {verifiedContacts.length === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-md bg-secondary/50">
                <WarningCircle size={16} weight="fill" className="text-yellow-500 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  No verified contacts yet. Add one from Settings before starting.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {verifiedContacts.map(contact => {
                  const selected = selectedContactIds.has(contact.id)
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => toggleContact(contact.id)}
                      className={cn(
                        'w-full p-3 rounded-md text-left transition-all flex items-center justify-between',
                        selected
                          ? 'bg-primary/10 border border-primary/40'
                          : 'bg-secondary/50 border border-transparent',
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.phone_e164}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {selected ? 'Notifying' : 'Tap to include'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <Button
            onClick={handleStart}
            disabled={isSubmitting || verifiedContacts.length === 0}
            className="w-full h-14 text-base font-semibold"
          >
            {isSubmitting ? 'Starting…' : `Start Safe Walk (${duration}m)`}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center px-4">
            By starting, you allow Pulse to send an SMS to your chosen contacts if
            you don't check in by the ETA. Standard carrier rates apply.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
