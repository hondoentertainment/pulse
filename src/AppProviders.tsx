import type { ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { BrowserRouter } from 'react-router-dom'

import { queryClient, CACHE_MAX_AGE } from '@/lib/query-client'
import { queryPersister } from '@/lib/query-persister'
import { ErrorFallback } from '@/ErrorFallback'
import { SupabaseAuthProvider } from '@/hooks/use-supabase-auth'
import { AppStateProvider } from '@/hooks/use-app-state'

/**
 * AppProviders — wraps the tree with all cross-cutting providers.
 *
 * Analytics / Speed Insights live in `main.tsx` (lazy, skipped on localhost)
 * so this file stays off the first-paint vendor graph.
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
            </AppStateProvider>
          </SupabaseAuthProvider>
        </BrowserRouter>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  )
}
