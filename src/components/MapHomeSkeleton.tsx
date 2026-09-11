export function MapHomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading map"
      aria-busy="true"
      className="mx-auto max-w-2xl space-y-3 px-4 pt-6 pb-24"
    >
      <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      <div className="flex gap-0 border-b border-border">
        <div className="h-11 flex-1 animate-pulse bg-muted/40" />
        <div className="h-11 flex-1 animate-pulse bg-muted/20" />
        <div className="h-11 flex-1 animate-pulse bg-muted/20" />
      </div>
      <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
      <div className="flex gap-2">
        <div className="h-11 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-11 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-11 w-20 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-[240px] w-full animate-pulse rounded-2xl bg-card" />
      <p className="text-[13px] text-muted-foreground">Skeleton matches map layout</p>
      <div className="h-16 w-full animate-pulse border-b border-border bg-muted/40" />
      <div className="h-16 w-full animate-pulse border-b border-border bg-muted/40" />
    </div>
  )
}
