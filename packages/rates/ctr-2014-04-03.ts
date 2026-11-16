// Container Trucking Regulation, B.C. Reg. 248/2014, Part 4, as it read before repeal by B.C. Reg. 144/2019.
// UNVERIFIED TRANSCRIPTION. VERIFY BEFORE USE. Read through an automated page fetch that summarises.
// Hourly rates and the independent operator callout floor only. All money is integer CENTS.

export const SCHEDULE_META = {
  id: 'ctr-2014-04-03',
  label: 'Container Trucking Regulation Part 4, services from 2014-04-03 to 2018-05-31',
  basis: 'Sections 13(1), 15(1) and 18(1) as last in force: the amounts for services before June 1, 2018.',
  // ASSUMPTION: the same employee rates applied from April 3, 2014. The table of earlier versions does not print the
  // section 13 amounts as they read before May 14, 2015 (BC Reg 72/2015); the last text in force states them for all
  // services "before June 1, 2018". The independent operator amounts are printed for that earlier version and match.
  effectiveFrom: '2014-04-03',
  effectiveTo: '2018-05-31',
  sourceUrl: 'https://free.bcpublications.ca/civix/document/id/complete/statreg/248_2014_pit',
  status: 'unverified-transcription',
  verifiedBy: null,
  transcribedOn: '2026-11-16',
  transcription: 'Read through an automated page fetch that summarises; not read from the consolidation by eye.',
} as const;

export const HOURLY_TIER_THRESHOLD_HOURS = 2340;

// Hourly minimums, cents per hour, inclusive of benefits.
export const HOURLY = {
  DEO:       { underThreshold: 2513, atOrOverThreshold: 2628 },  // s. 13
  IEO:       { underThreshold: 2513, atOrOverThreshold: 2628 },  // s. 14: the licensee tops the I/O's payment up to the s. 13 amount
  IO_HOURLY: { underThreshold: 5013, atOrOverThreshold: 5128 },  // s. 15
} as const;

// Part 4 contained no overtime rule.
export const OVERTIME = 'no_rule_in_order' as const;

// s. 18: this amount or the remuneration under s. 12 or s. 15, whichever is greater.
export const IO_CALLOUT_FLOOR_CENTS = 20000;

// NOT TRANSCRIBED, so the engine raises a gap for each: Schedule 1 (off-dock, 25 areas) and Schedule 2 (on-dock);
// the employee callout rule (ss. 16-17, which changed on May 14, 2015); the fuel surcharge (ss. 20-22, quarterly reference price).
// The positioning movement rate did not exist before July 1, 2019.
export const ON_DOCK = null;
export const OFF_DOCK = null;
export const EMPLOYEE_CALLOUT = null;
export const FUEL_SURCHARGE = null;
