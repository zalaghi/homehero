import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  getSessionCookieName,
  getSessionCookieOptionsForRequest,
  revokeSessionByToken,
  getCurrentUser,
} from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { logAudit } from "@/server/audit/log";

export async function POST() {
  await assertSameOrigin();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (token) await revokeSessionByToken(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(getSessionCookieName(), "", {
    ...(await getSessionCookieOptionsForRequest()),
    expires: new Date(0),
  });
  await logAudit({
    actorUserId: user?.userId,
    actorRole: user?.role,
    action: "LOGOUT",
    ip,
    userAgent,
  });
  return res;
}

