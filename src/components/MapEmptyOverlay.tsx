interface MapEmptyOverlayProps {
  catalogCount: number
  filteredCount: number
  inViewCount: number
  onShowCatalog: () => void
  onClearFilters?: () => void
}

/**
 * Designed empty map — never a dead “No Venues in View” when the Seattle
 * catalog exists. Location-denied guests still get Show Seattle.
 */
export function MapEmptyOverlay({
  catalogCount,
  filteredCount,
  inViewCount,
  onShowCatalog,
  onClearFilters,
}: MapEmptyOverlayProps) {
  if (catalogCount === 0 || inViewCount > 0) return null

  const filteredAway = filteredCount === 0

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center px-4 pointer-events-none">
      <div
        role="status"
        className="pointer-events-auto w-full max-w-xs rounded-2xl border border-border bg-card/95 p-4 text-center shadow-2xl"
      >
        <h3 className="text-[15px] font-bold text-foreground">
          {filteredAway ? 'Filters hid Seattle pins' : 'Seattle pins are just off-screen'}
        </h3>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          Map → venue → pulse. Location off uses Launch 33 / Downtown Seattle — we never invent live reviews.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={onShowCatalog}
            className="h-11 w-full rounded-full bg-foreground text-[15px] font-bold text-background touch-manipulation"
          >
            Show Seattle
          </button>
          {filteredAway && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="h-11 w-full rounded-full bg-muted text-[15px] font-semibold text-foreground touch-manipulation"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
