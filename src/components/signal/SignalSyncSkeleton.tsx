export function SignalSyncSkeleton() {
  return (
    <div className="mb-4 space-y-3" role="status" aria-live="polite" aria-busy="true" aria-label="Syncing history">
      <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 animate-pulse rounded-[1.75rem] bg-muted/80" />
        <div className="h-24 animate-pulse rounded-[1.75rem] bg-muted/80" />
      </div>
      <div className="h-40 animate-pulse rounded-[2rem] bg-muted/60" />
    </div>
  )
}
