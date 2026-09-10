export function MapHomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading map"
      aria-busy="true"
      className="mx-auto max-w-2xl space-y-3.5 px-5 pb-24 pt-8"
    >
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[#1F1F24]" />
      <div className="h-4 w-64 animate-pulse rounded bg-[#1F1F24]" />
      <div className="h-10 w-full animate-pulse rounded-2xl bg-[#1F1F24]" />
      <div className="flex gap-2">
        <div className="h-9 w-24 animate-pulse rounded-full bg-[#1F1F24]" />
        <div className="h-9 w-24 animate-pulse rounded-full bg-[#1F1F24]" />
        <div className="h-9 w-20 animate-pulse rounded-full bg-[#1F1F24]" />
      </div>
      <div className="h-[240px] w-full animate-pulse rounded-[16px] bg-[#1A1A1F]" />
      <p className="text-[13px] text-muted-foreground">Skeleton matches map layout</p>
      <div className="h-16 w-full animate-pulse rounded-[18px] bg-[#1F1F24]" />
      <div className="h-16 w-full animate-pulse rounded-[18px] bg-[#1F1F24]" />
    </div>
  )
}
