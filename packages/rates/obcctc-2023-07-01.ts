// OBCCTC Rate Order effective 2023-07-01. UNVERIFIED TRANSCRIPTION. VERIFY BEFORE USE.
// Source: the signed order PDF on obcctc.ca. Scalars only: the trip rate appendices are images.
// All money is integer CENTS.

export const SCHEDULE_META = {
  id: 'obcctc-2023-07-01',
  label: 'OBCCTC Rate Order effective July 1, 2023',
  orderedOn: '2023-06-07',
  effectiveFrom: '2023-07-01',
  effectiveTo: '2024-06-30',                  // the next order keeps prior orders in force up to and including this date
  sourceUrl: 'https://obcctc.ca/wp-content/uploads/2023/07/2023-06-07-Rate-Order-FINAL-Revised.pdf',
  status: 'unverified-transcription',       // no second person has checked this file against the source
  verifiedBy: null,
  transcribedOn: '2026-11-16',
  transcription: 'Read through an automated page fetch that summarises; not read from the PDF by eye.',
} as const;

// Exact ratio; never a float.
export type Ratio = { readonly num: number; readonly den: number };

export const HOURLY_TIER_THRESHOLD_HOURS = 2340;

// Hourly minimums, cents per hour, inclusive of benefits. Tier is collective hours for any licensee.
export const HOURLY = {
  DEO:       { underThreshold: 3033, atOrOverThreshold: 3167 },
  IEO:       { underThreshold: 3033, atOrOverThreshold: 3167 },  // the order sets IEO equal to DEO
  IO_HOURLY: { underThreshold: 6786, atOrOverThreshold: 6941 },
} as const;

export const OVERTIME = {
  multiplier: { num: 3, den: 2 } as Ratio, // 1.5x; DEO and IEO only
  dailyThresholdHours: 9,
  weeklyThresholdHours: 45,
  weekStartsOn: 'sunday',              // Sunday to Saturday
  onlyFirstNineHoursCountWeekly: true,
} as const;

export const CALLOUT = {
  minContinuousHours: 4,
  deoIeoMultiplierOfHourly: 4,         // no less than 4x the applicable hourly rate
  ioFloorCents: 32000,                 // or the applicable trip rate, whichever is greater
} as const;

// Appendix I (on-dock) and Appendix III (off-dock) are images in the PDF and could not be read.
// null is deliberate: the engine treats these as absent and raises a gap. See NEEDS_HUMAN.md.
export const ON_DOCK = null;
export const OFF_DOCK = null;

export const POSITIONING_MOVEMENT = {
  cents: 2500,                         // $25 per on- or off-dock trip rate payment, 1 container on a single chassis
  twoContainerMultiplier: { num: 3, den: 2 } as Ratio, // 1.5x; 2 containers on multiple chassis
  mustAppearSeparatelyOnPayStatement: true,
} as const;

// The order attaches the 1.5x two-container rule to the off-dock rate only.
export const MULTI_CONTAINER = {
  offDockTwoContainerTripMultiplier: { num: 3, den: 2 } as Ratio,
} as const;

// Fuel surcharge: ((A - 1.05) / 0.05) * B * 2%, B excluding the positioning movement rate. Calendar-month basis.
export const FUEL_SURCHARGE = {
  thresholdCentsPerLitre: 105,
  stepCentsPerLitre: 5,
  pctPerStep: 2,
  roundReferenceDownToCents: 5,
  excludesPositioningMovementRate: true,
  referenceSource: 'Kalibrate average Vancouver retail diesel incl. taxes, prior month; or the I/O discounted purchase price, whichever is lower',
} as const;
