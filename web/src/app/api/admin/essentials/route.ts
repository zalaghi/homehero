import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { cleanEssentialName, normalizeEssentialName } from "@/server/essentials/names";
import { assertSameOrigin } from "@/server/security/csrf";

const CreateBody = z.object({
  name: z.string().min(1).max(120),
});

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prisma = getPrisma();
  const suggestions = await prisma.essentialSuggestion.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    suggestions: suggestions.map((suggestion) => ({
      id: suggestion.id,
      name: suggestion.name,
      normalizedName: suggestion.normalizedName,
      isActive: suggestion.isActive,
      updatedAt: suggestion.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prisma = getPrisma();
  const name = cleanEssentialName(parsed.data.name);
  const normalizedName = normalizeEssentialName(name);
  if (!normalizedName) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const existing = await prisma.essentialSuggestion.findUnique({ where: { normalizedName } });
  if (existing?.isActive) {
    return NextResponse.json({ error: "Suggestion already exists" }, { status: 409 });
  }

  const suggestion = existing
    ? await prisma.essentialSuggestion.update({
        where: { id: existing.id },
        data: { name, isActive: true },
      })
    : await prisma.essentialSuggestion.create({
        data: { name, normalizedName },
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
}
