import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import type { IsoDate } from "@/lib/payroll/types";
import { getHolidaySetForEmployee } from "@/server/attendance/holidayLookup";
import { isWeekendInTimeZone } from "@/lib/attendance/calendar";
import { mergeAttendanceRecords } from "@/lib/attendance/merge";
import { isValidWorkedDay } from "@/lib/payroll/validWorkedDay";
import { toDbDate } from "@/lib/holidays/importers";
import { getPresignedDownloadUrl } from "@/server/storage/s3";

export async function GET(_req: Request, ctx: { params: Promise<{ payPeriodId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { payPeriodId } = await ctx.params;
  const prisma = getPrisma();

  const period = await prisma.payPeriod.findUnique({
    where: { id: payPeriodId },
    include: { employee: true },
  });
  if (!period || period.employeeId !== user.employeeId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
      date,
      worked: d.worked,
      authorizedExtra: d.authorizedExtra,
      validWorkedDay,
      isHoliday,
      isWeekend,
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

