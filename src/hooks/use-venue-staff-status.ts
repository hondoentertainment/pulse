/**
 * useVenueStaffStatus — reads the current user's `venue_staff` rows via
 * React Query (the app mounts a QueryClientProvider at root).
 */

import { useQuery } from '@tanstack/react-query'
import {
  listMyVenueStaffRoles,
  type VenueStaffMembership,
  type VenueStaffRole,
} from '@/lib/data/venue-staff'

export interface VenueStaffStatus {
  isStaff: boolean
  venues: Array<{ venueId: string; role: VenueStaffRole }>
  loading: boolean
}

export function useVenueStaffStatus(userId: string | null | undefined): VenueStaffStatus {
  const query = useQuery<VenueStaffMembership[]>({
    queryKey: ['venue-staff', userId ?? null],
    queryFn: async () => (userId ? listMyVenueStaffRoles(userId) : []),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const rows = query.data ?? []
  return {
    isStaff: rows.length > 0,
    venues: rows.map(r => ({ venueId: r.venueId, role: r.role })),
    loading: query.isLoading,
  }
}
