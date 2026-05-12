import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createMeetingEvent } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { client: true, expert: true },
  });
  if (!booking || booking.status !== "PENDING_PAYMENT") return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // Confirm booking first so we don't lose payment state on calendar failure.
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CONFIRMED",
      stripePaymentIntentId: paymentIntentId,
    },
  });

  // Create chat thread (idempotent on bookingId unique).
  await prisma.chatThread.upsert({
    where: { bookingId: booking.id },
    create: { bookingId: booking.id },
    update: {},
  });

  // Create the Google Calendar event with a Meet link.
  try {
    const endsAt = new Date(
      booking.startsAt.getTime() + booking.durationMinutes * 60_000,
    );
    const { eventId, meetLink } = await createMeetingEvent({
      expertUserId: booking.expertId,
      clientEmail: booking.client.email ?? "",
      startsAt: booking.startsAt,
      endsAt,
      summary: `Networkd session: ${booking.client.name ?? "Client"} ↔ ${booking.expert.name ?? "Expert"}`,
      description: "Booked via Networkd",
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: { googleEventId: eventId, meetLink },
    });
  } catch (err) {
    // TODO(notify): surface to expert/client; leaving meetLink null for now.
    console.error("Calendar event creation failed", err);
  }
  // TODO(notify): email client + expert with the Meet link.
}

async function handleAccountUpdated(account: Stripe.Account) {
  const complete =
    Boolean(account.details_submitted) &&
    Boolean(account.charges_enabled) &&
    Boolean(account.payouts_enabled);
  await prisma.user.updateMany({
    where: { stripeAccountId: account.id },
    data: { stripeOnboardingComplete: complete },
  });
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid signature: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handler failed", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
