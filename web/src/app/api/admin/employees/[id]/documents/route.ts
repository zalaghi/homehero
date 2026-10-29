import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { logAudit } from "@/server/audit/log";
import { generateDocumentStorageKey, uploadObject, deleteObject } from "@/server/storage/s3";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

async function requestContext() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;
  return { ip, userAgent };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const prisma = getPrisma();
  const documents = await prisma.employeeDocument
    .findMany({
      where: { employeeId: id },
      orderBy: { createdAt: "desc" },
    })
    .then((rows) =>
      rows.map((doc) => ({
        ...doc,
        previewUrl: `/api/admin/employees/${id}/documents/${doc.id}`,
      })),
    );

  const { ip, userAgent } = await requestContext();
  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "EMPLOYEE_DOCUMENT_LIST",
    entityType: "Employee",
    entityId: id,
    ip,
    userAgent,
  });

  return NextResponse.json({ documents });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const prisma = getPrisma();

  const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true, publicId: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid upload" }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 });

  const kindValue = formData.get("kind");
  const expirationValue = formData.get("expirationDate");
  const visibleValue = formData.get("visibleToEmployee");

  const filename = file.name?.trim() ? file.name : "document";
  const mimeType = file.type || "application/octet-stream";
  const sizeBytes = file.size;

  if (sizeBytes <= 0 || sizeBytes > 50_000_000) {
    return NextResponse.json({ error: "File size must be between 1 byte and 50 MB." }, { status: 400 });
  }

  const expirationDate =
    typeof expirationValue === "string" && expirationValue
      ? new Date(expirationValue)
      : null;
  if (expirationDate && Number.isNaN(expirationDate.getTime())) {
    return NextResponse.json({ error: "Invalid expiration date" }, { status: 400 });
  }

  const storageKey = generateDocumentStorageKey(employee.id, filename);
  try {
    await uploadObject({
      key: storageKey,
      contentType: mimeType,
      body: Buffer.from(await file.arrayBuffer()),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  let document;
  try {
    document = await prisma.employeeDocument.create({
      data: {
        employeeId: employee.id,
        kind: typeof kindValue === "string" && kindValue ? kindValue : null,
        filename,
        mimeType,
        sizeBytes,
        expirationDate,
        storageKey,
        visibleToEmployee: typeof visibleValue === "string" ? visibleValue === "true" : false,
        uploadedByUserId: user.userId,
        encryptedAtRest: true,
      },
    });
  } catch (error) {
    await deleteObject(storageKey).catch(() => undefined);
    throw error;
  }
  const previewUrl = `/api/admin/employees/${employee.id}/documents/${document.id}`;

  const { ip, userAgent } = await requestContext();
  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "EMPLOYEE_DOCUMENT_UPLOAD_REQUEST",
    entityType: "EmployeeDocument",
    entityId: document.id,
    ip,
    userAgent,
    metadata: {
      employeeId: employee.id,
      filename: document.filename,
      sizeBytes: document.sizeBytes,
      visibleToEmployee: document.visibleToEmployee,
    },
  });

  return NextResponse.json({
    document,
    previewUrl,
  });
}
