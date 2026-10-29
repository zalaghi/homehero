import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import type { IsoDate } from "@/lib/payroll/types";
import { listIsoDatesInclusive, isWeekendInTimeZone } from "@/lib/attendance/calendar";
import { getHolidaySetForEmployee } from "@/server/attendance/holidayLookup";
import { isValidWorkedDay } from "@/lib/payroll/validWorkedDay";
import { toDbDate } from "@/lib/holidays/importers";
import { mergeAttendanceRecords } from "@/lib/attendance/merge";
import {
  endOfIsoWeekInTimeZone,
  isoDateNowInTimeZone,
  startOfIsoWeekInTimeZone,
  startOfMonth,
} from "@/server/employee/stats";
import { formatIsoDateUTC, parseIsoDate } from "@/lib/payroll/date";

const Query = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cursor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period: z.enum(["weekly", "monthly"]).optional(),
});

function endOfMonth(date: IsoDate): IsoDate {
  const d = parseIsoDate(date);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return formatIsoDateUTC(last);
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = Query.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!q.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  let start = q.data.start as IsoDate | undefined;
  let end = q.data.end as IsoDate | undefined;
  const employeeId = user.employeeId;

  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, timezone: true, holidayCalendarId: true },
  });
  if (!employee) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cursor = (q.data.cursor as IsoDate | undefined) ?? isoDateNowInTimeZone(employee.timezone);
  if (q.data.period === "weekly") {
    start = startOfIsoWeekInTimeZone(cursor, employee.timezone);
    end = endOfIsoWeekInTimeZone(cursor, employee.timezone);
  } else if (q.data.period === "monthly") {
    start = startOfMonth(cursor);
    end = endOfMonth(cursor);
  }

  if (!start || !end) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const [holidaySet, days] = await Promise.all([
    getHolidaySetForEmployee({
      employeeId,
      holidayCalendarId: employee.holidayCalendarId,
      start,
      end,
    }),
    prisma.attendanceDay.findMany({
      where: { employeeId, date: { gte: toDbDate(start), lte: toDbDate(end) } },
      orderBy: { date: "asc" },
    }),
  ]);

  const dayByIso = mergeAttendanceRecords(days);

  const allDates = listIsoDatesInclusive(start, end);
  const items = allDates.map((date) => {
    const existing = dayByIso.get(date);
    const isHoliday = holidaySet.has(date);
    const isWeekend = isWeekendInTimeZone(date, employee.timezone);
    const worked = existing?.worked ?? false;
    const authorizedExtra = existing?.authorizedExtra ?? false;
    const validWorkedDay = isValidWorkedDay(date, worked, authorizedExtra, {
      isHoliday: (d) => holidaySet.has(d),
      isWeekend: (d) => isWeekendInTimeZone(d, employee.timezone),
    });
    return {
      date,
      worked,
      authorizedExtra,
      validWorkedDay,
      isHoliday,
      isWeekend,
    };
  });

  return NextResponse.json({ items, period: { start, end } });
}
