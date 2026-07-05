# Wave 2a — Dead-Code Audit Notes

Date: 2026-04-17
Scope: verification of dead-module candidates flagged by prior audit.

## Deleted

| File | Verification |
| --- | --- |
| `src/lib/white-label.ts` | Only referenced by its own test file. Zero component/hook imports. Deleted along with `src/lib/__tests__/white-label.test.ts`. |

## Kept — has references

### `src/lib/twitter-ingestion.ts`
- Imported by `src/hooks/use-social-pulse.ts` (re-exports `TwitterIngestionService`, `processIngestedPosts`, `deduplicatePosts`).
- Hook consumed by `src/components/SocialPulseDashboard.tsx` and `src/components/__tests__/business.test.tsx`.
- **Action:** Leave in place.

### `src/lib/public-api.ts` — REMOVED (2026-07-05)
- Server routes `api/keys/generate.ts` and `api/webhooks/sign.ts` now fully
  own key minting and webhook HMAC signing, so the client prototype was dead
  code (only its own test imported it) **and** a liability (`Math.random()`
  keys, `node:crypto` in a client module).
- Deleted the module and `src/lib/__tests__/public-api.test.ts`; updated the
  `api-client.ts` header comment and `SECURITY.md` §2.

## Follow-ups
- ~~Once `public-api.ts` is migrated to `api/` server routes per SECURITY.md, re-audit and remove client-side copy.~~ Done 2026-07-05.
- `SOCIAL_PULSE_IMPLEMENTATION.md` still mentions twitter-ingestion as a deliverable; no doc updates needed.
