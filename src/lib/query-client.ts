import { QueryClient } from '@tanstack/react-query'
import localforage from 'localforage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

// Configure robust offline-first garbage collection
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7, // Persist cache for 7 days
      staleTime: 1000 * 10, // Data becomes stale quickly (10s) to encourage background syncs
      refetchOnWindowFocus: true, // Always pull fresh when re-opening app
      refetchOnReconnect: true, // Always pull when moving from offline -> online
      retry: 3, // Retry failed queries politely
    },
  },
})

// Bind the QueryClient cache exclusively to IndexedDB via LocalForage
export const queryPersister = createAsyncStoragePersister({
  storage: localforage,
  key: 'PULSE_OFFLINE_CACHE_V1',
})
