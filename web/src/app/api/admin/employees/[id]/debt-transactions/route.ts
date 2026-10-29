import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { toDbDate } from "@/lib/holidays/importers";
import { logAudit } from "@/server/audit/log";
import { calculateDebtSnapshot } from "@/server/debt/calc";
import type { IsoDate } from "@/lib/payroll/types";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const Query = z.object({
  take: z.coerce.number().int().min(1).max(500).default(200),
});

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["LOAN_GIVEN", "DEBT_COLLECTED"]),
  amountCents: z.number().int().positive(),
  currency: z.string().min(3).max(3).default("EUR"),
  note: z.string().max(1000).optional().nullable(),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: employeeId } = await ctx.params;

  const url = new URL(req.url);
  const q = Query.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!q.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const prisma = getPrisma();
  const [items, employee, auditLogs] = await Promise.all([
    prisma.debtTransaction.findMany({
      where: { employeeId },
      orderBy: { date: "desc" },
      take: q.data.take,
      include: {
        voidedByUser: { select: { id: true, email: true } },
        createdByUser: { select: { id: true, email: true } },
      },
    }),
    prisma.employee.findUnique({ where: { id: employeeId }, select: { openingDebtCents: true } }),
    prisma.auditLog.findMany({
      where: { entityType: "DebtTransaction" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        actorUser: { select: { id: true, email: true } },
      },
    }),
  ]);

  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = auditLogs
    .map((entry) => ({
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt.toISOString(),
      actorRole: entry.actorRole,
      actorUserId: entry.actorUserId,
      actorName: entry.actorUser?.email ?? null,
      metadata: entry.metadataJson ? JSON.parse(entry.metadataJson) : null,
    }))
    .filter((entry) => entry.metadata && entry.metadata.employeeId === employeeId);

  const snapshot = calculateDebtSnapshot({
    openingDebtCents: employee.openingDebtCents,
    transactions: items,
  });

  return NextResponse.json({
    openingDebtCents: employee.openingDebtCents,
    items: items.map((t) => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      type: t.type,
      amountCents: t.amountCents,
      currency: t.currency,
      note: t.note,
      voidedAt: t.voidedAt ? t.voidedAt.toISOString() : null,
      voidedBy: t.voidedByUser ? t.voidedByUser.email ?? null : null,
    })),
    debtBalance: snapshot.balanceCents,
    audit: logs,
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
  const created = await prisma.debtTransaction.create({
    data: {
      employeeId,
      date: toDbDate(parsed.data.date as IsoDate),
      type: parsed.data.type,
      amountCents: parsed.data.amountCents,
      currency: parsed.data.currency.toUpperCase(),
      note: parsed.data.note ?? null,
      createdByUserId: user.userId,
    },
  });

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "DEBT_TX_CREATE",
    entityType: "DebtTransaction",
    entityId: created.id,
    metadata: { employeeId, date: parsed.data.date, type: parsed.data.type, amountCents: parsed.data.amountCents },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
