import { QueryClient } from '@tanstack/react-query'
import localforage from 'localforage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

// 24 hours in milliseconds — shared between gcTime and persister maxAge
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24

// Configure robust offline-first garbage collection
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: CACHE_MAX_AGE, // Keep in-memory cache for 24 hours (must be >= persister maxAge)
      staleTime: 1000 * 60 * 5, // 5 minutes before data is considered stale
      refetchOnWindowFocus: true, // Pull fresh data when re-opening app
      refetchOnReconnect: true, // Pull fresh data when moving from offline -> online
      retry: 3, // Retry failed queries
    },
  },
})

// Bind the QueryClient cache exclusively to IndexedDB via LocalForage
export const queryPersister = createAsyncStoragePersister({
  storage: localforage,
  key: 'PULSE_OFFLINE_CACHE_V1',
})
