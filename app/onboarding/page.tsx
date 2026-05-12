import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OnboardingForm from "@/components/OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/signin");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/signin");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Set up your profile</h1>
      <p className="text-slate-600">
        Tell people what you do. If you want to take paid bookings, choose
        Expert and set a rate — you can connect Stripe next.
      </p>
      <OnboardingForm
        initial={{
          role: user.role,
          headline: user.headline ?? "",
          bio: user.bio ?? "",
          expertiseTags: user.expertiseTags,
          hourlyRateCents: user.hourlyRateCents ?? 0,
          timezone: user.timezone,
        }}
      />
    </div>
  );
}
