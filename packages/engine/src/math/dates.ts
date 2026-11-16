import type { IsoDate, YearMonth } from '../types/primitives';
import { DAYS_PER_WEEK, MS_PER_DAY } from './units';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_LENGTH = 7;
const ISO_DATE_LENGTH = 10;

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

function utcMs(s: string): number | null {
  const m = ISO_DATE.exec(s);
  if (m === null) return null;
  const [, y = '', mo = '', d = ''] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  // Date.UTC rolls 02-30 into March; the round trip rejects that.
  return new Date(ms).toISOString().slice(0, ISO_DATE_LENGTH) === s ? ms : null;
}

export function isIsoDate(s: string): boolean {
  return utcMs(s) !== null;
}

// Days since 1970-01-01. Callers pass dates already checked by validateInput.
export function dayNumber(date: IsoDate): number {
  const ms = utcMs(date);
  if (ms === null) throw new RangeError(`not an ISO date: ${date}`);
  return ms / MS_PER_DAY;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date((dayNumber(date) + days) * MS_PER_DAY).toISOString().slice(0, ISO_DATE_LENGTH);
}

// Day number of the first day of the week containing date.
export function weekStartDay(date: IsoDate, startsOn: Weekday): number {
  const day = dayNumber(date);
  const weekday = new Date(day * MS_PER_DAY).getUTCDay();
  const offset = (weekday - WEEKDAYS.indexOf(startsOn) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return day - offset;
}

export function yearMonthOf(date: IsoDate): YearMonth {
  return date.slice(0, YEAR_MONTH_LENGTH);
}

// ISO dates order correctly as strings. A null end is open-ended.
export function inRange(date: IsoDate, from: IsoDate, to: IsoDate | null): boolean {
  return date >= from && (to === null || date <= to);
}
