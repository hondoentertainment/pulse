import { AppProviders } from '@/AppProviders'
import { AppBootstrap } from '@/AppBootstrap'
import { AppRoutes } from '@/AppRoutes'

/**
 * App — thin composition root.
 *
 *   <AppProviders>    → context providers (query client, router, auth, state)
 *   <AppBootstrap>    → one-shot lifecycle (Sentry, error listeners)
 *   <AppRoutes/>      → tab/sub-page switcher
 *
 * This file deliberately contains **zero** logic so that the boundaries above
 * can evolve independently without re-triggering whole-tree rebuilds.
 */
function App() {
  return (
    <AppProviders>
      <AppBootstrap>
        <AppRoutes />
      </AppBootstrap>
    </AppProviders>
  )
}

export default App
