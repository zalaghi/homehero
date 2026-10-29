import ICAL from "ical.js";
import { parse } from "csv-parse/sync";
import type { IsoDate } from "@/lib/payroll/types";
import { formatIsoDateUTC, parseIsoDate } from "@/lib/payroll/date";

export type HolidayImportSource = "IMPORT_ICS" | "IMPORT_CSV" | "IMPORT_URL";

export type ImportedHoliday = {
  date: IsoDate;
  nameByLocale: Record<string, string>;
  source: HolidayImportSource;
  sourceRef?: string;
  meta?: {
    location?: string;
  };
};

export type ImportPreviewItem = ImportedHoliday & {
  action: "CREATE" | "SKIP" | "OVERWRITE" | "MERGE";
  existingNameByLocale?: Record<string, string>;
};

export type ImportMode = "SKIP" | "OVERWRITE" | "MERGE";

export function parseHolidayNameJson(nameJson: string): Record<string, string> {
  try {
    const obj = JSON.parse(nameJson) as unknown;
    if (!obj || typeof obj !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function stringifyHolidayNameJson(nameByLocale: Record<string, string>): string {
  return JSON.stringify(nameByLocale);
}

export function mergeNames(
  existing: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  return { ...existing, ...incoming };
}

export function normalizeLocaleTag(locale: string): string {
  return locale.trim().toLowerCase();
}

export function parseDateStringToIso(dateStr: string): IsoDate {
  const s = dateStr.trim();

  // ISO yyyy-mm-dd
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}` as IsoDate;

  // dd/mm/yyyy
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}` as IsoDate;

  throw new Error(`Unsupported date format: ${dateStr}`);
}

export function parseCsvHolidays(input: {
  csvText: string;
  defaultLocale: string;
  sourceRef?: string;
}): ImportedHoliday[] {
  const records = parse(input.csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  const out: ImportedHoliday[] = [];
  for (const r of records) {
    const dateRaw = r.date ?? r.Date ?? r.fecha ?? r.Fecha;
    const nameRaw = r.name ?? r.Name ?? r.nombre ?? r.Nombre;
    if (!dateRaw || !nameRaw) continue;

    const localeRaw = r.locale ?? r.Locale ?? r.idioma ?? r.Idioma;
    const locale = normalizeLocaleTag(localeRaw ?? input.defaultLocale);
    const date = parseDateStringToIso(dateRaw);

    out.push({
      date,
      nameByLocale: { [locale]: nameRaw },
      source: "IMPORT_CSV",
      sourceRef: input.sourceRef,
    });
  }
  return out;
}

function icalTimeToIsoDate(t: ICAL.Time): IsoDate {
  if (t.isDate) {
    const y = String(t.year).padStart(4, "0");
    const m = String(t.month).padStart(2, "0");
    const d = String(t.day).padStart(2, "0");
    return `${y}-${m}-${d}` as IsoDate;
  }
  const js = t.toJSDate();
  return formatIsoDateUTC(js);
}

export function parseIcsHolidays(input: {
  icsText: string;
  defaultLocale: string;
  sourceRef?: string;
}): ImportedHoliday[] {
  const jcal = ICAL.parse(input.icsText);
  const comp = new ICAL.Component(jcal);
  const events = comp.getAllSubcomponents("vevent");

  const out: ImportedHoliday[] = [];
  for (const ev of events) {
    const e = new ICAL.Event(ev);
    const summary = String(e.summary ?? "").trim();
    const location = String(e.location ?? "").trim() || undefined;
    const dtStart = ev.getFirstPropertyValue("dtstart") as ICAL.Time | null;
    if (!summary || !dtStart) continue;

    const date = icalTimeToIsoDate(dtStart);
    out.push({
      date,
      nameByLocale: { [normalizeLocaleTag(input.defaultLocale)]: summary },
      source: "IMPORT_ICS",
      sourceRef: input.sourceRef,
      meta: location ? { location } : undefined,
    });
  }

  return out;
}

export function dedupeImportedByDate(items: ImportedHoliday[]): ImportedHoliday[] {
  const map = new Map<IsoDate, ImportedHoliday>();
  for (const it of items) {
    const existing = map.get(it.date);
    if (!existing) {
      map.set(it.date, it);
      continue;
    }
    map.set(it.date, {
      ...existing,
      nameByLocale: mergeNames(existing.nameByLocale, it.nameByLocale),
      meta: existing.meta ?? it.meta,
    });
  }
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function toDbDate(date: IsoDate): Date {
  // DATE-only stored as UTC midnight for consistency.
  return parseIsoDate(date);
}

