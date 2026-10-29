import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { createPresignedDownloadUrl } from "@/server/storage/s3";
import { logAudit } from "@/server/audit/log";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; documentId: string }> },
) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, documentId } = await ctx.params;
  const prisma = getPrisma();
  const document = await prisma.employeeDocument.findFirst({
    where: { id: documentId, employeeId: id },
  });

  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const downloadUrl = await createPresignedDownloadUrl({ key: document.storageKey, expiresInSeconds: 300 });

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "EMPLOYEE_DOCUMENT_DOWNLOAD",
    entityType: "EmployeeDocument",
    entityId: document.id,
    metadata: { filename: document.filename, employeeId: document.employeeId },
    ip,
    userAgent,
  });

  return NextResponse.json({ url: downloadUrl, expiresInSeconds: 300 });
}
