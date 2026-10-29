import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { assertSameOrigin } from "@/server/security/csrf";

export async function DELETE(
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
  const request = await prisma.weekendWorkRequest.findUnique({
    where: { id },
    select: { id: true, employeeId: true, status: true },
  });
  if (!request || request.employeeId !== user.employeeId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "Request is locked" }, { status: 409 });
  }

  await prisma.weekendWorkRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
