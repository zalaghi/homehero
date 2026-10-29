import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { assertSameOrigin } from "@/server/security/csrf";
import { toDbDate } from "@/lib/holidays/importers";
import type { IsoDate } from "@/lib/payroll/types";
import { notifyEmployee } from "@/server/notifications/notifyEmployee";

const UpdateBody = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED", "PENDING"]),
});

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: employeeId } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prisma = getPrisma();
  const request = await prisma.weekendWorkRequest.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, employeeId: true, date: true, status: true },
  });
  if (!request || request.employeeId !== employeeId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.weekendWorkRequest.update({
    where: { id: request.id },
    data: { status: parsed.data.status },
  });

  if (parsed.data.status === "APPROVED") {
    const date = request.date.toISOString().slice(0, 10) as IsoDate;
    const existing = await prisma.attendanceDay.findUnique({
      where: { employeeId_date: { employeeId, date: toDbDate(date) } },
      select: { worked: true },
    });
    await prisma.attendanceDay.upsert({
      where: { employeeId_date: { employeeId, date: toDbDate(date) } },
      create: {
        employeeId,
        date: toDbDate(date),
        worked: existing?.worked ?? false,
        authorizedExtra: true,
        source: "MANUAL",
        manualOverrideByUserId: user.userId,
      },
      update: {
        authorizedExtra: true,
        source: "MANUAL",
        manualOverrideByUserId: user.userId,
      },
    });
  } else {
    const date = request.date.toISOString().slice(0, 10) as IsoDate;
    await prisma.attendanceDay.updateMany({
      where: { employeeId, date: toDbDate(date) },
      data: {
        authorizedExtra: false,
        manualOverrideByUserId: user.userId,
        source: "MANUAL",
      },
    });
  }

  if (parsed.data.status !== request.status) {
    await notifyEmployee({
      employeeId,
      type: "WEEKEND_REQUEST_DECISION",
      metadata: { date: request.date.toISOString().slice(0, 10), status: parsed.data.status },
    });
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
