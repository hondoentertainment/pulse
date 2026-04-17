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
      className="min-h-screen bg-background flex items-center justify-center"
    >
      <p className="text-muted-foreground">Loading…</p>
    </div>
  )
}

export default PageSkeleton
