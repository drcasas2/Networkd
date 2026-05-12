# Networkd

Paid networking platform where experts charge for consulting calls — book, pay
through Stripe, and meet on Google Calendar / Meet in one streamlined flow.

## Stack

- Next.js 15 (App Router, TypeScript)
- Postgres + Prisma
- Auth.js v5 (Google OAuth, scopes include Google Calendar)
- Stripe (Checkout + Connect Express for expert payouts)
- Google Calendar API (freebusy + Meet conference links)
- Tailwind CSS

## Getting started

```bash
cp .env.example .env
# Fill in DATABASE_URL, Google OAuth, Stripe keys

pnpm install            # or npm install
pnpm db:migrate         # runs prisma migrate dev
pnpm dev
```

Then in another terminal, forward Stripe events to the local webhook:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Required environment variables

See `.env.example`. The Google OAuth client must have the Calendar API enabled
and the consent screen authorized for the `calendar.events` and
`calendar.freebusy` scopes. The Stripe account must have Connect enabled
(test mode is fine).

## End-to-end test flow

1. Sign in as Expert A → set role to Expert, set an hourly rate, complete
   Stripe Connect Express onboarding.
2. Sign in (other browser) as Client B → open `/experts`, pick Expert A,
   choose a slot, complete Stripe Checkout with test card `4242 4242 4242 4242`.
3. The webhook should:
   - flip the booking to `CONFIRMED`
   - create a Google Calendar event on Expert A's calendar with a Meet link
   - create a `ChatThread`
4. Both sides see the booking on `/dashboard`, can open `/chat/[id]`, and join
   the Meet link.
5. Cancel from the dashboard to trigger a refund + calendar event deletion.

## Tests

```bash
pnpm test
```

## Project layout

```
app/                Next.js App Router pages + API routes
components/         Client components (forms, pickers, chat)
lib/                Prisma client, Auth.js config, Stripe + Google helpers, fee math
prisma/             schema.prisma
middleware.ts       Auth gate for /dashboard, /onboarding, /book, /chat
```

## Non-goals (MVP)

No public feed, no pay-per-DM outside bookings, no reviews/ratings, no group
sessions, no real-time chat transport (polling), no email notifications. See
the plan in `/root/.claude/plans/create-a-new-networked-linked-lerdorf.md`.
