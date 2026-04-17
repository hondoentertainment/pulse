import type { ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

import { queryClient, queryPersister, CACHE_MAX_AGE } from '@/lib/query-client'
import { ErrorFallback } from '@/ErrorFallback'
import { SupabaseAuthProvider } from '@/hooks/use-supabase-auth'
import { AppStateProvider } from '@/hooks/use-app-state'

/**
 * AppProviders — wraps the tree with all cross-cutting providers.
 *
 * Composition order (outside → inside):
 *   ErrorBoundary          (captures render errors everywhere below)
 *   PersistQueryClientProvider (TanStack Query + IndexedDB persistence)
 *   BrowserRouter          (react-router)
 *   SupabaseAuthProvider   (session/profile)
 *   AppStateProvider       (derived app state)
 *   + Analytics / SpeedInsights (side-effect components)
 *
 * This file contains no lifecycle or data-loading logic — that lives in
 * `AppBootstrap.tsx`.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: CACHE_MAX_AGE }}
      >
        <BrowserRouter>
          <SupabaseAuthProvider>
            <AppStateProvider>
              {children}
              <Analytics />
              <SpeedInsights />
            </AppStateProvider>
          </SupabaseAuthProvider>
        </BrowserRouter>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  )
}
