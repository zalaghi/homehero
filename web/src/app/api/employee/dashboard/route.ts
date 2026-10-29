import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import type { IsoDate } from "@/lib/payroll/types";
import { getHolidaySetForEmployee } from "@/server/attendance/holidayLookup";
import { toDbDate } from "@/lib/holidays/importers";
import { isWeekendInTimeZone } from "@/lib/attendance/calendar";
import {
  endOfIsoWeekInTimeZone,
  isoDateNowInTimeZone,
  startOfIsoWeekInTimeZone,
  startOfMonth,
  startOfYear,
  summarizeForPeriod,
} from "@/server/employee/stats";
import { mergeAttendanceRecords } from "@/lib/attendance/merge";
import { calculateDebtSnapshot } from "@/server/debt/calc";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      currency: true,
      timezone: true,
      payFrequency: true,
      dailyRateCents: true,
      holidayCalendarId: true,
      publicId: true,
      openingDebtCents: true,
    },
  });
  if (!employee) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = isoDateNowInTimeZone(employee.timezone);
  const weekStart = startOfIsoWeekInTimeZone(today, employee.timezone);
  const weekEnd = endOfIsoWeekInTimeZone(today, employee.timezone);
  const monthStart = startOfMonth(today);
  const yearStart = startOfYear(today);

  const [
    holidayWeek,
    holidayMonth,
    holidayYear,
    attendanceYear,
    expensesYear,
    debtAll,
    todoOpenCount,
    essentialsNeedCount,
    absenceToday,
  ] = await Promise.all([
    getHolidaySetForEmployee({
      employeeId: employee.id,
      holidayCalendarId: employee.holidayCalendarId,
      start: weekStart,
      end: weekEnd,
    }),
    getHolidaySetForEmployee({
      employeeId: employee.id,
      holidayCalendarId: employee.holidayCalendarId,
      start: monthStart,
      end: today,
    }),
    getHolidaySetForEmployee({
      employeeId: employee.id,
      holidayCalendarId: employee.holidayCalendarId,
      start: yearStart,
      end: today,
    }),
    prisma.attendanceDay.findMany({
      where: { employeeId: employee.id, date: { gte: toDbDate(yearStart), lte: toDbDate(today) } },
      select: { date: true, worked: true, authorizedExtra: true, source: true },
    }),
    prisma.cardExpense.findMany({
      where: { employeeId: employee.id, date: { gte: toDbDate(yearStart), lte: toDbDate(today) } },
      select: { date: true, amountCents: true },
    }),
    prisma.debtTransaction.findMany({
      where: { employeeId: employee.id },
      orderBy: { date: "asc" },
      select: { date: true, type: true, amountCents: true, voidedAt: true },
    }),
    prisma.todoItem.count({
      where: { assignedToEmployeeId: employee.id, status: "OPEN" },
    }),
    prisma.employeeEssentialNeed.count({
      where: { employeeId: employee.id },
    }),
    prisma.absence.findFirst({
      where: {
        employeeId: employee.id,
        startDate: { lte: toDbDate(today) },
        endDate: { gte: toDbDate(today) },
      },
      select: { id: true },
    }),
  ]);

  const attendanceMerged = Array.from(mergeAttendanceRecords(attendanceYear).values());
  const attendance = attendanceMerged.map((d) => ({
    date: d.date,
    worked: d.worked,
    authorizedExtra: d.authorizedExtra,
  }));
  const attendanceToday = attendanceMerged.find((d) => d.date === today);
  const expenses = expensesYear.map((e) => ({
    date: e.date.toISOString().slice(0, 10) as IsoDate,
    amountCents: e.amountCents,
  }));
  const debtTxAll = debtAll.map((t) => ({
    date: t.date.toISOString().slice(0, 10) as IsoDate,
    type: t.type,
    amountCents: t.amountCents,
    voidedAt: t.voidedAt,
  }));
  const debtSnapshot = calculateDebtSnapshot({
    openingDebtCents: employee.openingDebtCents,
    transactions: debtTxAll,
  });

  const week = summarizeForPeriod({
    startDate: weekStart,
    endDate: weekEnd,
    dailyRateCents: employee.dailyRateCents,
    timeZone: employee.timezone,
    holidaySet: holidayWeek,
    attendanceDays: attendance,
    cardExpenses: expenses,
    debtTransactionsAll: debtSnapshot.activeTransactions,
    openingDebtCents: employee.openingDebtCents,
  });

  const month = summarizeForPeriod({
    startDate: monthStart,
    endDate: today,
    dailyRateCents: employee.dailyRateCents,
    timeZone: employee.timezone,
    holidaySet: holidayMonth,
    attendanceDays: attendance,
    cardExpenses: expenses,
    debtTransactionsAll: debtSnapshot.activeTransactions,
    openingDebtCents: employee.openingDebtCents,
  });

  const year = summarizeForPeriod({
    startDate: yearStart,
    endDate: today,
    dailyRateCents: employee.dailyRateCents,
    timeZone: employee.timezone,
    holidaySet: holidayYear,
    attendanceDays: attendance,
    cardExpenses: expenses,
    debtTransactionsAll: debtSnapshot.activeTransactions,
    openingDebtCents: employee.openingDebtCents,
  });

  const debtPaidTotal = debtSnapshot.paidTotalCents;
  const debtBalance = debtSnapshot.balanceCents;

  const todayStatus = absenceToday
    ? "AWAY"
    : holidayWeek.has(today)
      ? "HOLIDAY"
      : isWeekendInTimeZone(today, employee.timezone)
        ? "WEEKEND"
        : attendanceToday?.worked
          ? "WORKING"
          : "OFF";

  return NextResponse.json({
    employee: {
      publicId: employee.publicId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      currency: employee.currency,
      timezone: employee.timezone,
      payFrequency: employee.payFrequency,
      dailyRateCents: employee.dailyRateCents,
    },
    today,
    todayStatus,
    ranges: { weekStart, weekEnd, monthStart, yearStart },
    stats: {
      week,
      month,
      year,
      debtPaidTotal,
      debtBalance,
    },
    todos: {
      openCount: todoOpenCount,
    },
    essentials: {
      neededSoonCount: essentialsNeedCount,
    },
  });
}
