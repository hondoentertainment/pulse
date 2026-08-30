# Pulse Pro — interview brief (no price yet)

## Purpose

Learn whether a paid Pulse Pro offer is worth building. Do **not** invent a price, Stripe product, or feature list until the waitlist has real emails and at least a handful of interviews.

## Trigger

Settings → Pulse Pro pilot has stored emails in `signal_pilot_signups`. Review the count in Supabase before scheduling interviews.

## Preconditions

- Production pilot table applied (`20260816000001_signal_pilot_signups.sql`)
- Owner can read `signal_pilot_signups` as admin
- Outreach uses the submitted email and source only

## Interview prompts

1. What made you check in more than once?
2. Which weekly view would you pay to keep: export, summary, or reminder reliability?
3. What would make you ignore Pulse Signal after two weeks?
4. Who else sees your scores today, if anyone?
5. If Pro existed, what is one job it must do that the free loop does not?

## Out of scope

- Naming a monthly price
- Adding checkout, trials, or usage meters
- Social comparison, Health import, or unlimited intra-day logs

## Decision rule

Write the offer only after:

- [ ] Waitlist has emails you did not seed yourself
- [ ] 5 interviews completed with notes
- [ ] One sentence offer that a user repeated back

## Ownership

- Owner: Signal product
- Last reviewed: 2026-08-30
