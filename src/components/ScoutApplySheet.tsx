import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SCOUT_TIERS } from '@/lib/scout-program'
import { submitScoutApplication } from '@/lib/venue-admin-client'

interface ScoutApplySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmitted?: () => void
}

export function ScoutApplySheet({ open, onOpenChange, onSubmitted }: ScoutApplySheetProps) {
  const [motivation, setMotivation] = useState('')
  const [neighborhoods, setNeighborhoods] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const neighborhoodList = neighborhoods
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
      await submitScoutApplication({
        motivation: motivation.trim() || undefined,
        neighborhoods: neighborhoodList.length > 0 ? neighborhoodList : undefined,
      })
      toast.success('Application submitted — we will review soon.')
      setMotivation('')
      setNeighborhoods('')
      onOpenChange(false)
      onSubmitted?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit application')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Apply to be a Scout</SheetTitle>
          <SheetDescription>
            Scouts submit verified energy reports. {SCOUT_TIERS.rookie.description}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scout-motivation">Why do you want to scout?</Label>
            <Input
              id="scout-motivation"
              value={motivation}
              placeholder="I know Capitol Hill and go out 3x a week…"
              onChange={(e) => setMotivation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scout-neighborhoods">Neighborhoods (comma-separated)</Label>
            <Input
              id="scout-neighborhoods"
              value={neighborhoods}
              placeholder="Capitol Hill, Belltown, Fremont"
              onChange={(e) => setNeighborhoods(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={submitting}
            onClick={handleSubmit}
            data-testid="scout-apply-submit"
          >
            {submitting ? 'Submitting…' : 'Submit application'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
