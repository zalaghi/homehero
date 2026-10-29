import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/server/security/csrf";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { deleteObject, getObjectStream } from "@/server/storage/s3";
import { logAudit } from "@/server/audit/log";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

async function getContext() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;
  return { ip, userAgent };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; documentId: string }> }) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, documentId } = await ctx.params;
  const prisma = getPrisma();
  const document = await prisma.employeeDocument.findFirst({
    where: { id: documentId, employeeId: id },
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const stream = await getObjectStream(document.storageKey);

  const { ip, userAgent } = await getContext();
  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "EMPLOYEE_DOCUMENT_PREVIEW",
    entityType: "EmployeeDocument",
    entityId: document.id,
    metadata: { filename: document.filename, employeeId: document.employeeId },
    ip,
    userAgent,
  });

  if (!stream.body) return NextResponse.json({ error: "File unavailable" }, { status: 410 });

  const headersInit = new Headers({
    "Content-Type": stream.contentType ?? "application/octet-stream",
    "Content-Disposition": `inline; filename="${encodeURIComponent(document.filename)}"`,
    "Cache-Control": "private, max-age=60",
  });
  if (stream.contentLength) headersInit.set("Content-Length", stream.contentLength.toString());

  return new NextResponse(stream.body, { headers: headersInit });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; documentId: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, documentId } = await ctx.params;
  const prisma = getPrisma();
  const document = await prisma.employeeDocument.findFirst({ where: { id: documentId, employeeId: id } });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.employeeDocument.delete({ where: { id: document.id } });
  await deleteObject(document.storageKey);

  const { ip, userAgent } = await getContext();
  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "EMPLOYEE_DOCUMENT_DELETE",
    entityType: "EmployeeDocument",
    entityId: document.id,
    metadata: { filename: document.filename, employeeId: document.employeeId },
    ip,
    userAgent,
  });

  return NextResponse.json({ ok: true });
}
