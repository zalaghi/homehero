import type { IsoDate } from "./types";
import { isWeekendUTC } from "./date";

export type ValidWorkedDayContext = {
  isHoliday: (date: IsoDate) => boolean;
  isWeekend?: (date: IsoDate) => boolean;
};

/**
 * Mirrors Excel "Trabajo válido":
 * - laborable = NOT (isWeekend OR isHoliday)
 * - validWorkedDay = worked AND (laborable OR authorizedExtra)
 */
export function isValidWorkedDay(
  date: IsoDate,
  worked: boolean,
  authorizedExtra: boolean,
  ctx: ValidWorkedDayContext,
): boolean {
  if (!worked) return false;
  const weekendFn = ctx.isWeekend ?? isWeekendUTC;
  const laborable = !(weekendFn(date) || ctx.isHoliday(date));
  return laborable || authorizedExtra;
}

