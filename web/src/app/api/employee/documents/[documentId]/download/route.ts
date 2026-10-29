import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { getObjectStream } from "@/server/storage/s3";
import { logAudit } from "@/server/audit/log";

async function requireEmployeeOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) return null;
  return { ...user, employeeId: user.employeeId } as typeof user & { employeeId: string };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ documentId: string }> },
) {
  const user = await requireEmployeeOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId } = await ctx.params;
  const prisma = getPrisma();
  const document = await prisma.employeeDocument.findFirst({
    where: { id: documentId, employeeId: user.employeeId, visibleToEmployee: true },
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;

  await logAudit({
    actorUserId: user.userId,
    actorRole: "EMPLOYEE",
    action: "EMPLOYEE_DOCUMENT_DOWNLOAD",
    entityType: "EmployeeDocument",
    entityId: document.id,
    metadata: { filename: document.filename, employeeId: document.employeeId },
    ip,
    userAgent,
  });

  const stream = await getObjectStream(document.storageKey);
  if (!stream.body) return NextResponse.json({ error: "File unavailable" }, { status: 410 });

  const headersInit = new Headers({
    "Content-Type": document.mimeType ?? stream.contentType ?? "application/octet-stream",
    "Content-Disposition": `inline; filename="${encodeURIComponent(document.filename)}"`,
    "Cache-Control": "private, max-age=60",
  });
  if (stream.contentLength) headersInit.set("Content-Length", stream.contentLength.toString());

  return new NextResponse(stream.body, { headers: headersInit });
}
