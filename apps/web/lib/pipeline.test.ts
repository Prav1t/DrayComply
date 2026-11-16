import { describe, it, expect } from 'vitest';
import { runPipeline } from './pipeline';
import { SAMPLE_CSV, sampleFiles, sampleTemplate } from '../../../packages/ingest/src/testing/sample';

const OPTIONS = { licenseeId: 'L1', licenseeName: 'Sample Drayage Ltd.', asOf: '2026-11-16', rounding: 'half_up' as const, generatedAt: '2026-11-16T20:00:00.000Z' };

describe('web pipeline', () => {
  it('takes the sample exports from files to a binder', () => {
    const r = runPipeline(sampleFiles(), sampleTemplate(), OPTIONS);
    expect(r.kind === 'completed' && r.run.drivers.map(d => d.verdict)).toEqual(['no_shortfall_detected', 'no_shortfall_detected']);
    expect(r.kind === 'completed' && r.binder.summary.driversEvaluated).toBe(2);
  });
  it('is deterministic for the same files, template and options', () => {
    expect(runPipeline(sampleFiles(), sampleTemplate(), OPTIONS)).toEqual(runPipeline(sampleFiles(), sampleTemplate(), OPTIONS));
  });
  it('stops at the template when it is invalid, before reading any file', () => {
    expect(runPipeline([], { id: 'broken' }, OPTIONS)).toMatchObject({ kind: 'stopped', stage: 'template' });
  });
  it('stops at the files when a mapped file is missing', () => {
    expect(runPipeline(sampleFiles().slice(1), sampleTemplate(), OPTIONS)).toMatchObject({ kind: 'stopped', stage: 'files', errors: ['drivers: file drivers.csv was not supplied'] });
  });
  it('stops at the input when the engine refuses it, such as an impossible run date', () => {
    expect(runPipeline(sampleFiles(), sampleTemplate(), { ...OPTIONS, asOf: 'today' })).toMatchObject({ kind: 'stopped', stage: 'input' });
  });
  it('withholds a driver with a rejected row and says so in the binder', () => {
    const files = sampleFiles({ 'payments.csv': (SAMPLE_CSV['payments.csv'] ?? '').replace('IO1,P1,Fuel,63.94', 'IO1,P1,Fuel,oops') });
    const r = runPipeline(files, sampleTemplate(), OPTIONS);
    expect(r.kind === 'completed' && [r.run.drivers.length, r.binder.summary.driversWithheld]).toEqual([1, 1]);
  });
});
