import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { cleanEssentialName, normalizeEssentialName } from "@/server/essentials/names";
import { assertSameOrigin } from "@/server/security/csrf";

const CreateBody = z
  .object({
    suggestionId: z.string().min(1).optional(),
    name: z.string().min(1).max(120).optional(),
  })
  .refine((data) => data.suggestionId || data.name, { message: "Suggestion or name is required." });

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const needs = await prisma.employeeEssentialNeed.findMany({
    where: { employeeId: user.employeeId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, suggestionId: true, createdAt: true },
  });

  return NextResponse.json({
    needs: needs.map((need) => ({
      id: need.id,
      name: need.name,
      suggestionId: need.suggestionId,
      createdAt: need.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const prisma = getPrisma();
  let suggestionId: string | null = null;
  let name: string;
  let normalizedName: string;

  if (parsed.data.suggestionId) {
    const suggestion = await prisma.essentialSuggestion.findFirst({
      where: { id: parsed.data.suggestionId, isActive: true },
      select: { id: true, name: true, normalizedName: true },
    });
    if (!suggestion) return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    suggestionId = suggestion.id;
    name = suggestion.name;
    normalizedName = suggestion.normalizedName;
  } else {
    name = cleanEssentialName(parsed.data.name ?? "");
    normalizedName = normalizeEssentialName(name);
    if (!normalizedName) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const matchingSuggestion = await prisma.essentialSuggestion.findUnique({
      where: { normalizedName },
      select: { id: true, name: true, normalizedName: true, isActive: true },
    });
    if (matchingSuggestion?.isActive) {
      suggestionId = matchingSuggestion.id;
      name = matchingSuggestion.name;
      normalizedName = matchingSuggestion.normalizedName;
    }
  }

  const existing = await prisma.employeeEssentialNeed.findUnique({
    where: {
      employeeId_normalizedName: {
        employeeId: user.employeeId,
        normalizedName,
      },
    },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "Already listed" }, { status: 409 });

  try {
    const need = await prisma.employeeEssentialNeed.create({
      data: {
        employeeId: user.employeeId,
        suggestionId,
        name,
        normalizedName,
      },
    });

    return NextResponse.json({
      need: {
        id: need.id,
        name: need.name,
        suggestionId: need.suggestionId,
        createdAt: need.createdAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2002") {
      return NextResponse.json({ error: "Already listed" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE() {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const result = await prisma.employeeEssentialNeed.deleteMany({
    where: { employeeId: user.employeeId },
  });

  return NextResponse.json({ deletedCount: result.count });
}
