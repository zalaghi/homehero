import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { getPrisma } from "@/server/db/prisma";
import { parseEssentialDictionary } from "@/server/essentials/names";
import { assertSameOrigin } from "@/server/security/csrf";

const DICTIONARY_PATH = path.join(process.cwd(), "prisma", "data", "essential_dictionary.txt");
const ImportBody = z.object({
  text: z.string().max(200_000),
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
  const parsedBody = json === null ? null : ImportBody.safeParse(json);
  if (parsedBody && !parsedBody.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  let text = parsedBody?.data.text;
  if (text === undefined) {
    try {
      text = await readFile(DICTIONARY_PATH, "utf8");
    } catch {
      return NextResponse.json({ error: "Dictionary file not found" }, { status: 404 });
    }
  }

  const parsed = parseEssentialDictionary(text);
  if (parsed.length === 0) {
    return NextResponse.json({ importedCount: 0, skippedCount: 0 });
  }

  const prisma = getPrisma();
  const result = await prisma.essentialSuggestion.createMany({
    data: parsed.map((item) => ({
      name: item.name,
      normalizedName: item.normalizedName,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    importedCount: result.count,
    skippedCount: parsed.length - result.count,
  });
}
