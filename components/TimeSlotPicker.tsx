"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCents } from "@/lib/format";

type Busy = { start: string; end: string };

const SLOT_MINUTES = 60;
const DAYS_AHEAD = 7;
const DAY_START_HOUR = 9; // expert local 9am
const DAY_END_HOUR = 18; // expert local 6pm

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function overlapsBusy(start: Date, end: Date, busy: Busy[]): boolean {
  return busy.some((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return start.getTime() < be && end.getTime() > bs;
  });
}

export default function TimeSlotPicker({
  expertId,
  hourlyRateCents,
}: {
  expertId: string;
  hourlyRateCents: number;
}) {
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const range = useMemo(() => {
    const from = startOfDay(new Date());
    const to = new Date(from.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
    return { from, to };
  }, []);

  useEffect(() => {
    const url = new URL("/api/calendar/freebusy", window.location.origin);
    url.searchParams.set("expertId", expertId);
    url.searchParams.set("from", range.from.toISOString());
    url.searchParams.set("to", range.to.toISOString());
    fetch(url.toString())
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Failed");
        return r.json();
      })
      .then((data) => setBusy(data.busy ?? []))
      .catch((e) => setError(String(e.message ?? e)));
  }, [expertId, range.from, range.to]);

  const days = useMemo(() => {
    const out: { day: Date; slots: Date[] }[] = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const day = new Date(range.from.getTime() + i * 24 * 60 * 60 * 1000);
      const slots: Date[] = [];
      for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
        const start = new Date(day);
        start.setHours(h, 0, 0, 0);
        if (start.getTime() < Date.now()) continue;
        slots.push(start);
      }
      out.push({ day, slots });
    }
    return out;
  }, [range.from]);

  async function book() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expertId,
        startsAt: selected.toISOString(),
        durationMinutes: SLOT_MINUTES,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setError(data.error ?? "Could not start checkout");
      setSubmitting(false);
      return;
    }
    window.location.href = data.url;
  }

  if (error) {
    return <div className="rounded border bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }
  if (!busy) {
    return <div className="text-sm text-slate-500">Loading availability…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {days.map(({ day, slots }) => (
          <div key={day.toISOString()} className="rounded border bg-white p-3">
            <div className="mb-2 text-sm font-medium">
              {day.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
            <div className="flex flex-col gap-1">
              {slots.length === 0 && (
                <div className="text-xs text-slate-400">—</div>
              )}
              {slots.map((s) => {
                const end = new Date(s.getTime() + SLOT_MINUTES * 60_000);
                const taken = overlapsBusy(s, end, busy);
                const isSelected = selected?.getTime() === s.getTime();
                return (
                  <button
                    key={s.toISOString()}
                    type="button"
                    disabled={taken}
                    onClick={() => setSelected(s)}
                    className={`rounded border px-2 py-1 text-sm ${
                      taken
                        ? "cursor-not-allowed bg-slate-100 text-slate-400"
                        : isSelected
                        ? "border-brand bg-brand text-white"
                        : "hover:border-brand"
                    }`}
                  >
                    {s.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-white p-4">
        <div className="text-sm">
          {selected ? (
            <>
              Selected:{" "}
              <span className="font-medium">
                {selected.toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>{" "}
              · {SLOT_MINUTES} min · {formatCents(hourlyRateCents)}
            </>
          ) : (
            "Pick a time slot above."
          )}
        </div>
        <button
          disabled={!selected || submitting}
          onClick={book}
          className="rounded bg-brand px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? "Redirecting…" : "Pay & book"}
        </button>
      </div>
    </div>
  );
}
