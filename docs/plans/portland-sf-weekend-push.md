# Portland and San Francisco weekend push

Review for Kyle. Docs only. Seattle stays the default city. Portland and San Francisco are the other two coast markets from [#126](https://github.com/hondoentertainment/pulse/pull/126). This push reuses Tonight ranking and surge push from [#110](https://github.com/hondoentertainment/pulse/pull/110), the Friday quiet prompt, and hop share. No paid APIs, no new vendor keys, no Stripe, no messages Pulse sends on its own. Los Angeles and every other city stay off the index.

## Goal

On Friday and Saturday night, a guest who picks Portland or San Francisco sees that city only: a real Tonight list or an honest “quiet” card, the curated map, and a way to share a hop. Success is observable with the events we already log (`guest_map_view`, `venue_open`, `auth_start`, `first_pulse_create`):

- The map and Tonight match the switcher. A fresh open is still Seattle.
- Tonight shows at most 8 rooms from that city, or the quiet card when that city has zero pulses tonight. The empty copy names Portland or San Francisco, not a Seattle pin.
- At most one quiet push per city per local night, and only at 9pm Pacific when the city is actually quiet.
- At most one Electric surge push per venue per two hours. Both pushes skip the user’s quiet hours. Missing VAPID sends nothing.
- A hop link opens that room on the current origin (`https://pulse-chi-nine.vercel.app`).
- A useful weekend read is one real pulse on a curated room in each city. We do not invent a crowd to get there.

## What a guest sees

The switcher already offers Seattle, Portland, and San Francisco when the geo-gate is empty. If `VITE_LAUNCHED_CITIES` is only `Seattle,WA`, the other two cities are hidden. Coast value: `Seattle,WA;Portland,OR;San Francisco,CA`.

**Tonight.** Header is `Tonight · {neighborhood}`. Rank is live energy, distance, and time of day (music and bars rise after 8pm). A followed room with a pulse in the last 90 minutes floats when it is within 2 miles. A location-verified pulse beats an equal unverified one. Curated wins a tie. Scores stay 0 until someone posts.

**Quiet Friday or Saturday.** If the selected city is Portland or San Francisco and the curated (or followed) rooms have no pulse that local night, the existing quiet card replaces the list: one real room, “0 · no pulses yet tonight”, and Post first pulse. Guests can browse. Posting still goes to `/auth`.

**Surge.** The first Electric pulse at a followed room can push “{name} · Surging”. A second Electric inside two hours does not. Mute on the venue page stops that room.

**Map.** That city’s curated pins paint first. Portland and San Francisco have no second catalog behind idle (Seattle still does: Launch 33, then All Seattle). Pins from the other cities do not draw.

**Friday prompt.** At 9pm Pacific the same quiet state can push once: “Quiet night in {city}”, with Post first pulse, Open Tonight, and Mute. People who do not follow a room in that city do not get the push. The in-app card still shows for anyone looking at that city.

Portland’s Friday spine is Old Town (Dante’s, Roseland, Star Theater) plus Holocene and the music halls. San Francisco’s is Mission (The Chapel, El Rio, Make-Out Room) and SoMa (DNA Lounge, The EndUp, 1015 Folsom, Cat Club), with Castro next to them. Marina and Alberta read as earlier bars, not the late list.

## Curated gaps

Each city has 32 curated rooms, cap 40. Do not add an OSM dump for this weekend.

Portland hoods that cannot hop: Eliot is only Wonder Ballroom, Brooklyn is only Aladdin Theater. Hop next needs two other rooms in the same neighborhood, so those two halls offer no next stop. Division / Richmond is a real Friday corridor and is missing (candidates Kyle should confirm: Dig a Pony, The Know, Victory Bar). About 10 of 32 Portland rooms have a public website. The rest cannot self-verify a claim by email domain.

San Francisco hoods all have at least three rooms, so hop next works. The obvious music gap is The Fillmore and The Independent, which are not in the eight neighborhoods. A new hood needs three real rooms or hop next is empty there. About 9 of 32 rooms have a website. Seeds have no hours. Do not invent hours or photos.

## Seeding

Same row shape as the [#126](https://github.com/hondoentertainment/pulse/pull/126) seed `20261005120000_portland_san_francisco_launch_venues.sql`: deterministic UUIDs, `inventory_source = curated-seed`, pulse score 0, no photos, idempotent upsert, share slug kept as an alias. Apply the new rows on production project `xeldqwhztcnnvazmshzh` **before** the catalog PR merges, then run a verify script (32 plus the new rooms, still ≤ 40, zero rows outside Portland and San Francisco). Do not mass-delete. #126’s checklist said to apply after merge. This push lands the rows first so Friday share links resolve.

## Push timing

Quiet hours live on `push_tokens.quiet_hours_start` / `quiet_hours_end`, Pacific time (`America/Los_Angeles`), which covers Seattle, Portland, and San Francisco. A window of 22 to 7 is quiet overnight and still allows the 9pm prompt (hour 21 is outside that window). A window that starts at 21 or earlier is what suppresses 9pm. Empty bounds mean no quiet hours; nothing here turns on a default window. The Friday prompt also checks `launch_quiet_notices` (one per city per night) and `launch_quiet_mutes`. Surge checks `venue_surge_notices` and `follows.surge_muted`. No new keys. If VAPID is unset, both sends return a no-op.

## Share and hop

Heading there copies `/venue/{slug}?hop=1`. Crawlers hit `/api/share/venue?venueId=&hop=1` and the friend lands on “{name} is heading here” for eight hours, then I’m here. The `sms:` link only opens the guest’s own compose sheet. Pulse does not send SMS, email, or invites. Hop next lists two other Start-here rooms in that neighborhood. New rooms need the same slug-to-UUID alias pattern (`pdx-…`, `sf-…`).

## Phased PRs

**PR 1 — Fill the thin hoods and seed prod first.** Add one confirmed hood per city (about three real rooms), plus a public website only where the venue already publishes one. Stay inside 25–40. Files: `src/lib/portland-launch-venues.ts`, `src/lib/san-francisco-launch-venues.ts`, a new upsert migration, `supabase/verify/portland_san_francisco_launch_venues.sql`, the launch-venue tests. Migration: yes. Apply it on prod before merge. Test: count and bbox tests; verify SQL; hop next returns two rooms in the new hood.

**PR 2 — City-correct the Friday night screen.** Tonight’s empty steps name the selected city. The quiet-push body says “rooms you follow” only when the room is actually followed. Files: `src/lib/tonight-home.ts`, `src/lib/launch-city-quiet.ts`, `src/components/TonightHomeHeader.tsx`, their tests. Migration: no. Smoke: Portland at 9pm with zero pulses shows the quiet card; one pulse shows the ranked list; San Francisco matches; Seattle copy is unchanged.

**PR 3 — Lock push timing.** No new sender. Tests cover Pacific quiet hours, one quiet push per city per night, mute, and the two-hour Electric cap. Files: `src/lib/venue-surge-notify.ts`, `src/lib/launch-city-quiet.ts`, `src/lib/quiet-night.ts`, existing notify tests, the night-coach cron if it is what fires the 9pm send. Migration: no. Smoke: with no VAPID, both paths no-op. A 21–7 window suppresses the 9pm send for that user. A 22–7 window still allows it, because hour 21 is outside those bounds.

**PR 4 — Hop the new rooms.** Slug aliases and OG for the new ids. Files: `src/lib/coast-venue-ids.ts`, `src/lib/heading-there.ts`, `src/lib/hop-next.ts`, `api/share/venue`, share tests. Migration: no, unless `venue_headings` is still missing on prod (do not re-apply `20261009120000` if it is already there). Smoke: a hop link for a new room opens that room with the heading banner, on this origin.

## Open questions for Kyle

1. Which three Division rooms, and which San Francisco hood (Fillmore / Independent, or Polk), should the first seed include?
2. Is production `VITE_LAUNCHED_CITIES` already the three-city coast value, empty, or Seattle only?
3. Should the 9pm push stay limited to people who follow a room in that city?
4. Leave quiet hours off until someone sets them, or ship a default 22–7 for this weekend?
5. Are the existing VAPID keys already on Vercel? This plan will not generate any.
