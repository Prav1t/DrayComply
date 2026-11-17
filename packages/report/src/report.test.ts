// Sample exports through ingest, the engine, the binder and the PDF.
import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildBinder, formatCents, formatDelta, DISCLAIMER } from './binder';
import { layout } from './layout';
import { renderPdf } from './pdf';
import { ingest } from '../../ingest/src/index';
import { SAMPLE_CSV, sampleFiles, sampleTemplate } from '../../ingest/src/testing/sample';
import { runCompliance } from '../../engine/src/index';
import { DEDUCTION_POLICY, OBCCTC_SCHEDULES } from '../../engine/src/adapters/obcctc';

const META = { licenseeName: 'Sample Drayage Ltd.', generatedAt: '2026-11-16T20:00:00.000Z', preparedBy: 'test' };
const OPTIONS = { asOf: '2026-11-16', rounding: 'half_up' as const, deductionPolicy: DEDUCTION_POLICY };

function binderFor(replace: Record<string, string> = {}) {
  const ingested = ingest(sampleFiles(replace), sampleTemplate(), 'L1');
  if (ingested.kind !== 'completed') throw new Error(ingested.errors.join('; '));
  const run = runCompliance(ingested.input, OBCCTC_SCHEDULES, OPTIONS);
  if (run.kind !== 'completed') throw new Error(run.errors.join('; '));
  return buildBinder(run, ingested, META);
}
const swap = (file: string, find: string, to: string): Record<string, string> => ({ [file]: (SAMPLE_CSV[file] ?? '').replace(find, to) });
const allText = (b: ReturnType<typeof binderFor>): string => layout(b).map(x => ('text' in x ? x.text : 'label' in x ? `${x.label} ${x.value}` : '')).join('\n');

describe('formatting', () => {
  it('formats cents with a thousands comma and a leading minus', () => {
    expect([formatCents(0), formatCents(5), formatCents(123_456), formatCents(-190_000)]).toEqual(['$0.00', '$0.05', '$1,234.56', '-$1,900.00']);
  });
  it('says short, over or level, and marks rounding-only', () => {
    expect(formatDelta({ kind: 'computed', cents: -1_900, exact: { num: '-1900', den: '1' }, roundingOnly: false })).toBe('-$19.00 (short)');
    expect(formatDelta({ kind: 'computed', cents: -1, exact: { num: '-1', den: '2' }, roundingOnly: true })).toBe('-$0.01 (short; rounding only)');
    expect(formatDelta({ kind: 'not_computable' })).toBe('not computable (see gaps)');
  });
});

describe('binder', () => {
  const clean = binderFor();

  it('summarises a clean run', () => {
    expect(clean.summary).toMatchObject({
      driversEvaluated: 2, driversWithheld: 0, aggregateShortfallCents: 0, segregatedShortfallCents: 0, rejectedRows: 0, gapCount: 0,
      byVerdict: { no_shortfall_detected: 2, shortfall_aggregate: 0, shortfall_segregated_only: 0, insufficient_data: 0 },
    });
  });
  it('carries no unverified-rates notice when only the verified schedule priced the run', () => {
    expect(clean.header.unverifiedRatesNotice).toBeNull();
    expect(clean.schedules.map(s => [s.id, s.status])).toEqual([['obcctc-2026-07-01', 'verified'], ['obcctc-fuel-surcharge-published', 'verified']]);
  });
  it('lists every input file with its hash, and the template', () => {
    expect(clean.manifest.map(m => m.name)).toEqual(['drivers.csv', 'periods.csv', 'hours.csv', 'trips.csv', 'payments.csv']);
    clean.manifest.forEach(m => expect(m.sha256).toMatch(/^[0-9a-f]{64}$/));
    expect(clean.inputSources.at(-1)?.name).toBe('template:sample-template@v1');
  });
  it('always states the scope, including what the engine does not implement', () => {
    expect(clean.scope.join(' ')).toContain('IEO indemnification offset is not implemented');
    expect(clean.scope).toContain('Every row was read. No value was inferred or defaulted.');
  });
  it('gives each driver a worksheet showing both comparisons side by side', () => {
    const labels = clean.worksheets[1]?.periods[0]?.figures.map(f => f.label) ?? [];
    expect(labels.slice(0, 2)).toEqual(['Aggregate comparison', 'Segregated comparison']);
    expect(clean.worksheets.map(w => w.driverId)).toEqual(['D1', 'IO1']);
  });
  it('totals shortfalls on both comparisons when a trip is underpaid', () => {
    const short = binderFor(swap('payments.csv', 'IO1,P1,Trip,139.00', 'IO1,P1,Trip,120.00'));
    expect([short.summary.aggregateShortfallCents, short.summary.segregatedShortfallCents]).toEqual([1_900, 1_900]);
    expect(short.summary.byVerdict.shortfall_aggregate).toBe(1);
    expect(short.findings.map(f => f.ruleId)).toContain('TRIP_RATE_BELOW_MINIMUM');
  });
  it('never nets one driver\'s surplus against another driver\'s shortfall in the totals', () => {
    // D1 is paid $5.00 over; IO1's trip is $19.00 short. The total short is $19.00, not $14.00.
    const mixed = binderFor({ 'payments.csv': (SAMPLE_CSV['payments.csv'] ?? '').replace('"$293.76"', '"$298.76"').replace('IO1,P1,Trip,139.00', 'IO1,P1,Trip,120.00') });
    expect([mixed.summary.aggregateShortfallCents, mixed.summary.segregatedShortfallCents]).toEqual([1_900, 1_900]);
  });
  it('states in the header that unverified rates were used, whenever they were', () => {
    // A June 2026 pay period is priced under the unverified 2025 transcription.
    const june = binderFor({
      'periods.csv': (SAMPLE_CSV['periods.csv'] ?? '').replace('D1,P1,2026-07-05,2026-07-18,2026-07-24', 'D1,P1,2026-06-07,2026-06-20,2026-06-26'),
      'hours.csv': 'Driver,Date,Hours\nD1,2026-06-08,8.5',
      'payments.csv': (SAMPLE_CSV['payments.csv'] ?? '').replace('"$293.76",2026-07-05,2026-07-18', '"$287.73",2026-06-07,2026-06-20'),
    });
    expect(june.header.unverifiedRatesNotice).toContain('UNVERIFIED RATES WERE USED');
    expect(june.header.unverifiedRatesNotice).toContain('obcctc-2025-07-01');
    expect(layout(june).findIndex(b => b.kind === 'notice')).toBe(2);   // directly under the title and licensee
  });
  it('reports rejected rows and withheld drivers, and says no figure covers them', () => {
    const bad = binderFor(swap('payments.csv', 'IO1,P1,Fuel,63.94', 'IO1,P1,Fuel,sixty'));
    expect([bad.summary.driversEvaluated, bad.summary.driversWithheld, bad.summary.rejectedRows]).toEqual([1, 1, 1]);
    expect(bad.scope.join(' ')).toContain('1 driver(s) were withheld from the calculation');
    expect(allText(bad)).toContain('payments.csv row 5, payments.amount: amount is not a number (value: "sixty")');
  });
  it('shows gaps and insufficient data when a value is missing', () => {
    const gap = binderFor(swap('periods.csv', 'licensee,50.00', 'licensee,'));
    expect(gap.summary.byVerdict.insufficient_data).toBe(1);
    expect(gap.gaps.map(g => g.code)).toEqual(['WAIT_TIME_NOT_REPORTED']);
    expect(allText(gap)).toContain('not computable (see gaps)');
  });
  it('says the totals leave out the pay period that could not be computed', () => {
    const gap = binderFor(swap('periods.csv', 'licensee,50.00', 'licensee,'));
    expect([gap.summary.periodsTotal, gap.summary.periodsNotComputable]).toEqual([2, 1]);
    expect(allText(gap)).toContain('Totals cover 1 of 2 pay period(s). The other 1 could not be computed and are not in the totals.');
  });
  it('prints "Not computed", never $0.00, when every driver was withheld', () => {
    const none = binderFor({ 'payments.csv': (SAMPLE_CSV['payments.csv'] ?? '').replace('"$293.76"', 'abc').replace('IO1,P1,Fuel,63.94', 'IO1,P1,Fuel,sixty') });
    expect(none.summary.driversEvaluated).toBe(0);
    expect(allText(none)).toContain('Total shortfall, aggregate comparison Not computed');
    expect(allText(none)).toContain('Total shortfall, segregated comparison Not computed');
    expect(allText(none)).not.toContain('Total shortfall, aggregate comparison $0.00');
  });
  it('never says compliant, and always carries the disclaimer', () => {
    [clean, binderFor(swap('payments.csv', 'IO1,P1,Trip,139.00', 'IO1,P1,Trip,120.00'))].forEach(b => {
      expect(allText(b).toLowerCase()).not.toContain('compliant');
      expect(allText(b)).toContain(DISCLAIMER);
      expect(allText(b)).toContain('under the rules as encoded, for the data provided');
    });
  });
});

describe('pdf', () => {
  it('renders a readable PDF with one worksheet page per driver after the front matter', async () => {
    const pdf = await renderPdf(binderFor());
    expect(new TextDecoder('latin1').decode(pdf.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
    expect(doc.getTitle()).toBe('Driver Remuneration Calculation Binder - Sample Drayage Ltd.');
  });
  it('is byte-for-byte reproducible for the same binder', async () => {
    const [a, b] = [await renderPdf(binderFor()), await renderPdf(binderFor())];
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
  it('does not fail on names outside Latin-1', async () => {
    const b = binderFor();
    const pdf = await renderPdf({ ...b, header: { ...b.header, licenseeName: 'ਸਿੰਘ Transport 株式会社' } });
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
