import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BookingRow from "@/components/BookingRow";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/signin");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/signin");

  const [asClient, asExpert] = await Promise.all([
    prisma.booking.findMany({
      where: { clientId: userId },
      orderBy: { startsAt: "desc" },
      include: { expert: true },
      take: 50,
    }),
    prisma.booking.findMany({
      where: { expertId: userId },
      orderBy: { startsAt: "desc" },
      include: { client: true },
      take: 50,
    }),
  ]);

  const isExpertRole = user.role === "EXPERT" || user.role === "BOTH";

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/onboarding" className="rounded border px-3 py-1 hover:bg-slate-100">
            Edit profile
          </Link>
          {isExpertRole && (
            <Link
              href="/dashboard/expert/onboarding"
              className="rounded border px-3 py-1 hover:bg-slate-100"
            >
              {user.stripeOnboardingComplete ? "Stripe ✓" : "Connect Stripe"}
            </Link>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Your bookings</h2>
        {asClient.length === 0 ? (
          <div className="rounded border bg-white p-6 text-sm text-slate-600">
            You haven&apos;t booked anyone yet —{" "}
            <Link href="/experts" className="text-brand underline">
              browse experts
            </Link>
            .
          </div>
        ) : (
          <ul className="space-y-2">
            {asClient.map((b) => (
              <li key={b.id}>
                <BookingRow
                  booking={b}
                  counterparty={b.expert}
                  viewerRole="client"
                  viewerTz={user.timezone}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {isExpertRole && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Sessions you&apos;re hosting</h2>
          {asExpert.length === 0 ? (
            <div className="rounded border bg-white p-6 text-sm text-slate-600">
              No clients yet. Share your profile link: <code>/experts/{userId}</code>
            </div>
          ) : (
            <ul className="space-y-2">
              {asExpert.map((b) => (
                <li key={b.id}>
                  <BookingRow
                    booking={b}
                    counterparty={b.client}
                    viewerRole="expert"
                    viewerTz={user.timezone}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
