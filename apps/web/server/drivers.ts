// Driver setup: the roster, effective-dated class periods, hours for other licensees, and import from a file.
import { and, asc, eq } from 'drizzle-orm';
import { DRIVER_CLASSES, driverClassPeriods, driverOtherHours, drivers, type Conn, type DriverClass } from '../../../packages/db/src/index';
import { ingest, parseTemplate, TABLE_KINDS, type Reject, type SourceFile } from '../../../packages/ingest/src/index';
import { audit } from './audit';
import { requireRole, type Ctx } from './context';
import { db } from './db';
import { invalid, notFound, pgCode } from './errors';
import type { RosterDriver } from './roster';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: string): boolean => ISO_DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export interface DriverFields {
  readonly externalId: string;
  readonly displayName: string | null;
  readonly openingCumulativeMinutes: number | null;
  readonly hourlyCoverageFrom: string | null;
  readonly fuelBasis: 'published' | 'io_discounted' | null;
  readonly calloutsFlagged: boolean | null;
  readonly otherLicenseeHoursReported: boolean | null;
}

function checkFields(f: DriverFields): void {
  if (f.externalId === '' || f.externalId.length > 100) throw invalid('Enter the driver id used in your exports.');
  if (f.openingCumulativeMinutes !== null && (!Number.isInteger(f.openingCumulativeMinutes) || f.openingCumulativeMinutes < 0)) throw invalid('Opening hours must be a whole number of minutes, zero or more.');
  if (f.hourlyCoverageFrom !== null && !isDate(f.hourlyCoverageFrom)) throw invalid('"Hours complete from" must be a date.');
}

export async function listDrivers(ctx: Ctx) {
  const rows = await db().select().from(drivers).where(eq(drivers.organizationId, ctx.organizationId)).orderBy(asc(drivers.externalId));
  const periods = await db().select().from(driverClassPeriods).where(eq(driverClassPeriods.organizationId, ctx.organizationId)).orderBy(asc(driverClassPeriods.fromDate));
  return rows.map(d => ({ ...d, classPeriods: periods.filter(p => p.driverId === d.id) }));
}

export async function getDriver(ctx: Ctx, driverId: string) {
  const [d] = await db().select().from(drivers).where(and(eq(drivers.organizationId, ctx.organizationId), eq(drivers.id, driverId)));
  if (d === undefined) throw notFound();
  const classPeriods = await db().select().from(driverClassPeriods).where(and(eq(driverClassPeriods.organizationId, ctx.organizationId), eq(driverClassPeriods.driverId, driverId))).orderBy(asc(driverClassPeriods.fromDate));
  const otherHours = await db().select().from(driverOtherHours).where(and(eq(driverOtherHours.organizationId, ctx.organizationId), eq(driverOtherHours.driverId, driverId))).orderBy(asc(driverOtherHours.workDate));
  return { ...d, classPeriods, otherHours };
}

export async function createDriver(ctx: Ctx, f: DriverFields): Promise<{ id: string }> {
  requireRole(ctx, 'payroll');
  checkFields(f);
  try {
    return await db().transaction(async tx => {
      const [row] = await tx.insert(drivers).values({ organizationId: ctx.organizationId, ...f }).returning({ id: drivers.id });
      if (row === undefined) throw new Error('driver insert returned nothing');
      await audit(tx, ctx, 'driver.created', 'driver', row.id);
      return row;
    });
  } catch (e) {
    if (pgCode(e) === '23505') throw invalid('A driver with that id already exists.');
    throw e;
  }
}

export async function updateDriver(ctx: Ctx, driverId: string, f: DriverFields): Promise<void> {
  requireRole(ctx, 'payroll');
  checkFields(f);
  await db().transaction(async tx => {
    const changed = await tx.update(drivers).set({ ...f, updatedAt: ctx.now.toISOString() }).where(and(eq(drivers.organizationId, ctx.organizationId), eq(drivers.id, driverId))).returning({ id: drivers.id });
    if (changed.length === 0) throw notFound();
    await audit(tx, ctx, 'driver.updated', 'driver', driverId);
  }).catch(e => { throw pgCode(e) === '23505' ? invalid('A driver with that id already exists.') : e; });
}

export interface ClassPeriodInput { readonly class: string; readonly from: string; readonly to: string | null; readonly employingIoDriverId: string | null }

function checkPeriod(p: ClassPeriodInput): DriverClass {
  const cls = DRIVER_CLASSES.find(c => c === p.class);
  if (cls === undefined) throw invalid('Choose a driver class.');
  if (!isDate(p.from) || (p.to !== null && !isDate(p.to))) throw invalid('Class period dates must be valid dates.');
  if (p.to !== null && p.to < p.from) throw invalid('The class period ends before it starts.');
  if ((cls === 'IEO') !== (p.employingIoDriverId !== null)) throw invalid(cls === 'IEO' ? 'An IEO period needs the independent operator who employs the driver.' : 'Only an IEO period names an employing operator.');
  return cls;
}

// Two periods for one driver may not cover the same day: the class on a date must be unambiguous.
async function assertNoOverlap(conn: Conn, ctx: Ctx, driverId: string, p: ClassPeriodInput): Promise<void> {
  const existing = await conn.select().from(driverClassPeriods).where(and(eq(driverClassPeriods.organizationId, ctx.organizationId), eq(driverClassPeriods.driverId, driverId)));
  const clash = existing.find(e => (p.to === null || e.fromDate <= p.to) && (e.toDate === null || e.toDate >= p.from));
  if (clash !== undefined) throw invalid(`This period overlaps the ${clash.class} period starting ${clash.fromDate}. End that period first.`);
}

export async function addClassPeriod(ctx: Ctx, driverId: string, p: ClassPeriodInput): Promise<{ id: string }> {
  requireRole(ctx, 'payroll');
  const cls = checkPeriod(p);
  return db().transaction(async tx => {
    const [d] = await tx.select({ id: drivers.id }).from(drivers).where(and(eq(drivers.organizationId, ctx.organizationId), eq(drivers.id, driverId)));
    if (d === undefined) throw notFound();
    if (p.employingIoDriverId !== null) {
      const [io] = await tx.select({ id: drivers.id }).from(drivers).where(and(eq(drivers.organizationId, ctx.organizationId), eq(drivers.id, p.employingIoDriverId)));
      if (io === undefined) throw invalid('The employing operator is not one of your drivers.');
    }
    await assertNoOverlap(tx, ctx, driverId, p);
    const [row] = await tx.insert(driverClassPeriods).values({ organizationId: ctx.organizationId, driverId, class: cls, employingIoDriverId: p.employingIoDriverId, fromDate: p.from, toDate: p.to }).returning({ id: driverClassPeriods.id });
    if (row === undefined) throw new Error('class period insert returned nothing');
    await audit(tx, ctx, 'driver.class_period_added', 'driver', driverId);
    return row;
  });
}

// Ending a period sets its last day. A period is never edited in any other way; a wrong one is removed and re-entered.
export async function endClassPeriod(ctx: Ctx, driverId: string, periodId: string, to: string): Promise<void> {
  requireRole(ctx, 'payroll');
  if (!isDate(to)) throw invalid('Enter a valid end date.');
  await db().transaction(async tx => {
    const [p] = await tx.select().from(driverClassPeriods).where(and(eq(driverClassPeriods.organizationId, ctx.organizationId), eq(driverClassPeriods.driverId, driverId), eq(driverClassPeriods.id, periodId)));
    if (p === undefined) throw notFound();
    if (to < p.fromDate) throw invalid('The class period would end before it starts.');
    await tx.update(driverClassPeriods).set({ toDate: to }).where(and(eq(driverClassPeriods.organizationId, ctx.organizationId), eq(driverClassPeriods.id, periodId)));
    await audit(tx, ctx, 'driver.class_period_ended', 'driver', driverId);
  });
}

export async function removeClassPeriod(ctx: Ctx, driverId: string, periodId: string): Promise<void> {
  requireRole(ctx, 'payroll');
  await db().transaction(async tx => {
    const gone = await tx.delete(driverClassPeriods).where(and(eq(driverClassPeriods.organizationId, ctx.organizationId), eq(driverClassPeriods.driverId, driverId), eq(driverClassPeriods.id, periodId))).returning({ id: driverClassPeriods.id });
    if (gone.length === 0) throw notFound();
    await audit(tx, ctx, 'driver.class_period_removed', 'driver', driverId);
  });
}

export async function addOtherHours(ctx: Ctx, driverId: string, workDate: string, minutes: number): Promise<{ id: string }> {
  requireRole(ctx, 'payroll');
  if (!isDate(workDate)) throw invalid('Enter a valid date.');
  if (!Number.isInteger(minutes) || minutes <= 0) throw invalid('Enter a whole number of minutes greater than zero.');
  return db().transaction(async tx => {
    const [d] = await tx.select({ id: drivers.id, reported: drivers.otherLicenseeHoursReported }).from(drivers).where(and(eq(drivers.organizationId, ctx.organizationId), eq(drivers.id, driverId)));
    if (d === undefined) throw notFound();
    if (d.reported !== true) throw invalid('First record on the driver that hours for other licensees are known.');
    const [row] = await tx.insert(driverOtherHours).values({ organizationId: ctx.organizationId, driverId, workDate, minutes }).returning({ id: driverOtherHours.id });
    if (row === undefined) throw new Error('other hours insert returned nothing');
    await audit(tx, ctx, 'driver.other_hours_added', 'driver', driverId);
    return row;
  });
}

export async function removeOtherHours(ctx: Ctx, driverId: string, entryId: string): Promise<void> {
  requireRole(ctx, 'payroll');
  await db().transaction(async tx => {
    const gone = await tx.delete(driverOtherHours).where(and(eq(driverOtherHours.organizationId, ctx.organizationId), eq(driverOtherHours.driverId, driverId), eq(driverOtherHours.id, entryId))).returning({ id: driverOtherHours.id });
    if (gone.length === 0) throw notFound();
    await audit(tx, ctx, 'driver.other_hours_removed', 'driver', driverId);
  });
}

// The roster in the shape the roster files are written from.
export async function loadRoster(conn: Conn, ctx: Ctx): Promise<RosterDriver[]> {
  const rows = await conn.select().from(drivers).where(eq(drivers.organizationId, ctx.organizationId));
  const periods = await conn.select().from(driverClassPeriods).where(eq(driverClassPeriods.organizationId, ctx.organizationId));
  const hours = await conn.select().from(driverOtherHours).where(eq(driverOtherHours.organizationId, ctx.organizationId));
  const externalOf = new Map(rows.map(d => [d.id, d.externalId]));
  return rows.map(d => ({
    externalId: d.externalId, openingCumulativeMinutes: d.openingCumulativeMinutes, hourlyCoverageFrom: d.hourlyCoverageFrom, fuelBasis: d.fuelBasis,
    calloutsFlagged: d.calloutsFlagged, otherLicenseeHoursReported: d.otherLicenseeHoursReported,
    classPeriods: periods.filter(p => p.driverId === d.id).map(p => ({ class: p.class, from: p.fromDate, to: p.toDate, employingIoExternalId: p.employingIoDriverId === null ? null : externalOf.get(p.employingIoDriverId) ?? null })),
    otherHours: hours.filter(h => h.driverId === d.id).map(h => ({ workDate: h.workDate, minutes: h.minutes })),
  }));
}

export type ImportResult =
  | { readonly kind: 'imported'; readonly created: number; readonly updated: number }
  | { readonly kind: 'refused'; readonly errors: readonly string[]; readonly rejects: readonly Reject[] };

// Reads a driver file through packages/ingest with a drivers-only template. All or nothing: one rejected row imports no one.
// An imported driver replaces that driver's class periods and other-licensee hours with what the file states.
export async function importDrivers(ctx: Ctx, files: readonly SourceFile[], template: unknown): Promise<ImportResult> {
  requireRole(ctx, 'payroll');
  const parsed = parseTemplate(template);
  if (parsed.kind === 'invalid') return { kind: 'refused', errors: parsed.errors, rejects: [] };
  const extra = TABLE_KINDS.filter(k => k !== 'drivers' && k !== 'otherLicenseeHours' && parsed.template.tables[k].kind !== 'none');
  if (extra.length > 0 || parsed.template.tables.drivers.kind !== 'mapped') return { kind: 'refused', errors: ['A driver import template maps the drivers table, optionally hours for other licensees, and nothing else.'], rejects: [] };
  const result = ingest(files, template, ctx.organizationId);
  if (result.kind !== 'completed') return { kind: 'refused', errors: result.errors, rejects: [] };
  if (result.rejects.length > 0) return { kind: 'refused', errors: ['Some rows could not be read. Nothing was imported. Fix the file and import it again.'], rejects: result.rejects };
  const incoming = result.input.drivers;

  try {
    return await db().transaction(async tx => {
      const existing = await tx.select({ id: drivers.id, externalId: drivers.externalId }).from(drivers).where(eq(drivers.organizationId, ctx.organizationId));
      const idOf = new Map(existing.map(d => [d.externalId, d.id]));
      let created = 0;
      for (const d of incoming) {
        const fields = {
          openingCumulativeMinutes: d.openingCumulativeMinutes.kind === 'reported' ? d.openingCumulativeMinutes.value : null,
          hourlyCoverageFrom: d.hourlyCoverageFrom.kind === 'reported' ? d.hourlyCoverageFrom.value : null,
          fuelBasis: d.fuelBasis.kind === 'not_reported' ? null : d.fuelBasis.kind,
          calloutsFlagged: d.callouts.kind === 'flagged' ? true : null,
          otherLicenseeHoursReported: d.otherLicenseeHours.kind === 'reported' ? true : null,
        };
        const known = idOf.get(d.driverId);
        if (known === undefined) {
          const [row] = await tx.insert(drivers).values({ organizationId: ctx.organizationId, externalId: d.driverId, ...fields }).returning({ id: drivers.id });
          if (row === undefined) throw new Error('driver insert returned nothing');
          idOf.set(d.driverId, row.id);
          created += 1;
        } else {
          await tx.update(drivers).set({ ...fields, updatedAt: ctx.now.toISOString() }).where(and(eq(drivers.organizationId, ctx.organizationId), eq(drivers.id, known)));
        }
      }
      for (const d of incoming) {
        const driverId = idOf.get(d.driverId);
        if (driverId === undefined) throw new Error('driver id missing after upsert');
        await tx.delete(driverClassPeriods).where(and(eq(driverClassPeriods.organizationId, ctx.organizationId), eq(driverClassPeriods.driverId, driverId)));
        await tx.delete(driverOtherHours).where(and(eq(driverOtherHours.organizationId, ctx.organizationId), eq(driverOtherHours.driverId, driverId)));
        const sorted = [...d.classPeriods].sort((a, b) => (a.from < b.from ? -1 : 1));
        sorted.forEach((p, i) => {
          const next = sorted[i + 1];
          if (next !== undefined && (p.to === null || p.to >= next.from)) throw invalid(`Driver ${d.driverId}: the class periods starting ${p.from} and ${next.from} overlap. Nothing was imported.`);
        });
        for (const p of sorted) {
          const employer = p.class === 'IEO' ? idOf.get(p.employingIoDriverId) : null;
          if (employer === undefined) throw invalid(`Driver ${d.driverId}: the employing operator named in the file is not a known driver. Nothing was imported.`);
          await tx.insert(driverClassPeriods).values({ organizationId: ctx.organizationId, driverId, class: p.class, employingIoDriverId: employer, fromDate: p.from, toDate: p.to });
        }
        if (d.otherLicenseeHours.kind === 'reported' && d.otherLicenseeHours.entries.length > 0) {
          await tx.insert(driverOtherHours).values(d.otherLicenseeHours.entries.map(e => ({ organizationId: ctx.organizationId, driverId, workDate: e.workDate, minutes: e.minutes })));
        }
      }
      await audit(tx, ctx, 'driver.imported', 'driver', null, { count: incoming.length, created });
      return { kind: 'imported', created, updated: incoming.length - created };
    });
  } catch (e) {
    if (pgCode(e) === '23514') throw invalid('A row in the file breaks a rule for class periods or hours. Nothing was imported.');
    throw e;
  }
}
