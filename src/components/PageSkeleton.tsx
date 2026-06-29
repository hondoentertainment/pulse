/**
 * PageSkeleton — branded full-viewport fallback used by React.lazy() boundaries.
 *
 * We keep this component dependency-free (no animation libs) so the Suspense
 * fallback itself never adds meaningful weight to the critical path. The shimmer
 * is pure CSS (`animate-pulse`) so it ships in the base bundle.
 */

interface PageSkeletonProps {
  /** Optional label announced to assistive tech. */
  label?: string
  /** Render a list of card placeholders (feeds) vs. a single hero (detail). */
  variant?: 'feed' | 'detail'
}

export function PageSkeleton({ label = 'Loading', variant = 'feed' }: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className="min-h-screen bg-background"
    >
      <span className="sr-only">{label}…</span>

      {/* Header shimmer */}
      <div className="border-b border-border/60 bg-background/80 px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="h-7 w-40 rounded-lg bg-muted animate-pulse" />
          <div className="h-3.5 w-64 rounded bg-muted/70 animate-pulse" />
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6" aria-hidden>
        {variant === 'detail' ? (
          <>
            <div className="h-48 w-full rounded-2xl bg-muted animate-pulse" />
            <div className="h-5 w-1/2 rounded bg-muted/80 animate-pulse" />
            <div className="h-3.5 w-3/4 rounded bg-muted/60 animate-pulse" />
            <div className="h-3.5 w-2/3 rounded bg-muted/60 animate-pulse" />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/60 bg-card/60 p-4"
              style={{ opacity: 1 - i * 0.12 }}
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/4 rounded bg-muted/60 animate-pulse" />
                </div>
                <div className="h-6 w-12 rounded-full bg-muted/70 animate-pulse" />
              </div>
              <div className="mt-4 h-28 w-full rounded-xl bg-muted/50 animate-pulse" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default PageSkeleton
