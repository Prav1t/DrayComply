import type { IsoDate, Minutes } from '../types/primitives';

export type OvertimeKind = 'none' | 'daily' | 'weekly';

export interface OvertimeState {
  readonly dayKey: IsoDate | null;
  readonly dayMinutes: Minutes;
  readonly weekKey: number | null;
  readonly weekCountedMinutes: Minutes;   // excludes daily overtime minutes
}

export const INITIAL_OVERTIME_STATE: OvertimeState = { dayKey: null, dayMinutes: 0, weekKey: null, weekCountedMinutes: 0 };

// Reset the day and week counters when an entry starts a new one.
export function enterDay(state: OvertimeState, workDate: IsoDate, weekKey: number): OvertimeState {
  const sameWeek = state.weekKey === weekKey;
  const sameDay = sameWeek && state.dayKey === workDate;
  return {
    dayKey: workDate,
    dayMinutes: sameDay ? state.dayMinutes : 0,
    weekKey,
    weekCountedMinutes: sameWeek ? state.weekCountedMinutes : 0,
  };
}

// Kind of the next minute worked. Daily overtime takes precedence over weekly.
export function overtimeKind(state: OvertimeState, dailyMinutes: Minutes, weeklyMinutes: Minutes): OvertimeKind {
  if (state.dayMinutes >= dailyMinutes) return 'daily';
  if (state.weekCountedMinutes >= weeklyMinutes) return 'weekly';
  return 'none';
}

// Minutes until the kind changes; null when it cannot change again today.
export function minutesToOvertimeBoundary(state: OvertimeState, dailyMinutes: Minutes, weeklyMinutes: Minutes): Minutes | null {
  if (state.dayMinutes >= dailyMinutes) return null;
  const toDaily = dailyMinutes - state.dayMinutes;
  if (state.weekCountedMinutes >= weeklyMinutes) return toDaily;
  return Math.min(toDaily, weeklyMinutes - state.weekCountedMinutes);
}

// Daily overtime minutes never count toward the weekly total.
export function advance(state: OvertimeState, minutes: Minutes, kind: OvertimeKind): OvertimeState {
  return {
    ...state,
    dayMinutes: state.dayMinutes + minutes,
    weekCountedMinutes: kind === 'daily' ? state.weekCountedMinutes : state.weekCountedMinutes + minutes,
  };
}
