"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking, User } from "@prisma/client";
import { formatCents, formatDateTime } from "@/lib/format";

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-green-100 text-green-800",
  COMPLETED: "bg-slate-100 text-slate-700",
  CANCELED: "bg-red-100 text-red-800",
  REFUNDED: "bg-red-100 text-red-800",
};

export default function BookingRow({
  booking,
  counterparty,
  viewerRole,
  viewerTz,
}: {
  booking: Booking;
  counterparty: User;
  viewerRole: "client" | "expert";
  viewerTz: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCancel =
    booking.status === "CONFIRMED" || booking.status === "PENDING_PAYMENT";
  const canChat = booking.status === "CONFIRMED" || booking.status === "COMPLETED";

  async function cancel() {
    if (!confirm("Cancel this booking? Paid sessions will be refunded.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Cancel failed");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {viewerRole === "client" ? "with" : "for"} {counterparty.name ?? "User"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              STATUS_COLORS[booking.status] ?? "bg-slate-100"
            }`}
          >
            {booking.status.replace("_", " ").toLowerCase()}
          </span>
        </div>
        <div className="text-sm text-slate-600">
          {formatDateTime(booking.startsAt, viewerTz)} · {booking.durationMinutes}m ·{" "}
          {formatCents(booking.priceCents)}
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {booking.meetLink && booking.status === "CONFIRMED" && (
          <a
            href={booking.meetLink}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-dark"
          >
            Join Meet
          </a>
        )}
        {canChat && (
          <Link
            href={`/chat/${booking.id}`}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Chat
          </Link>
        )}
        {canCancel && (
          <button
            onClick={cancel}
            disabled={busy}
            className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {busy ? "Canceling…" : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}
