import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
import { aliasCoastCityKey, coastCityKeyForNeighborhoodSlug } from '@/lib/coast-cities'
import { loadCityCuratedCatalog } from '@/lib/city-catalog'
import { emptySurgingPulseHref } from '@/lib/empty-surging'
import { buildAuthPath } from '@/lib/auth-return-intent'
import {
  getNeighborhoodPrettyShareUrl,
  getNeighborhoodSharePreviewUrl,
  NEIGHBORHOOD_SHARE_COPY,
} from '@/lib/neighborhood-share'
import { toast } from 'sonner'
import { CaretLeft } from '@phosphor-icons/react'
import { InstallAffordance } from '@/components/InstallAffordance'

export function NeighborhoodPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { venues, selectedMarketKey } = useAppState()
  const { handleCreatePulse } = useAppHandlers()
  const { session, isPlaceholder } = useSupabaseAuth()

  const page = useMemo(() => findNeighborhoodPage([], slug), [slug])
  const ownerKey = coastCityKeyForNeighborhoodSlug(slug)
  const activeKey = aliasCoastCityKey(selectedMarketKey) ?? 'seattle'
  const otherCity = Boolean(page && ownerKey && ownerKey !== activeKey)
  const { data: otherCityVenues } = useQuery({
    queryKey: ['city-curated', ownerKey],
    queryFn: () => loadCityCuratedCatalog(ownerKey!),
    enabled: otherCity,
  })
  const catalog = useMemo(
    () => (otherCity ? (otherCityVenues ?? []) : (venues ?? [])),
    [otherCity, otherCityVenues, venues],
  )
  const hoodVenues = useMemo(() => listNeighborhoodVenues(catalog, slug), [catalog, slug])

  if (!page) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button type="button" onClick={() => navigate('/')} className="mb-4 text-sm text-muted-foreground">
          ← Tonight
        </button>
        <h1 className="text-[22px] font-bold">Neighborhood not tagged</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We only list hoods already tagged on a coast city. No GPS required.
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
      <p className="text-[13px] text-muted-foreground">Tonight · {page.city}</p>
      <h1 className="text-[28px] font-bold tracking-tight text-foreground">{page.name}</h1>
      {page.slug === 'capitol-hill' && (
        <div className="mt-3">
          <InstallAffordance surface="capitol-hill" />
        </div>
      )}
      <p className="mt-1 text-[13px] text-muted-foreground">
        Guest-safe list from tagged rooms. Search works without GPS.
      </p>
      <button
        type="button"
        className="mt-3 h-9 rounded-full border border-border px-3 text-[13px] font-semibold text-foreground"
        onClick={() => {
          const pretty = getNeighborhoodPrettyShareUrl(page.slug)
          void getNeighborhoodSharePreviewUrl(page.slug)
          void navigator.clipboard?.writeText(pretty).then(() => {
            toast.success('Neighborhood link copied')
          }).catch(() => undefined)
        }}
      >
        {NEIGHBORHOOD_SHARE_COPY.cta}
      </button>
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
