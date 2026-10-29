import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import type { IsoDate } from "@/lib/payroll/types";
import { listIsoDatesInclusive, isWeekendInTimeZone } from "@/lib/attendance/calendar";
import { getHolidaySetForEmployee } from "@/server/attendance/holidayLookup";
import { isValidWorkedDay } from "@/lib/payroll/validWorkedDay";
import { logAudit } from "@/server/audit/log";
import { toDbDate } from "@/lib/holidays/importers";
import { mergeAttendanceRecords } from "@/lib/attendance/merge";
import { buildAttendanceAuditMetadata } from "@/server/attendance/audit";
import {
  endOfIsoWeekInTimeZone,
  isoDateNowInTimeZone,
  startOfIsoWeekInTimeZone,
  startOfMonth,
} from "@/server/employee/stats";
import { formatIsoDateUTC, parseIsoDate } from "@/lib/payroll/date";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

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

const PatchBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  worked: z.boolean(),
  authorizedExtra: z.boolean(),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: employeeId } = await ctx.params;
  const url = new URL(req.url);
  const q = Query.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!q.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  let start = q.data.start as IsoDate | undefined;
  let end = q.data.end as IsoDate | undefined;

  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, timezone: true, holidayCalendarId: true },
  });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (q.data.period) {
    const cursor = (q.data.cursor as IsoDate | undefined) ?? isoDateNowInTimeZone(employee.timezone);
    if (q.data.period === "weekly") {
      start = startOfIsoWeekInTimeZone(cursor, employee.timezone);
      end = endOfIsoWeekInTimeZone(cursor, employee.timezone);
    } else {
      start = startOfMonth(cursor);
      end = endOfMonth(cursor);
    }
  }

  if (!start || !end) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

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
  const weekendRequests = await prisma.weekendWorkRequest.findMany({
    where: { employeeId, date: { gte: toDbDate(start), lte: toDbDate(end) } },
    orderBy: { date: "asc" },
    select: { id: true, date: true, status: true },
  });
  const weekendRequestByDate = new Map(
    weekendRequests.map((request) => [request.date.toISOString().slice(0, 10), request]),
  );

  const allDates = listIsoDatesInclusive(start, end);
  const items = allDates.map((date) => {
    const existing = dayByIso.get(date);
    const weekendRequest = weekendRequestByDate.get(date) ?? null;
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
      source: existing?.source ?? "RESOLVED",
      firstEntryTime: existing?.firstEntryTime?.toISOString() ?? null,
      lastExitTime: existing?.lastExitTime?.toISOString() ?? null,
      uncertainty: existing?.uncertainty ?? false,
      weekendRequest: weekendRequest
        ? {
            id: weekendRequest.id,
            status: weekendRequest.status,
          }
        : null,
    };
  });

  return NextResponse.json({ items, period: { start, end } });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: employeeId } = await ctx.params;
  const prisma = getPrisma();

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const date = parsed.data.date as IsoDate;
  const previous = await prisma.attendanceDay.findUnique({
    where: { employeeId_date: { employeeId, date: toDbDate(date) } },
    select: { id: true, worked: true, authorizedExtra: true },
  });

  const updated = await prisma.attendanceDay.upsert({
    where: { employeeId_date: { employeeId, date: toDbDate(date) } },
    create: {
      employeeId,
      date: toDbDate(date),
      worked: parsed.data.worked,
      authorizedExtra: parsed.data.authorizedExtra,
      source: "MANUAL",
      manualOverrideByUserId: user.userId,
    },
    update: {
      worked: parsed.data.worked,
      authorizedExtra: parsed.data.authorizedExtra,
      source: "MANUAL",
      manualOverrideByUserId: user.userId,
    },
  });

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "ATTENDANCE_MANUAL_SET",
    entityType: "AttendanceDay",
    entityId: updated.id,
    metadata: buildAttendanceAuditMetadata({
      employeeId,
      date,
      previous: previous
        ? { worked: previous.worked, authorizedExtra: previous.authorizedExtra }
        : null,
      next: {
        worked: parsed.data.worked,
        authorizedExtra: parsed.data.authorizedExtra,
      },
    }),
  });

  return NextResponse.json({ ok: true });
}
