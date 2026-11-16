import type { IsoDate } from '../types/primitives';
import type { Component, RegulatedSchedule, ScheduleSet } from '../types/schedule';
import { GAPS } from '../rules/catalogue';
import { inRange } from '../math/dates';

export type Resolved<T> =
  | { readonly kind: 'resolved'; readonly scheduleId: string; readonly value: T }
  | { readonly kind: 'gap'; readonly code: typeof GAPS.NO_SCHEDULE_FOR_DATE | typeof GAPS.SCHEDULE_COMPONENT_ABSENT; readonly detail: string };

// Exact containment only. There is no nearest-schedule fallback.
export function scheduleFor(set: ScheduleSet, date: IsoDate): RegulatedSchedule | null {
  return set.schedules.find(s => inRange(date, s.effectiveFrom, s.effectiveTo)) ?? null;
}

export function resolveComponent<T>(
  set: ScheduleSet,
  date: IsoDate,
  name: string,
  pick: (s: RegulatedSchedule) => Component<T>,
): Resolved<T> {
  const schedule = scheduleFor(set, date);
  if (schedule === null) {
    return { kind: 'gap', code: GAPS.NO_SCHEDULE_FOR_DATE, detail: `No rate schedule is loaded for ${date}.` };
  }
  const component = pick(schedule);
  // A caller that can act on 'no rule in force' uses resolveOptionalComponent. Everyone else gets a gap, which is safe.
  if (component.kind !== 'present') {
    return { kind: 'gap', code: GAPS.SCHEDULE_COMPONENT_ABSENT, detail: `Schedule ${schedule.id} holds no ${name} rules for ${date}.` };
  }
  return { kind: 'resolved', scheduleId: schedule.id, value: component.value };
}

export type OptionalResolved<T> = Resolved<T> | { readonly kind: 'not_in_force'; readonly scheduleId: string };

// For rules an order may simply not contain. 'not_in_force' is knowledge, not a gap.
export function resolveOptionalComponent<T>(
  set: ScheduleSet,
  date: IsoDate,
  name: string,
  pick: (s: RegulatedSchedule) => Component<T>,
): OptionalResolved<T> {
  const schedule = scheduleFor(set, date);
  if (schedule !== null && pick(schedule).kind === 'not_in_force') return { kind: 'not_in_force', scheduleId: schedule.id };
  return resolveComponent(set, date, name, pick);
}
