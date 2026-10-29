import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { cleanEssentialName, normalizeEssentialName } from "@/server/essentials/names";
import { assertSameOrigin } from "@/server/security/csrf";

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data = parsed.data;
  if (!data.name && data.isActive === undefined) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const prisma = getPrisma();
  const name = data.name ? cleanEssentialName(data.name) : null;
  const normalizedName = name ? normalizeEssentialName(name) : null;
  if (data.name && !normalizedName) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    const suggestion = await prisma.essentialSuggestion.update({
      where: { id },
      data: {
        ...(name && normalizedName ? { name, normalizedName } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    return NextResponse.json({
      suggestion: {
        id: suggestion.id,
        name: suggestion.name,
        normalizedName: suggestion.normalizedName,
        isActive: suggestion.isActive,
        updatedAt: suggestion.updatedAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2002") {
      return NextResponse.json({ error: "Suggestion already exists" }, { status: 409 });
    }
    if (code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const prisma = getPrisma();

  try {
    await prisma.essentialSuggestion.update({
      where: { id },
      data: { isActive: false },
    });
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
