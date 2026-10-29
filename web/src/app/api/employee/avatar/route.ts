import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { getObjectStream } from "@/server/storage/s3";
import { logAudit } from "@/server/audit/log";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const avatarDocument = await prisma.employeeDocument.findFirst({
    where: { employeeId: user.employeeId, kind: "avatar", visibleToEmployee: true },
    orderBy: { createdAt: "desc" },
  });

  if (!avatarDocument) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stream = await getObjectStream(avatarDocument.storageKey);
  if (!stream.body) return NextResponse.json({ error: "File unavailable" }, { status: 410 });

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;

  await logAudit({
    actorUserId: user.userId,
    actorRole: "EMPLOYEE",
    action: "EMPLOYEE_AVATAR_VIEW",
    entityType: "EmployeeDocument",
    entityId: avatarDocument.id,
    metadata: { filename: avatarDocument.filename, employeeId: avatarDocument.employeeId },
    ip,
    userAgent,
  });

  const headersInit = new Headers({
    "Content-Type": stream.contentType ?? "image/jpeg",
    "Cache-Control": "private, max-age=60",
  });
  if (stream.contentLength) headersInit.set("Content-Length", stream.contentLength.toString());

  return new NextResponse(stream.body, { headers: headersInit });
}
