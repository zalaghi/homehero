import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const Query = z.object({
  take: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: employeeId } = await ctx.params;

  const url = new URL(req.url);
  const q = Query.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!q.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const prisma = getPrisma();
  const items = await prisma.payPeriod.findMany({
    where: { employeeId },
    orderBy: { startDate: "desc" },
    take: q.data.take,
  });

  return NextResponse.json({
    items: items.map((p) => ({
      id: p.id,
      frequency: p.frequency,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate.toISOString().slice(0, 10),
      status: p.status,
      validDays: p.validDays,
      grossPayCents: p.grossPayCents,
      cardExpensesCents: p.cardExpensesCents,
      loansCents: p.loansCents,
      debtCollectedCents: p.debtCollectedCents,
      netPayCents: p.netPayCents,
      currency: p.currency,
      paidAt: p.paidAt?.toISOString() ?? null,
      adminNote: p.adminNote ?? null,
    })),
  });
}

