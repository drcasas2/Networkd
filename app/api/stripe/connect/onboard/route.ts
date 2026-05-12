import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, appUrl } from "@/lib/stripe";

export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user?.email || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!user.stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: "individual",
      metadata: { userId: user.id },
    });
    user = await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: account.id },
    });
  }

  const link = await stripe.accountLinks.create({
    account: user.stripeAccountId!,
    refresh_url: `${appUrl()}/dashboard/expert/onboarding?refresh=1`,
    return_url: `${appUrl()}/dashboard/expert/onboarding?done=1`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}
