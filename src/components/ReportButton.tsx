/**
 * ReportButton
 *
 * A compact flag/report icon button that opens a modal for submitting
 * a ContentReport via the moderation library.  Designed to be embedded
 * inside pulse cards, reaction rows, and story viewers.
 */

import { useState } from 'react'
import { Flag, Warning, ShieldCheck, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { submitReport, type ContentType, type ReportReason } from '@/lib/moderation'
import { checkDefaultLimit } from '@/lib/rate-limiter'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Reason catalogue (mirrors moderation.ts types)
// ---------------------------------------------------------------------------

const REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'spam',           label: 'Spam',           description: 'Promotional or repetitive content' },
  { value: 'inappropriate',  label: 'Inappropriate',  description: 'Offensive or explicit content'     },
  { value: 'harassment',     label: 'Harassment',     description: 'Bullying or targeted abuse'        },
  { value: 'misinformation', label: 'Misinformation', description: 'False venue or energy info'        },
  { value: 'other',          label: 'Other',          description: 'Something else'                    },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReportButtonProps {
  /** ID of the user filing the report. */
  reporterId: string
  /** What kind of content is being reported. */
  contentType: ContentType
  /** ID of the content being reported. */
  contentId: string
  /** Optional extra CSS classes for the trigger button. */
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportButton({
  reporterId,
  contentType,
  contentId,
  className = '',
}: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null)
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Reset internal state whenever the dialog closes
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Small delay so the user sees the success state before unmounting
      setTimeout(() => {
        setSelectedReason(null)
        setDescription('')
        setSubmitted(false)
      }, 300)
    }
    setOpen(next)
  }

  const handleSubmit = () => {
    if (!selectedReason) return

    // Rate-limit reports: 10 per day per user
    const limitCheck = checkDefaultLimit(reporterId, 'report')
    if (!limitCheck.allowed) {
      const waitSecs = limitCheck.retryAfter ?? 60
      toast.error('Report limit reached', {
        description: `You can file more reports in ${Math.ceil(waitSecs / 60)} minute(s).`,
      })
      handleOpenChange(false)
      return
    }

    submitReport({
      reporterId,
      contentType,
      contentId,
      reason: selectedReason,
      description: description.trim() || undefined,
    })

    setSubmitted(true)

    toast.success('Report submitted', {
      description: "Thanks for helping keep Pulse safe. We'll review it shortly.",
    })

    setTimeout(() => handleOpenChange(false), 1600)
  }

  const contentLabel =
    contentType === 'pulse'
      ? 'Pulse'
      : contentType === 'story'
      ? 'Story'
      : 'Reaction'

  return (
    <>
      {/* Trigger button — minimal footprint */}
      <button
        type="button"
        aria-label={`Report this ${contentLabel}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ${className}`}
      >
        <Flag size={15} weight="bold" />
      </button>

      {/* Modal */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-card border-border max-w-sm">
          {submitted ? (
            <div className="flex flex-col items-center py-8 gap-4">
              <ShieldCheck size={48} weight="fill" className="text-accent" />
              <p className="text-lg font-semibold text-foreground">Report Received</p>
              <p className="text-sm text-muted-foreground text-center">
                We'll review this {contentLabel.toLowerCase()} and take action if needed.
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Flag size={18} weight="fill" className="text-destructive" />
                  Report {contentLabel}
                </DialogTitle>
                <DialogDescription>
                  Help us understand what's wrong with this content.
                </DialogDescription>
              </DialogHeader>

              {/* Reason selector */}
              <div className="space-y-2 mt-2">
                {REASONS.map((reason) => (
                  <button
                    key={reason.value}
                    type="button"
                    onClick={() => setSelectedReason(reason.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      selectedReason === reason.value
                        ? 'border-accent bg-accent/10 text-foreground'
                        : 'border-border bg-background hover:border-muted-foreground/30 text-foreground'
                    }`}
                  >
                    <p className="text-sm font-medium">{reason.label}</p>
                    <p className="text-xs text-muted-foreground">{reason.description}</p>
                  </button>
                ))}
              </div>

              {/* Optional description */}
              {selectedReason && (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details (optional)"
                  maxLength={500}
                  className="w-full mt-3 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-accent"
                />
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleOpenChange(false)}
                >
                  <X size={14} className="mr-1" />
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  disabled={!selectedReason}
                  onClick={handleSubmit}
                >
                  <Warning size={14} weight="fill" className="mr-1" />
                  Submit Report
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
