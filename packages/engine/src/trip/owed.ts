import type { DriverInput, TripRecord } from '../types/input';
import type { RateTable, ScheduleSet } from '../types/schedule';
import type { GapDraft, TripItem } from '../types/internal';
import { GAPS } from '../rules/catalogue';
import { classAt } from '../classify/class-at';
import { resolveComponent, resolveOptionalComponent } from '../schedule/resolve';
import { fromInt, mulRatio, type Frac } from '../math/ratio';
import { pmrOwed } from './pmr';

export interface TripOutcome {
  readonly items: readonly TripItem[];
  readonly gaps: readonly GapDraft[];
}

type Lookup =
  | { readonly kind: 'found'; readonly cents: number }
  | { readonly kind: 'no_row' }
  | { readonly kind: 'no_column' };

function lookup(table: RateTable, row: string, column: string): Lookup {
  const cells = Object.hasOwn(table, row) ? table[row] : undefined;
  if (cells === undefined) return { kind: 'no_row' };
  const cents = Object.hasOwn(cells, column) ? cells[column] : undefined;
  return cents === undefined ? { kind: 'no_column' } : { kind: 'found', cents };
}

function describe(t: TripRecord): string {
  const show = (r: { kind: 'reported'; value: string } | { kind: 'not_reported' }): string => (r.kind === 'reported' ? r.value : '?');
  const count = t.containers.kind === 'reported' ? `${t.containers.value} container${t.containers.value === 'two' ? 's' : ''}` : 'container count not reported';
  return t.move.kind === 'on_dock'
    ? `on-dock, area ${show(t.move.zone)}, terminal ${show(t.move.terminal)}, ${count}`
    : `off-dock, area ${show(t.move.origin)} to area ${show(t.move.destination)}, ${count}`;
}

export function computeTrips(driver: DriverInput, schedules: ScheduleSet): TripOutcome {
  const items: TripItem[] = [];
  const gaps: GapDraft[] = [];

  for (const t of driver.trips) {
    const gap = (code: GapDraft['code'], detail: string): void => {
      gaps.push({ code, workDate: t.workDate, recordIds: [t.tripId], detail });
    };
    const unpriced = (): void => {
      items.push({ tripId: t.tripId, workDate: t.workDate, scheduleIds: [], description: describe(t), base: null, pmr: null });
    };
    const period = classAt(driver.classPeriods, t.workDate);
    if (period === null) { gap(GAPS.CLASS_UNKNOWN_FOR_DATE, `No driver class is recorded for ${t.workDate}.`); unpriced(); continue; }
    if (period.class !== 'IO_TRIP') {
      gap(GAPS.CLASS_WORK_MISMATCH, `Trip dated ${t.workDate} falls in a period where the driver is paid hourly.`);
      unpriced();
      continue;
    }

    const scheduleIds: string[] = [];
    let base: Frac | null = null;
    if (t.containers.kind === 'not_reported') gap(GAPS.CONTAINER_COUNT_MISSING, 'The number of containers moved was not reported.');

    if (t.move.kind === 'on_dock') {
      const { zone, terminal } = t.move;
      if (zone.kind === 'not_reported') gap(GAPS.ZONE_MISSING, 'The origin or destination area was not reported.');
      if (terminal.kind === 'not_reported') gap(GAPS.TERMINAL_MISSING, 'The terminal was not reported.');
      const rules = resolveComponent(schedules, t.workDate, 'on-dock trip rate', s => s.onDock);
      if (rules.kind === 'gap') gap(rules.code, rules.detail);
      if (rules.kind === 'resolved' && zone.kind === 'reported' && terminal.kind === 'reported' && t.containers.kind === 'reported') {
        const found = lookup(rules.value.table, zone.value, terminal.value);
        if (found.kind === 'no_row') gap(GAPS.ZONE_NOT_IN_SCHEDULE, `Area ${zone.value} is not in schedule ${rules.scheduleId}.`);
        else if (found.kind === 'no_column') gap(GAPS.TERMINAL_NOT_IN_SCHEDULE, `Terminal ${terminal.value} is not in schedule ${rules.scheduleId}.`);
        else if (t.containers.value === 'two') gap(GAPS.ON_DOCK_MULTI_CONTAINER_UNDEFINED, `Schedule ${rules.scheduleId} states no on-dock rate for two containers.`);
        else { base = fromInt(found.cents); scheduleIds.push(rules.scheduleId); }
      }
    } else {
      const { origin, destination } = t.move;
      if (origin.kind === 'not_reported' || destination.kind === 'not_reported') gap(GAPS.ZONE_MISSING, 'The origin or destination area was not reported.');
      const rules = resolveComponent(schedules, t.workDate, 'off-dock trip rate', s => s.offDock);
      if (rules.kind === 'gap') gap(rules.code, rules.detail);
      if (rules.kind === 'resolved' && origin.kind === 'reported' && destination.kind === 'reported' && t.containers.kind === 'reported') {
        const found = lookup(rules.value.table, origin.value, destination.value);
        if (found.kind !== 'found') {
          gap(GAPS.ZONE_NOT_IN_SCHEDULE, `Area pair ${origin.value} to ${destination.value} is not in schedule ${rules.scheduleId}.`);
        } else {
          const one = fromInt(found.cents);
          base = t.containers.value === 'two' ? mulRatio(one, rules.value.twoContainerMultiplier) : one;
          scheduleIds.push(rules.scheduleId);
        }
      }
    }

    // The PMR has its own two-container rule, so it prices even when the trip rate cannot.
    let pmr: Frac | null = null;
    if (t.containers.kind === 'reported') {
      const rules = resolveOptionalComponent(schedules, t.workDate, 'positioning movement rate', s => s.pmr);
      if (rules.kind === 'gap') gap(rules.code, rules.detail);
      // No positioning movement rate existed under this schedule: nothing is owed, and that is knowledge, not a gap.
      else if (rules.kind === 'not_in_force') { pmr = fromInt(0); scheduleIds.push(rules.scheduleId); }
      else { pmr = pmrOwed(rules.value, t.containers.value); scheduleIds.push(rules.scheduleId); }
    }
    items.push({ tripId: t.tripId, workDate: t.workDate, scheduleIds, description: describe(t), base, pmr });
  }
  return { items, gaps };
}
