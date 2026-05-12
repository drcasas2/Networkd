import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="space-y-6 py-12 text-center">
        <h1 className="text-balance text-5xl font-bold tracking-tight">
          Pay an expert. Get an hour. Go.
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-lg text-slate-600">
          Networkd is the no-nonsense paid networking platform. Browse experts,
          book a slot, pay through Stripe, and join the Google Meet — all in
          under two minutes.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/experts"
            className="rounded-md bg-brand px-5 py-3 text-white hover:bg-brand-dark"
          >
            Find an expert
          </Link>
          <Link
            href="/signin"
            className="rounded-md border border-slate-300 px-5 py-3 hover:bg-slate-100"
          >
            Become an expert
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            t: "1. Set your rate",
            d: "Sign in with Google, connect Stripe, and set your hourly consulting rate.",
          },
          {
            t: "2. Get booked",
            d: "Clients pick an open slot from your Google Calendar and pay upfront via Stripe.",
          },
          {
            t: "3. Meet & chat",
            d: "We auto-create a Google Meet and a private chat. You get paid out to your bank.",
          },
        ].map((card) => (
          <div key={card.t} className="rounded-lg border bg-white p-6">
            <h3 className="mb-2 font-semibold">{card.t}</h3>
            <p className="text-sm text-slate-600">{card.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
