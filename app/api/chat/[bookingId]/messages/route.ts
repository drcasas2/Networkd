import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PostBody = z.object({ body: z.string().min(1).max(4000) });

async function assertParticipant(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, clientId: true, expertId: true, status: true },
  });
  if (!booking) return null;
  if (booking.clientId !== userId && booking.expertId !== userId) return null;
  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") return null;
  return booking;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await assertParticipant(bookingId, userId);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const thread = await prisma.chatThread.findUnique({
    where: { bookingId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, senderId: true, body: true, createdAt: true },
      },
    },
  });
  return NextResponse.json({ messages: thread?.messages ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await assertParticipant(bookingId, userId);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const thread = await prisma.chatThread.upsert({
    where: { bookingId },
    create: { bookingId },
    update: {},
  });

  const message = await prisma.message.create({
    data: {
      threadId: thread.id,
      senderId: userId,
      body: parsed.data.body,
    },
    select: { id: true, senderId: true, body: true, createdAt: true },
  });
  return NextResponse.json({ message });
}
