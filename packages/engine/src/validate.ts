import type { ComplianceInput, RunOptions } from './types/input';
import type { ScheduleSet } from './types/schedule';
import { isIsoDate } from './math/dates';
import { isExactRatio } from './math/ratio';

const isAmount = (x: number): boolean => Number.isSafeInteger(x) && x >= 0;

function overlaps(ranges: readonly { readonly from: string; readonly to: string | null }[]): boolean {
  const sorted = [...ranges].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  return sorted.some((r, i) => {
    const next = sorted[i + 1];
    return next !== undefined && (r.to === null || next.from <= r.to);
  });
}

function duplicates(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

// Malformed input is rejected outright. It is never repaired and never becomes a gap.
export function validateRun(input: ComplianceInput, schedules: ScheduleSet, options: RunOptions): string[] {
  const errors: string[] = [];
  const date = (value: string, where: string): void => { if (!isIsoDate(value)) errors.push(`${where}: "${value}" is not a YYYY-MM-DD date`); };
  const amount = (value: number, where: string): void => { if (!isAmount(value)) errors.push(`${where}: ${value} is not a non-negative integer`); };

  date(options.asOf, 'options.asOf');
  for (const s of schedules.schedules) {
    date(s.effectiveFrom, `schedule ${s.id} effectiveFrom`);
    if (s.effectiveTo !== null) date(s.effectiveTo, `schedule ${s.id} effectiveTo`);
    const ratios = [
      s.overtime.kind === 'present' ? s.overtime.value.multiplier : null,
      s.offDock.kind === 'present' ? s.offDock.value.twoContainerMultiplier : null,
      s.pmr.kind === 'present' ? s.pmr.value.twoContainerMultiplier : null,
    ];
    if (ratios.some(r => r !== null && !isExactRatio(r))) errors.push(`schedule ${s.id}: a multiplier is not an exact integer ratio`);
  }
  if (overlaps(schedules.schedules.map(s => ({ from: s.effectiveFrom, to: s.effectiveTo })))) errors.push('schedules overlap in time');
  duplicates(schedules.schedules.map(s => s.id)).forEach(id => errors.push(`duplicate schedule id ${id}`));
  duplicates(input.drivers.map(d => d.driverId)).forEach(id => errors.push(`duplicate driver id ${id}`));

  for (const d of input.drivers) {
    const at = `driver ${d.driverId}`;
    d.classPeriods.forEach(p => {
      date(p.from, `${at} class period from`);
      if (p.to !== null) date(p.to, `${at} class period to`);
      if (p.to !== null && p.to < p.from) errors.push(`${at}: class period ends before it starts`);
    });
    if (overlaps(d.classPeriods)) errors.push(`${at}: class periods overlap`);
    if (d.openingCumulativeMinutes.kind === 'reported') amount(d.openingCumulativeMinutes.value, `${at} openingCumulativeMinutes`);
    if (d.hourlyCoverageFrom.kind === 'reported') date(d.hourlyCoverageFrom.value, `${at} hourlyCoverageFrom`);
    if (d.fuelBasis.kind === 'io_discounted') Object.entries(d.fuelBasis.centsPerLitreByMonth).forEach(([m, c]) => amount(c, `${at} fuel price ${m}`));
    d.hourlyEntries.forEach(e => {
      date(e.workDate, `${at} entry ${e.entryId}`);
      amount(e.minutes, `${at} entry ${e.entryId} minutes`);
      if (!Number.isSafeInteger(e.seq)) errors.push(`${at} entry ${e.entryId}: seq is not an integer`);
    });
    d.trips.forEach(t => date(t.workDate, `${at} trip ${t.tripId}`));
    if (d.otherLicenseeHours.kind === 'reported') d.otherLicenseeHours.entries.forEach((o, i) => {
      date(o.workDate, `${at} other-licensee hours [${i}]`);
      amount(o.minutes, `${at} other-licensee hours [${i}] minutes`);
    });
    const entryIds = new Set(d.hourlyEntries.map(e => e.entryId));
    const tripIds = new Set(d.trips.map(t => t.tripId));
    const calloutRecords = d.callouts.kind === 'flagged' ? d.callouts.records : [];
    calloutRecords.forEach(c => {
      date(c.workDate, `${at} callout ${c.calloutId}`);
      c.entryIds.filter(id => !entryIds.has(id)).forEach(id => errors.push(`${at} callout ${c.calloutId}: unknown entry ${id}`));
      c.tripIds.filter(id => !tripIds.has(id)).forEach(id => errors.push(`${at} callout ${c.calloutId}: unknown trip ${id}`));
    });
    d.payPeriods.forEach(p => {
      const where = `${at} pay period ${p.payPeriodId}`;
      date(p.from, `${where} from`);
      date(p.to, `${where} to`);
      date(p.payDate, `${where} payDate`);
      if (p.to < p.from) errors.push(`${where}: ends before it starts`);
      if (p.waitTimeReceived.kind === 'reported') amount(p.waitTimeReceived.value, `${where} waitTimeReceived`);
      p.lines.forEach(l => {
        amount(l.cents, `${where} line ${l.lineId}`);
        if (l.workPeriod.kind === 'stated') {
          date(l.workPeriod.from, `${where} line ${l.lineId} work period from`);
          date(l.workPeriod.to, `${where} line ${l.lineId} work period to`);
          if (l.workPeriod.to < l.workPeriod.from) errors.push(`${where} line ${l.lineId}: work period ends before it starts`);
        }
      });
      p.deductions.forEach(x => amount(x.cents, `${where} deduction ${x.deductionId}`));
    });
    if (overlaps(d.payPeriods)) errors.push(`${at}: pay periods overlap`);
    duplicates([
      ...d.hourlyEntries.map(e => e.entryId), ...d.trips.map(t => t.tripId), ...calloutRecords.map(c => c.calloutId),
      ...d.payPeriods.map(p => p.payPeriodId), ...d.payPeriods.flatMap(p => [...p.lines.map(l => l.lineId), ...p.deductions.map(x => x.deductionId)]),
    ]).forEach(id => errors.push(`${at}: record id ${id} is used more than once`));
  }
  return errors;
}
