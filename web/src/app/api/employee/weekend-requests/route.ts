import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { assertSameOrigin } from "@/server/security/csrf";
import { toDbDate } from "@/lib/holidays/importers";
import type { IsoDate } from "@/lib/payroll/types";
import { isWeekendInTimeZone } from "@/lib/attendance/calendar";
import { getHolidaySetForEmployee } from "@/server/attendance/holidayLookup";

const CreateBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const items = await prisma.weekendWorkRequest.findMany({
    where: { employeeId: user.employeeId },
    orderBy: [{ date: "desc" }],
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      date: item.date.toISOString().slice(0, 10),
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const date = parsed.data.date as IsoDate;
  if (date < todayIso()) {
    return NextResponse.json({ error: "Date must be in the future" }, { status: 400 });
  }

  const prisma = getPrisma();
  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: { id: true, timezone: true, holidayCalendarId: true },
  });
  if (!employee) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const holidaySet = await getHolidaySetForEmployee({
    employeeId: user.employeeId,
    holidayCalendarId: employee.holidayCalendarId,
    start: date,
    end: date,
  });
  const isWeekend = isWeekendInTimeZone(date, employee.timezone);
  const isHoliday = holidaySet.has(date);
  if (!isWeekend && !isHoliday) {
    return NextResponse.json({ error: "Work requests must be on a weekend or holiday" }, { status: 400 });
  }

  const existing = await prisma.weekendWorkRequest.findUnique({
    where: {
      employeeId_date: {
        employeeId: user.employeeId,
        date: toDbDate(date),
      },
    },
  });
  if (existing) {
    return NextResponse.json({ id: existing.id, status: existing.status });
  }

  const item = await prisma.weekendWorkRequest.create({
    data: {
      employeeId: user.employeeId,
      date: toDbDate(date),
      status: "PENDING",
    },
  });

  return NextResponse.json({ id: item.id, status: item.status });
}
