"use client";

import { useState } from "react";

export default function StripeOnboardButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setError(data.error ?? "Could not start Stripe onboarding");
      setBusy(false);
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="space-y-2">
      <button
        onClick={onClick}
        disabled={busy}
        className="rounded bg-brand px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "Redirecting…" : "Continue with Stripe"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
