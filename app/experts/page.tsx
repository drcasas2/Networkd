import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ExpertCard from "@/components/ExpertCard";

export const dynamic = "force-dynamic";

export default async function ExpertsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;

  const experts = await prisma.user.findMany({
    where: {
      role: { in: ["EXPERT", "BOTH"] },
      stripeOnboardingComplete: true,
      hourlyRateCents: { not: null, gt: 0 },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { headline: { contains: q, mode: "insensitive" } },
              { bio: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(tag ? { expertiseTags: { has: tag } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Browse experts</h1>
          <p className="text-slate-600">Book a paid session in minutes.</p>
        </div>
        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, headline…"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark"
          >
            Search
          </button>
        </form>
      </div>

      {tag && (
        <div className="text-sm">
          Filtering by tag: <span className="font-medium">{tag}</span>{" "}
          <Link href="/experts" className="text-brand underline">
            clear
          </Link>
        </div>
      )}

      {experts.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-slate-600">
          No experts match yet. Be the first —{" "}
          <Link href="/onboarding" className="text-brand underline">
            set up your profile
          </Link>
          .
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {experts.map((e) => (
            <li key={e.id}>
              <ExpertCard expert={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
