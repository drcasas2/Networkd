import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreeBusy } from "@/lib/google";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const expertId = searchParams.get("expertId");
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  if (!expertId || !fromStr || !toStr) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Range too large" }, { status: 400 });
  }

  const expert = await prisma.user.findUnique({ where: { id: expertId } });
  if (!expert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const busy = await getFreeBusy(expertId, from, to);
    // Also merge in pending/confirmed bookings as "busy" so we don't show
    // slots that are reserved but not yet on the calendar.
    const reserved = await prisma.booking.findMany({
      where: {
        expertId,
        status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
        startsAt: { gte: from, lt: to },
      },
      select: { startsAt: true, durationMinutes: true },
    });
    const reservedBusy = reserved.map((b) => ({
      start: b.startsAt.toISOString(),
      end: new Date(b.startsAt.getTime() + b.durationMinutes * 60_000).toISOString(),
    }));
    return NextResponse.json({ busy: [...busy, ...reservedBusy], timezone: expert.timezone });
  } catch (err) {
    console.error("freebusy failed", err);
    return NextResponse.json({ error: "Freebusy lookup failed" }, { status: 502 });
  }
}
