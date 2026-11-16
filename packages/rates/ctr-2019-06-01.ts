// Container Trucking Regulation, B.C. Reg. 248/2014, Part 4, as it read before repeal by B.C. Reg. 144/2019.
// UNVERIFIED TRANSCRIPTION. VERIFY BEFORE USE. Read through an automated page fetch that summarises.
// Hourly rates and the independent operator callout floor only. All money is integer CENTS.

export const SCHEDULE_META = {
  id: 'ctr-2019-06-01',
  label: 'Container Trucking Regulation Part 4, services from 2019-06-01 to 2019-06-30',
  basis: 'Sections 13(3) item 2 and 15(2.1) item 2, as amended by BC Reg 94/2019: on or after June 1, 2019, until repeal on July 1, 2019.',
  effectiveFrom: '2019-06-01',
  effectiveTo: '2019-06-30',
  sourceUrl: 'https://free.bcpublications.ca/civix/document/id/complete/statreg/248_2014_pit',
  status: 'unverified-transcription',
  verifiedBy: null,
  transcribedOn: '2026-11-16',
  transcription: 'Read through an automated page fetch that summarises; not read from the consolidation by eye.',
} as const;

export const HOURLY_TIER_THRESHOLD_HOURS = 2340;

// Hourly minimums, cents per hour, inclusive of benefits.
export const HOURLY = {
  DEO:       { underThreshold: 2630, atOrOverThreshold: 2750 },  // s. 13
  IEO:       { underThreshold: 2630, atOrOverThreshold: 2750 },  // s. 14: the licensee tops the I/O's payment up to the s. 13 amount
  IO_HOURLY: { underThreshold: 5246, atOrOverThreshold: 5366 },  // s. 15
} as const;

// Part 4 contained no overtime rule.
export const OVERTIME = 'no_rule_in_order' as const;

// s. 18: this amount or the remuneration under s. 12 or s. 15, whichever is greater.
export const IO_CALLOUT_FLOOR_CENTS = 30000;

// NOT TRANSCRIBED, so the engine raises a gap for each: Schedule 1 (off-dock, 25 areas) and Schedule 2 (on-dock);
// the employee callout rule (ss. 16-17, which changed on May 14, 2015); the fuel surcharge (ss. 20-22, quarterly reference price).
// The positioning movement rate did not exist before July 1, 2019.
export const ON_DOCK = null;
export const OFF_DOCK = null;
export const EMPLOYEE_CALLOUT = null;
export const FUEL_SURCHARGE = null;
