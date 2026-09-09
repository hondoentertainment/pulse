import { Toaster } from 'sonner'

import { AppBootstrap } from '@/AppBootstrap'
import { AppProviders } from '@/AppProviders'
import { AppRoutes } from '@/AppRoutes'

/**
 * Venue discovery shell — production default (`VITE_APP_MODE` unset or `venue`).
 *
 * Kept in its own module so Signal (`VITE_APP_MODE=signal`) can stay off
 * the venue first-paint graph.
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
