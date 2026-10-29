import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { parseHolidayNameJson } from "@/lib/holidays/importers";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const Query = z.object({
  take: z.coerce.number().int().min(1).max(500).default(200),
  cursor: z.string().optional(),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const q = Query.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!q.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const prisma = getPrisma();
  const holidays = await prisma.holiday.findMany({
    where: { calendarId: id },
    orderBy: { date: "desc" },
    take: q.data.take,
    ...(q.data.cursor ? { skip: 1, cursor: { id: q.data.cursor } } : {}),
  });

  const items = holidays.map((h) => ({
    id: h.id,
    date: h.date.toISOString().slice(0, 10),
    nameByLocale: parseHolidayNameJson(h.nameJson),
    source: h.source,
    sourceRef: h.sourceRef,
  }));

  const nextCursor = holidays.length === q.data.take ? holidays[holidays.length - 1]?.id : null;
  return NextResponse.json({ holidays: items, nextCursor });
}

