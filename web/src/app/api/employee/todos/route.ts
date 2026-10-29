import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const prisma = getPrisma();
  const items = await prisma.todoItem.findMany({
    where: {
      assignedToEmployeeId: user.employeeId,
      ...(status ? { status: status === "DONE" ? "DONE" : "OPEN" } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      doneAt: item.doneAt ? item.doneAt.toISOString() : null,
    })),
  });
}
