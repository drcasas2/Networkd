"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  role: "CLIENT" | "EXPERT" | "BOTH";
  headline: string;
  bio: string;
  expertiseTags: string[];
  hourlyRateCents: number;
  timezone: string;
};

export default function OnboardingForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [role, setRole] = useState<Initial["role"]>(initial.role);
  const [headline, setHeadline] = useState(initial.headline);
  const [bio, setBio] = useState(initial.bio);
  const [tags, setTags] = useState(initial.expertiseTags.join(", "));
  const [rate, setRate] = useState(
    initial.hourlyRateCents ? (initial.hourlyRateCents / 100).toString() : "",
  );
  const [timezone, setTimezone] = useState(
    initial.timezone ||
      (typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC"),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExpert = role === "EXPERT" || role === "BOTH";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        headline: headline || null,
        bio: bio || null,
        expertiseTags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        hourlyRateCents: isExpert && rate ? Math.round(Number(rate) * 100) : null,
        timezone,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save");
      setBusy(false);
      return;
    }
    router.push(isExpert ? "/dashboard/expert/onboarding" : "/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium">I want to…</label>
        <div className="flex gap-2">
          {(["CLIENT", "EXPERT", "BOTH"] as const).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setRole(r)}
              className={`rounded border px-3 py-1.5 text-sm ${
                role === r ? "border-brand bg-brand text-white" : "border-slate-300"
              }`}
            >
              {r === "CLIENT" ? "Book experts" : r === "EXPERT" ? "Get booked" : "Both"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Headline</label>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="e.g. Staff engineer, ex-Stripe"
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
      </div>

      {isExpert && (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Expertise tags (comma separated)
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="payments, infra, hiring"
              className="w-full rounded border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Hourly rate (USD)
            </label>
            <input
              type="number"
              min={0}
              step={5}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-40 rounded border border-slate-300 px-3 py-2"
            />
          </div>
        </>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Timezone</label>
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-brand px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
