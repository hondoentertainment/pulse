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
  if (catalogCount === 0 || inViewCount < 0 || inViewCount > 0) return null

  const filteredAway = filteredCount === 0

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
      <div
        role="status"
        className="pointer-events-auto w-full rounded-[14px] border border-white/10 bg-[#12141a] p-3 text-left"
      >
        <h3 className="text-[14px] font-semibold leading-[18px] text-foreground">
          {filteredAway ? 'Filters hid Seattle pins' : 'Seattle pins are just off-screen'}
        </h3>
        <p className="mt-2 text-[12px] leading-4 text-muted-foreground">
          Map → venue → pulse. Location off uses Launch 33 / Downtown Seattle — we never invent live reviews.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={onShowCatalog}
            className="h-11 w-full rounded-[14px] bg-white text-[14px] font-semibold text-[#06171f] touch-manipulation"
          >
            Show Seattle
          </button>
          {filteredAway && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="h-11 w-full rounded-[14px] bg-muted text-[14px] font-semibold text-foreground touch-manipulation"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
