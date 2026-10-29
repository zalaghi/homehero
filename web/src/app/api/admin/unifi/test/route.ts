import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeUnifiHost, type UnifiConfig } from "@/lib/unifi/config";
import { assertSameOrigin } from "@/server/security/csrf";
import { getCurrentUser } from "@/server/auth/session";
import { testUnifiConnection } from "@/server/unifi/sync";
import { UnifiError } from "@/lib/unifi/protect";
import { getUnifiConfig } from "@/server/unifi/config";

const Body = z.object({
  host: z.string().min(1),
  token: z.string().optional(),
  tlsVerify: z.boolean(),
});

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function POST(req: Request) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const stored = await getUnifiConfig();
  let host: string;
  try { host=normalizeUnifiHost(parsed.data.host); } catch { return NextResponse.json({error:"Use an HTTPS console address without a path"},{status:400}); }
  if (!parsed.data.token?.trim() && stored && host !== normalizeUnifiHost(stored.host)) return NextResponse.json({error:"Enter the API key for the new console address"},{status:400});
  const payload: UnifiConfig = {
    host,
    token: parsed.data.token?.trim() || stored?.token || "",
    tlsVerify: parsed.data.tlsVerify,
  };
  if (!payload.token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  try {
    const result = await testUnifiConnection(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof UnifiError ? err.message : "Unable to check Protect", code: err instanceof UnifiError ? err.code : "UNKNOWN" }, { status: 502 });
  }
}
