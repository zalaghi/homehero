import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { assertSameOrigin } from "@/server/security/csrf";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const prisma = getPrisma();
  const item = await prisma.todoItem.findUnique({
    where: { id },
    select: { id: true, assignedToEmployeeId: true, status: true },
  });
  if (!item || item.assignedToEmployeeId !== user.employeeId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (item.status === "DONE") {
    return NextResponse.json({ ok: true });
  }

  await prisma.todoItem.update({
    where: { id },
    data: { status: "DONE", doneAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
