import { useMemo, useState } from 'react'
import { CaretLeft, ShieldCheck } from '@phosphor-icons/react'
import { REPORT_REASONS } from '@/lib/content-moderation'
import type { ContentReport } from '@/lib/content-moderation'

interface ModerationQueuePageProps {
  reports: ContentReport[]
  onBack: () => void
  onUpdateReports: (reports: ContentReport[]) => void
}

export function ModerationQueuePage({ reports, onBack, onUpdateReports }: ModerationQueuePageProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | ContentReport['status']>('all')
  const [reasonFilter, setReasonFilter] = useState<'all' | ContentReport['reason']>('all')
  const [query, setQuery] = useState('')
  const [triageMode, setTriageMode] = useState(true)

  const sorted = useMemo(
    () => {
      if (!triageMode) {
        return [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      }
      return [...reports].sort((left, right) => {
        const leftPending = left.status === 'pending'
        const rightPending = right.status === 'pending'
        if (leftPending && !rightPending) return -1
        if (!leftPending && rightPending) return 1
        if (leftPending && rightPending) {
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        }
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })
    },
    [reports, triageMode]
  )
  const filtered = useMemo(
    () => sorted.filter((report) => {
      if (statusFilter !== 'all' && report.status !== statusFilter) return false
      if (reasonFilter !== 'all' && report.reason !== reasonFilter) return false
      if (query.trim().length === 0) return true
      const q = query.toLowerCase()
      return (
        report.targetId.toLowerCase().includes(q) ||
        report.reporterId.toLowerCase().includes(q) ||
        (report.description || '').toLowerCase().includes(q)
      )
    }),
    [query, reasonFilter, sorted, statusFilter]
  )

  const updateStatus = (reportId: string, status: ContentReport['status']) => {
    onUpdateReports(
      sorted.map((report) => (
        report.id === reportId
          ? { ...report, status, reviewedAt: new Date().toISOString() }
          : report
      ))
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-muted rounded-lg">
            <CaretLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} weight="fill" className="text-primary" />
            <h1 className="text-xl font-bold">Moderation Queue</h1>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Queue controls</p>
            <button
              onClick={() => setTriageMode((value) => !value)}
              className={`text-[10px] px-2 py-1 rounded border ${triageMode ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground'}`}
            >
              {triageMode ? 'Triage Mode On' : 'Triage Mode Off'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="bg-background border border-border rounded px-2 py-1.5 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <select
              value={reasonFilter}
              onChange={(event) => setReasonFilter(event.target.value as typeof reasonFilter)}
              className="bg-background border border-border rounded px-2 py-1.5 text-xs"
            >
              <option value="all">All reasons</option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>{reason.label}</option>
              ))}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search target/reporter"
              className="bg-background border border-border rounded px-2 py-1.5 text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {sorted.length} reports
          </p>
        </div>

        {sorted.length === 0 && (
          <div className="text-center py-14 text-muted-foreground">
            No reports yet.
          </div>
        )}
        {filtered.map((report) => (
          <div key={report.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{report.targetType.toUpperCase()} · {report.reason}</p>
                <p className="text-xs text-muted-foreground">Target: {report.targetId}</p>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-1 rounded bg-muted text-muted-foreground">
                {report.status}
              </span>
            </div>
            {report.description && (
              <p className="text-sm text-muted-foreground">{report.description}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateStatus(report.id, 'reviewed')}
                className="px-2.5 py-1.5 text-xs rounded border border-border hover:border-primary/40"
              >
                Mark Reviewed
              </button>
              <button
                onClick={() => updateStatus(report.id, 'actioned')}
                className="px-2.5 py-1.5 text-xs rounded border border-border hover:border-primary/40"
              >
                Action Taken
              </button>
              <button
                onClick={() => updateStatus(report.id, 'dismissed')}
                className="px-2.5 py-1.5 text-xs rounded border border-border hover:border-primary/40"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
