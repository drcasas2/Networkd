import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ExpertProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expert = await prisma.user.findUnique({ where: { id } });
  if (!expert || (expert.role !== "EXPERT" && expert.role !== "BOTH")) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-lg border bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold">{expert.name ?? "Expert"}</h1>
            {expert.headline && (
              <p className="text-slate-600">{expert.headline}</p>
            )}
            {expert.expertiseTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {expert.expertiseTags.map((t) => (
                  <Link
                    key={t}
                    href={`/experts?tag=${encodeURIComponent(t)}`}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold">
              {expert.hourlyRateCents
                ? `${formatCents(expert.hourlyRateCents)}/hr`
                : "Not yet priced"}
            </div>
            {expert.stripeOnboardingComplete && expert.hourlyRateCents ? (
              <Link
                href={`/book/${expert.id}`}
                className="mt-3 inline-block rounded-md bg-brand px-5 py-2 text-white hover:bg-brand-dark"
              >
                Book a session
              </Link>
            ) : (
              <span className="mt-3 inline-block rounded-md border px-5 py-2 text-sm text-slate-500">
                Not accepting bookings
              </span>
            )}
          </div>
        </div>
        {expert.bio && (
          <p className="mt-6 whitespace-pre-wrap text-slate-700">{expert.bio}</p>
        )}
      </div>
    </div>
  );
}
