// Container Trucking Regulation, B.C. Reg. 248/2014, Part 4, as it read before repeal by B.C. Reg. 144/2019.
// UNVERIFIED TRANSCRIPTION. VERIFY BEFORE USE. Read through an automated page fetch that summarises.
// Hourly rates, the I/O callout floor and Schedule 2 (on-dock). Schedule 1 for this period is an image in the source. All money is integer CENTS.

export const SCHEDULE_META = {
  id: 'ctr-2018-06-01',
  label: 'Container Trucking Regulation Part 4, services from 2018-06-01 to 2019-05-31',
  basis: 'Sections 13(3) item 1, 15(2.1) item 1 and 18(2), and Schedule 2, as enacted by BC Reg 92/2018: June 1, 2018 to May 31, 2019.',
  effectiveFrom: '2018-06-01',
  effectiveTo: '2019-05-31',
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
  DEO:       { underThreshold: 2578, atOrOverThreshold: 2696 },  // s. 13
  IEO:       { underThreshold: 2578, atOrOverThreshold: 2696 },  // s. 14: the licensee tops the I/O's payment up to the s. 13 amount
  IO_HOURLY: { underThreshold: 5143, atOrOverThreshold: 5261 },  // s. 15
} as const;

// Part 4 contained no overtime rule.
export const OVERTIME = 'no_rule_in_order' as const;

// s. 18: this amount or the remuneration under s. 12 or s. 15, whichever is greater.
export const IO_CALLOUT_FLOOR_CENTS = 30000;

export type ZoneLetter = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L'|'M'|'N'|'O'|'P'|'Q'|'R'|'S'|'T'|'U'|'V'|'W'|'X'|'Y';

// Schedule 1, Table 1: 25 areas. Boundary descriptions were not transcribed.
export const ZONES: { item: number; name: string; letter: ZoneLetter }[] = [
  { item: 1, name: 'Abbotsford', letter: 'A' },
  { item: 2, name: 'Annacis Island', letter: 'B' },
  { item: 3, name: 'Burnaby North', letter: 'C' },
  { item: 4, name: 'Burnaby South', letter: 'D' },
  { item: 5, name: 'Chilliwack', letter: 'E' },
  { item: 6, name: 'Cloverdale', letter: 'F' },
  { item: 7, name: 'Coquitlam', letter: 'G' },
  { item: 8, name: 'City of Delta', letter: 'H' },
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

// Schedule 2 as re-enacted by BC Reg 92/2018 - on-dock trip rates, cents, by area letter and terminal.
export const ON_DOCK: Record<ZoneLetter, { centermVanterm: number; deltaport: number; fraserSurreyDocks: number }> = {
  A: { centermVanterm: 20110, deltaport: 20110, fraserSurreyDocks: 18390 },  // Abbotsford
  B: { centermVanterm: 13790, deltaport: 13790, fraserSurreyDocks: 11490 },  // Annacis Island
  C: { centermVanterm: 12070, deltaport: 15510, fraserSurreyDocks: 12640 },  // Burnaby North
  D: { centermVanterm: 12640, deltaport: 15510, fraserSurreyDocks: 12070 },  // Burnaby South
  E: { centermVanterm: 22980, deltaport: 22980, fraserSurreyDocks: 21260 },  // Chilliwack
  F: { centermVanterm: 15510, deltaport: 15510, fraserSurreyDocks: 13220 },  // Cloverdale
  G: { centermVanterm: 13220, deltaport: 15510, fraserSurreyDocks: 12640 },  // Coquitlam
  H: { centermVanterm: 15510, deltaport: 11490, fraserSurreyDocks: 11490 },  // Delta
  I: { centermVanterm: 17810, deltaport: 18960, fraserSurreyDocks: 15510 },  // Fort Langley/Aldergrove
  J: { centermVanterm: 16090, deltaport: 18390, fraserSurreyDocks: 15510 },  // Haney/Maple Ridge
  K: { centermVanterm: 16660, deltaport: 15510, fraserSurreyDocks: 13790 },  // Langley City
  L: { centermVanterm: 18960, deltaport: 13790, fraserSurreyDocks: 13790 },  // Langley South
  M: { centermVanterm: 20110, deltaport: 21260, fraserSurreyDocks: 18960 },  // Mission
  N: { centermVanterm: 13220, deltaport: 15510, fraserSurreyDocks: 12070 },  // New Westminster
  O: { centermVanterm: 12070, deltaport: 16090, fraserSurreyDocks: 15510 },  // North Vancouver
  P: { centermVanterm: 18960, deltaport: 13790, fraserSurreyDocks: 13790 },  // Pacific Highway
  Q: { centermVanterm: 15510, deltaport: 17240, fraserSurreyDocks: 13790 },  // Pitt Meadows
  R: { centermVanterm: 15510, deltaport: 16660, fraserSurreyDocks: 12640 },  // Port Kells
  S: { centermVanterm: 13790, deltaport: 16660, fraserSurreyDocks: 13220 },  // Port Moody/Port Coquitlam
  T: { centermVanterm: 12070, deltaport: 13790, fraserSurreyDocks: 12070 },  // Richmond North
  U: { centermVanterm: 12640, deltaport: 12640, fraserSurreyDocks: 12070 },  // Richmond South
  V: { centermVanterm: 13790, deltaport: 13790, fraserSurreyDocks: 11490 },  // Surrey North
  W: { centermVanterm: 15510, deltaport: 13790, fraserSurreyDocks: 13790 },  // Surrey South
  X: { centermVanterm: 11490, deltaport: 15510, fraserSurreyDocks: 13790 },  // Vancouver
  Y: { centermVanterm: 12640, deltaport: 16660, fraserSurreyDocks: 16090 },  // West Vancouver
};

// Schedule 1, Table 2 as re-enacted by BC Reg 92/2018 is shown only as an image. NOT TRANSCRIBED: off-dock trips in this period are a gap.
export const OFF_DOCK = null;

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
