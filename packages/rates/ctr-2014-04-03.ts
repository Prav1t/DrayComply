// Container Trucking Regulation, B.C. Reg. 248/2014, Part 4, as it read before repeal by B.C. Reg. 144/2019.
// UNVERIFIED TRANSCRIPTION. VERIFY BEFORE USE. Read through an automated page fetch that summarises.
// Hourly rates, the I/O callout floor, Schedule 1 (off-dock) and Schedule 2 (on-dock). All money is integer CENTS.

export const SCHEDULE_META = {
  id: 'ctr-2014-04-03',
  label: 'Container Trucking Regulation Part 4, services from 2014-04-03 to 2018-05-31',
  basis: 'Sections 12, 13(1), 15(1) and 18(1) and Schedules 1 and 2 as they read for services before June 1, 2018.',
  // ASSUMPTION: the same employee rates applied from April 3, 2014. The table of earlier versions does not print the
  // section 13 amounts as they read before May 14, 2015 (BC Reg 72/2015); the last text in force states them for all
  // services "before June 1, 2018". The independent operator amounts are printed for that earlier version and match.
  // ASSUMPTION: BC Reg 92/2018 re-enacted both Schedules on May 4, 2018, but section 19(4) made the increases payable
  // only from June 1, 2018, so these tables are applied through May 31, 2018.
  effectiveFrom: '2014-04-03',
  effectiveTo: '2018-05-31',
  sourceUrl: 'https://free.bcpublications.ca/civix/document/id/complete/statreg/248_2014_pit',
  status: 'unverified-transcription',
  verifiedBy: null,
  transcribedOn: '2026-11-16',
  transcription: 'Read through an automated page fetch that summarises; not read from the consolidation by eye.',
} as const;

// Exact ratio; never a float.
export type Ratio = { readonly num: number; readonly den: number };

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

export type ZoneLetter = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L'|'M'|'N'|'O'|'P'|'Q'|'R'|'S'|'T'|'U'|'V'|'W'|'X'|'Y';

// Item 8 was "Delta North" (part of Delta under OCP Bylaw No. 3950) until BC Reg 186/2016 made it the City of Delta on July 20, 2016.
// Schedule 1, Table 1: 25 areas. Boundary descriptions were not transcribed.
export const ZONES: { item: number; name: string; letter: ZoneLetter }[] = [
  { item: 1, name: 'Abbotsford', letter: 'A' },
  { item: 2, name: 'Annacis Island', letter: 'B' },
  { item: 3, name: 'Burnaby North', letter: 'C' },
  { item: 4, name: 'Burnaby South', letter: 'D' },
  { item: 5, name: 'Chilliwack', letter: 'E' },
  { item: 6, name: 'Cloverdale', letter: 'F' },
  { item: 7, name: 'Coquitlam', letter: 'G' },
  { item: 8, name: 'Delta North', letter: 'H' },
  { item: 9, name: 'Fort Langley/Aldergrove', letter: 'I' },
  { item: 10, name: 'Haney/Maple Ridge', letter: 'J' },
  { item: 11, name: 'Langley City', letter: 'K' },
  { item: 12, name: 'Langley South', letter: 'L' },
  { item: 13, name: 'Mission', letter: 'M' },
  { item: 14, name: 'New Westminster', letter: 'N' },
  { item: 15, name: 'North Vancouver', letter: 'O' },
  { item: 16, name: 'Pacific Highway', letter: 'P' },
  { item: 17, name: 'Pitt Meadows', letter: 'Q' },
  { item: 18, name: 'Port Kells', letter: 'R' },
  { item: 19, name: 'Port Moody/Port Coquitlam', letter: 'S' },
  { item: 20, name: 'Richmond North', letter: 'T' },
  { item: 21, name: 'Richmond South', letter: 'U' },
  { item: 22, name: 'Surrey North', letter: 'V' },
  { item: 23, name: 'Surrey South', letter: 'W' },
  { item: 24, name: 'Vancouver', letter: 'X' },
  { item: 25, name: 'West Vancouver', letter: 'Y' },
];
export const ZONE_H_FROM_2016_07_20 = { effectiveFrom: '2016-07-20', name: 'City of Delta' } as const;

// Schedule 2 - on-dock trip rates, cents, by area letter and terminal. Any other terminal: a rate set by the commissioner.
export const ON_DOCK: Record<ZoneLetter, { centermVanterm: number; deltaport: number; fraserSurreyDocks: number }> = {
  A: { centermVanterm: 19600, deltaport: 19600, fraserSurreyDocks: 17920 },  // Abbotsford
  B: { centermVanterm: 13440, deltaport: 13440, fraserSurreyDocks: 11200 },  // Annacis Island
  C: { centermVanterm: 11760, deltaport: 15120, fraserSurreyDocks: 12320 },  // Burnaby North
  D: { centermVanterm: 12320, deltaport: 15120, fraserSurreyDocks: 11760 },  // Burnaby South
  E: { centermVanterm: 22400, deltaport: 22400, fraserSurreyDocks: 20720 },  // Chilliwack
  F: { centermVanterm: 15120, deltaport: 15120, fraserSurreyDocks: 12880 },  // Cloverdale
  G: { centermVanterm: 12880, deltaport: 15120, fraserSurreyDocks: 12320 },  // Coquitlam
  H: { centermVanterm: 15120, deltaport: 11200, fraserSurreyDocks: 11200 },  // Delta
  I: { centermVanterm: 17360, deltaport: 18480, fraserSurreyDocks: 15120 },  // Fort Langley/Aldergrove
  J: { centermVanterm: 15680, deltaport: 17920, fraserSurreyDocks: 15120 },  // Haney/Maple Ridge
  K: { centermVanterm: 16240, deltaport: 15120, fraserSurreyDocks: 13440 },  // Langley City
  L: { centermVanterm: 18480, deltaport: 13440, fraserSurreyDocks: 13440 },  // Langley South
  M: { centermVanterm: 19600, deltaport: 20720, fraserSurreyDocks: 18480 },  // Mission
  N: { centermVanterm: 12880, deltaport: 15120, fraserSurreyDocks: 11760 },  // New Westminster
  O: { centermVanterm: 11760, deltaport: 15680, fraserSurreyDocks: 15120 },  // North Vancouver
  P: { centermVanterm: 18480, deltaport: 13440, fraserSurreyDocks: 13440 },  // Pacific Highway
  Q: { centermVanterm: 15120, deltaport: 16800, fraserSurreyDocks: 13440 },  // Pitt Meadows
  R: { centermVanterm: 15120, deltaport: 16240, fraserSurreyDocks: 12320 },  // Port Kells
  S: { centermVanterm: 13440, deltaport: 16240, fraserSurreyDocks: 12880 },  // Port Moody/Port Coquitlam
  T: { centermVanterm: 11760, deltaport: 13440, fraserSurreyDocks: 11760 },  // Richmond North
  U: { centermVanterm: 12320, deltaport: 12320, fraserSurreyDocks: 11760 },  // Richmond South
  V: { centermVanterm: 13440, deltaport: 13440, fraserSurreyDocks: 11200 },  // Surrey North
  W: { centermVanterm: 15120, deltaport: 13440, fraserSurreyDocks: 13440 },  // Surrey South
  X: { centermVanterm: 11200, deltaport: 15120, fraserSurreyDocks: 13440 },  // Vancouver
  Y: { centermVanterm: 12320, deltaport: 16240, fraserSurreyDocks: 15680 },  // West Vancouver
};

// Schedule 1, Table 2 as first enacted - off-dock trip rates, cents, [origin][destination].
// NOT SYMMETRIC, as printed: F to K is 11000 but K to F is 10000; I to K is 10000 but K to I is 11000. BC Reg 186/2016 replaced rows F and I.
export const OFF_DOCK: Record<ZoneLetter, Record<ZoneLetter, number>> = {
  A: { A: 10000, B: 13000, C: 13500, D: 13000, E: 11000, F: 12500, G: 13000, H: 12000, I: 11000, J: 11500, K: 11500, L: 11000, M: 11000, N: 13500, O: 14500, P: 11500, Q: 12000, R: 12000, S: 13500, T: 13000, U: 12500, V: 12500, W: 12000, X: 14000, Y: 15000 },
  B: { A: 13000, B: 10000, C: 12000, D: 11500, E: 13500, F: 12000, G: 11500, H: 11000, I: 12000, J: 13500, K: 12500, L: 12000, M: 14000, N: 11000, O: 12000, P: 12000, Q: 13000, R: 12000, S: 12000, T: 11000, U: 11500, V: 11500, W: 11500, X: 11500, Y: 12500 },
  C: { A: 13500, B: 12000, C: 10000, D: 11000, E: 14000, F: 12000, G: 11000, H: 13000, I: 12500, J: 12500, K: 12500, L: 13000, M: 13000, N: 11500, O: 11500, P: 13000, Q: 12000, R: 12000, S: 11500, T: 11500, U: 12000, V: 11500, W: 12000, X: 11000, Y: 12000 },
  D: { A: 13000, B: 11500, C: 11000, D: 10000, E: 14000, F: 12000, G: 11500, H: 12000, I: 12500, J: 13000, K: 12500, L: 13000, M: 13000, N: 11000, O: 11500, P: 13500, Q: 12000, R: 12000, S: 11500, T: 11500, U: 12000, V: 11500, W: 12000, X: 11000, Y: 12000 },
  E: { A: 11000, B: 13500, C: 14000, D: 14000, E: 10000, F: 12500, G: 13500, H: 13000, I: 11500, J: 12000, K: 12000, L: 12500, M: 11500, N: 13500, O: 15000, P: 12000, Q: 12500, R: 12500, S: 13000, T: 14500, U: 14000, V: 13500, W: 12000, X: 14500, Y: 15500 },
  F: { A: 12500, B: 12000, C: 12000, D: 12000, E: 12500, F: 10000, G: 12000, H: 11500, I: 11500, J: 13000, K: 11000, L: 11500, M: 12500, N: 11500, O: 13000, P: 11000, Q: 12500, R: 11500, S: 12000, T: 12500, U: 12500, V: 11000, W: 11000, X: 12500, Y: 13500 },
  G: { A: 13000, B: 11500, C: 11000, D: 11500, E: 13500, F: 12000, G: 10000, H: 11500, I: 12500, J: 12000, K: 12000, L: 12500, M: 12500, N: 11000, O: 12000, P: 12500, Q: 11500, R: 11500, S: 11000, T: 11500, U: 12000, V: 11000, W: 11500, X: 11500, Y: 12000 },
  H: { A: 12000, B: 11000, C: 13000, D: 12000, E: 13000, F: 11500, G: 11500, H: 10000, I: 12500, J: 12500, K: 12000, L: 12000, M: 12500, N: 11500, O: 12500, P: 11500, Q: 12500, R: 12000, S: 12000, T: 11500, U: 11000, V: 11000, W: 11000, X: 12000, Y: 13000 },
  I: { A: 11000, B: 12000, C: 12500, D: 12500, E: 11500, F: 11500, G: 12500, H: 12500, I: 10000, J: 12500, K: 10000, L: 11500, M: 12000, N: 12500, O: 14000, P: 11500, Q: 13500, R: 11500, S: 13000, T: 13500, U: 13000, V: 11500, W: 11500, X: 13500, Y: 14500 },
  J: { A: 11500, B: 13500, C: 12500, D: 13000, E: 12000, F: 13000, G: 12000, H: 12500, I: 12500, J: 10000, K: 12500, L: 12000, M: 11000, N: 12500, O: 13500, P: 13500, Q: 11000, R: 13000, S: 11500, T: 13000, U: 13500, V: 13000, W: 13000, X: 13000, Y: 14000 },
  K: { A: 11500, B: 12500, C: 12500, D: 12500, E: 12000, F: 10000, G: 12000, H: 12000, I: 11000, J: 12500, K: 10000, L: 11000, M: 12000, N: 12000, O: 13500, P: 11500, Q: 13500, R: 11000, S: 12500, T: 13000, U: 12500, V: 11500, W: 11500, X: 13000, Y: 14000 },
  L: { A: 11000, B: 12000, C: 13000, D: 13000, E: 12500, F: 11500, G: 12500, H: 12000, I: 11500, J: 12000, K: 11000, L: 10000, M: 12000, N: 13500, O: 12000, P: 12000, Q: 13500, R: 11000, S: 12500, T: 13000, U: 12500, V: 11500, W: 11000, X: 13500, Y: 14500 },
  M: { A: 11000, B: 14000, C: 13000, D: 13000, E: 11500, F: 12500, G: 12500, H: 12500, I: 12000, J: 11000, K: 12000, L: 12000, M: 10000, N: 13000, O: 14000, P: 13000, Q: 11500, R: 13000, S: 12000, T: 13500, U: 14000, V: 13000, W: 13000, X: 13500, Y: 14500 },
  N: { A: 13500, B: 11000, C: 11500, D: 11000, E: 13500, F: 11500, G: 11000, H: 11500, I: 12500, J: 12500, K: 12000, L: 13500, M: 13000, N: 10000, O: 12000, P: 12000, Q: 12000, R: 11500, S: 11500, T: 11000, U: 11500, V: 11000, W: 11500, X: 11500, Y: 12500 },
  O: { A: 14500, B: 12000, C: 11500, D: 11500, E: 15000, F: 13000, G: 12000, H: 12500, I: 14000, J: 13500, K: 13500, L: 12000, M: 14000, N: 12000, O: 10000, P: 14000, Q: 13000, R: 13000, S: 12500, T: 11500, U: 12000, V: 12500, W: 13000, X: 11000, Y: 11000 },
  P: { A: 11500, B: 12000, C: 13000, D: 13500, E: 12000, F: 11000, G: 12500, H: 11500, I: 11500, J: 13500, K: 11500, L: 12000, M: 13000, N: 12000, O: 14000, P: 10000, Q: 13000, R: 12000, S: 12500, T: 12500, U: 12000, V: 11500, W: 11000, X: 13000, Y: 14000 },
  Q: { A: 12000, B: 13000, C: 12000, D: 12000, E: 12500, F: 12500, G: 11500, H: 12500, I: 13500, J: 11000, K: 13500, L: 13500, M: 11500, N: 12000, O: 13000, P: 13000, Q: 10000, R: 12500, S: 11000, T: 12500, U: 13000, V: 12000, W: 12500, X: 12500, Y: 13500 },
  R: { A: 12000, B: 12000, C: 12000, D: 12000, E: 12500, F: 11500, G: 11500, H: 12000, I: 11500, J: 13000, K: 11000, L: 11000, M: 13000, N: 11500, O: 13000, P: 12000, Q: 12500, R: 10000, S: 12000, T: 12000, U: 12500, V: 11000, W: 11500, X: 12500, Y: 13500 },
  S: { A: 13500, B: 12000, C: 11500, D: 11500, E: 13000, F: 12000, G: 11000, H: 12000, I: 13000, J: 11500, K: 12500, L: 12500, M: 12000, N: 11500, O: 12500, P: 12500, Q: 11000, R: 12000, S: 10000, T: 12000, U: 12500, V: 11500, W: 12000, X: 12000, Y: 13000 },
  T: { A: 13000, B: 11000, C: 11500, D: 11500, E: 14500, F: 12500, G: 11500, H: 11500, I: 13500, J: 13000, K: 13000, L: 13000, M: 13500, N: 11000, O: 11500, P: 12500, Q: 12500, R: 12000, S: 12000, T: 10000, U: 11000, V: 11500, W: 12000, X: 11000, Y: 12000 },
  U: { A: 12500, B: 11500, C: 12000, D: 12000, E: 14000, F: 12500, G: 12000, H: 11000, I: 13000, J: 13500, K: 12500, L: 12500, M: 14000, N: 11500, O: 12000, P: 12000, Q: 13000, R: 12500, S: 12500, T: 11000, U: 10000, V: 11500, W: 11500, X: 11500, Y: 12500 },
  V: { A: 12500, B: 11500, C: 11500, D: 11500, E: 13500, F: 11000, G: 11000, H: 11000, I: 11500, J: 13000, K: 11500, L: 11500, M: 13000, N: 11000, O: 12500, P: 11500, Q: 12000, R: 11000, S: 11500, T: 11500, U: 11500, V: 10000, W: 11000, X: 12000, Y: 12500 },
  W: { A: 12000, B: 11500, C: 12000, D: 12000, E: 12000, F: 11000, G: 11500, H: 11000, I: 11500, J: 13000, K: 11500, L: 11000, M: 13000, N: 11500, O: 13000, P: 11000, Q: 12500, R: 11500, S: 12000, T: 12000, U: 11500, V: 11000, W: 10000, X: 12500, Y: 13500 },
  X: { A: 14000, B: 11500, C: 11000, D: 11000, E: 14500, F: 12500, G: 11500, H: 12000, I: 13500, J: 13000, K: 13000, L: 13500, M: 13500, N: 11500, O: 11000, P: 13000, Q: 12500, R: 12500, S: 12000, T: 11000, U: 11500, V: 12000, W: 12500, X: 10000, Y: 11500 },
  Y: { A: 15000, B: 12500, C: 12000, D: 12000, E: 15500, F: 13500, G: 12000, H: 13000, I: 14500, J: 14000, K: 14000, L: 14500, M: 14500, N: 12500, O: 11000, P: 14000, Q: 13500, R: 13500, S: 13000, T: 12000, U: 12500, V: 12500, W: 13500, X: 11500, Y: 10000 },
};

// Schedule 1, Table 2 after BC Reg 186/2016 (July 20, 2016), until re-enacted by BC Reg 92/2018. Symmetric.
export const OFF_DOCK_TABLE_FROM_2016_07_20: Record<ZoneLetter, Record<ZoneLetter, number>> = {
  A: { A: 10000, B: 13000, C: 13500, D: 13000, E: 11000, F: 12500, G: 13000, H: 12000, I: 11000, J: 11500, K: 11500, L: 11000, M: 11000, N: 13500, O: 14500, P: 11500, Q: 12000, R: 12000, S: 13500, T: 13000, U: 12500, V: 12500, W: 12000, X: 14000, Y: 15000 },
  B: { A: 13000, B: 10000, C: 12000, D: 11500, E: 13500, F: 12000, G: 11500, H: 11000, I: 12000, J: 13500, K: 12500, L: 12000, M: 14000, N: 11000, O: 12000, P: 12000, Q: 13000, R: 12000, S: 12000, T: 11000, U: 11500, V: 11500, W: 11500, X: 11500, Y: 12500 },
  C: { A: 13500, B: 12000, C: 10000, D: 11000, E: 14000, F: 12000, G: 11000, H: 13000, I: 12500, J: 12500, K: 12500, L: 13000, M: 13000, N: 11500, O: 11500, P: 13000, Q: 12000, R: 12000, S: 11500, T: 11500, U: 12000, V: 11500, W: 12000, X: 11000, Y: 12000 },
  D: { A: 13000, B: 11500, C: 11000, D: 10000, E: 14000, F: 12000, G: 11500, H: 12000, I: 12500, J: 13000, K: 12500, L: 13000, M: 13000, N: 11000, O: 11500, P: 13500, Q: 12000, R: 12000, S: 11500, T: 11500, U: 12000, V: 11500, W: 12000, X: 11000, Y: 12000 },
  E: { A: 11000, B: 13500, C: 14000, D: 14000, E: 10000, F: 12500, G: 13500, H: 13000, I: 11500, J: 12000, K: 12000, L: 12500, M: 11500, N: 13500, O: 15000, P: 12000, Q: 12500, R: 12500, S: 13000, T: 14500, U: 14000, V: 13500, W: 12000, X: 14500, Y: 15500 },
  F: { A: 12500, B: 12000, C: 12000, D: 12000, E: 12500, F: 10000, G: 12000, H: 11500, I: 11500, J: 13000, K: 10000, L: 11500, M: 12500, N: 11500, O: 13000, P: 11000, Q: 12500, R: 11500, S: 12000, T: 12500, U: 12500, V: 11000, W: 11000, X: 12500, Y: 13500 },
  G: { A: 13000, B: 11500, C: 11000, D: 11500, E: 13500, F: 12000, G: 10000, H: 11500, I: 12500, J: 12000, K: 12000, L: 12500, M: 12500, N: 11000, O: 12000, P: 12500, Q: 11500, R: 11500, S: 11000, T: 11500, U: 12000, V: 11000, W: 11500, X: 11500, Y: 12000 },
  H: { A: 12000, B: 11000, C: 13000, D: 12000, E: 13000, F: 11500, G: 11500, H: 10000, I: 12500, J: 12500, K: 12000, L: 12000, M: 12500, N: 11500, O: 12500, P: 11500, Q: 12500, R: 12000, S: 12000, T: 11500, U: 11000, V: 11000, W: 11000, X: 12000, Y: 13000 },
  I: { A: 11000, B: 12000, C: 12500, D: 12500, E: 11500, F: 11500, G: 12500, H: 12500, I: 10000, J: 12500, K: 11000, L: 11500, M: 12000, N: 12500, O: 14000, P: 11500, Q: 13500, R: 11500, S: 13000, T: 13500, U: 13000, V: 11500, W: 11500, X: 13500, Y: 14500 },
  J: { A: 11500, B: 13500, C: 12500, D: 13000, E: 12000, F: 13000, G: 12000, H: 12500, I: 12500, J: 10000, K: 12500, L: 12000, M: 11000, N: 12500, O: 13500, P: 13500, Q: 11000, R: 13000, S: 11500, T: 13000, U: 13500, V: 13000, W: 13000, X: 13000, Y: 14000 },
  K: { A: 11500, B: 12500, C: 12500, D: 12500, E: 12000, F: 10000, G: 12000, H: 12000, I: 11000, J: 12500, K: 10000, L: 11000, M: 12000, N: 12000, O: 13500, P: 11500, Q: 13500, R: 11000, S: 12500, T: 13000, U: 12500, V: 11500, W: 11500, X: 13000, Y: 14000 },
  L: { A: 11000, B: 12000, C: 13000, D: 13000, E: 12500, F: 11500, G: 12500, H: 12000, I: 11500, J: 12000, K: 11000, L: 10000, M: 12000, N: 13500, O: 12000, P: 12000, Q: 13500, R: 11000, S: 12500, T: 13000, U: 12500, V: 11500, W: 11000, X: 13500, Y: 14500 },
  M: { A: 11000, B: 14000, C: 13000, D: 13000, E: 11500, F: 12500, G: 12500, H: 12500, I: 12000, J: 11000, K: 12000, L: 12000, M: 10000, N: 13000, O: 14000, P: 13000, Q: 11500, R: 13000, S: 12000, T: 13500, U: 14000, V: 13000, W: 13000, X: 13500, Y: 14500 },
  N: { A: 13500, B: 11000, C: 11500, D: 11000, E: 13500, F: 11500, G: 11000, H: 11500, I: 12500, J: 12500, K: 12000, L: 13500, M: 13000, N: 10000, O: 12000, P: 12000, Q: 12000, R: 11500, S: 11500, T: 11000, U: 11500, V: 11000, W: 11500, X: 11500, Y: 12500 },
  O: { A: 14500, B: 12000, C: 11500, D: 11500, E: 15000, F: 13000, G: 12000, H: 12500, I: 14000, J: 13500, K: 13500, L: 12000, M: 14000, N: 12000, O: 10000, P: 14000, Q: 13000, R: 13000, S: 12500, T: 11500, U: 12000, V: 12500, W: 13000, X: 11000, Y: 11000 },
  P: { A: 11500, B: 12000, C: 13000, D: 13500, E: 12000, F: 11000, G: 12500, H: 11500, I: 11500, J: 13500, K: 11500, L: 12000, M: 13000, N: 12000, O: 14000, P: 10000, Q: 13000, R: 12000, S: 12500, T: 12500, U: 12000, V: 11500, W: 11000, X: 13000, Y: 14000 },
  Q: { A: 12000, B: 13000, C: 12000, D: 12000, E: 12500, F: 12500, G: 11500, H: 12500, I: 13500, J: 11000, K: 13500, L: 13500, M: 11500, N: 12000, O: 13000, P: 13000, Q: 10000, R: 12500, S: 11000, T: 12500, U: 13000, V: 12000, W: 12500, X: 12500, Y: 13500 },
  R: { A: 12000, B: 12000, C: 12000, D: 12000, E: 12500, F: 11500, G: 11500, H: 12000, I: 11500, J: 13000, K: 11000, L: 11000, M: 13000, N: 11500, O: 13000, P: 12000, Q: 12500, R: 10000, S: 12000, T: 12000, U: 12500, V: 11000, W: 11500, X: 12500, Y: 13500 },
  S: { A: 13500, B: 12000, C: 11500, D: 11500, E: 13000, F: 12000, G: 11000, H: 12000, I: 13000, J: 11500, K: 12500, L: 12500, M: 12000, N: 11500, O: 12500, P: 12500, Q: 11000, R: 12000, S: 10000, T: 12000, U: 12500, V: 11500, W: 12000, X: 12000, Y: 13000 },
  T: { A: 13000, B: 11000, C: 11500, D: 11500, E: 14500, F: 12500, G: 11500, H: 11500, I: 13500, J: 13000, K: 13000, L: 13000, M: 13500, N: 11000, O: 11500, P: 12500, Q: 12500, R: 12000, S: 12000, T: 10000, U: 11000, V: 11500, W: 12000, X: 11000, Y: 12000 },
  U: { A: 12500, B: 11500, C: 12000, D: 12000, E: 14000, F: 12500, G: 12000, H: 11000, I: 13000, J: 13500, K: 12500, L: 12500, M: 14000, N: 11500, O: 12000, P: 12000, Q: 13000, R: 12500, S: 12500, T: 11000, U: 10000, V: 11500, W: 11500, X: 11500, Y: 12500 },
  V: { A: 12500, B: 11500, C: 11500, D: 11500, E: 13500, F: 11000, G: 11000, H: 11000, I: 11500, J: 13000, K: 11500, L: 11500, M: 13000, N: 11000, O: 12500, P: 11500, Q: 12000, R: 11000, S: 11500, T: 11500, U: 11500, V: 10000, W: 11000, X: 12000, Y: 12500 },
  W: { A: 12000, B: 11500, C: 12000, D: 12000, E: 12000, F: 11000, G: 11500, H: 11000, I: 11500, J: 13000, K: 11500, L: 11000, M: 13000, N: 11500, O: 13000, P: 11000, Q: 12500, R: 11500, S: 12000, T: 12000, U: 11500, V: 11000, W: 10000, X: 12500, Y: 13500 },
  X: { A: 14000, B: 11500, C: 11000, D: 11000, E: 14500, F: 12500, G: 11500, H: 12000, I: 13500, J: 13000, K: 13000, L: 13500, M: 13500, N: 11500, O: 11000, P: 13000, Q: 12500, R: 12500, S: 12000, T: 11000, U: 11500, V: 12000, W: 12500, X: 10000, Y: 11500 },
  Y: { A: 15000, B: 12500, C: 12000, D: 12000, E: 15500, F: 13500, G: 12000, H: 13000, I: 14500, J: 14000, K: 14000, L: 14500, M: 14500, N: 12500, O: 11000, P: 14000, Q: 13500, R: 13500, S: 13000, T: 12000, U: 12500, V: 12500, W: 13500, X: 11500, Y: 10000 },
};
export const OFF_DOCK_FROM_2016_07_20 = { effectiveFrom: '2016-07-20', table: OFF_DOCK_TABLE_FROM_2016_07_20 } as const;

// s. 12: two containers on an off-dock trip pay 1.5x the table amount. The section states no two-container rule for on-dock trips.
export const MULTI_CONTAINER = {
  offDockTwoContainerTripMultiplier: { num: 3, den: 2 } as Ratio,
} as const;

// The positioning movement rate began July 1, 2019. Part 4 contained none.
export const POSITIONING_MOVEMENT = 'no_rule_in_order' as const;

// NOT TRANSCRIBED, so the engine raises a gap for each: the employee callout rule (ss. 16-17, which changed on May 14, 2015);
// the fuel surcharge (ss. 20-22: same formula, but a quarterly MJ Ervin reference price that nobody has supplied).
export const EMPLOYEE_CALLOUT = null;
export const FUEL_SURCHARGE = null;
