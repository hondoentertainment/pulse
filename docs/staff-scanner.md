# Staff Scanner

`src/components/ticketing/StaffScannerPage.tsx` is the operator-facing
page that validates tickets at the door. It is gated by the `ticketing`
feature flag AND `useVenueStaffStatus().isStaff === true`; if either
check fails, the component renders nothing.

## Hardware

- **Rear camera preferred.** We request `facingMode: { ideal: 'environment' }`
  so phones default to the better-focused rear lens. Laptops fall back
  to whatever `getUserMedia` returns.
- **Recommended:** iPhone 12+ (supports `BarcodeDetector` via Safari) or
  any modern Android with Chrome 83+.
- **Bandwidth:** verification is a single `POST` per scan with a small
  body (<1 KB) and response. Works fine on venue Wi-Fi or LTE.

## Offline behavior

The current build requires connectivity for every scan. When offline:

1. Scans return a network error.
2. The UI surfaces an inline error and the door staff fall back to a
   manual lookup.

**Planned:** queue pending scan attempts in `localforage` (already a
dependency) and replay them when connectivity returns. The server
endpoint already supports idempotent replays within 5 minutes, so we
just need:

- Local queue with `{ qr, attemptedAt }`.
- Replay worker on `online` event.
- UI badge for "n scans queued".

This is listed as a follow-up.

## Fallback for missing BarcodeDetector

Some browsers (Firefox, older Safari, desktop Chromium w/o the flag)
don't expose `window.BarcodeDetector`. The scanner page:

- Checks `typeof window.BarcodeDetector === 'function'` at render.
- If missing, hides the `<video>` element and shows only the manual
  entry field.
- Manual entry accepts the full `PULSE-TKT:…:hmac` string; the server
  is the source of truth on validity.

For a higher-quality fallback we can ship `@zxing/browser` (not yet
approved as a dependency — no-new-deps constraint).

## Error surfaces

| UI                 | Server status / code            | What staff should do     |
| ------------------ | ------------------------------- | ------------------------ |
| "Signature mismatch" | 403 `invalid_signature`       | Refuse entry             |
| "Cannot scan: cancelled" | 409 `cancelled`           | Refuse entry             |
| "Cannot scan: refunded"  | 409 `refunded`            | Refuse entry             |
| "Already scanned"  | 200 `already_scanned`          | Refuse (likely duplicate) |
| "Forbidden"        | 403 `not_staff`                | Admin must assign role   |
| "Too many requests"| 429 (rate-limited)             | Wait, then retry          |

## Testing

- Unit: `api/_lib/__tests__/ticket-verify.test.ts` — HMAC happy/sad
  path, role check, already-scanned idempotency window.
- Client contract: `src/lib/__tests__/staff-scanner-client.test.ts`.

## Follow-ups

- Apple Wallet / Google Wallet pass generation.
- Offline scan queue with replay.
- `charge.dispute.created` webhook to auto-flag the ticket as disputed.
