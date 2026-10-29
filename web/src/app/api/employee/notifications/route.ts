import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { defaultLocale } from "@/i18n/routing";
import { assertSameOrigin } from "@/server/security/csrf";
import { rateLimitFixedWindow } from "@/server/security/rateLimit";

type NotificationsPayload = {
  unreadCount: number;
  unreadByType: Record<string, number>;
  items: Array<{
    id: string;
    title: string;
    body: string;
    type: string;
    link: string | null;
    createdAt: string;
    readAt: string | null;
  }>;
};

async function requireEmployeeOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) return null;
  return user;
}

function rateLimitResponse(resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfterSeconds.toString(),
      },
    },
  );
}

const Query = z.object({
  includeRead: z.enum(["true", "false"]).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  after: z.string().optional(),
});

export async function GET(req: Request) {
  const user = await requireEmployeeOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateLimit = await rateLimitFixedWindow({
    key: `employee:notifications:get:${user.employeeId}`,
    limit: 240,
    windowSeconds: 60,
  });
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt);

  const prisma = getPrisma();
  const employeeId = user.employeeId!;
  const url = new URL(req.url);
  const query = Query.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!query.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const includeRead = query.data.includeRead !== "false";
  const take = query.data.take ?? 50;
  const after = query.data.after ? new Date(query.data.after) : null;
  if (after && Number.isNaN(after.getTime())) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const payloadPromise = (async () => {
    let employee;
    try {
      employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { publicId: true, locale: true },
      });
    } catch (error) {
      console.error("employee_notifications_get_employee_failed", error);
      throw new Error("employee_notifications_get_employee_failed");
    }
    if (!employee) {
      throw new Error("employee_notifications_employee_missing");
    }
    const employeeLocale = employee.locale || defaultLocale;
    const portalBase = `/${employeeLocale}/portal/${employee.publicId}`;
    const [items, unreadCount, unreadByTypeRaw] = await Promise.all([
      prisma.employeeNotification.findMany({
        where: {
          employeeId,
          ...(includeRead ? {} : { readAt: null }),
          ...(after ? { createdAt: { gt: after } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.employeeNotification.count({
        where: { employeeId, readAt: null },
      }),
      prisma.employeeNotification.groupBy({
        by: ["type"],
        where: { employeeId, readAt: null },
        _count: { _all: true },
      }),
    ]);
    const unreadByType = unreadByTypeRaw.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.type] = entry._count._all;
      return acc;
    }, {});

    const linkForType = (type: string) => {
      if (type === "TODO_ASSIGNED") return `${portalBase}/todos`;
      if (type === "ESSENTIALS_UPDATED") return `${portalBase}/essentials`;
      if (type === "WEEKEND_REQUEST_DECISION") return `${portalBase}/attendance`;
      return null;
    };

    return {
      unreadCount,
      unreadByType,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        type: item.type,
        link: linkForType(item.type),
        createdAt: item.createdAt.toISOString(),
        readAt: item.readAt ? item.readAt.toISOString() : null,
      })),
    } satisfies NotificationsPayload;
  })();

  try {
    const payload = await payloadPromise;
    return NextResponse.json(payload);
  } catch (error) {
    if ((error as Error).message === "employee_notifications_employee_missing") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("employee_notifications_get_failed", error);
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}

const PatchBody = z.object({
  type: z.enum(["WEEKEND_REQUEST_DECISION", "TODO_ASSIGNED", "ESSENTIALS_UPDATED"]).optional(),
}).strict();

export async function PATCH(req: Request) {
  await assertSameOrigin();
  const user = await requireEmployeeOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateLimit = await rateLimitFixedWindow({
    key: `employee:notifications:patch:${user.employeeId}`,
    limit: 120,
    windowSeconds: 60,
  });
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt);

  // Older installed PWAs send no body for "mark all". Accept that specific case,
  // but never interpret malformed JSON or unknown fields as a bulk operation.
  const body = await req.text();
  let json: unknown = {};
  if (body.trim()) {
    try { json = JSON.parse(body); }
    catch { return NextResponse.json({ error: "Invalid input" }, { status: 400 }); }
  }
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prisma = getPrisma();
  const employeeId = user.employeeId!;
  const type = parsed.data?.type;
  let updated;
  try {
    updated = await prisma.employeeNotification.updateMany({
      where: { employeeId, readAt: null, ...(type ? { type } : {}) },
      data: { readAt: new Date() },
    });
  } catch (error) {
    console.error("employee_notifications_patch_failed", error);
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, updated: updated.count });
}
