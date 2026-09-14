import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppState } from '@/hooks/use-app-state'
import { useAppHandlers } from '@/hooks/use-app-handlers'
import { useSupabaseAuth } from '@/hooks/use-supabase-auth'
import { VenueTypeahead } from '@/components/VenueTypeahead'
import { EmptySurgingStartHere } from '@/components/EmptySurgingStartHere'
import { UX_CARD, UX_HAIRLINE } from '@/lib/ux-chrome'
import {
  findNeighborhoodPage,
  listNeighborhoodVenues,
} from '@/lib/neighborhood-pages'
import { emptySurgingPulseHref } from '@/lib/empty-surging'
import { buildAuthPath } from '@/lib/auth-return-intent'
import { CaretLeft } from '@phosphor-icons/react'

export function NeighborhoodPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { venues } = useAppState()
  const { handleCreatePulse } = useAppHandlers()
  const { session, isPlaceholder } = useSupabaseAuth()

  const catalog = useMemo(() => venues ?? [], [venues])
  const page = useMemo(() => findNeighborhoodPage(catalog, slug), [catalog, slug])
  const hoodVenues = useMemo(() => listNeighborhoodVenues(catalog, slug), [catalog, slug])

  if (!page) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button type="button" onClick={() => navigate('/')} className="mb-4 text-sm text-muted-foreground">
          ← Tonight
        </button>
        <h1 className="text-[22px] font-bold">Neighborhood not tagged</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We only list hoods already on the Seattle catalog. No GPS required.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-3 flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground"
      >
        <CaretLeft size={16} />
        Tonight
      </button>
      <p className="text-[13px] text-muted-foreground">Tonight · Seattle</p>
      <h1 className="text-[28px] font-bold tracking-tight text-foreground">{page.name}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Guest-safe list from tagged rooms. Search works without GPS.
      </p>
      <div className="mt-4">
        <VenueTypeahead
          venues={hoodVenues}
          onVenueSelect={(venue) => navigate(`/venue/${venue.id}`)}
        />
      </div>
      {hoodVenues.length > 0 && (
        <div className={`mt-4 ${UX_CARD} p-3.5`}>
          <EmptySurgingStartHere
            venues={hoodVenues}
            onVenueClick={(venue) => navigate(`/venue/${venue.id}`)}
            onBeFirstPulse={(venue) => {
              const href = emptySurgingPulseHref({
                isPlaceholder,
                hasSession: Boolean(session),
                venueId: venue.id,
              })
              if (href.kind === 'auth') {
                navigate(buildAuthPath(href.next))
                return
              }
              handleCreatePulse(venue.id)
            }}
          />
        </div>
      )}
      <ul className={`mt-4 divide-y ${UX_HAIRLINE}`}>
        {hoodVenues.map((venue) => (
          <li key={venue.id}>
            <button
              type="button"
              onClick={() => navigate(`/venue/${venue.id}`)}
              className="flex min-h-12 w-full items-center justify-between py-3 text-left"
            >
              <span className="truncate text-[15px] font-semibold text-foreground">{venue.name}</span>
              <span className="text-[13px] text-muted-foreground">{venue.neighborhood}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
