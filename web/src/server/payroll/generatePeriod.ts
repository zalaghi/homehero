import type { PayFrequency } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import type { IsoDate } from "@/lib/payroll/types";
import { getPayPeriodForDate } from "@/lib/payroll/periods";
import { computePayrollTotals } from "@/lib/payroll/calculate";
import { computeDebtBalanceBeforeDate } from "@/lib/payroll/debt";
import { getHolidaySetForEmployee } from "@/server/attendance/holidayLookup";
import { isWeekendInTimeZone } from "@/lib/attendance/calendar";
import { toDbDate } from "@/lib/holidays/importers";
import { mergeAttendanceRecords } from "@/lib/attendance/merge";

export async function generatePayPeriodForEmployee(input: {
  employeeId: string;
  anchorDate: IsoDate;
  frequency?: PayFrequency;
}): Promise<{ payPeriodId: string }> {
  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: {
      id: true,
      payFrequency: true,
      dailyRateCents: true,
      currency: true,
      timezone: true,
      holidayCalendarId: true,
      openingDebtCents: true,
    },
  });
  if (!employee) throw new Error("Employee not found");

  const freq = input.frequency ?? employee.payFrequency;
  const period = getPayPeriodForDate(input.anchorDate, freq);

  const [attendanceDays, cardExpenses, debtTxAll, holidaySet] = await Promise.all([
    prisma.attendanceDay.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: toDbDate(period.startDate), lte: toDbDate(period.endDate) },
      },
      select: { date: true, worked: true, authorizedExtra: true, source: true },
    }),
    prisma.cardExpense.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: toDbDate(period.startDate), lte: toDbDate(period.endDate) },
      },
      select: { date: true, amountCents: true },
    }),
    prisma.debtTransaction.findMany({
      where: { voidedAt: null, employeeId: employee.id },
      select: { date: true, type: true, amountCents: true },
      orderBy: { date: "asc" },
    }),
    getHolidaySetForEmployee({
      employeeId: employee.id,
      holidayCalendarId: employee.holidayCalendarId,
      start: period.startDate,
      end: period.endDate,
    }),
  ]);

  const mergedAttendance = Array.from(mergeAttendanceRecords(attendanceDays).values());
  const attendanceInputs = mergedAttendance.map((d) => ({
    date: d.date,
    worked: d.worked,
    authorizedExtra: d.authorizedExtra,
  }));
  const expenseInputs = cardExpenses.map((e) => ({
    date: e.date.toISOString().slice(0, 10) as IsoDate,
    amountCents: e.amountCents,
  }));
  const debtInputs = debtTxAll.map((t) => ({
    date: t.date.toISOString().slice(0, 10) as IsoDate,
    type: t.type,
    amountCents: t.amountCents,
  }));

  const debtStartCents = computeDebtBalanceBeforeDate(
    debtInputs,
    period.startDate,
    employee.openingDebtCents,
  );

  const totals = computePayrollTotals({
    period: { startDate: period.startDate, endDate: period.endDate },
    dailyRateCents: employee.dailyRateCents,
    debtStartCents,
    attendanceDays: attendanceInputs,
    cardExpenses: expenseInputs,
    debtTransactions: debtInputs,
    validityContext: {
      isHoliday: (d) => holidaySet.has(d),
      isWeekend: (d) => isWeekendInTimeZone(d, employee.timezone),
    },
  });

  // A database insert with conflict handling establishes one period under concurrent requests. Only an
  // atomic DRAFT update can change totals, preserving a concurrently finalized period.
  const snapshot = {
    validDays: totals.validDays, dailyRateCents: employee.dailyRateCents,
    grossPayCents: totals.grossPayCents, cardExpensesCents: totals.cardExpensesCents,
    loansCents: totals.loansCents, debtCollectedCents: totals.debtCollectedCents,
    debtStartCents: totals.debtStartCents, debtEndCents: totals.debtEndCents,
    netPayCents: totals.netPayCents, currency: employee.currency,
  };
  const key = { employeeId: employee.id, startDate: toDbDate(period.startDate), endDate: toDbDate(period.endDate) };
  await prisma.payPeriod.createMany({
    data: [{ ...key, frequency: freq, status: "DRAFT", ...snapshot }],
    skipDuplicates: true,
  });
  const row = await prisma.payPeriod.findUniqueOrThrow({ where: { employeeId_startDate_endDate: key }, select: { id: true } });
  await prisma.payPeriod.updateMany({ where: { id: row.id, status: "DRAFT", paidAt: null }, data: snapshot });
  return { payPeriodId: row.id };
}
