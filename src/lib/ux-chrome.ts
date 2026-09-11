/**
 * Uber × X chrome tokens as Tailwind class groups.
 * Prefer these over one-off hex in Pulse surfaces.
 */
export const UX_PAGE = 'bg-background text-foreground'
export const UX_SURFACE = 'bg-card'
export const UX_RAISED = 'bg-muted'
export const UX_HAIRLINE = 'border-border'
export const UX_META = 'text-[13px] text-muted-foreground'
export const UX_NAME = 'font-bold tracking-tight text-foreground'
export const UX_BODY = 'text-[15px] leading-5 text-foreground'
export const UX_PILL_IDLE =
  'border border-border bg-muted text-muted-foreground'
export const UX_PILL_ACTIVE = 'border border-transparent bg-primary text-primary-foreground'
export const UX_CTA =
  'h-12 w-full rounded-full bg-primary text-[15px] font-bold text-primary-foreground hover:bg-primary/90'
export const UX_FAB =
  'fixed right-5 bottom-24 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(255,45,120,0.35)]'
export const UX_TIMELINE_ROW =
  'flex w-full gap-3 border-b border-border px-0 py-3 text-left'

export type MapHomeSurface = 'tonight' | 'live' | 'map'
