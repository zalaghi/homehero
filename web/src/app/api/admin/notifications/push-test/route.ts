import { assertSameOrigin } from "@/server/security/csrf";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { sendEmployeePush } from "@/server/notifications/push";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const Body = z.object({
  employeeId: z.string().min(10),
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(300).optional(),
});

export async function POST(req: Request) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const payload = {
    employeeId: parsed.data.employeeId,
    title: parsed.data.title ?? "HomeHero",
    body: parsed.data.body ?? "Test push notification",
    type: "TODO_ASSIGNED" as const,
  };

  const result = await sendEmployeePush(payload);
  if (result.skipped) {
    return NextResponse.json({ ok: false, error: "VAPID_CONFIG_MISSING" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, sent: result.sent });
}
