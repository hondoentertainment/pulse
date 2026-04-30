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

### `src/lib/public-api.ts`
- No component or hook imports the module. The only reference is `src/lib/__tests__/public-api.test.ts`.
- `SECURITY.md` documents this file as an intentional **prototype** (API key + webhook signing) that must move to server routes before launch.
- **Action:** Leave in place. Tracked in `SECURITY.md` migration plan; removing it now would delete sunset-tracked prototype.

## Follow-ups
- Once `public-api.ts` is migrated to `api/` server routes per SECURITY.md, re-audit and remove client-side copy.
- `SOCIAL_PULSE_IMPLEMENTATION.md` still mentions twitter-ingestion as a deliverable; no doc updates needed.
