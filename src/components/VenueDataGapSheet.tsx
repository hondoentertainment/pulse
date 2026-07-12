import { useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Warning, PaperPlaneTilt } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  VENUE_DATA_REPORT_REASONS,
  VENUE_DATA_REPORT_LABELS,
  submitVenueDataReport,
  type VenueDataReportReason,
} from '@/lib/venue-data-reports'

interface VenueDataGapSheetProps {
  open: boolean
  onClose: () => void
  venueName: string
  venueId: string
  accessToken?: string | null
  onSubmitted?: (reason: VenueDataReportReason) => void
}

/** Reasons that benefit from an optional menu link so we can fix it faster. */
const MENU_REASONS: VenueDataReportReason[] = ['menu_missing', 'menu_outdated']

export function VenueDataGapSheet({
  open,
  onClose,
  venueName,
  venueId,
  accessToken,
  onSubmitted,
}: VenueDataGapSheetProps) {
  const [selectedReason, setSelectedReason] = useState<VenueDataReportReason | null>(null)
  const [note, setNote] = useState('')
  const [menuUrl, setMenuUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedReason, setSubmittedReason] = useState<VenueDataReportReason | null>(null)

  const resetAndClose = () => {
    setSelectedReason(null)
    setNote('')
    setMenuUrl('')
    setSubmitting(false)
    setSubmittedReason(null)
    onClose()
  }

  const handleReasonClick = (reason: VenueDataReportReason) => {
    setSelectedReason(reason)
  }

  const handleSubmit = async () => {
    if (!selectedReason) return
    setSubmitting(true)
    const result = await submitVenueDataReport({
      venueId,
      reason: selectedReason,
      note: note.trim() || undefined,
      menuUrl: MENU_REASONS.includes(selectedReason) && menuUrl.trim() ? menuUrl.trim() : undefined,
      accessToken,
    })
    setSubmitting(false)

    if (!result.ok) {
      toast.error('Could not submit report', { description: result.error })
      return
    }

    setSubmittedReason(selectedReason)
    onSubmitted?.(selectedReason)
    toast.success('Thanks for the heads up!', {
      description: 'Our team will take a look at this venue.',
    })
  }

  const showMenuUrlField = selectedReason ? MENU_REASONS.includes(selectedReason) : false

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) resetAndClose() }}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-accent/20 bg-card max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/30 mb-2" />
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <Warning size={20} weight="fill" className="text-orange-400" />
            Something's wrong?
          </SheetTitle>
          <SheetDescription className="text-sm">
            Help us fix {venueName}'s info. This doesn't affect live energy reports.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          <AnimatePresence mode="wait">
            {submittedReason ? (
              <motion.div
                key="submitted"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20"
              >
                <CheckCircle size={22} weight="fill" className="text-green-400" />
                <div>
                  <p className="text-sm font-bold text-green-400">Report sent</p>
                  <p className="text-xs text-muted-foreground">
                    {VENUE_DATA_REPORT_LABELS[submittedReason]}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-2">
                  {VENUE_DATA_REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => handleReasonClick(reason)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border transition-all text-left text-sm font-medium',
                        selectedReason === reason
                          ? 'bg-accent/10 border-accent/40 text-accent'
                          : 'bg-secondary/50 border-border hover:border-accent/30',
                      )}
                    >
                      {VENUE_DATA_REPORT_LABELS[reason]}
                    </button>
                  ))}
                </div>

                {selectedReason && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 overflow-hidden"
                  >
                    {showMenuUrlField && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Menu link (optional)</Label>
                        <Input
                          placeholder="https://..."
                          value={menuUrl}
                          onChange={(e) => setMenuUrl(e.target.value)}
                          className="bg-secondary"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Details (optional)</Label>
                      <Input
                        placeholder="Tell us more..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="bg-secondary"
                      />
                    </div>

                    <Button
                      className="w-full"
                      disabled={submitting}
                      onClick={handleSubmit}
                    >
                      <PaperPlaneTilt size={16} className="mr-1" />
                      {submitting ? 'Sending…' : 'Send report'}
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  )
}
