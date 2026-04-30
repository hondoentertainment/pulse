import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MapPin, Users, Clock } from '@phosphor-icons/react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import type { SafetyContactSnapshot, StartArgs } from './safety-types'

export interface ShareNightSheetProps {
  open: boolean
  onClose: () => void
  contacts: SafetyContactSnapshot[]
  userLocation: { lat: number; lng: number } | null
  onStartSession?: (input: StartArgs) => Promise<{ ok: boolean; error?: string }>
}

const DURATION_PRESETS = [1, 2, 3, 4, 5] as const // hours

export function ShareNightSheet(props: ShareNightSheetProps) {
  const [plan, setPlan] = useState('')
  const [hours, setHours] = useState<number>(3)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(props.contacts.filter(c => c.verified_at).slice(0, 3).map(c => c.id)),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const verifiedContacts = useMemo(
    () => props.contacts.filter(c => c.verified_at),
    [props.contacts],
  )

  const toggleContact = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleStart = async () => {
    if (!props.onStartSession) return
    const contacts = verifiedContacts.filter(c => selectedIds.has(c.id))
    if (contacts.length === 0) {
      toast.error('Pick at least one verified contact to share with.')
      return
    }
    setIsSubmitting(true)
    const result = await props.onStartSession({
      kind: 'share_night',
      expectedDurationMinutes: hours * 60,
      destination: props.userLocation
        ? { lat: props.userLocation.lat, lng: props.userLocation.lng, label: plan || undefined }
        : plan
          ? { label: plan }
          : undefined,
      contacts,
      notes: plan || undefined,
    })
    setIsSubmitting(false)
    if (result.ok) {
      toast.success('Your night plan is shared.')
      props.onClose()
    } else {
      toast.error(result.error ?? 'Could not share plan')
    }
  }

  return (
    <Sheet open={props.open} onOpenChange={o => !o && props.onClose()}>
      <SheetContent side="bottom" className="h-[82vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Share My Night</SheetTitle>
          <SheetDescription>
            Lightweight live-share of where you'll be. No auto-alert – contacts
            just see your updates.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pt-4">
          <section className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MapPin size={14} weight="fill" className="text-primary" /> Tonight's plan
            </Label>
            <Input
              placeholder="e.g. Dinner at Rustic, then Bar 15"
              value={plan}
              onChange={event => setPlan(event.target.value)}
              className="h-12"
            />
          </section>

          <Separator />

          <section className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Clock size={14} weight="fill" className="text-accent" /> How long
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {DURATION_PRESETS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(h)}
                  className={cn(
                    'h-12 rounded-md text-sm font-medium transition-all',
                    hours === h
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Users size={14} weight="fill" className="text-primary" /> Share with
            </Label>
            {verifiedContacts.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 bg-secondary/50 rounded-md">
                Add a verified contact first.
              </p>
            ) : (
              <div className="space-y-2">
                {verifiedContacts.map(contact => {
                  const selected = selectedIds.has(contact.id)
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
                        {selected ? 'Sharing' : 'Tap to include'}
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
            {isSubmitting ? 'Sharing…' : `Share for ${hours}h`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
