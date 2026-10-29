import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { toDbDate } from "@/lib/holidays/importers";
import type { IsoDate } from "@/lib/payroll/types";
import { logAudit } from "@/server/audit/log";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const Query = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  take: z.coerce.number().int().min(1).max(500).default(200),
});

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  concept: z.string().min(1).max(200),
  amountCents: z.number().int().positive(),
  currency: z.string().min(3).max(3).default("EUR"),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: employeeId } = await ctx.params;

  const url = new URL(req.url);
  const q = Query.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!q.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const prisma = getPrisma();
  const where: { employeeId: string; date?: { gte: Date; lte: Date } } = { employeeId };
  if (q.data.start && q.data.end) {
    where.date = {
      gte: toDbDate(q.data.start as IsoDate),
      lte: toDbDate(q.data.end as IsoDate),
    };
  }

  const items = await prisma.cardExpense.findMany({
    where,
    orderBy: { date: "desc" },
    take: q.data.take,
  });

  return NextResponse.json({
    items: items.map((e) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      concept: e.concept,
      amountCents: e.amountCents,
      currency: e.currency,
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: employeeId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prisma = getPrisma();
  const created = await prisma.cardExpense.create({
    data: {
      employeeId,
      date: toDbDate(parsed.data.date as IsoDate),
      concept: parsed.data.concept,
      amountCents: parsed.data.amountCents,
      currency: parsed.data.currency.toUpperCase(),
      createdByUserId: user.userId,
    },
  });

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "CARD_EXPENSE_CREATE",
    entityType: "CardExpense",
    entityId: created.id,
    metadata: { employeeId, date: parsed.data.date, amountCents: parsed.data.amountCents },
  });

  return NextResponse.json({ ok: true, id: created.id });
}

