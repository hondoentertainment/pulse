import { Toaster } from 'sonner'

import { AppBootstrap } from '@/AppBootstrap'
import { AppProviders } from '@/AppProviders'
import { AppRoutes } from '@/AppRoutes'

/**
 * Venue discovery shell — the only Pulse product surface.
 */
export default function VenueApp() {
  return (
    <AppProviders>
      <Toaster position="top-center" theme="dark" richColors />
      <AppBootstrap>
        <AppRoutes />
      </AppBootstrap>
    </AppProviders>
  )
}
