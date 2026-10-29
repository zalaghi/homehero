import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET(req: Request) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedEmployeeId = searchParams.get("employeeId");

  const prisma = getPrisma();
  const employees = await prisma.employee.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const selectedEmployeeId =
    employees.find((employee) => employee.id === requestedEmployeeId)?.id ?? employees[0]?.id ?? null;

  const needs = selectedEmployeeId
    ? await prisma.employeeEssentialNeed.findMany({
        where: { employeeId: selectedEmployeeId },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, suggestionId: true, createdAt: true },
      })
    : [];

  return NextResponse.json({
    selectedEmployeeId,
    employees: employees.map((employee) => ({
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
    })),
    needs: needs.map((need) => ({
      id: need.id,
      name: need.name,
      suggestionId: need.suggestionId,
      createdAt: need.createdAt.toISOString(),
    })),
  });
}
