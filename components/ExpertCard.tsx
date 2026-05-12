import Link from "next/link";
import type { User } from "@prisma/client";
import { formatCents } from "@/lib/format";

export default function ExpertCard({ expert }: { expert: User }) {
  return (
    <Link
      href={`/experts/${expert.id}`}
      className="block rounded-lg border bg-white p-5 transition hover:border-brand hover:shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{expert.name ?? "Expert"}</h3>
          {expert.headline && (
            <p className="text-sm text-slate-600">{expert.headline}</p>
          )}
          {expert.expertiseTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {expert.expertiseTags.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="whitespace-nowrap text-right">
          <div className="font-semibold">
            {expert.hourlyRateCents
              ? `${formatCents(expert.hourlyRateCents)}/hr`
              : "—"}
          </div>
        </div>
      </div>
    </Link>
  );
}
