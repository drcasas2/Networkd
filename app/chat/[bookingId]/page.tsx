import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import ChatPanel from "@/components/ChatPanel";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/signin");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { client: true, expert: true },
  });
  if (!booking) notFound();
  if (booking.clientId !== userId && booking.expertId !== userId) notFound();

  const other = booking.clientId === userId ? booking.expert : booking.client;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              Chat with {other.name ?? "User"}
            </h1>
            <p className="text-sm text-slate-600">
              Session: {formatDateTime(booking.startsAt)} ({booking.durationMinutes}m)
            </p>
          </div>
          {booking.meetLink && (
            <a
              href={booking.meetLink}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-brand px-3 py-2 text-sm text-white hover:bg-brand-dark"
            >
              Join Meet
            </a>
          )}
        </div>
        <Link href="/dashboard" className="mt-2 inline-block text-sm text-brand underline">
          ← Dashboard
        </Link>
      </div>
      <ChatPanel bookingId={booking.id} viewerId={userId} />
    </div>
  );
}
