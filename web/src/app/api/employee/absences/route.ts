import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { assertSameOrigin } from "@/server/security/csrf";
import { toDbDate } from "@/lib/holidays/importers";
import type { IsoDate } from "@/lib/payroll/types";

const CreateBody = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const items = await prisma.absence.findMany({
    where: { employeeId: user.employeeId },
    orderBy: [{ startDate: "desc" }],
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      startDate: item.startDate.toISOString().slice(0, 10),
      endDate: item.endDate.toISOString().slice(0, 10),
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
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

  const startDate = parsed.data.startDate as IsoDate;
  const endDate = parsed.data.endDate as IsoDate;
  if (startDate > endDate) {
    return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 });
  }

  const prisma = getPrisma();
  const item = await prisma.absence.create({
    data: {
      employeeId: user.employeeId,
      startDate: toDbDate(startDate),
      endDate: toDbDate(endDate),
      reason: parsed.data.reason?.trim() || null,
    },
  });

  return NextResponse.json({ id: item.id });
}
