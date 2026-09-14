import { venueCoverUrl } from '@/lib/venue-cover'

export function VenueCoverPhoto({ venue }: { venue: unknown }) {
  const src = venueCoverUrl(venue)
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      className="mb-3 h-40 w-full rounded-xl object-cover"
    />
  )
}
