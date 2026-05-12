import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  role: z.enum(["CLIENT", "EXPERT", "BOTH"]),
  headline: z.string().max(200).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  expertiseTags: z.array(z.string().min(1).max(40)).max(20).optional(),
  hourlyRateCents: z.number().int().min(0).max(10_000_00).optional().nullable(),
  timezone: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const data = parsed.data;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      role: data.role,
      headline: data.headline ?? undefined,
      bio: data.bio ?? undefined,
      expertiseTags: data.expertiseTags ?? undefined,
      hourlyRateCents: data.hourlyRateCents ?? undefined,
      timezone: data.timezone ?? undefined,
      onboardingComplete: true,
    },
  });
  return NextResponse.json({ user });
}
