import type { IsoDate } from "@/lib/payroll/types";
import { getPrisma } from "@/server/db/prisma";
import { toDbDate } from "@/lib/holidays/importers";

export async function getHolidaySetForEmployee(input: {
  employeeId: string;
  holidayCalendarId: string | null;
  start: IsoDate;
  end: IsoDate;
}): Promise<Set<IsoDate>> {
  if (!input.holidayCalendarId) return new Set<IsoDate>();
  const prisma = getPrisma();
  const holidays = await prisma.holiday.findMany({
    where: {
      calendarId: input.holidayCalendarId,
      date: { gte: toDbDate(input.start), lte: toDbDate(input.end) },
    },
    select: { date: true },
  });

  const set = new Set<IsoDate>();
  for (const h of holidays) {
    set.add(h.date.toISOString().slice(0, 10) as IsoDate);
  }
  return set;
}

