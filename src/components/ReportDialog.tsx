import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { REPORT_REASONS, createReport, type ReportReason, type ContentReport } from '@/lib/content-moderation'
import { Flag, Warning, ShieldCheck } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetType: 'pulse' | 'user'
  targetId: string
  reporterId: string
  onReport: (report: ContentReport) => void
}

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  reporterId,
  onReport,
}: ReportDialogProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null)
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (!selectedReason) return

    const report = createReport(reporterId, targetType, targetId, selectedReason, description || undefined)
    onReport(report)
    setSubmitted(true)

    setTimeout(() => {
      onOpenChange(false)
      setSubmitted(false)
      setSelectedReason(null)
      setDescription('')
    }, 1500)

    toast.success('Report submitted', {
      description: 'Thank you for helping keep Pulse safe.',
    })
  }

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border max-w-sm">
          <div className="flex flex-col items-center py-8 gap-4">
            <ShieldCheck size={48} weight="fill" className="text-accent" />
            <p className="text-lg font-semibold text-foreground">Report Submitted</p>
            <p className="text-sm text-muted-foreground text-center">
              We'll review this and take action if needed.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag size={20} weight="fill" className="text-destructive" />
            Report {targetType === 'pulse' ? 'Pulse' : 'User'}
          </DialogTitle>
          <DialogDescription>
            Help us understand what's wrong.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason.value}
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

        {selectedReason && (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details (optional)"
            className="w-full mt-3 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        )}

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-destructive hover:bg-destructive/90"
            disabled={!selectedReason}
            onClick={handleSubmit}
          >
            <Warning size={16} weight="fill" className="mr-1" />
            Submit Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
