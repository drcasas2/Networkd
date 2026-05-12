import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StripeOnboardButton from "@/components/StripeOnboardButton";

export default async function StripeOnboardingPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/signin");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/signin");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Get paid via Stripe</h1>
      <p className="text-slate-600">
        We use Stripe Connect (Express) so payouts go directly to your bank.
        Networkd takes a service fee from each booking; you keep the rest.
      </p>
      {user.stripeOnboardingComplete ? (
        <div className="rounded-lg border bg-green-50 p-4 text-sm text-green-900">
          Stripe is connected and ready. You can take bookings.
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-6">
          <p className="mb-4 text-sm text-slate-700">
            You haven&apos;t finished Stripe onboarding yet. Click below to
            continue — it takes about a minute.
          </p>
          <StripeOnboardButton />
        </div>
      )}
    </div>
  );
}
