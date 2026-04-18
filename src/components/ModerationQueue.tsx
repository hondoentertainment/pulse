/**
 * ModerationQueue — Admin-only component
 *
 * Displays pending content reports and lets moderators take action:
 *   - Dismiss the report (no action needed)
 *   - Remove the content
 *   - Warn the reporting user's target
 *
 * Integrates with src/lib/moderation.ts for all data operations.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  getAllReports,
  resolveReport,
  dismissReport,
  type ContentReport,
  type ReportStatus,
} from '@/lib/moderation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Flag,
  CheckCircle,
  Trash,
  Warning,
  ArrowLeft,
  ClockCounterClockwise,
  ShieldCheck,
  ShieldSlash,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModerationQueueProps {
  /** Called when the user presses the back / close button. */
  onBack?: () => void
  /**
   * ID of the acting moderator. Required so resolveReport can record who
   * took the action.
   */
  moderatorId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const REASON_LABELS: Record<string, string> = {
  spam:           'Spam',
  inappropriate:  'Inappropriate',
  harassment:     'Harassment',
  misinformation: 'Misinformation',
  other:          'Other',
}

const STATUS_BADGE: Record<ReportStatus, { label: string; className: string }> = {
  pending:   { label: 'Pending',   className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  reviewed:  { label: 'Reviewed',  className: 'bg-blue-500/20  text-blue-400  border-blue-500/30'  },
  dismissed: { label: 'Dismissed', className: 'bg-muted        text-muted-foreground border-border' },
  actioned:  { label: 'Actioned',  className: 'bg-green-500/20 text-green-400 border-green-500/30' },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ReportCardProps {
  report: ContentReport
  moderatorId: string
  onUpdate: () => void
}

function ReportCard({ report, moderatorId, onUpdate }: ReportCardProps) {
  const [acting, setActing] = useState(false)
  const badge = STATUS_BADGE[report.status]

  const handleDismiss = () => {
    setActing(true)
    dismissReport(report.id)
    toast.success('Report dismissed')
    onUpdate()
    setActing(false)
  }

  const handleAction = (
    action: 'warn' | 'remove_content' | 'temp_ban' | 'permanent_ban',
    label: string,
  ) => {
    setActing(true)
    const result = resolveReport(report.id, {
      action,
      moderatorId,
      reason: `Moderator action: ${label}`,
    })
    if (result) {
      toast.success(`Action taken: ${label}`)
    } else {
      toast.error('Could not resolve report — not found')
    }
    onUpdate()
    setActing(false)
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Flag size={14} weight="fill" className="text-destructive shrink-0" />
            <span className="text-xs text-muted-foreground font-mono truncate">
              {report.contentType}/{report.contentId}
            </span>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        {/* Reason + reporter */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {REASON_LABELS[report.reason] ?? report.reason}
            </span>
            <span className="text-xs text-muted-foreground">
              · by {report.reporterId}
            </span>
          </div>
          {report.description && (
            <p className="text-xs text-muted-foreground italic line-clamp-2">
              "{report.description}"
            </p>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <ClockCounterClockwise size={11} />
          {formatRelative(report.createdAt)}
        </p>

        {/* Actions (only for pending reports) */}
        {report.status === 'pending' && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2"
              disabled={acting}
              onClick={handleDismiss}
            >
              <CheckCircle size={12} className="mr-1" />
              Dismiss
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
              disabled={acting}
              onClick={() => handleAction('warn', 'Warn User')}
            >
              <Warning size={12} className="mr-1" />
              Warn User
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2 border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={acting}
              onClick={() => handleAction('remove_content', 'Remove Content')}
            >
              <Trash size={12} className="mr-1" />
              Remove Content
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ModerationQueue({ onBack, moderatorId }: ModerationQueueProps) {
  const [reports, setReports] = useState<ContentReport[]>([])
  const [activeTab, setActiveTab] = useState<ReportStatus | 'all'>('pending')

  const refresh = useCallback(() => {
    setReports(getAllReports())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const displayedReports =
    activeTab === 'all'
      ? reports
      : reports.filter((r) => r.status === activeTab)

  const pendingCount = reports.filter((r) => r.status === 'pending').length

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck size={20} className="text-accent" />
            Moderation Queue
          </h1>
          <p className="text-xs text-muted-foreground">
            {pendingCount} pending report{pendingCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border"
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportStatus | 'all')}>
          <TabsList className="w-full grid grid-cols-4 h-9">
            <TabsTrigger value="pending" className="text-xs">
              Pending
              {pendingCount > 0 && (
                <Badge className="ml-1.5 h-4 px-1.5 text-[10px] bg-destructive text-destructive-foreground">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="actioned" className="text-xs">Actioned</TabsTrigger>
            <TabsTrigger value="dismissed" className="text-xs">Dismissed</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          </TabsList>

          {(['pending', 'actioned', 'dismissed', 'all'] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
              {displayedReports.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
                  <ShieldSlash size={40} />
                  <p className="text-sm">No {tab === 'all' ? '' : tab} reports</p>
                </div>
              ) : (
                displayedReports.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    moderatorId={moderatorId}
                    onUpdate={refresh}
                  />
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
