import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { normalizeEssentialName } from "@/server/essentials/names";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "EMPLOYEE" || !user.employeeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = normalizeEssentialName(searchParams.get("q") ?? "");
  if (query.length < 2) return NextResponse.json({ suggestions: [] });

  const prisma = getPrisma();
  const existingNeeds = await prisma.employeeEssentialNeed.findMany({
    where: { employeeId: user.employeeId },
    select: { normalizedName: true },
  });
  const existingNames = new Set(existingNeeds.map((need) => need.normalizedName));

  const suggestions = await prisma.essentialSuggestion.findMany({
    where: {
      isActive: true,
      normalizedName: { contains: query },
      ...(existingNames.size > 0 ? { NOT: { normalizedName: { in: [...existingNames] } } } : {}),
    },
    orderBy: { name: "asc" },
    take: 10,
    select: { id: true, name: true, normalizedName: true },
  });

  return NextResponse.json({
    suggestions: suggestions.map((suggestion) => ({
      id: suggestion.id,
      name: suggestion.name,
      normalizedName: suggestion.normalizedName,
    })),
  });
}
