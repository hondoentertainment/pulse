import { Toaster } from 'sonner'

import { AppBootstrap } from '@/AppBootstrap'
import { AppProviders } from '@/AppProviders'
import { AppRoutes } from '@/AppRoutes'

/**
 * Venue discovery shell — only mounted when `VITE_APP_MODE=venue`.
 *
 * Kept in its own module so the default Signal entry can `React.lazy` it
 * and keep AppRoutes / venue providers off the Signal first-paint graph.
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
