# Networkd

**Pay an expert. Get an hour. Go.**

Networkd is a no-nonsense paid networking platform — a LinkedIn-style directory where every connection is a transaction. Experts publish a profile and an hourly rate, clients browse and pay upfront via Stripe, and the platform automatically creates a Google Calendar event with a Meet link and opens a private chat thread tied to the booking. Networkd takes a service fee on each booking and pays the rest out to the expert via Stripe Connect.

This repository is the MVP. It is intentionally lean: no public feed, no follows, no reviews — just the booking + payment + meeting + chat flow.

---

## Table of contents

1. [Current functionality](#current-functionality)
2. [Tech stack](#tech-stack)
3. [Architecture at a glance](#architecture-at-a-glance)
4. [Core flows](#core-flows)
5. [Codebase tour](#codebase-tour)
6. [Data model](#data-model)
7. [Environment variables](#environment-variables)
8. [External service setup](#external-service-setup)
9. [Local development](#local-development)
10. [End-to-end test walkthrough](#end-to-end-test-walkthrough)
11. [Tests](#tests)
12. [Deployment notes](#deployment-notes)
13. [Roadmap / non-goals](#roadmap--non-goals)

---

## Current functionality

- **Google sign-in** with Calendar scopes baked into the OAuth grant.
- **Profile onboarding**: choose a role (`CLIENT`, `EXPERT`, or `BOTH`), set a headline, bio, expertise tags, hourly rate, and timezone.
- **Stripe Connect Express** onboarding for experts so payouts land in their bank account.
- **Expert directory** (`/experts`) with name/headline search and tag filters.
- **Bookings** that pull live availability from the expert's Google Calendar (freebusy) and merge in pending Networkd holds.
- **Stripe Checkout** in destination-charge mode — the platform takes an `application_fee_amount` (default 15%) and the rest is transferred to the expert's connected account.
- **Webhook fan-out** on `checkout.session.completed`: marks the booking confirmed, creates a Google Calendar event with a Meet link on the expert's calendar (with the client invited), and opens a chat thread.
- **In-app chat** scoped to a single booking (polling-based for MVP).
- **Cancel + refund** from the dashboard: refunds via Stripe (including reverse-transfer + application-fee refund) and deletes the Calendar event.
- **Fee math** centralized in one file (`lib/fees.ts`) with unit tests.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | Postgres |
| ORM | Prisma |
| Auth | Auth.js v5 (NextAuth) with Google OAuth, JWT session strategy |
| Payments | Stripe Checkout + Stripe Connect Express |
| Meetings | Google Calendar API (`freebusy.query`, `events.insert` with `hangoutsMeet` conference data) |
| Styling | Tailwind CSS |
| Tests | Vitest |

---

## Architecture at a glance

```
┌──────────────┐       ┌──────────────────────────────────────────────┐
│   Browser    │◀────▶│  Next.js 15 App Router                       │
│ (React UI)   │       │  - Server components / pages                 │
└──────────────┘       │  - Route handlers under /api/*               │
                       │  - middleware.ts (auth gate)                 │
                       └──────────┬───────────────────┬──────────────┘
                                  │                   │
                       ┌──────────▼─────────┐  ┌──────▼───────────┐
                       │ Postgres (Prisma)  │  │ Auth.js (Google) │
                       │ users, bookings,   │  │ + Prisma adapter │
                       │ threads, messages  │  │ JWT sessions     │
                       └──────────┬─────────┘  └──────┬───────────┘
                                  │                   │
                       ┌──────────▼─────────┐  ┌──────▼───────────┐
                       │ Stripe             │  │ Google Calendar  │
                       │ Checkout +         │  │ freebusy +       │
                       │ Connect Express +  │  │ events.insert    │
                       │ Webhook            │  │ (Meet)           │
                       └────────────────────┘  └──────────────────┘
```

Server components do data fetching directly through Prisma. Mutations (booking, profile updates, chat, cancel) go through Next.js route handlers in `app/api/`. External side effects (Stripe, Google) are triggered server-side and reconciled through the Stripe webhook.

---

## Core flows

### 1. Sign-in
- `app/signin/page.tsx` renders a single "Continue with Google" button that calls a server-action `signIn("google", …)`.
- Auth.js config lives in two files:
  - `auth.config.ts` — edge-safe (no Prisma adapter). Used by `middleware.ts` so route gating can run on the edge runtime.
  - `lib/auth.ts` — adds the Prisma adapter and JWT callbacks; used by server components and API routes.
- The Google authorization request includes the `calendar.events` and `calendar.freebusy` scopes plus `access_type=offline` + `prompt=consent` so we get a refresh token. The refresh token is stored on the `Account` row by the Prisma adapter and later used by `lib/google.ts`.

### 2. Expert onboarding
- `app/onboarding/page.tsx` collects role, headline, bio, tags, hourly rate, timezone. `components/OnboardingForm.tsx` POSTs to `app/api/profile/route.ts`.
- If the user picks Expert or Both, they're redirected to `app/dashboard/expert/onboarding/page.tsx`, which uses `components/StripeOnboardButton.tsx` to call `app/api/stripe/connect/onboard/route.ts`.
- That route creates a Stripe Express account (if one doesn't exist) and returns a `accountLinks.create` URL. The `account.updated` webhook flips `stripeOnboardingComplete` to `true` when Stripe confirms charges + payouts are enabled.

### 3. Browse and book
- `app/experts/page.tsx` lists experts who have completed Stripe onboarding and set a rate. Search hits `name`/`headline`/`bio` (`ILIKE`) and an optional `tag` filter (`expertiseTags has`).
- `app/experts/[id]/page.tsx` is the public profile page with a "Book a session" CTA.
- `app/book/[expertId]/page.tsx` mounts `components/TimeSlotPicker.tsx`. The picker:
  1. Calls `GET /api/calendar/freebusy?expertId=…&from=…&to=…`, which uses `lib/google.ts` `getFreeBusy()` to query the expert's primary calendar and also pulls existing Networkd bookings to avoid showing double-booked slots.
  2. Renders 7 days × 9am–6pm hourly slots, disabling busy ones.
  3. On submit, POSTs to `app/api/stripe/checkout/route.ts`.
- The checkout route uses `lib/fees.ts` (`priceForMinutes`, `platformFeeCents`) to compute the total and platform fee, reserves the slot via `prisma.booking.create` (the `(expertId, startsAt)` unique index prevents races), and creates a Stripe Checkout Session in destination-charge mode with `payment_intent_data.transfer_data.destination = expert.stripeAccountId`.

### 4. Webhook fan-out
- `app/api/stripe/webhook/route.ts` validates the signature with the raw body and handles two events:
  - `checkout.session.completed` → looks up the booking by `stripeCheckoutSessionId`, flips it to `CONFIRMED`, stores the `PaymentIntent` id, upserts a `ChatThread`, then calls `lib/google.ts` `createMeetingEvent()` to insert a Calendar event on the expert's primary calendar with `conferenceData.createRequest` (Google generates a Meet link). The client is added as an attendee and `sendUpdates: "all"` triggers Google's invitation email.
  - `account.updated` → updates the expert's `stripeOnboardingComplete` flag based on `details_submitted` + `charges_enabled` + `payouts_enabled`.

### 5. Chat
- `app/chat/[bookingId]/page.tsx` server-side checks that the viewer is the client or expert on the booking, renders booking metadata + the Meet link, and mounts `components/ChatPanel.tsx`.
- `components/ChatPanel.tsx` polls `GET /api/chat/[bookingId]/messages` every 3 seconds and POSTs new messages to the same route. Both ends are scoped to a single `ChatThread` keyed off the booking.

### 6. Cancel + refund
- `components/BookingRow.tsx` exposes a "Cancel" button on `/dashboard`.
- `app/api/bookings/[id]/cancel/route.ts` verifies the caller owns the booking, calls `stripe.refunds.create({ payment_intent, reverse_transfer: true, refund_application_fee: true })` (so the expert's share and the platform fee both unwind), then deletes the Google Calendar event via `lib/google.ts` `deleteCalendarEvent()`, and marks the booking `REFUNDED` (or `CANCELED` if it never paid).

---

## Codebase tour

```
app/
├── layout.tsx                                  Root layout, header, sign-out form
├── page.tsx                                    Landing page
├── globals.css                                 Tailwind base
├── signin/page.tsx                             Google sign-in button (server action)
├── onboarding/page.tsx                         Profile setup (uses OnboardingForm)
├── experts/
│   ├── page.tsx                                Expert directory + search/tag filter
│   └── [id]/page.tsx                           Public expert profile
├── book/[expertId]/page.tsx                    Booking page (mounts TimeSlotPicker)
├── dashboard/
│   ├── page.tsx                                Bookings as client + as expert
│   └── expert/onboarding/page.tsx              Stripe Connect onboarding entry
├── chat/[bookingId]/page.tsx                   Per-booking chat view
└── api/
    ├── auth/[...nextauth]/route.ts             Auth.js handler (GET/POST)
    ├── profile/route.ts                        Upsert user profile fields
    ├── stripe/
    │   ├── checkout/route.ts                   Create Checkout Session + reserve booking
    │   ├── connect/onboard/route.ts            Create Stripe Express account + onboarding link
    │   └── webhook/route.ts                    checkout.session.completed + account.updated
    ├── calendar/freebusy/route.ts              GET busy intervals for an expert
    ├── chat/[bookingId]/messages/route.ts      GET/POST messages on a booking's thread
    └── bookings/[id]/cancel/route.ts           Refund + delete Calendar event

components/
├── ExpertCard.tsx                              Directory card
├── OnboardingForm.tsx                          Profile form (client component)
├── StripeOnboardButton.tsx                     POSTs to /api/stripe/connect/onboard
├── TimeSlotPicker.tsx                          Fetches freebusy, renders slots, POSTs to checkout
├── BookingRow.tsx                              Dashboard row (Join Meet, Chat, Cancel)
└── ChatPanel.tsx                               Polling chat UI

lib/
├── auth.ts                                     NextAuth() with Prisma adapter + JWT
├── prisma.ts                                   PrismaClient singleton
├── stripe.ts                                   Stripe SDK + appUrl()
├── google.ts                                   OAuth2 client, freebusy, event create/delete
├── fees.ts                                     platformFeeBps / platformFeeCents / priceForMinutes
├── fees.test.ts                                Vitest unit tests for fee math
└── format.ts                                   formatCents, formatDateTime

prisma/
└── schema.prisma                               Users, accounts, sessions, bookings, threads, messages

auth.config.ts                                  Edge-safe Auth.js config (used by middleware)
middleware.ts                                   Gates /dashboard, /onboarding, /book, /chat
next.config.mjs                                 Next.js config (image hosts)
tailwind.config.ts                              Tailwind config (brand color)
vitest.config.ts                                Vitest config
types/next-auth.d.ts                            Session type augmentation (session.user.id)
```

---

## Data model

Defined in `prisma/schema.prisma`.

| Model | Purpose | Notable fields / invariants |
|---|---|---|
| `User` | Auth.js user + profile + Stripe Connect state | `role`, `headline`, `bio`, `expertiseTags[]`, `hourlyRateCents`, `timezone`, `stripeAccountId` (unique), `stripeOnboardingComplete` |
| `Account` | Auth.js OAuth account, holds Google `refresh_token` | Unique on `(provider, providerAccountId)` |
| `Session`, `VerificationToken` | Auth.js standard tables | — |
| `Booking` | A paid session between client and expert | `status: PENDING_PAYMENT → CONFIRMED → COMPLETED / CANCELED / REFUNDED`, unique `(expertId, startsAt)` to prevent double-booking, unique `stripeCheckoutSessionId` and `stripePaymentIntentId`, optional `googleEventId` + `meetLink` |
| `ChatThread` | 1-to-1 with a `Booking` (`bookingId` unique) | Created by the Stripe webhook |
| `Message` | Chat message in a thread | Indexed on `(threadId, createdAt)` |

---

## Environment variables

All listed in `.env.example`. Copy to `.env` and fill in.

| Variable | Required | What it is | Where it comes from |
|---|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string | Your local Postgres or a hosted provider (Neon, Supabase, RDS, etc.) |
| `AUTH_SECRET` | yes | Secret used by Auth.js to sign JWTs | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | yes (local) | Public base URL of the app | `http://localhost:3000` in development |
| `AUTH_GOOGLE_ID` | yes | Google OAuth 2.0 Client ID | Google Cloud Console → APIs & Services → Credentials |
| `AUTH_GOOGLE_SECRET` | yes | Google OAuth 2.0 Client secret | Same place as the client ID |
| `STRIPE_SECRET_KEY` | yes | Stripe secret key (test or live) | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | yes | Signing secret for the local webhook listener | Printed by `stripe listen --forward-to …` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | yes | Stripe publishable key | Stripe Dashboard → Developers → API keys |
| `PLATFORM_FEE_BPS` | no | Platform fee in basis points; defaults to `1500` (15%) | You |
| `APP_URL` | yes | Used to build Stripe success/cancel + Connect refresh/return URLs | `http://localhost:3000` locally |

---

## External service setup

### 1. Postgres

Pick one:

- **Local (Docker)**:
  ```bash
  docker run --name networkd-pg -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=networkd -p 5432:5432 -d postgres:16
  ```
  Then `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/networkd?schema=public"`.
- **Neon** (free tier, serverless Postgres) — create a project at https://neon.tech and copy the connection string into `DATABASE_URL`.
- **Supabase** — create a project at https://supabase.com, grab the Postgres connection string from Project settings → Database.

### 2. Google Cloud / OAuth / Calendar API

1. Go to https://console.cloud.google.com and create (or pick) a project.
2. **Enable the Google Calendar API**: APIs & Services → Library → search "Google Calendar API" → Enable.
3. **Configure the OAuth consent screen**: APIs & Services → OAuth consent screen.
   - User type: **External**.
   - Fill in app name / support email.
   - Add scopes:
     - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/calendar.freebusy`
   - Add yourself (and any test accounts you'll use) as **Test users** while the app is in Testing mode.
4. **Create OAuth credentials**: APIs & Services → Credentials → Create credentials → OAuth client ID.
   - Application type: **Web application**.
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (add your production URL too when you deploy).
5. Copy the Client ID into `AUTH_GOOGLE_ID` and the Client Secret into `AUTH_GOOGLE_SECRET`.

### 3. Stripe

1. Create a Stripe account at https://stripe.com (test mode is fine for development).
2. **API keys**: Dashboard → Developers → API keys.
   - Copy the **Secret key** (`sk_test_…`) into `STRIPE_SECRET_KEY`.
   - Copy the **Publishable key** (`pk_test_…`) into `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. **Enable Connect**: Dashboard → Connect → Get started. Choose **platform/marketplace**. Networkd uses the **Express** account type. In test mode this is one click.
4. **Install the Stripe CLI** (https://stripe.com/docs/stripe-cli) and log in:
   ```bash
   stripe login
   ```
5. **Forward webhooks to localhost**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   The CLI prints a signing secret (`whsec_…`). Copy that into `STRIPE_WEBHOOK_SECRET`. The CLI also forwards Connect events from the platform account, so `account.updated` works without extra setup.

### 4. AUTH_SECRET

Generate locally — anything random will do:

```bash
openssl rand -base64 32
```

---

## Local development

Prereqs: Node 20+, pnpm (or npm), a Postgres database, and the Stripe CLI for webhook forwarding.

```bash
# 1. Install
pnpm install        # or: npm install

# 2. Create env file
cp .env.example .env
# Fill in the values per "External service setup" above.

# 3. Run migrations
pnpm db:migrate     # prisma migrate dev — creates tables

# 4. Start the app
pnpm dev            # http://localhost:3000

# 5. In a second terminal — forward Stripe events
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Useful scripts (defined in `package.json`):

| Script | What it does |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm build` | `prisma generate && next build` |
| `pnpm start` | Production Next server |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:push` | `prisma db push` (schema sync without migrations — handy for prototyping) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm test` | Run Vitest unit tests |

---

## End-to-end test walkthrough

You'll need **two browsers** (or one regular + one Incognito) so you can be signed in as both an expert and a client at once. Two Google accounts both need to be added as Test users on the OAuth consent screen.

1. **Expert: sign in and configure**
   - Browser A → http://localhost:3000/signin → Continue with Google → grant Calendar scopes.
   - Land on `/onboarding`. Choose role **Get booked** (or **Both**), add a headline / bio / a couple of tags, set an hourly rate (e.g. `200`), save.
   - You'll be redirected to `/dashboard/expert/onboarding`. Click **Continue with Stripe**, complete the Express onboarding form (Stripe test mode accepts a stub identity and the test bank routing `110000000` / account `000123456789`).
   - Stripe's `account.updated` webhook will flip `stripeOnboardingComplete = true` once you've finished. Refresh `/dashboard` and the Stripe pill should show **Stripe ✓**.

2. **Client: book a session**
   - Browser B → http://localhost:3000/signin → sign in with the second Google account → finish minimal onboarding as **Book experts**.
   - Open `/experts`, find Expert A, click their card, then **Book a session**.
   - The grid loads availability from Expert A's calendar (via `freebusy`). Pick any open slot and click **Pay & book**.
   - You'll be redirected to Stripe Checkout. Use test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

3. **Verify the webhook fan-out**
   - The Stripe CLI window will show `checkout.session.completed` being forwarded with a `200`. Expected side effects:
     - `Booking.status` flips from `PENDING_PAYMENT` to `CONFIRMED`.
     - A Google Calendar event appears on Expert A's primary calendar with a Meet link and Client B as an attendee.
     - A `ChatThread` row is created for the booking.
   - You can confirm with `pnpm db:studio` or by reloading `/dashboard`.

4. **Meet + chat**
   - Both sides see the booking on `/dashboard` with a **Join Meet** button and a **Chat** link.
   - Open `/chat/[bookingId]` in both browsers, send a message from each side — the other side picks it up within ~3 seconds (poll interval).

5. **Cancel + refund**
   - From either dashboard, click **Cancel** on the booking. The route fires `stripe.refunds.create` with `reverse_transfer: true` and `refund_application_fee: true`, then deletes the Calendar event.
   - The booking row updates to `REFUNDED`, the calendar event disappears, and the refund shows up in the Stripe dashboard.

---

## Tests

```bash
pnpm test
```

Currently covers `lib/fees.ts` — the single source of truth for platform fee math.

---

## Deployment notes

- The Stripe webhook handler and `lib/google.ts` need the **Node.js runtime** (not Edge) — they're already declared as such; don't move them.
- Auth.js middleware (`middleware.ts`) uses the edge-safe `auth.config.ts` (no Prisma adapter), which is why we use JWT sessions instead of database sessions.
- Set every variable from the table above in your hosting provider. For Stripe in production, configure a real webhook endpoint at `https://<your-domain>/api/stripe/webhook` (Dashboard → Developers → Webhooks) and use the signing secret it generates.
- Add your production callback URL to the Google OAuth client: `https://<your-domain>/api/auth/callback/google`.
- The platform fee is read from `PLATFORM_FEE_BPS` at request time, so you can change it without redeploying if your platform supports runtime env updates.

---

## Roadmap / non-goals

Explicitly **out of scope** for this MVP (so we don't accidentally feature-creep):

- Public activity feed, posts, follows
- Pay-per-DM outside of a booked session
- Reviews and ratings
- Group sessions, recurring bookings
- Real-time chat transport (we poll every 3s; SSE/WebSockets are a straightforward follow-up)
- Email / SMS notifications (Google Calendar's own invitation email is the only notification today)
- Mobile apps

These are deliberate omissions — the goal of this codebase is to nail the "browse → pay → meet" loop and nothing else.
