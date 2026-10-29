import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { logAudit } from "@/server/audit/log";

const CalendarPatch = z.object({
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

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const prisma = getPrisma();
  const calendar = await prisma.holidayCalendar.findUnique({
    where: { id },
    include: { _count: { select: { holidays: true, employees: true } } },
  });
  if (!calendar) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ calendar });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const prisma = getPrisma();
  const json = await req.json().catch(() => null);
  const parsed = CalendarPatch.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const calendar = await prisma.holidayCalendar.update({
    where: { id },
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
    action: "HOLIDAY_CALENDAR_UPDATE",
    entityType: "HolidayCalendar",
    entityId: id,
  });

  return NextResponse.json({ calendar });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const prisma = getPrisma();
  const assigned = await prisma.employee.count({ where: { holidayCalendarId: id } });
  if (assigned) return NextResponse.json({ error: "Assign employees to another calendar before deleting this one." }, { status: 409 });
  await prisma.holidayCalendar.deleteMany({ where: { id } });

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "HOLIDAY_CALENDAR_DELETE",
    entityType: "HolidayCalendar",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}

