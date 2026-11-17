// Release safety: the watermark and the list of unreviewed legal interpretations.
import { describe, it, expect } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { buildBinder, WATERMARK, type BinderMeta } from './binder';
import { layout } from './layout';
import { renderPdf } from './pdf';
import { interpretationsRelied, isReviewed, pendingLegalReview, type LegalInterpretation } from './interpretations';
import { ingest } from '../../ingest/src/index';
import { DEDUCTIONS_TABLE, SAMPLE_CSV, sampleFiles, sampleTemplate } from '../../ingest/src/testing/sample';
import { runCompliance } from '../../engine/src/index';
import { DEDUCTION_POLICY, OBCCTC_SCHEDULES } from '../../engine/src/adapters/obcctc';
import { LEGAL_INTERPRETATIONS } from '../../rates/legal-interpretations';

const META: BinderMeta = { licenseeName: 'Sample Drayage Ltd.', generatedAt: '2026-11-16T20:00:00.000Z', preparedBy: 'test', interpretations: LEGAL_INTERPRETATIONS, extraScope: [] };
const OPTIONS = { asOf: '2026-11-16', rounding: 'half_up' as const, deductionPolicy: DEDUCTION_POLICY };

function runFor(replace: Record<string, string> = {}, template: unknown = sampleTemplate()) {
  const ingested = ingest(sampleFiles(replace), template, 'L1');
  if (ingested.kind !== 'completed') throw new Error(ingested.errors.join('; '));
  const run = runCompliance(ingested.input, OBCCTC_SCHEDULES, OPTIONS);
  if (run.kind !== 'completed') throw new Error(run.errors.join('; '));
  return { run, ingested };
}
const binderFor = (replace: Record<string, string> = {}, meta = META) => { const r = runFor(replace); return buildBinder(r.run, r.ingested, meta); };

// A June 2026 pay period is priced under the unverified 2025 transcription.
const JUNE = {
  'periods.csv': (SAMPLE_CSV['periods.csv'] ?? '').replace('D1,P1,2026-07-05,2026-07-18,2026-07-24', 'D1,P1,2026-06-07,2026-06-20,2026-06-26'),
  'hours.csv': 'Driver,Date,Hours\nD1,2026-06-08,8.5',
  'payments.csv': (SAMPLE_CSV['payments.csv'] ?? '').replace('"$293.76",2026-07-05,2026-07-18', '"$287.73",2026-06-07,2026-06-20'),
};

// Every page's drawing instructions, inflated. Text is drawn as hex strings.
async function pageStreams(pdf: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(pdf);
  return doc.getPages().map(page => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => doc.context.lookup(ref)) : [contents];
    return streams.map(s => (s instanceof PDFRawStream ? new TextDecoder('latin1').decode(decodePDFRawStream(s).decode()) : '')).join('\n');
  });
}
const hex = (text: string): string => [...text].map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join('');

describe('unverified rates watermark', () => {
  it('is absent when only verified schedules priced the run', async () => {
    const b = binderFor();
    expect(b.header.watermark).toBeNull();
    const pages = await pageStreams(await renderPdf(b));
    pages.forEach(p => expect(p).not.toContain(hex(WATERMARK)));
  });
  it('is the exact required wording', () => {
    expect(WATERMARK).toBe('UNVERIFIED RATES - NOT FOR RELIANCE');
  });
  it('is painted on every page when an unverified schedule priced anything', async () => {
    const b = binderFor(JUNE);
    expect(b.header.watermark).toBe(WATERMARK);
    const pdf = await renderPdf(b);
    const pages = await pageStreams(pdf);
    expect(pages.length).toBeGreaterThanOrEqual(3);
    pages.forEach(p => expect(p).toContain(hex(WATERMARK)));
    expect((await PDFDocument.load(pdf)).getSubject()).toBe(WATERMARK);
  });
});

describe('legal interpretations', () => {
  const reviewed = (ids: readonly string[]): LegalInterpretation[] =>
    LEGAL_INTERPRETATIONS.map(i => (ids.includes(i.id) ? { ...i, status: 'reviewed' as const, reviewedBy: 'A. Lawyer, 2027-01-05' } : i));

  it('none in the registry has been reviewed', () => {
    expect(LEGAL_INTERPRETATIONS.filter(isReviewed)).toEqual([]);
    expect(new Set(LEGAL_INTERPRETATIONS.map(i => i.id)).size).toBe(LEGAL_INTERPRETATIONS.length);
  });
  it('a clean 2026 run relies on the always-on readings and the rules it evaluated, and no others', () => {
    const { run } = runFor();
    expect(interpretationsRelied(run, LEGAL_INTERPRETATIONS).map(i => i.id)).toEqual(['LI-01', 'LI-02', 'LI-06', 'LI-07', 'LI-08']);
  });
  it('adds the deduction readings when a deduction is classified', () => {
    const { run } = runFor({ 'deductions.csv': 'Driver,Period,Reason,Amount\nIO1,P1,Chassis Rent,40.00' }, sampleTemplate({ deductions: DEDUCTIONS_TABLE }));
    const ids = interpretationsRelied(run, LEGAL_INTERPRETATIONS).map(i => i.id);
    expect(ids).toContain('LI-03');
    expect(ids).toContain('LI-04');
  });
  it('adds the effective-date reading only when an older schedule priced something', () => {
    expect(interpretationsRelied(runFor().run, LEGAL_INTERPRETATIONS).map(i => i.id)).not.toContain('LI-09');
    const old = { ...runFor().run, provenance: { ...runFor().run.provenance, scheduleIds: ['obcctc-2020-04-01'] } };
    expect(interpretationsRelied(old, LEGAL_INTERPRETATIONS).map(i => i.id)).toContain('LI-09');
  });
  it('the binder states the notice in the header and lists each pending reading with its alternative', () => {
    const b = binderFor();
    expect(b.header.legalReviewNotice).toContain('PENDING LEGAL REVIEW');
    expect(b.header.legalReviewNotice).toContain('LI-01, LI-02, LI-06, LI-07, LI-08');
    const text = layout(b).map(x => ('text' in x ? x.text : 'label' in x ? `${x.label} ${x.value}` : '')).join('\n');
    expect(text).toContain('8. Legal interpretations pending review');
    expect(text).toContain('LI-01: Two comparisons: aggregate and segregated pending legal review');
    expect(text).toContain('Other reading: The Commissioner may apply only one of the two');
  });
  it('drops a reading from the pending list only when it is reviewed by a named person', () => {
    const { run } = runFor();
    expect(pendingLegalReview(run, reviewed(['LI-01'])).map(i => i.id)).toEqual(['LI-02', 'LI-06', 'LI-07', 'LI-08']);
    const unnamed = LEGAL_INTERPRETATIONS.map(i => (i.id === 'LI-01' ? { ...i, status: 'reviewed' as const, reviewedBy: null } : i));
    expect(pendingLegalReview(run, unnamed).map(i => i.id)).toContain('LI-01');
  });
  it('carries no notice once every reading relied on is reviewed', () => {
    const b = binderFor({}, { ...META, interpretations: reviewed(LEGAL_INTERPRETATIONS.map(i => i.id)) });
    expect(b.header.legalReviewNotice).toBeNull();
    expect(b.pendingLegalReview).toEqual([]);
  });
  it('prints scope limits supplied by the caller', () => {
    const b = binderFor({}, { ...META, extraScope: ['3 driver(s) in the data were not selected for this run.'] });
    expect(b.scope).toContain('3 driver(s) in the data were not selected for this run.');
  });
});
