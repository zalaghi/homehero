import { PrismaClient, type HolidaySource } from "@prisma/client";
import { stringifyHolidayNameJson, toDbDate } from "../src/lib/holidays/importers";
import type { IsoDate } from "../src/lib/payroll/types";

const prisma = new PrismaClient();

type SeedHoliday = { date: IsoDate; nameByLocale: Record<string, string>; source: HolidaySource };

type SeedCalendar = {
  name: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
  defaultLocale: string;
  holidays: SeedHoliday[];
};

const calendars: SeedCalendar[] = [
  {
    name: "Barcelona 2026",
    country: "ES",
    region: "Catalonia",
    city: "Barcelona",
    timezone: "Europe/Madrid",
    defaultLocale: "es",
    holidays: [
      { date: "2026-01-01" as IsoDate, nameByLocale: { es: "Año Nuevo", en: "New Year's Day" }, source: "IMPORT_CSV" },
      { date: "2026-01-06" as IsoDate, nameByLocale: { es: "Reyes", en: "Epiphany" }, source: "IMPORT_CSV" },
      { date: "2026-03-19" as IsoDate, nameByLocale: { es: "San José", en: "St. Joseph" }, source: "IMPORT_CSV" },
      { date: "2026-05-01" as IsoDate, nameByLocale: { es: "Día del Trabajador", en: "Labor Day" }, source: "IMPORT_CSV" },
      { date: "2026-06-24" as IsoDate, nameByLocale: { es: "San Juan", en: "St. John's Day" }, source: "IMPORT_CSV" },
      { date: "2026-08-15" as IsoDate, nameByLocale: { es: "Asunción", en: "Assumption" }, source: "IMPORT_CSV" },
      { date: "2026-09-11" as IsoDate, nameByLocale: { es: "Diada de Catalunya", en: "Catalonia National Day" }, source: "IMPORT_CSV" },
      { date: "2026-09-24" as IsoDate, nameByLocale: { es: "La Mercè", en: "La Mercè" }, source: "IMPORT_CSV" },
      { date: "2026-10-12" as IsoDate, nameByLocale: { es: "Fiesta Nacional de España", en: "Spanish National Day" }, source: "IMPORT_CSV" },
      { date: "2026-11-01" as IsoDate, nameByLocale: { es: "Todos los Santos", en: "All Saints' Day" }, source: "IMPORT_CSV" },
      { date: "2026-12-06" as IsoDate, nameByLocale: { es: "Día de la Constitución", en: "Constitution Day" }, source: "IMPORT_CSV" },
      { date: "2026-12-25" as IsoDate, nameByLocale: { es: "Navidad", en: "Christmas Day" }, source: "IMPORT_CSV" },
      { date: "2026-12-26" as IsoDate, nameByLocale: { es: "San Esteban", en: "St. Stephen's Day" }, source: "IMPORT_CSV" },
    ],
  },
];

async function upsertCalendar(calendar: SeedCalendar) {
  const existing = await prisma.holidayCalendar.findFirst({ where: { name: calendar.name } });
  if (existing) {
    await prisma.holiday.deleteMany({ where: { calendarId: existing.id } });

    await prisma.holidayCalendar.update({
      where: { id: existing.id },
      data: {
        country: calendar.country,
        region: calendar.region,
        city: calendar.city,
        timezone: calendar.timezone,
        defaultLocale: calendar.defaultLocale,
      },
    });

    await prisma.holiday.createMany({
      data: calendar.holidays.map((h) => ({
        calendarId: existing.id,
        date: toDbDate(h.date),
        nameJson: stringifyHolidayNameJson(h.nameByLocale),
        source: h.source,
        sourceRef: "seed",
      })),
      skipDuplicates: true,
    });

    return existing.id;
  }

  const created = await prisma.holidayCalendar.create({
    data: {
      name: calendar.name,
      country: calendar.country,
      region: calendar.region,
      city: calendar.city,
      timezone: calendar.timezone,
      defaultLocale: calendar.defaultLocale,
      holidays: {
        createMany: {
          data: calendar.holidays.map((h) => ({
            date: toDbDate(h.date),
            nameJson: stringifyHolidayNameJson(h.nameByLocale),
            source: h.source,
            sourceRef: "seed",
          })),
        },
      },
    },
  });

  return created.id;
}

async function main() {
  for (const cal of calendars) {
    const id = await upsertCalendar(cal);
    console.log(`Seeded calendar: ${cal.name} (${id})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
