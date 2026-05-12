import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/format";
import TimeSlotPicker from "@/components/TimeSlotPicker";

export default async function BookPage({
  params,
}: {
  params: Promise<{ expertId: string }>;
}) {
  const { expertId } = await params;
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect(`/signin`);

  const expert = await prisma.user.findUnique({ where: { id: expertId } });
  if (!expert || (expert.role !== "EXPERT" && expert.role !== "BOTH")) {
    notFound();
  }
  if (!expert.stripeOnboardingComplete || !expert.hourlyRateCents) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border bg-white p-6">
        This expert isn&apos;t accepting bookings yet.
      </div>
    );
  }
  if (expert.id === userId) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border bg-white p-6">
        You can&apos;t book yourself.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Book {expert.name ?? "Expert"}</h1>
        <p className="text-slate-600">
          {formatCents(expert.hourlyRateCents)}/hr · Times shown in your local
          timezone.
        </p>
      </div>
      <TimeSlotPicker
        expertId={expert.id}
        hourlyRateCents={expert.hourlyRateCents}
      />
    </div>
  );
}
