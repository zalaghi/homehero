import type { IsoDate } from "@/lib/payroll/types";

export type AttendanceAuditState = {
  worked: boolean;
  authorizedExtra: boolean;
};

export function buildAttendanceAuditMetadata(input: {
  employeeId: string;
  date: IsoDate;
  previous?: AttendanceAuditState | null;
  next: AttendanceAuditState;
}): Record<string, unknown> {
  return {
    employeeId: input.employeeId,
    date: input.date,
    previous: input.previous ?? null,
    next: input.next,
  };
}
