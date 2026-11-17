import { describe, it, expect } from 'vitest';
import { totalsView } from './totals';

describe('totalsView', () => {
  it('shows dollar totals and full coverage when every pay period was computed', () => {
    expect(totalsView(11_776, 11_776, 2, 0)).toEqual({ aggregate: '$117.76', segregated: '$117.76', coverage: 'Totals cover all 2 pay period(s).' });
  });
  it('never shows $0.00 when nothing was computed: no drivers, or every period short of data', () => {
    expect(totalsView(0, 0, 0, 0).aggregate).toBe('Not computed');
    expect(totalsView(0, 0, 3, 3)).toEqual({ aggregate: 'Not computed', segregated: 'Not computed', coverage: 'No pay period could be computed, so there is no total.' });
  });
  it('says how many pay periods the totals leave out', () => {
    expect(totalsView(500, 0, 5, 2).coverage).toBe('Totals cover 3 of 5 pay period(s). The other 2 could not be computed and are not in the totals.');
  });
});
