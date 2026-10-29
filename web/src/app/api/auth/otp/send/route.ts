import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getPrisma } from "@/server/db/prisma";
import { getOtpProvider } from "@/server/otp/providerFactory";
import { assertSameOrigin } from "@/server/security/csrf";
import { rateLimitFixedWindow } from "@/server/security/rateLimit";
import { logAudit } from "@/server/audit/log";
import { normalizeEmail } from "@/lib/email";

const Body = z.object({
  email: z.string().email().max(254),
  locale: z.string().min(2).max(10).optional(),
  employeePublicId: z.string().optional(),
});

export async function POST(req: Request) {
  await assertSameOrigin();
  const prisma = getPrisma();
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { email, locale, employeePublicId } = parsed.data;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return NextResponse.json({ ok: false }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? null;

  const rlId = await rateLimitFixedWindow({
    key: `otp_send:email:${normalizedEmail}`,
    limit: 3,
    windowSeconds: 5 * 60,
  });
  const rlIp = await rateLimitFixedWindow({
    key: `otp_send:ip:${ip}`,
    limit: 15,
    windowSeconds: 5 * 60,
  });
  if (!rlId.ok || !rlIp.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  // Anti-enumeration: do not reveal whether the employee exists.
  const employee = await prisma.employee.findFirst({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (!employee) {
    // Anti-enumeration: return ok regardless; verification will fail later.
    await logAudit({
      action: "OTP_SEND_EMPLOYEE_MISSING",
      ip,
      userAgent,
      metadata: { email: normalizedEmail },
    });
    return NextResponse.json({ ok: true, challengeId: nanoid() });
  }

  const provider = getOtpProvider();
  const { challengeId } = await provider.sendCode(normalizedEmail, {
    locale: locale ?? "en",
    purpose: "EMPLOYEE_LOGIN",
    employeePublicId,
  });

  const authUser = await prisma.authUser.findFirst({
    where: { role: "EMPLOYEE", employeeId: employee.id },
    select: { id: true },
  });

  await logAudit({
    actorUserId: authUser?.id,
    actorRole: "EMPLOYEE",
    action: "OTP_SEND",
    ip,
    userAgent,
    metadata: { email: normalizedEmail, challengeId },
  });

  return NextResponse.json({ ok: true, challengeId });
}

