import type { AttendanceDaySource } from "@prisma/client";
import type { IsoDate } from "@/lib/payroll/types";

export type AttendanceRecord = {
  date: Date;
  id?: string;
  worked: boolean;
  authorizedExtra: boolean;
  source: AttendanceDaySource;
  firstEntryTime?: Date | null;
  lastExitTime?: Date | null;
  uncertainty?: boolean | null;
};

export type ResolvedAttendanceRecord = {
  date: IsoDate;
  id: string | null;
  worked: boolean;
  authorizedExtra: boolean;
  source: AttendanceDaySource;
  firstEntryTime: Date | null;
  lastExitTime: Date | null;
  uncertainty: boolean;
};

const SOURCE_PRIORITY: Record<AttendanceDaySource, number> = {
  UNIFI: 1,
  RESOLVED: 2,
  MANUAL: 3,
};

export function mergeAttendanceRecords(records: AttendanceRecord[]): Map<IsoDate, ResolvedAttendanceRecord> {
  const byDate = new Map<IsoDate, ResolvedAttendanceRecord>();

  for (const record of records) {
    const date = record.date.toISOString().slice(0, 10) as IsoDate;
    const next: ResolvedAttendanceRecord = {
      date,
      id: record.id ?? null,
      worked: record.worked,
      authorizedExtra: record.authorizedExtra,
      source: record.source,
      firstEntryTime: record.firstEntryTime ?? null,
      lastExitTime: record.lastExitTime ?? null,
      uncertainty: record.uncertainty ?? false,
    };

    const existing = byDate.get(date);
    if (!existing || SOURCE_PRIORITY[next.source] >= SOURCE_PRIORITY[existing.source]) {
      byDate.set(date, next);
    }
  }

  return byDate;
}
