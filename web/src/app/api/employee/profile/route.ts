import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { logAudit } from "@/server/audit/log";

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
      publicId: true,
      firstName: true,
      lastName: true,
      email: true,
      payFrequency: true,
      timezone: true,
    },
  });

  if (!employee) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const avatarDocument = await prisma.employeeDocument.findFirst({
    where: { employeeId: employee.id, kind: "avatar", visibleToEmployee: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      updatedAt: true,
    },
  });

  const avatarUrl = avatarDocument ? `/api/employee/avatar?t=${avatarDocument.updatedAt.getTime()}` : null;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;

  await logAudit({
    actorUserId: user.userId,
    actorRole: "EMPLOYEE",
    action: "EMPLOYEE_PROFILE_VIEW",
    entityType: "Employee",
    entityId: employee.id,
    ip,
    userAgent,
  });

  return NextResponse.json({
    publicId: employee.publicId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    payFrequency: employee.payFrequency,
    timezone: employee.timezone,
    avatarUrl,
  });
}
