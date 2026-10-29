import { describe, expect, test } from "vitest";
import {
  dedupeImportedByDate,
  mergeNames,
  parseCsvHolidays,
  parseIcsHolidays,
  parseDateStringToIso,
} from "../importers";

describe("holiday importers", () => {
  test("parseDateStringToIso supports ISO and dd/mm/yyyy", () => {
    expect(parseDateStringToIso("2026-01-06")).toBe("2026-01-06");
    expect(parseDateStringToIso("06/01/2026")).toBe("2026-01-06");
  });

  test("parseCsvHolidays reads date/name/optional locale", () => {
    const items = parseCsvHolidays({
      csvText: "date,name,locale\n2026-01-06,Epiphany,en\n2026-01-01,Año Nuevo,es\n",
      defaultLocale: "en",
      sourceRef: "upload.csv",
    });
    expect(items).toHaveLength(2);
    expect(items[0].date).toBe("2026-01-06");
    expect(items[0].nameByLocale.en).toBe("Epiphany");
    expect(items[1].nameByLocale.es).toBe("Año Nuevo");
  });

  test("parseIcsHolidays extracts DTSTART + SUMMARY (+ optional LOCATION)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20260106",
      "SUMMARY:Epiphany",
      "LOCATION:Barcelona",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");

    const items = parseIcsHolidays({ icsText: ics, defaultLocale: "en", sourceRef: "file.ics" });
    expect(items).toHaveLength(1);
    expect(items[0].date).toBe("2026-01-06");
    expect(items[0].nameByLocale.en).toBe("Epiphany");
    expect(items[0].meta?.location).toBe("Barcelona");
  });

  test("dedupeImportedByDate merges locale names for same date", () => {
    const items = dedupeImportedByDate([
      { date: "2026-01-06", nameByLocale: { en: "Epiphany" }, source: "IMPORT_CSV" },
      { date: "2026-01-06", nameByLocale: { es: "Reyes" }, source: "IMPORT_CSV" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].nameByLocale).toEqual({ en: "Epiphany", es: "Reyes" });
  });

  test("mergeNames prefers incoming values", () => {
    expect(mergeNames({ en: "Old" }, { en: "New", es: "ES" })).toEqual({ en: "New", es: "ES" });
  });
});

