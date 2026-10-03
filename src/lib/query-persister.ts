import localforage from 'localforage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'

/** IndexedDB persister for the venue shell. Signal first paint must not import this. */
export const queryPersister = createAsyncStoragePersister({
  storage: localforage,
  key: 'PULSE_OFFLINE_CACHE_V1',
})
