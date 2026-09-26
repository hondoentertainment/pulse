# Runbook: Meta glasses companion (phone notification mirroring)

Pulse stays a Seattle-only PWA. Meta Ray-Ban and Meta Ray-Ban Display do not get a native Wearables SDK integration. Glasses show a Pulse event only when the paired phone receives a Pulse Web Push and the Meta AI app mirrors that notification.

VAPID keys are already on Vercel. Do not regenerate or rotate them for this path.

## What gets mirrored

| Moment | Kind | Tag | Title shape | Opens |
|--------|------|-----|-------------|--------|
| Followed venue crosses Electric | `venue_surge` | `venue-surge:{venueId}` | `{Venue} · Surging` | `/venue/{venueId}` |
| Signed-in I’m here (presence written) | `im_here` | `im-here:{venueId}` | `You're at {Venue} · Pulse` | `/?here={venueId}` |
| Someone you follow is here | `im_here` | `im-here:{venueId}` | `{Name} is here` | `/?here={venueId}` |

Electric uses a higher Web Push urgency and `renotify` so a new surge replaces the previous one for that venue. I’m-here stays normal urgency. A second I’m here at the same venue inside 90 minutes does not send again.

Share-arrival “I’m here” only opens the map. The push fires when **I’m here · Pulse** succeeds (the check-in confirm in `VenueRoute`). Follower pushes also require a live `presence` row from that confirm. The self glance still sends if that row did not land.

## Phone setup

1. Install Pulse (Add to Home Screen / browser install) on the phone that pairs to the glasses.
2. Sign in and turn on Pulse notifications (Settings → Notifications, or the follow/install notify card). Allow notifications for the installed PWA or the browser.
3. Optional: set surge quiet hours. Those hours pause Electric alerts and friend here-now pushes. Your own I’m here glance still sends.
4. In the Meta AI app, pair the Ray-Ban glasses.
5. When Meta offers notification mirroring, allow Pulse (or the browser that shows Pulse notifications) to mirror. If mirroring is not in the app yet, the phone notification is the whole path — Pulse cannot turn mirroring on.

## Limits

- Mirroring depends on Meta’s rollout and the user’s Meta AI settings. The PWA cannot open a glasses SDK session.
- Follower pushes go only to people who follow the confirmer (`follows.target_kind = user`), capped at the 40 most recent follows. Presence visibility `off` or presence disabled skips follower pushes. The self glance still sends.
- Follower quiet hours use `push_tokens.quiet_hours_start` / `quiet_hours_end` (Seattle local). Surge mute is per followed venue and does not apply to I’m here.
- The Friends Nearby switch in Settings is on-device only. The server does not read it.
- “Hide at sensitive venues” stays in the client presence engine. Follower push does not apply it.
- I’m-here does not insert an in-app `notifications` row. That table has no actor column, so a `friend_nearby` insert would bump unread without a renderable card.
- Missing `VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY` is an honest no-op. The in-app “I’m here” toast still shows.
- Seattle only. This does not add another city.

## Manual proof (phone + glasses)

Kyle owns hardware proof. On a signed-in phone with Pulse notifications allowed:

1. Follow a venue, wait until a real Electric cross (or use a venue that just crossed). Confirm a short `{Venue} · Surging` notification. Tap it and land on `/venue/{id}`. A second Electric pulse inside two hours should not send another surge push.
2. Open that venue and tap **I’m here · Pulse**. Confirm `You're at {Venue} · Pulse`, then tap it and land on the map focused with `/?here={venueId}`.
3. With glasses paired and Pulse mirroring allowed in Meta AI, confirm the same notification appears on the glasses. If Meta has not rolled mirroring out to that account, record that the phone notification arrived and the glasses did not — that is a Meta limit, not a Pulse send failure.
4. From a second account that follows the first, confirm `{Name} is here` after the first account’s I’m here, unless quiet hours or presence-off apply.

## Code map

- Surge decision + payload: `src/lib/venue-surge-notify.ts`
- I’m-here decision + payload: `src/lib/im-here-notify.ts`
- Senders: `api/_lib/web-push-live.ts`, `api/_lib/web-push-im-here.ts`
- Confirm wire-up: `src/components/VenueRoute.tsx` after `writeImHerePresence`
- Service worker: `public/push-sw.js` (VitePWA `importScripts`) and legacy `public/sw.js`
- Setup copy: Settings → Notifications, and the push notify card
