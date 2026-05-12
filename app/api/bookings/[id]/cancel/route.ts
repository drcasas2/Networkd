import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { deleteCalendarEvent } from "@/lib/google";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.clientId !== userId && booking.expertId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (booking.status !== "CONFIRMED" && booking.status !== "PENDING_PAYMENT") {
    return NextResponse.json({ error: "Cannot cancel" }, { status: 400 });
  }

  if (booking.stripePaymentIntentId) {
    try {
      await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true,
      });
    } catch (err) {
      console.error("Refund failed", err);
      return NextResponse.json({ error: "Refund failed" }, { status: 502 });
    }
  }

  if (booking.googleEventId) {
    try {
      await deleteCalendarEvent(booking.expertId, booking.googleEventId);
    } catch (err) {
      console.error("Calendar delete failed", err);
      // Continue — refund already succeeded.
    }
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: booking.stripePaymentIntentId ? "REFUNDED" : "CANCELED",
    },
  });
  return NextResponse.json({ booking: updated });
}
