import type { DriverInput, PayLine } from '../types/input';

export interface TripPayments {
  readonly paidByTrip: ReadonlyMap<string, number>;   // linked trip_rate cents, across all pay periods
  readonly orphanLineIds: ReadonlySet<string>;        // trip_rate lines with no trip record behind them
}

// Explicit links only. The engine never guesses which payment belongs to which trip.
export function matchTripPayments(driver: DriverInput): TripPayments {
  const known = new Set(driver.trips.map(t => t.tripId));
  const paidByTrip = new Map<string, number>();
  const orphanLineIds = new Set<string>();
  const lines: readonly PayLine[] = driver.payPeriods.flatMap(p => p.lines);
  for (const line of lines) {
    if (line.kind !== 'trip_rate') continue;
    if (line.link.kind === 'unlinked' || !known.has(line.link.tripId)) { orphanLineIds.add(line.lineId); continue; }
    paidByTrip.set(line.link.tripId, (paidByTrip.get(line.link.tripId) ?? 0) + line.cents);
  }
  return { paidByTrip, orphanLineIds };
}
