import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { getBrandingSettings, updateBrandingSettings } from "@/server/branding/settings";
import { logAudit } from "@/server/audit/log";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const UrlField = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) =>
      value === "" ||
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("/") ||
      value.startsWith("data:"),
    {
      message: "Invalid URL",
    },
  );

const Body = z.object({
  appName: z.string().trim().min(1).max(80),
  logoUrl: UrlField.optional().nullable(),
  iconUrl: UrlField.optional().nullable(),
});

export async function GET() {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getBrandingSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const current = await getBrandingSettings();
  const next = {
    appName: parsed.data.appName,
    logoUrl: parsed.data.logoUrl && parsed.data.logoUrl.length > 0 ? parsed.data.logoUrl : null,
    iconUrl: parsed.data.iconUrl && parsed.data.iconUrl.length > 0 ? parsed.data.iconUrl : null,
  };
  await updateBrandingSettings(next);

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "BRANDING_UPDATE",
    entityType: "AppSetting",
    entityId: "branding",
    metadata: { before: current, after: next },
  });

  return NextResponse.json({ settings: next });
}
