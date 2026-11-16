// OBCCTC Rate Order effective 2022-07-01. UNVERIFIED TRANSCRIPTION. VERIFY BEFORE USE.
// Source: the amended order PDF on obcctc.ca. Tables are text in this PDF and are transcribed here.
// All money is integer CENTS.

export const SCHEDULE_META = {
  id: 'obcctc-2022-07-01',
  label: 'OBCCTC Minimum Rates for Drivers, order effective April 1, 2020 as amended July 1, 2022',
  orderedOn: null,                          // no signing date appears in the document
  // ASSUMPTION: the amended figures apply from the amendment date. April 2020 to June 2022 is NOT covered by this file.
  effectiveFrom: '2022-07-01',
  effectiveTo: '2023-06-30',                // the 2023 order keeps prior orders in force through June 30, 2023
  sourceUrl: 'https://obcctc.ca/wp-content/uploads/2022/06/2022-07-01-CTC-Rates-and-Remuneration-FINAL.pdf',
  status: 'unverified-transcription',       // no second person has checked this file against the source
  verifiedBy: null,
  transcribedOn: '2026-11-16',
  transcription: 'Read through an automated page fetch that summarises; not read from the PDF by eye.',
} as const;

// Exact ratio; never a float.
export type Ratio = { readonly num: number; readonly den: number };

export const HOURLY_TIER_THRESHOLD_HOURS = 2340;

export type ZoneLetter = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L'|'M'|'N'|'O'|'P'|'Q'|'R'|'S'|'T'|'U'|'V'|'W'|'X'|'Y'|'Z';

// Appendix I of this order: zone names and letters. Descriptions were not transcribed.
export const ZONES: { item: number; name: string; letter: ZoneLetter }[] = [
  { item: 1, name: 'Abbotsford East', letter: 'A' },
  { item: 2, name: 'Abbotsford West', letter: 'B' },
  { item: 3, name: 'Burnaby North', letter: 'C' },
  { item: 4, name: 'Burnaby South', letter: 'D' },
  { item: 5, name: 'Chilliwack', letter: 'E' },
  { item: 6, name: 'Cloverdale', letter: 'F' },
  { item: 7, name: 'Annacis', letter: 'G' },
  { item: 8, name: 'Delta', letter: 'H' },
  { item: 9, name: 'Tri Cities North', letter: 'I' },
  { item: 10, name: 'Maple Ridge', letter: 'J' },
  { item: 11, name: 'Langley West', letter: 'K' },
  { item: 12, name: 'Langley East', letter: 'L' },
  { item: 13, name: 'Mission', letter: 'M' },
  { item: 14, name: 'New Westminster', letter: 'N' },
  { item: 15, name: 'North Vancouver', letter: 'O' },
  { item: 16, name: 'Pacific Highway', letter: 'P' },
  { item: 17, name: 'Pitt Meadows', letter: 'Q' },
  { item: 18, name: 'Port Kells', letter: 'R' },
  { item: 19, name: 'Tri Cities South', letter: 'S' },
  { item: 20, name: 'Richmond North', letter: 'T' },
  { item: 21, name: 'Richmond South', letter: 'U' },
  { item: 22, name: 'Surrey North', letter: 'V' },
  { item: 23, name: 'Surrey Central', letter: 'W' },
  { item: 24, name: 'Vancouver North', letter: 'X' },
  { item: 25, name: 'Vancouver South', letter: 'Y' },
  { item: 26, name: 'West Vancouver', letter: 'Z' },
];

// Hourly minimums, cents per hour, inclusive of benefits. Tier is collective hours for any licensee.
export const HOURLY = {
  DEO:       { underThreshold: 2762, atOrOverThreshold: 2888 },
  IEO:       { underThreshold: 2762, atOrOverThreshold: 2888 },  // the order states the IEO minimum as the difference up to the DEO rate
  IO_HOURLY: { underThreshold: 6348, atOrOverThreshold: 6493 },
} as const;

// This order contains no overtime rule. The separate order of April 28, 2023 adds one from May 1, 2023.
// The marker says the order was read and has none. null would mean nobody has transcribed it.
export const OVERTIME = 'no_rule_in_order' as const;
export const OVERTIME_FROM_2023_05_01 = {
  effectiveFrom: '2023-05-01',
  orderedOn: '2023-04-28',
  sourceUrl: 'https://obcctc.ca/wp-content/uploads/2023/04/2023-04-28-Overtime-Rates-and-Remuneration-FINAL.pdf',
  multiplier: { num: 3, den: 2 } as Ratio, // 1.5x the DEO applicable hourly rate; DEO and IEO only
  dailyThresholdHours: 9,
  weeklyThresholdHours: 45,
  weekStartsOn: 'sunday',
  onlyFirstNineHoursCountWeekly: true,
} as const;

export const CALLOUT = {
  minContinuousHours: 4,
  deoIeoMultiplierOfHourly: 4,         // no less than 4x the applicable hourly rate
  ioFloorCents: 30000,                 // or the applicable trip rate, whichever is greater
} as const;

// Appendix II of this order - on-dock trip rates, cents, by zone letter and terminal.
// The PDF labels the last row "25"; Appendix I makes it item 26, West Vancouver.
export const ON_DOCK: Record<ZoneLetter, { centermVanterm: number; deltaport: number; fraserSurreyDocks: number }> = {
  A: { centermVanterm: 24020, deltaport: 24020, fraserSurreyDocks: 21090 },  // Abbotsford East
  B: { centermVanterm: 20510, deltaport: 20510, fraserSurreyDocks: 18760 },  // Abbotsford West
  C: { centermVanterm: 12310, deltaport: 16410, fraserSurreyDocks: 12890 },  // Burnaby North
  D: { centermVanterm: 12890, deltaport: 15820, fraserSurreyDocks: 12310 },  // Burnaby South
  E: { centermVanterm: 26350, deltaport: 26350, fraserSurreyDocks: 22850 },  // Chilliwack
  F: { centermVanterm: 15820, deltaport: 15820, fraserSurreyDocks: 14070 },  // Cloverdale
  G: { centermVanterm: 14070, deltaport: 14070, fraserSurreyDocks: 11720 },  // Annacis
  H: { centermVanterm: 15820, deltaport: 11720, fraserSurreyDocks: 11720 },  // Delta
  I: { centermVanterm: 14650, deltaport: 17580, fraserSurreyDocks: 14070 },  // Tri Cities North
  J: { centermVanterm: 18760, deltaport: 19340, fraserSurreyDocks: 15820 },  // Maple Ridge
  K: { centermVanterm: 18170, deltaport: 18170, fraserSurreyDocks: 14070 },  // Langley West
  L: { centermVanterm: 19340, deltaport: 19340, fraserSurreyDocks: 15820 },  // Langley East
  M: { centermVanterm: 21690, deltaport: 22270, fraserSurreyDocks: 19340 },  // Mission
  N: { centermVanterm: 13480, deltaport: 15820, fraserSurreyDocks: 12310 },  // New Westminster
  O: { centermVanterm: 12310, deltaport: 16990, fraserSurreyDocks: 15820 },  // North Vancouver
  P: { centermVanterm: 19340, deltaport: 15820, fraserSurreyDocks: 14070 },  // Pacific Highway
  Q: { centermVanterm: 15820, deltaport: 17580, fraserSurreyDocks: 14070 },  // Pitt Meadows
  R: { centermVanterm: 15820, deltaport: 16990, fraserSurreyDocks: 12890 },  // Port Kells
  S: { centermVanterm: 14070, deltaport: 16990, fraserSurreyDocks: 13480 },  // Tri Cities South
  T: { centermVanterm: 12310, deltaport: 14070, fraserSurreyDocks: 12310 },  // Richmond North
  U: { centermVanterm: 12890, deltaport: 12890, fraserSurreyDocks: 12310 },  // Richmond South
  V: { centermVanterm: 14070, deltaport: 14070, fraserSurreyDocks: 11720 },  // Surrey North
  W: { centermVanterm: 15820, deltaport: 14070, fraserSurreyDocks: 14070 },  // Surrey Central
  X: { centermVanterm: 11720, deltaport: 16410, fraserSurreyDocks: 14650 },  // Vancouver North
  Y: { centermVanterm: 11720, deltaport: 15820, fraserSurreyDocks: 14070 },  // Vancouver South
  Z: { centermVanterm: 12890, deltaport: 17580, fraserSurreyDocks: 16410 },  // West Vancouver
};

// Appendix III of this order - off-dock trip rates, cents, [origin][destination].
export const OFF_DOCK: Record<ZoneLetter, Record<ZoneLetter, number>> = {
  A: { A: 10500, B: 11500, C: 17100, D: 17100, E: 11500, F: 14600, G: 16600, H: 16600, I: 17100, J: 14100, K: 13600, L: 12500, M: 11500, N: 16600, O: 18200, P: 14600, Q: 16600, R: 14600, S: 16600, T: 17600, U: 17100, V: 15600, W: 15100, X: 18200, Y: 17600, Z: 18700 },
  B: { A: 11500, B: 10500, C: 15600, D: 15600, E: 12500, F: 13100, G: 15100, H: 15100, I: 15600, J: 13100, K: 12500, L: 11500, M: 11500, N: 15100, O: 16600, P: 13600, Q: 15600, R: 13600, S: 15100, T: 16100, U: 15600, V: 14100, W: 13600, X: 16600, Y: 16100, Z: 17100 },
  C: { A: 17100, B: 15600, C: 10500, D: 11500, E: 18700, F: 12500, G: 12500, H: 13600, I: 12000, J: 14100, K: 13600, L: 14600, M: 16600, N: 12000, O: 12000, P: 14100, Q: 12500, R: 12500, S: 12000, T: 12000, U: 12500, V: 12000, W: 12500, X: 11500, Y: 11500, Z: 12500 },
  D: { A: 17100, B: 15600, C: 11500, D: 10500, E: 18700, F: 12500, G: 12000, H: 12500, I: 12000, J: 14100, K: 13600, L: 14100, M: 16600, N: 11500, O: 12000, P: 13600, Q: 12500, R: 12500, S: 12000, T: 12000, U: 12500, V: 12000, W: 12500, X: 11500, Y: 11500, Z: 12500 },
  E: { A: 11500, B: 12500, C: 18700, D: 18700, E: 10500, F: 15600, G: 18200, H: 18200, I: 18700, J: 15100, K: 14600, L: 13600, M: 12500, N: 18200, O: 19700, P: 15600, Q: 17600, R: 16100, S: 18200, T: 19200, U: 18700, V: 17100, W: 16600, X: 19700, Y: 19200, Z: 20200 },
  F: { A: 14600, B: 13100, C: 12500, D: 12500, E: 15600, F: 10500, G: 12500, H: 12000, I: 13100, J: 13600, K: 11500, L: 12000, M: 14100, N: 12000, O: 13600, P: 11500, Q: 13100, R: 11500, S: 12500, T: 13100, U: 13100, V: 11500, W: 11500, X: 13600, Y: 13100, Z: 14100 },
  G: { A: 16600, B: 15100, C: 12500, D: 12000, E: 18200, F: 12500, G: 10500, H: 11500, I: 13100, J: 15100, K: 13100, L: 13600, M: 16600, N: 11500, O: 12500, P: 12500, Q: 13600, R: 12500, S: 12500, T: 11500, U: 12000, V: 12000, W: 12000, X: 12500, Y: 12000, Z: 13100 },
  H: { A: 16600, B: 15100, C: 13600, D: 12500, E: 18200, F: 12000, G: 11500, H: 10500, I: 13600, J: 15100, K: 13100, L: 13600, M: 17100, N: 12000, O: 13100, P: 12000, Q: 13600, R: 12500, S: 13100, T: 12000, U: 11500, V: 11500, W: 11500, X: 13100, Y: 12500, Z: 13600 },
  I: { A: 17100, B: 15600, C: 12000, D: 12000, E: 18700, F: 13100, G: 13100, H: 13600, I: 10500, J: 12500, K: 13600, L: 14100, M: 14100, N: 12500, O: 13100, P: 13600, Q: 12000, R: 13100, S: 11500, T: 13100, U: 13600, V: 12000, W: 13100, X: 13100, Y: 13100, Z: 13600 },
  J: { A: 14100, B: 13100, C: 14100, D: 14100, E: 15100, F: 13600, G: 15100, H: 15100, I: 12500, J: 10500, K: 13100, L: 13600, M: 11500, N: 13100, O: 14600, P: 14100, Q: 11500, R: 13600, S: 12500, T: 15600, U: 15600, V: 13600, W: 13600, X: 14600, Y: 15100, Z: 15100 },
  K: { A: 13600, B: 12500, C: 13600, D: 13600, E: 14600, F: 11500, G: 13100, H: 13100, I: 13600, J: 13100, K: 10500, L: 11500, M: 13600, N: 13100, O: 14600, P: 12000, Q: 14100, R: 11500, S: 13100, T: 14100, U: 13600, V: 12000, W: 12000, X: 14100, Y: 14100, Z: 15100 },
  L: { A: 12500, B: 11500, C: 14600, D: 14100, E: 13600, F: 12000, G: 13600, H: 13600, I: 14100, J: 13600, K: 11500, L: 10500, M: 13100, N: 13600, O: 15100, P: 12500, Q: 14600, R: 12000, S: 13600, T: 14600, U: 14100, V: 12500, W: 12500, X: 14600, Y: 14600, Z: 15600 },
  M: { A: 11500, B: 11500, C: 16600, D: 16600, E: 12500, F: 14100, G: 16600, H: 17100, I: 14100, J: 11500, K: 13600, L: 13100, M: 10500, N: 16100, O: 17600, P: 14600, Q: 13100, R: 14100, S: 14100, T: 18200, U: 17600, V: 14600, W: 14600, X: 18200, Y: 18200, Z: 18200 },
  N: { A: 16600, B: 15100, C: 12000, D: 11500, E: 18200, F: 12000, G: 11500, H: 12000, I: 12500, J: 13100, K: 13100, L: 13600, M: 16100, N: 10500, O: 12500, P: 12500, Q: 12500, R: 12000, S: 12000, T: 11500, U: 12000, V: 11500, W: 12000, X: 12000, Y: 12000, Z: 13100 },
  O: { A: 18200, B: 16600, C: 12000, D: 12000, E: 19700, F: 13600, G: 12500, H: 13100, I: 13100, J: 14600, K: 14600, L: 15100, M: 17600, N: 12500, O: 10500, P: 14600, Q: 13600, R: 13600, S: 13100, T: 12000, U: 12500, V: 13100, W: 13600, X: 11500, Y: 12000, Z: 11500 },
  P: { A: 14600, B: 13600, C: 14100, D: 13600, E: 15600, F: 11500, G: 12500, H: 12000, I: 13600, J: 14100, K: 12000, L: 12500, M: 14600, N: 12500, O: 14600, P: 10500, Q: 13600, R: 12500, S: 13100, T: 13100, U: 12500, V: 12000, W: 11500, X: 14100, Y: 13600, Z: 14600 },
  Q: { A: 16600, B: 15600, C: 12500, D: 12500, E: 17600, F: 13100, G: 13600, H: 13600, I: 12000, J: 11500, K: 14100, L: 14600, M: 13100, N: 12500, O: 13600, P: 13600, Q: 10500, R: 13100, S: 12000, T: 13600, U: 14100, V: 12500, W: 13100, X: 13100, Y: 13600, Z: 14100 },
  R: { A: 14600, B: 13600, C: 12500, D: 12500, E: 16100, F: 11500, G: 12500, H: 12500, I: 13100, J: 13600, K: 11500, L: 12000, M: 14100, N: 12000, O: 13600, P: 12500, Q: 13100, R: 10500, S: 12500, T: 13100, U: 13100, V: 11500, W: 12000, X: 13600, Y: 13100, Z: 14100 },
  S: { A: 16600, B: 15100, C: 12000, D: 12000, E: 18200, F: 12500, G: 12500, H: 13100, I: 11500, J: 12500, K: 13100, L: 13600, M: 14100, N: 12000, O: 13100, P: 13100, Q: 12000, R: 12500, S: 10500, T: 12500, U: 13100, V: 11500, W: 12500, X: 12500, Y: 12500, Z: 13600 },
  T: { A: 17600, B: 16100, C: 12000, D: 12000, E: 19200, F: 13100, G: 11500, H: 12000, I: 13100, J: 15600, K: 14100, L: 14600, M: 18200, N: 11500, O: 12000, P: 13100, Q: 13600, R: 13100, S: 12500, T: 10500, U: 11500, V: 12000, W: 12500, X: 11500, Y: 11500, Z: 12500 },
  U: { A: 17100, B: 15600, C: 12500, D: 12500, E: 18700, F: 13100, G: 12000, H: 11500, I: 13600, J: 15600, K: 13600, L: 14100, M: 17600, N: 12000, O: 12500, P: 12500, Q: 14100, R: 13100, S: 13100, T: 11500, U: 10500, V: 12000, W: 12000, X: 12000, Y: 12000, Z: 13100 },
  V: { A: 15600, B: 14100, C: 12000, D: 12000, E: 17100, F: 11500, G: 12000, H: 11500, I: 12000, J: 13600, K: 12000, L: 12500, M: 14600, N: 11500, O: 13100, P: 12000, Q: 12500, R: 11500, S: 11500, T: 12000, U: 12000, V: 10500, W: 11500, X: 13100, Y: 12500, Z: 13100 },
  W: { A: 15100, B: 13600, C: 12500, D: 12500, E: 16600, F: 11500, G: 12000, H: 11500, I: 13100, J: 13600, K: 12000, L: 12500, M: 14600, N: 12000, O: 13600, P: 11500, Q: 13100, R: 12000, S: 12500, T: 12500, U: 12000, V: 11500, W: 10500, X: 13600, Y: 13100, Z: 14100 },
  X: { A: 18200, B: 16600, C: 11500, D: 11500, E: 19700, F: 13600, G: 12500, H: 13100, I: 13100, J: 14600, K: 14100, L: 14600, M: 18200, N: 12000, O: 11500, P: 14100, Q: 13100, R: 13600, S: 12500, T: 11500, U: 12000, V: 13100, W: 13600, X: 10500, Y: 10500, Z: 12000 },
  Y: { A: 17600, B: 16100, C: 11500, D: 11500, E: 19200, F: 13100, G: 12000, H: 12500, I: 13100, J: 15100, K: 14100, L: 14600, M: 18200, N: 12000, O: 12000, P: 13600, Q: 13600, R: 13100, S: 12500, T: 11500, U: 12000, V: 12500, W: 13100, X: 10500, Y: 10500, Z: 12500 },
  Z: { A: 18700, B: 17100, C: 12500, D: 12500, E: 20200, F: 14100, G: 13100, H: 13600, I: 13600, J: 15100, K: 15100, L: 15600, M: 18200, N: 13100, O: 11500, P: 14600, Q: 14100, R: 14100, S: 13600, T: 12500, U: 13100, V: 13100, W: 14100, X: 12000, Y: 12500, Z: 10500 },
};

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
