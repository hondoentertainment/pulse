/**
 * PageSkeleton — minimal full-viewport fallback used by React.lazy() boundaries.
 *
 * We keep this component tiny (no external deps, no animation libs) so the
 * Suspense fallback itself never adds meaningful weight to the critical path.
 */
export function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-busy="true"
      className="mx-auto min-h-screen max-w-2xl space-y-3 bg-background px-5 pt-8"
    >
      <div className="h-5 w-24 animate-pulse rounded bg-muted" />
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-card" />
      <div className="h-12 w-full animate-pulse rounded-full bg-muted" />
      <p className="sr-only">Loading Pulse</p>
    </div>
  )
}

export default PageSkeleton
