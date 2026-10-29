import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { logAudit } from "@/server/audit/log";
import {
  dedupeImportedByDate,
  mergeNames,
  parseCsvHolidays,
  parseHolidayNameJson,
  parseIcsHolidays,
  stringifyHolidayNameJson,
  toDbDate,
  type ImportedHoliday,
  type ImportMode,
  type ImportPreviewItem,
} from "@/lib/holidays/importers";

async function requireAdminOr401() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const JsonBody = z.object({
  mode: z.enum(["SKIP", "OVERWRITE", "MERGE"]).default("SKIP"),
  dryRun: z.boolean().default(true),
  filterCity: z.boolean().optional(),
  replaceExisting: z.boolean().optional(),
  url: z.string().url().optional(),
  csvText: z.string().optional(),
  icsText: z.string().optional(),
});

function pickMode(mode: ImportMode, exists: boolean): ImportPreviewItem["action"] {
  if (!exists) return "CREATE";
  if (mode === "SKIP") return "SKIP";
  if (mode === "OVERWRITE") return "OVERWRITE";
  return "MERGE";
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);
  return await res.text();
}

function detectTypeFromUrl(url: string): "ics" | "csv" | "unknown" {
  const lower = url.toLowerCase();
  if (lower.endsWith(".ics")) return "ics";
  if (lower.endsWith(".csv")) return "csv";
  return "unknown";
}

function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase();
}

function extractCityFromSummary(summary: string): string | null {
  // Heuristic for datasets with "Festa local <Municipi>" entries
  const m = summary.match(/^festa local\s+(.+)$/i);
  if (!m) return null;
  return m[1]?.trim() ?? null;
}

function shouldKeepForCity(input: { city: string; item: ImportedHoliday }): boolean {
  const city = normalizeForMatch(input.city);

  const loc = input.item.meta?.location ? normalizeForMatch(input.item.meta.location) : null;
  if (loc) {
    // If LOCATION is present, only keep events matching the calendar city.
    return loc.includes(city);
  }

  // If no location, try to detect city embedded in summary for "Festa local".
  const embedded = extractCityFromSummary(Object.values(input.item.nameByLocale)[0] ?? "");
  if (embedded) {
    return normalizeForMatch(embedded).includes(city);
  }

  // No location info => keep (these are typically nationwide/regional holidays).
  return true;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await assertSameOrigin();
  const user = await requireAdminOr401();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: calendarId } = await ctx.params;
  const prisma = getPrisma();

  const calendar = await prisma.holidayCalendar.findUnique({ where: { id: calendarId } });
  if (!calendar) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let mode: ImportMode = "SKIP";
  let dryRun = true;
  let filterCity = Boolean(calendar.city);
  let replaceExisting = false;
  let sourceRef: string | undefined;
  let imported: ImportedHoliday[] = [];

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    mode = (String(form.get("mode") ?? "SKIP") as ImportMode) ?? "SKIP";
    dryRun = String(form.get("dryRun") ?? "true") !== "false";
    filterCity = String(form.get("filterCity") ?? String(Boolean(calendar.city))) !== "false";
    replaceExisting = String(form.get("replaceExisting") ?? "false") === "true";

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    sourceRef = file.name;
    const text = await file.text();
    const ext = file.name.toLowerCase().endsWith(".ics")
      ? "ics"
      : file.name.toLowerCase().endsWith(".csv")
        ? "csv"
        : "unknown";

    if (ext === "ics") {
      imported = parseIcsHolidays({
        icsText: text,
        defaultLocale: calendar.defaultLocale,
        sourceRef,
      });
    } else if (ext === "csv") {
      imported = parseCsvHolidays({
        csvText: text,
        defaultLocale: calendar.defaultLocale,
        sourceRef,
      });
    } else {
      return NextResponse.json({ error: "Unsupported file type (use .ics or .csv)" }, { status: 400 });
    }
  } else {
    const json = await req.json().catch(() => null);
    const parsed = JsonBody.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    mode = parsed.data.mode;
    dryRun = parsed.data.dryRun;
    filterCity =
      parsed.data.filterCity === undefined ? Boolean(calendar.city) : Boolean(parsed.data.filterCity);
    replaceExisting = Boolean(parsed.data.replaceExisting);

    if (parsed.data.url) {
      sourceRef = parsed.data.url;
      const text = await fetchUrlText(parsed.data.url);
      const t = detectTypeFromUrl(parsed.data.url);
      if (t === "ics") {
        imported = parseIcsHolidays({
          icsText: text,
          defaultLocale: calendar.defaultLocale,
          sourceRef,
        });
      } else if (t === "csv") {
        imported = parseCsvHolidays({
          csvText: text,
          defaultLocale: calendar.defaultLocale,
          sourceRef,
        });
      } else {
        // Try ICS first, then CSV.
        try {
          imported = parseIcsHolidays({ icsText: text, defaultLocale: calendar.defaultLocale, sourceRef });
        } catch {
          imported = parseCsvHolidays({ csvText: text, defaultLocale: calendar.defaultLocale, sourceRef });
        }
      }
    } else if (parsed.data.csvText) {
      sourceRef = "csvText";
      imported = parseCsvHolidays({
        csvText: parsed.data.csvText,
        defaultLocale: calendar.defaultLocale,
        sourceRef,
      });
    } else if (parsed.data.icsText) {
      sourceRef = "icsText";
      imported = parseIcsHolidays({
        icsText: parsed.data.icsText,
        defaultLocale: calendar.defaultLocale,
        sourceRef,
      });
    } else {
      return NextResponse.json({ error: "Provide url OR csvText OR icsText OR a file upload" }, { status: 400 });
    }
  }

  if (filterCity && calendar.city) {
    imported = imported.filter((i) => shouldKeepForCity({ city: calendar.city!, item: i }));
  }

  imported = dedupeImportedByDate(imported);

  const dates = imported.map((i) => toDbDate(i.date));
  const existing = await prisma.holiday.findMany({
    where: { calendarId, date: { in: dates } },
  });
  const existingByIso = new Map<string, typeof existing[number]>();
  for (const h of existing) {
    existingByIso.set(h.date.toISOString().slice(0, 10), h);
  }

  const preview: ImportPreviewItem[] = imported.map((i) => {
    const ex = existingByIso.get(i.date);
    const action = pickMode(mode, Boolean(ex));
    return {
      ...i,
      action,
      existingNameByLocale: ex ? parseHolidayNameJson(ex.nameJson) : undefined,
    };
  });

  const summary = {
    total: preview.length,
    toCreate: preview.filter((p) => p.action === "CREATE").length,
    toOverwrite: preview.filter((p) => p.action === "OVERWRITE").length,
    toMerge: preview.filter((p) => p.action === "MERGE").length,
    toSkip: preview.filter((p) => p.action === "SKIP").length,
  };

  if (dryRun) {
    return NextResponse.json({ dryRun: true, mode, summary, preview, filterCity, replaceExisting });
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    if (replaceExisting) {
      await tx.holiday.deleteMany({ where: { calendarId } });
    }
    let created = 0;
    let overwritten = 0;
    let merged = 0;
    let skipped = 0;

    for (const p of preview) {
      if (p.action === "SKIP") {
        skipped += 1;
        continue;
      }

      const ex = existingByIso.get(p.date);
      if (!ex) {
        await tx.holiday.create({
          data: {
            calendarId,
            date: toDbDate(p.date),
            nameJson: stringifyHolidayNameJson(p.nameByLocale),
            source: p.source,
            sourceRef: p.sourceRef,
            createdAt: now,
            updatedAt: now,
          },
        });
        created += 1;
        continue;
      }

      if (p.action === "OVERWRITE") {
        await tx.holiday.update({
          where: { id: ex.id },
          data: {
            nameJson: stringifyHolidayNameJson(p.nameByLocale),
            source: p.source,
            sourceRef: p.sourceRef,
          },
        });
        overwritten += 1;
        continue;
      }

      // MERGE
      const mergedNames = mergeNames(parseHolidayNameJson(ex.nameJson), p.nameByLocale);
      await tx.holiday.update({
        where: { id: ex.id },
        data: {
          nameJson: stringifyHolidayNameJson(mergedNames),
          source: p.source,
          sourceRef: p.sourceRef,
        },
      });
      merged += 1;
    }

    return { created, overwritten, merged, skipped };
  });

  await logAudit({
    actorUserId: user.userId,
    actorRole: "ADMIN",
    action: "HOLIDAY_IMPORT_APPLY",
    entityType: "HolidayCalendar",
    entityId: calendarId,
    metadata: {
      mode,
      sourceRef,
      filterCity,
      replaceExisting,
      ...summary,
      ...result,
    },
  });

  return NextResponse.json({ dryRun: false, mode, summary, result });
}

