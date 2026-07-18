# PWA & Offline

How Pulse works as a Progressive Web App — installability, service worker, and offline write queue.

---

## PWA features

| Feature | Implementation |
|---------|----------------|
| Installable | `public/manifest.json` + `beforeinstallprompt` handler |
| App shell caching | VitePWA Workbox (`vite.config.ts`) |
| Icons / screenshots | `public/icons/*`, `public/screenshots/tonight.png` |
| Offline writes | `src/lib/offline-queue.ts` |
| Push notifications | `src/lib/pwa.ts` + `use-push-registration` |
| Native wrapper | Capacitor (iOS/Android) — see [Native Setup](native/setup.md) |

---

## Service worker

**Single owner:** `vite-plugin-pwa` with `injectRegister: 'auto'` and `registerType: 'autoUpdate'`.

`src/lib/pwa.ts` → `registerServiceWorker()` only resolves the existing registration (`navigator.serviceWorker.ready`). It does **not** register a second `/sw.js` — dual service workers previously fought for control.

Workbox precaches hashed JS/CSS/HTML plus static assets matching `globPatterns` in `vite.config.ts`.

**Update strategy:** New deployments activate on next visit (autoUpdate + hashed filenames).

---

## Install prompt

`listenForInstallPrompt()` captures the `beforeinstallprompt` event for custom install UI.

| Platform | Behavior |
|----------|----------|
| Android Chrome | Native install banner or custom prompt |
| Desktop Chrome | Install icon in address bar |
| iOS Safari | Manual "Add to Home Screen" (no `beforeinstallprompt`) |

`getInstallState()` returns `canInstall`, `isInstalled`, `platform`.

---

## Offline queue

`src/lib/offline-queue.ts` queues pulse submissions when offline.

### Queued actions

- Pulse creation (energy, caption, photos, hashtags)
- Retries with exponential backoff
- Max retry count per item
- Background Sync when the browser supports `SyncManager`

See the rest of this file in git history for deeper offline-queue details if needed; the registration contract above is the launch source of truth.
