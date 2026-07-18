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
  PRICE_RANGE_OPTIONS,
  submitVenueDataReport,
  type VenueDataReportReason,
  type VenuePriceRange,
  type VenueProposedFields,
} from '@/lib/venue-data-reports'

export interface VenueCorrectionCurrentValues {
  address?: string
  phone?: string
  hours?: string
  website?: string
  menuUrl?: string | null
  priceRange?: VenuePriceRange | null
}

interface VenueDataGapSheetProps {
  open: boolean
  onClose: () => void
  venueName: string
  venueId: string
  accessToken?: string | null
  currentValues?: VenueCorrectionCurrentValues
  onSubmitted?: (reason: VenueDataReportReason) => void
}

/** Reasons that benefit from an optional menu link so we can fix it faster. */
const MENU_REASONS: VenueDataReportReason[] = ['menu_missing', 'menu_outdated']

function proposedFieldForReason(reason: VenueDataReportReason): keyof VenueProposedFields | null {
  switch (reason) {
    case 'wrong_hours':
      return 'hours'
    case 'wrong_address':
      return 'address'
    case 'wrong_phone':
      return 'phone'
    case 'missing_info':
      return 'website'
    default:
      return null
  }
}

function currentLabelForReason(
  reason: VenueDataReportReason,
  current?: VenueCorrectionCurrentValues,
): string | undefined {
  switch (reason) {
    case 'wrong_hours':
      return current?.hours
    case 'wrong_address':
      return current?.address
    case 'wrong_phone':
      return current?.phone
    case 'missing_info':
      return current?.website
    case 'menu_missing':
    case 'menu_outdated':
      return current?.menuUrl ?? undefined
    default:
      return undefined
  }
}

function correctionPlaceholder(reason: VenueDataReportReason): string {
  switch (reason) {
    case 'wrong_hours':
      return 'e.g. Mon–Thu 5pm–12am, Fri–Sat 5pm–2am'
    case 'wrong_address':
      return 'Correct street address'
    case 'wrong_phone':
      return 'Correct phone number'
    case 'missing_info':
      return 'Website or other missing detail'
    default:
      return ''
  }
}

export function VenueDataGapSheet({
  open,
  onClose,
  venueName,
  venueId,
  accessToken,
  currentValues,
  onSubmitted,
}: VenueDataGapSheetProps) {
  const [selectedReason, setSelectedReason] = useState<VenueDataReportReason | null>(null)
  const [note, setNote] = useState('')
  const [menuUrl, setMenuUrl] = useState('')
  const [proposedValue, setProposedValue] = useState('')
  const [priceRange, setPriceRange] = useState<VenuePriceRange | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submittedReason, setSubmittedReason] = useState<VenueDataReportReason | null>(null)

  const resetAndClose = () => {
    setSelectedReason(null)
    setNote('')
    setMenuUrl('')
    setProposedValue('')
    setPriceRange(null)
    setSubmitting(false)
    setSubmittedReason(null)
    onClose()
  }

  const handleReasonClick = (reason: VenueDataReportReason) => {
    setSelectedReason(reason)
    setProposedValue('')
    setPriceRange(null)
    if (!MENU_REASONS.includes(reason)) setMenuUrl('')
  }

  const handleSubmit = async () => {
    if (!selectedReason) return

    if (!accessToken) {
      toast.error('Sign in to suggest a correction', {
        description: 'Your Pulse account is required to recommend venue updates.',
      })
      return
    }

    const fieldKey = proposedFieldForReason(selectedReason)
    const proposedFields: VenueProposedFields | undefined =
      fieldKey && proposedValue.trim()
        ? { [fieldKey]: proposedValue.trim() }
        : undefined

    setSubmitting(true)
    const result = await submitVenueDataReport({
      venueId,
      reason: selectedReason,
      note: note.trim() || undefined,
      menuUrl: MENU_REASONS.includes(selectedReason) && menuUrl.trim() ? menuUrl.trim() : undefined,
      priceRange: selectedReason === 'pricing_outdated' && priceRange ? priceRange : undefined,
      proposedFields,
      accessToken,
    })
    setSubmitting(false)

    if (!result.ok) {
      toast.error('Could not submit correction', { description: result.error })
      return
    }

    setSubmittedReason(selectedReason)
    onSubmitted?.(selectedReason)
    toast.success('Correction submitted', {
      description: 'Thanks — our team will review your suggestion.',
    })
  }

  const showMenuUrlField = selectedReason ? MENU_REASONS.includes(selectedReason) : false
  const showPriceRange = selectedReason === 'pricing_outdated'
  const proposedFieldKey = selectedReason ? proposedFieldForReason(selectedReason) : null
  const listedValue = selectedReason ? currentLabelForReason(selectedReason, currentValues) : undefined

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) resetAndClose() }}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t-accent/20 bg-card max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/30 mb-2" />
          <SheetTitle className="text-xl font-bold flex items-center gap-2">
            <Warning size={20} weight="fill" className="text-orange-400" />
            Suggest a correction
          </SheetTitle>
          <SheetDescription className="text-sm">
            Recommend an update for {venueName}. Signed-in Pulse users help keep the catalog accurate.
            This doesn&apos;t affect live energy reports.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          {!accessToken && !submittedReason && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-200">
              Sign in with your Pulse account to submit a venue correction.
            </div>
          )}

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
                  <p className="text-sm font-bold text-green-400">Correction sent</p>
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
                      data-testid={`venue-correction-reason-${reason}`}
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
                    {listedValue && (
                      <div className="rounded-lg bg-secondary/40 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Currently listed</p>
                        <p className="text-sm mt-0.5 break-words">{listedValue}</p>
                      </div>
                    )}

                    {proposedFieldKey && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          What should it be? (recommended)
                        </Label>
                        <Input
                          placeholder={correctionPlaceholder(selectedReason)}
                          value={proposedValue}
                          onChange={(e) => setProposedValue(e.target.value)}
                          className="bg-secondary"
                          data-testid="venue-correction-proposed-value"
                        />
                      </div>
                    )}

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

                    {showPriceRange && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Suggested price range</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {PRICE_RANGE_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setPriceRange(option.value)}
                              className={cn(
                                'rounded-xl border p-2 text-sm font-semibold transition-all',
                                priceRange === option.value
                                  ? 'bg-accent/10 border-accent/40 text-accent'
                                  : 'bg-secondary/50 border-border hover:border-accent/30',
                              )}
                              title={option.hint}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Details (optional)</Label>
                      <Input
                        placeholder="Anything else we should know..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="bg-secondary"
                      />
                    </div>

                    <Button
                      className="w-full"
                      disabled={submitting || !accessToken}
                      onClick={handleSubmit}
                      data-testid="venue-correction-submit"
                    >
                      <PaperPlaneTilt size={16} className="mr-1" />
                      {submitting ? 'Sending…' : 'Submit correction'}
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
