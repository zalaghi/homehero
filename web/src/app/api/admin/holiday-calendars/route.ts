import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { logAudit } from "@/server/audit/log";

const CalendarInput = z.object({
  name: z.string().min(1).max(120),
  country: z.string().max(120).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  timezone: z.string().min(1).max(64),
  defaultLocale: z.string().min(2).max(10),
});

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = getPrisma();

  const calendars = await prisma.holidayCalendar.findMany({
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { holidays: true, employees: true } } },
  });
  return NextResponse.json({ calendars });
}

export async function POST(req: Request) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = getPrisma();

  const json = await req.json().catch(() => null);
  const parsed = CalendarInput.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const c = await prisma.holidayCalendar.create({
    data: {
      name: parsed.data.name,
      country: parsed.data.country ?? null,
      region: parsed.data.region ?? null,
      city: parsed.data.city ?? null,
      timezone: parsed.data.timezone,
      defaultLocale: parsed.data.defaultLocale,
    },
  });

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "HOLIDAY_CALENDAR_CREATE",
    entityType: "HolidayCalendar",
    entityId: c.id,
  });

  return NextResponse.json({ calendar: c });
}

