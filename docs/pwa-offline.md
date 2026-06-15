# PWA & Offline

How Pulse works as a Progressive Web App — installability, service worker, and offline write queue.

---

## PWA features

| Feature | Implementation |
|---------|----------------|
| Installable | `public/manifest.json` + `beforeinstallprompt` handler |
| App shell caching | Service worker (`public/sw.js`) |
| Offline writes | `src/lib/offline-queue.ts` |
| Push notifications | `src/lib/pwa.ts` + `use-push-registration` |
| Native wrapper | Capacitor (iOS/Android) — see [Native Setup](native/setup.md) |

Vite PWA plugin configured in `vite.config.ts` (`vite-plugin-pwa`).

---

## Service worker

Registered from `src/lib/pwa.ts`:

```typescript
await navigator.serviceWorker.register('/sw.js', { scope: '/' })
```

The service worker precaches:
- App shell (HTML, JS, CSS chunks)
- Static assets from `public/`
- PWA manifest and icons

**Update strategy:** New deployments activate on next visit (standard cache-bust via hashed filenames).

---

## Install prompt

`listenForInstallPrompt()` captures the `beforeinstallprompt` event for custom install UI.

| Platform | Behavior |
|----------|----------|
| Android Chrome | Native install banner or custom prompt |
| Desktop Chrome | Install icon in address bar |
| iOS Safari | Manual "Add to Home Screen" (no `beforeinstallprompt`) |

`getInstallPromptState()` returns `canInstall`, `isInstalled`, `platform`.

---

## Offline queue

`src/lib/offline-queue.ts` queues pulse submissions when offline.

### Queued actions

- Pulse creation (energy, caption, photos, hashtags)
- Retries with exponential backoff
- Max retry count per item

### Storage

Currently `localStorage` (`pulse_offline_queue` key). Production target: IndexedDB for larger media payloads.

### Sync flow

```
User creates pulse offline
        │
        ▼
enqueuePulse() → localStorage
        │
        ▼
useOfflineMode detects reconnect
        │
        ▼
processQueue() → POST /api/pulses/create (or legacy endpoint)
        │
        ▼
onBatchComplete → toast + state refresh
```

Video pulses use a separate queue: `src/lib/video-offline-queue.ts`.

### UI indicators

- `OfflineBanner.tsx` — network status
- `queuedPulseCount` in app state — badge on create button
- Toast on sync success/failure

---

## Offline detection

`use-offline-mode.ts`:
- Listens to `online` / `offline` events
- Triggers queue processing on reconnect
- Exposes `isOffline` to components

---

## Push notifications

### Web (limited)

Service worker push requires VAPID keys and user permission. Native push is the primary path.

### Native (Capacitor)

`use-push-registration.ts`:
1. Request permission via `@capacitor/push-notifications`
2. Register token with `POST /api/push/register`
3. Store in `push_tokens` table

Unregister on sign-out: `POST /api/push/unregister`.

---

## Manifest

`public/manifest.json`:

- App name, short name, theme color
- Icons (192, 512, maskable)
- `display: standalone`
- `start_url: /`
- Dark theme background

---

## Permissions

Configured in `vercel.json` Permissions-Policy:

```
geolocation=(self)
camera=()
microphone=()
```

Geolocation is required for check-in verification. Camera/mic used only in native Capacitor context for media capture.

---

## Testing offline behavior

1. Open DevTools → Network → Offline
2. Create a pulse — should queue locally
3. Re-enable network — queue should sync
4. Verify `pulse_offline_queue` in Application → Local Storage

E2E does not currently test offline queue — manual verification required.

---

## Production considerations

| Gap | Target |
|-----|--------|
| localStorage queue | IndexedDB with size limits |
| Client-only sync | Background Sync API where supported |
| No conflict resolution | Server wins on duplicate IDs |
| SW update UX | Prompt user to refresh on new version |

---

## Related docs

- [ARCHITECTURE.md](../ARCHITECTURE.md) — PWA architecture section
- [Data Layer](data-layer.md) — persistence split
- [Native Setup](native/setup.md) — Capacitor install path
- [API Reference](api-reference.md) — pulse create endpoint
