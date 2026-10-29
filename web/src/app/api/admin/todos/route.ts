import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { assertSameOrigin } from "@/server/security/csrf";
import { notifyEmployee } from "@/server/notifications/notifyEmployee";

const CreateBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(500).optional(),
  employeeId: z.string().min(1),
});

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET(req: Request) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const employeeId = searchParams.get("employeeId");

  const prisma = getPrisma();
  const items = await prisma.todoItem.findMany({
    where: {
      ...(status ? { status: status === "DONE" ? "DONE" : "OPEN" } : {}),
      ...(employeeId ? { assignedToEmployeeId: employeeId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      assignedToEmployee: { select: { id: true, firstName: true, lastName: true, publicId: true } },
    },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      doneAt: item.doneAt ? item.doneAt.toISOString() : null,
      employee: item.assignedToEmployee,
    })),
  });
}

export async function POST(req: Request) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prisma = getPrisma();
  if (!await prisma.employee.findUnique({ where: { id: parsed.data.employeeId }, select: { id: true } })) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  const item = await prisma.todoItem.create({
    data: {
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      assignedToEmployeeId: parsed.data.employeeId,
      createdByAdminId: user.userId,
    },
  });

  await notifyEmployee({
    employeeId: parsed.data.employeeId,
    type: "TODO_ASSIGNED",
    metadata: { todoId: item.id, title: parsed.data.title.trim() },
  });

  return NextResponse.json({ id: item.id });
}
