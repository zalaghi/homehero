import { assertSameOrigin } from "@/server/security/csrf";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import type { IsoDate } from "@/lib/payroll/types";
import { getHolidaySetForEmployee } from "@/server/attendance/holidayLookup";
import { isWeekendInTimeZone } from "@/lib/attendance/calendar";
import { isValidWorkedDay } from "@/lib/payroll/validWorkedDay";
import { toDbDate } from "@/lib/holidays/importers";
import { logAudit } from "@/server/audit/log";
import { getPresignedDownloadUrl } from "@/server/storage/s3";
import { generateAndStoreReceipt, type ReceiptLocale } from "@/server/payroll/receipt";
import { mergeAttendanceRecords } from "@/lib/attendance/merge";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const PatchBody = z.object({
  status: z.enum(["DRAFT", "FINAL", "PAID"]).optional(),
  paidAt: z.string().datetime().nullable().optional(),
  adminNote: z.string().max(2000).nullable().optional(),
  locale: z.enum(["en", "fa", "es", "de"]).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ payPeriodId: string }> }) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { payPeriodId } = await ctx.params;
  const prisma = getPrisma();

  const period = await prisma.payPeriod.findUnique({
    where: { id: payPeriodId },
    include: { employee: true },
  });
  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let receiptDownloadUrl: string | null = null;
  if (period.receiptFileKey) {
    try {
      receiptDownloadUrl = await getPresignedDownloadUrl(period.receiptFileKey);
    } catch (err) {
      console.error("Failed to sign receipt", err);
    }
  }

  const startDate = period.startDate.toISOString().slice(0, 10) as IsoDate;
  const endDate = period.endDate.toISOString().slice(0, 10) as IsoDate;

  const holidaySet = await getHolidaySetForEmployee({
    employeeId: period.employeeId,
    holidayCalendarId: period.employee.holidayCalendarId,
    start: startDate,
    end: endDate,
  });

  const [attendanceDays, cardExpenses, debtTx] = await Promise.all([
    prisma.attendanceDay.findMany({
      where: { employeeId: period.employeeId, date: { gte: toDbDate(startDate), lte: toDbDate(endDate) } },
      orderBy: { date: "asc" },
    }),
    prisma.cardExpense.findMany({
      where: { employeeId: period.employeeId, date: { gte: toDbDate(startDate), lte: toDbDate(endDate) } },
      orderBy: { date: "asc" },
    }),
    prisma.debtTransaction.findMany({
      where: { voidedAt: null, employeeId: period.employeeId, date: { gte: toDbDate(startDate), lte: toDbDate(endDate) } },
      orderBy: { date: "asc" },
    }),
  ]);

  const attendanceMerged = Array.from(mergeAttendanceRecords(attendanceDays).values());

  const attendance = attendanceMerged.map((d) => {
    const date = d.date;
    const isHoliday = holidaySet.has(date);
    const isWeekend = isWeekendInTimeZone(date, period.employee.timezone);
    const validWorkedDay = isValidWorkedDay(date, d.worked, d.authorizedExtra, {
      isHoliday: (x) => holidaySet.has(x),
      isWeekend: (x) => isWeekendInTimeZone(x, period.employee.timezone),
    });
    return {
      id: d.id,
      date,
      worked: d.worked,
      authorizedExtra: d.authorizedExtra,
      validWorkedDay,
      isHoliday,
      isWeekend,
      source: d.source,
    };
  });

  return NextResponse.json({
    period: {
      id: period.id,
      employeeId: period.employeeId,
      employee: {
        firstName: period.employee.firstName,
        lastName: period.employee.lastName,
        currency: period.employee.currency,
        timezone: period.employee.timezone,
      },
      frequency: period.frequency,
      startDate,
      endDate,
      status: period.status,
      paidAt: period.paidAt?.toISOString() ?? null,
      adminNote: period.adminNote ?? null,
      snapshots: {
        validDays: period.validDays,
        dailyRateCents: period.dailyRateCents,
        grossPayCents: period.grossPayCents,
        cardExpensesCents: period.cardExpensesCents,
        loansCents: period.loansCents,
        debtCollectedCents: period.debtCollectedCents,
        debtStartCents: period.debtStartCents,
        debtEndCents: period.debtEndCents,
        netPayCents: period.netPayCents,
        currency: period.currency,
      },
      receiptDownloadUrl,
    },
    attendance,
    cardExpenses: cardExpenses.map((e) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      concept: e.concept,
      amountCents: e.amountCents,
      currency: e.currency,
    })),
    debtTransactions: debtTx.map((t) => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      type: t.type,
      amountCents: t.amountCents,
      currency: t.currency,
      note: t.note ?? null,
    })),
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ payPeriodId: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { payPeriodId } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prisma = getPrisma();
  const existing = await prisma.payPeriod.findUnique({ where: { id: payPeriodId }, include: { employee: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (existing.status === "PAID" && parsed.data.status && parsed.data.status !== "PAID") {
    return NextResponse.json({ error: "Paid periods cannot be reopened. Preserve the payment history." }, { status: 409 });
  }
  const nextStatus = parsed.data.status ?? existing.status;
  if (parsed.data.status) data.status = nextStatus;
  if (nextStatus === "PAID") {
    data.paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : existing.paidAt ?? new Date();
  } else {
    data.paidAt = null;
  }
  if (parsed.data.adminNote !== undefined) data.adminNote = parsed.data.adminNote;

  const updated = await prisma.payPeriod.update({
    where: { id: payPeriodId, status: existing.status },
    data,
  });

  let receiptUrl: string | null = null;
  if (updated.status === "PAID" && updated.paidAt) {
    try {
      const receipt = await generateAndStoreReceipt({
        payPeriodId,
        locale: parsed.data.locale as ReceiptLocale | undefined,
      });
      receiptUrl = receipt.receiptUrl;
    } catch (err) {
      console.error("Failed to generate receipt", err);
    }
  }

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "PAY_PERIOD_UPDATE",
    entityType: "PayPeriod",
    entityId: updated.id,
    metadata: { status: updated.status, paidAt: updated.paidAt?.toISOString() ?? null },
  });

  return NextResponse.json({ ok: true, receiptUrl });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ payPeriodId: string }> }) {
  await assertSameOrigin(); const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { payPeriodId } = await ctx.params;
  const prisma = getPrisma();
  const result = await prisma.$transaction(async tx => {
    const deleted = await tx.payPeriod.deleteMany({ where: { id: payPeriodId, status: "DRAFT", paidAt: null } });
    if (deleted.count) await tx.auditLog.create({ data: { actorUserId: user.userId, actorRole: "ADMIN", action: "PAY_PERIOD_DELETE", entityType: "PayPeriod", entityId: payPeriodId } });
    return deleted;
  });
  if (!result.count) return NextResponse.json({ error: "Only an unpaid draft can be deleted." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
