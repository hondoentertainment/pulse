import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretLeft } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import {
  decideOpsClaim,
  isAdminSession,
  listOpsClaims,
  listOpsReports,
  updateOpsReport,
  type OpsClaimRow,
  type OpsReportRow,
} from '@/lib/ops-client'
import { Button } from '@/components/ui/button'

export function OpsQueuePage() {
  const navigate = useNavigate()
  const { session, isPlaceholder, isLoading } = useSupabaseAuth()
  const admin = isAdminSession(session)
  const [claims, setClaims] = useState<OpsClaimRow[]>([])
  const [reports, setReports] = useState<OpsReportRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setBusy(true)
    setError(null)
    try {
      const [nextClaims, nextReports] = await Promise.all([
        listOpsClaims('pending'),
        listOpsReports(),
      ])
      setClaims(nextClaims)
      setReports(nextReports.filter((row) => row.status === 'pending'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load ops queue')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!admin || isPlaceholder) return
    void reload()
  }, [admin, isPlaceholder])

  return (
    <div className="min-h-screen bg-[#0B0B0E] px-5 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-2 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground"
        >
          <CaretLeft size={18} />
          Home
        </button>
        <h1 className="text-[22px] font-bold text-white">Tonight’s ops queue</h1>
        <p className="text-sm text-muted-foreground">
          Verify venue claims and triage pulse reports. No admin UI credentials are invented here —
          you need <code>app_metadata.role = admin</code>. SQL fallback lives in
          {' '}docs/runbooks/venue-claims-ops.md.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Checking admin role…</p>
        ) : !admin || isPlaceholder ? (
          <div className="rounded-[18px] bg-[#17171C] p-3.5 space-y-2">
            <h2 className="text-base font-semibold">Admin role required</h2>
            <p className="text-sm text-muted-foreground">
              Signed-in users without the admin role stay on this runbook path. Paste the verify SQL
              from the claims ops runbook in the Supabase SQL editor for project
              {' '}xeldqwhztcnnvazmshzh.
            </p>
          </div>
        ) : (
          <>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Pending claims</h2>
                <Button type="button" variant="ghost" size="sm" onClick={() => void reload()} disabled={busy}>
                  Refresh
                </Button>
              </div>
              {claims.length === 0 ? (
                <p className="rounded-[18px] bg-[#17171C] p-3.5 text-sm text-muted-foreground">
                  No pending claims.
                </p>
              ) : claims.map((claim) => (
                <article key={claim.id} className="rounded-[18px] bg-[#17171C] p-3.5 space-y-2">
                  <p className="text-sm font-semibold text-white">Venue {claim.venue_id}</p>
                  <p className="text-xs text-muted-foreground">{claim.evidence}</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        void decideOpsClaim({ claimId: claim.id, status: 'verified' })
                          .then(() => {
                            toast.success('Claim verified')
                            return reload()
                          })
                          .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed'))
                      }}
                    >
                      Verify
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        void decideOpsClaim({ claimId: claim.id, status: 'rejected', notes: 'Rejected from /ops' })
                          .then(() => {
                            toast.message('Claim rejected')
                            return reload()
                          })
                          .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed'))
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </article>
              ))}
            </section>
            <section className="space-y-2">
              <h2 className="text-base font-semibold">Pending reports</h2>
              {reports.length === 0 ? (
                <p className="rounded-[18px] bg-[#17171C] p-3.5 text-sm text-muted-foreground">
                  No pending reports.
                </p>
              ) : reports.map((report) => (
                <article key={report.id} className="rounded-[18px] bg-[#17171C] p-3.5 space-y-2">
                  <p className="text-sm font-semibold text-white">{report.reason}</p>
                  <p className="text-xs text-muted-foreground">Pulse {report.pulse_id}</p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void updateOpsReport({ reportId: report.id, status: 'dismissed' })
                        .then(() => {
                          toast.success('Report dismissed')
                          return reload()
                        })
                        .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed'))
                    }}
                  >
                    Dismiss
                  </Button>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
