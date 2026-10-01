# Second city readiness (WC-13)

Seattle stays the only launched city. This note is a checklist for a later market. Do not import a new catalog, do not set a second city in `VITE_LAUNCHED_CITIES`, and do not ship a second map center from this work.

## Before a second city is even considered

Seattle habit has to be real first:

- D1 and D7 of nightly opens are measured (WC-0.5 analytics keys; the console adapter stays a no-op until then).
- Capitol Hill (the focus hood) is not empty on Fri/Sat 9–12pm for a sustained dogfood window (WC-9). That is a human invite and claim job. Do not send invites from the repo.
- Live review → map, claim → inbox, and share OG are proven on production. Leave GitHub issues #85 and #86 open until that proof exists.

## What a second city would reuse

Do not build a parallel stack. A later city would:

1. **Catalog import.** Add a curated seed the same way as `SEATTLE_LAUNCH_VENUES` (about 25–40 real, publicly listed rooms, `pulseScore` 0, `inventorySource: curated-seed`). OSM fill stays a separate idle layer, the way All Seattle is deferred behind Launch 33. No mass deletes. No scraped photos.
2. **Geo-gate.** `VITE_LAUNCHED_CITIES` already treats `Seattle,WA` as one market. A second market would be an additional `City,ST` pair separated by `;` (see `docs/feature-flags.md`). Empty stays “no gate.” Do not turn that env on for a new city in this repo until the Seattle targets above are hit.
3. **OG and share.** `/api/share/venue` and neighborhood OG stay city-agnostic. A new hood page is `/n/:slug` only after venues in that city carry a neighborhood tag. Do not invent a second production domain.
4. **Map cold start.** The new city’s curated set paints first. The large catalog waits for idle, same as `partitionColdStartCatalog` / `pulse_map_interactive`.
5. **Trust.** Claims, `/ops` (`app_metadata.role = admin` only), and `pulse_reports` stay the moderation path. No new admin role.

## Explicitly out of scope here

- Launching city number two
- Importing a non-Seattle catalog or seed SQL
- Changing Supabase Auth Site URL
- New vendor keys, Stripe, or paid APIs
