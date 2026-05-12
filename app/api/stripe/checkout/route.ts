import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, appUrl } from "@/lib/stripe";
import { platformFeeCents, priceForMinutes } from "@/lib/fees";

const Body = z.object({
  expertId: z.string().min(1),
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().max(8 * 60).default(60),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clientId = (session.user as { id?: string }).id;
  if (!clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { expertId, startsAt, durationMinutes } = parsed.data;

  if (expertId === clientId) {
    return NextResponse.json({ error: "Cannot book yourself" }, { status: 400 });
  }

  const expert = await prisma.user.findUnique({ where: { id: expertId } });
  if (!expert || (expert.role !== "EXPERT" && expert.role !== "BOTH")) {
    return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  }
  if (!expert.stripeAccountId || !expert.stripeOnboardingComplete) {
    return NextResponse.json(
      { error: "Expert hasn't finished payout setup" },
      { status: 400 },
    );
  }
  if (!expert.hourlyRateCents || expert.hourlyRateCents <= 0) {
    return NextResponse.json({ error: "Expert has no rate set" }, { status: 400 });
  }

  const startDate = new Date(startsAt);
  if (Number.isNaN(startDate.getTime()) || startDate.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invalid time slot" }, { status: 400 });
  }

  const priceCents = priceForMinutes(expert.hourlyRateCents, durationMinutes);
  const feeCents = platformFeeCents(priceCents);

  // Reserve the slot. Unique constraint on (expertId, startsAt) prevents races.
  let booking;
  try {
    booking = await prisma.booking.create({
      data: {
        clientId,
        expertId,
        startsAt: startDate,
        durationMinutes,
        priceCents,
        platformFeeCents: feeCents,
        status: "PENDING_PAYMENT",
      },
    });
  } catch {
    return NextResponse.json({ error: "Slot already taken" }, { status: 409 });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: session.user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: priceCents,
          product_data: {
            name: `${durationMinutes}-min session with ${expert.name ?? "Expert"}`,
            description: expert.headline ?? undefined,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: feeCents,
      transfer_data: { destination: expert.stripeAccountId },
      metadata: { bookingId: booking.id },
    },
    metadata: { bookingId: booking.id },
    success_url: `${appUrl()}/dashboard?booking=${booking.id}&status=success`,
    cancel_url: `${appUrl()}/experts/${expertId}?canceled=1`,
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { stripeCheckoutSessionId: checkout.id },
  });

  return NextResponse.json({ url: checkout.url });
}
