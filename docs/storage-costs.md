# Storage & Egress Cost Model

Per-1M MAU estimate for the video-pulses surface. Numbers are best-case
envelopes — actual costs vary by CDN negotiated rates.

## Assumptions
- 1,000,000 monthly active users.
- 20% of MAU publish at least one video per week (creator ratio): 200k
  creators.
- Creators average 2 videos/week.
- Mean compressed video: 10 MB (720x1280, 1.2 Mbps, 45s).
- Mean views per video: 20 (small — the 90-min TTL limits reach).
- Egress per view: 10 MB (4G) / 4 MB (2g/3g with `?q=low` variant).
- 90-min TTL; storage retained 24h post-expiry for DMCA.

## Upload ingress
- Videos/week = 200,000 * 2 = 400,000
- Videos/year = 400,000 * 52 = 20.8M
- Upload ingress/year = 20.8M * 10 MB ≈ 208 TB/year
- Most cloud providers do not bill ingress; this only matters as load on
  the Edge Functions.

## Steady-state storage
- Peak simultaneous videos (90 min TTL, 400k/week) ≈ (400,000 / 7 / 24 /
  60) * 90 ≈ 3,570 videos in the hot window.
- Hot-window storage ≈ 3,570 * 10 MB ≈ 35 GB (!)
- 24h DMCA tail ≈ (400,000 / 7) * 10 MB ≈ 560 GB
- Total steady-state storage ≈ 600 GB

## Egress (view traffic)
- Views/year = 20.8M * 20 ≈ 416M
- Egress/year = 416M * ~8 MB (weighted 70% 4G, 30% low) ≈ 3.3 PB/year
- Egress/month = ~275 TB/month

## Cost bands (order-of-magnitude)
Using typical public pricing:
- Storage at $0.021/GB-month * 600 GB ≈ **$13/month**
- Egress at $0.09/GB (no CDN discount) * 275 TB ≈ **$25k/month**
- Egress with a CDN at $0.02/GB ≈ **$5.5k/month**

Egress dominates by ~3 orders of magnitude. **Priority #1 for cost control
is CDN caching** — the `Cache-Control: public, max-age=30` on the feed
endpoint and long-lived cacheable video URLs are key.

Priority #2 is the low-bitrate variant for 2g/3g networks (halves egress
for ~30% of global traffic).

## Follow-ups
- HLS adaptive bitrate cuts egress ~30% vs single MP4.
- Lifecycle policy: move the 24h tail to cold storage (90% cheaper).
- Per-region Edge Function deployment to keep traffic local.
