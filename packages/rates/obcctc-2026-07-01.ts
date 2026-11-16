// OBCCTC Rate Order effective 2026-07-01, ordered 2026-05-25. VERIFY BEFORE USE.
// Source: OBCCTC Rate Order PDF, Appendices I-III. All money is integer CENTS.

export const SCHEDULE_META = {
  id: 'obcctc-2026-07-01',                  // stable key for ComplianceRun.scheduleIds
  label: 'OBCCTC Rate Order effective July 1, 2026',
  orderedOn: '2026-05-25',                  // date the Commissioner signed the order
  effectiveFrom: '2026-07-01',
  effectiveTo: null,                        // null until the next order supersedes it
  increasePct: 2.1,                         // CPI-linked increase over the 2025 order
  commissioner: 'Glen MacInnes',
  sourceUrl: '',                            // paste the PDF URL here before verifying
  verifiedBy: null,                         // second-person sign-off required
} as const;

export type ZoneLetter = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L'|'M'|'N'|'O'|'P'|'Q'|'R'|'S'|'T'|'U'|'V'|'W'|'X'|'Y'|'Z';

// Appendix II - the 26 origin/destination areas.
export const ZONES: { item: number; name: string; letter: ZoneLetter; description: string }[] = [
  { item: 1, name: 'Abbotsford East', letter: 'A', description: 'That part of City of Abbotsford east of Highway 11' },
  { item: 2, name: 'Abbotsford West', letter: 'B', description: 'That part of City of Abbotsford west of Highway 11' },
  { item: 3, name: 'Burnaby North', letter: 'C', description: 'That part of City of Burnaby north of Highway 1' },
  { item: 4, name: 'Burnaby South', letter: 'D', description: 'That part of City of Burnaby south of Highway 1 and north of Marine Way' },
  { item: 5, name: 'Chilliwack', letter: 'E', description: 'City of Chilliwack' },
  { item: 6, name: 'Cloverdale', letter: 'F', description: 'That part of the City of Surrey south of Highway 1, east of 176 St and north of 40 Ave (eastern boundary is 196 St)' },
  { item: 7, name: 'Annacis', letter: 'G', description: 'That part of the City of Delta in the south arm of the Fraser River, and that part of the City of New Westminster south of the north arm of the Fraser River, and that part of the City of Richmond east of No. 9 Road, and that part of the City of Burnaby south of Marine Way' },
  { item: 8, name: 'Delta', letter: 'H', description: 'City of Delta including Tsawwassen, Tsawwassen First Nation and Westham Island, not including Annacis Island (G)' },
  { item: 9, name: 'Tri Cities North', letter: 'I', description: 'Those parts of the Cities of Coquitlam, Port Coquitlam, and Port Moody north of Highway 7A (Barnet Highway) / Highway 7 (Lougheed Highway)' },
  { item: 10, name: 'Maple Ridge', letter: 'J', description: 'City of Maple Ridge' },
  { item: 11, name: 'Langley West', letter: 'K', description: 'City of Langley and that part of the Township of Langley that is west of 240 St, not including that part that is north of Highway 1 and west of 208 St (Port Kells). Western boundary is 196 St' },
  { item: 12, name: 'Langley East', letter: 'L', description: 'That part of the Township of Langley that is east of 240 St, including Aldergrove' },
  { item: 13, name: 'Mission', letter: 'M', description: 'District of Mission' },
  { item: 14, name: 'New Westminster', letter: 'N', description: 'City of New Westminster excluding that part south of the north arm of the Fraser River' },
  { item: 15, name: 'North Vancouver', letter: 'O', description: 'City and North Vancouver and District of North Vancouver' },
  { item: 16, name: 'Pacific Highway', letter: 'P', description: 'City of White Rock and that part of the City of Surrey south of 40 Ave' },
  { item: 17, name: 'Pitt Meadows', letter: 'Q', description: 'City of Pitt Meadows' },
  { item: 18, name: 'Port Kells', letter: 'R', description: 'That part of the City of Surrey and Township of Langley north of Highway 1, east of 176 St and west of 208 St, including the CN Vancouver Intermodal Terminal' },
  { item: 19, name: 'Tri Cities South', letter: 'S', description: 'Those parts of the Cities of Coquitlam, Port Coquitlam, and Port Moody south of Highway 7A (Barnet Highway) / Highway 7 (Lougheed Highway)' },
  { item: 20, name: 'Richmond North', letter: 'T', description: 'That part of City of Richmond north of Westminster Highway and west of No. 9 Road' },
  { item: 21, name: 'Richmond South', letter: 'U', description: 'That part of City of Richmond south of Westminster Highway and west of No. 9 Road' },
  { item: 22, name: 'Surrey North', letter: 'V', description: 'That part of Surrey north of Nordel Way / 88 Ave and west of 176 St including the Fraser Heights regions' },
  { item: 23, name: 'Surrey Central', letter: 'W', description: 'That part of Surrey south of Nordel Way / 88 Ave and west of 176 St and north of 40 Ave' },
  { item: 24, name: 'Vancouver North', letter: 'X', description: 'That part of City of Vancouver north of Grandview Highway / 12th Ave / 10th Ave' },
  { item: 25, name: 'Vancouver South', letter: 'Y', description: 'That part of City of Vancouver south of Grandview Highway / 12th Ave / 10th Ave' },
  { item: 26, name: 'West Vancouver', letter: 'Z', description: 'District of West Vancouver' },
];

// Appendix I - on-dock trip rates, cents, by zone letter and terminal.
export const ON_DOCK: Record<ZoneLetter, { centermVanterm: number; deltaport: number; fraserSurreyDocks: number }> = {
  A: { centermVanterm: 27756, deltaport: 27756, fraserSurreyDocks: 24378 },  // Abbotsford East
  B: { centermVanterm: 23707, deltaport: 23707, fraserSurreyDocks: 21684 },  // Abbotsford West
  C: { centermVanterm: 14229, deltaport: 18968, fraserSurreyDocks: 14899 },  // Burnaby North
  D: { centermVanterm: 14899, deltaport: 18286, fraserSurreyDocks: 14229 },  // Burnaby South
  E: { centermVanterm: 30457, deltaport: 30457, fraserSurreyDocks: 26412 },  // Chilliwack
  F: { centermVanterm: 18286, deltaport: 18286, fraserSurreyDocks: 16264 },  // Cloverdale
  G: { centermVanterm: 16264, deltaport: 16264, fraserSurreyDocks: 13547 },  // Annacis
  H: { centermVanterm: 18286, deltaport: 13547, fraserSurreyDocks: 13547 },  // Delta
  I: { centermVanterm: 16933, deltaport: 20320, fraserSurreyDocks: 16264 },  // Tri Cities North
  J: { centermVanterm: 21684, deltaport: 22355, fraserSurreyDocks: 18286 },  // Maple Ridge
  K: { centermVanterm: 21003, deltaport: 21003, fraserSurreyDocks: 16264 },  // Langley West
  L: { centermVanterm: 22355, deltaport: 22355, fraserSurreyDocks: 18286 },  // Langley East
  M: { centermVanterm: 25071, deltaport: 25741, fraserSurreyDocks: 22355 },  // Mission
  N: { centermVanterm: 15581, deltaport: 18286, fraserSurreyDocks: 14229 },  // New Westminster
  O: { centermVanterm: 14229, deltaport: 19638, fraserSurreyDocks: 18286 },  // North Vancouver
  P: { centermVanterm: 22355, deltaport: 18286, fraserSurreyDocks: 16264 },  // Pacific Highway
  Q: { centermVanterm: 18286, deltaport: 20320, fraserSurreyDocks: 16264 },  // Pitt Meadows
  R: { centermVanterm: 18286, deltaport: 19638, fraserSurreyDocks: 14899 },  // Port Kells
  S: { centermVanterm: 16264, deltaport: 19638, fraserSurreyDocks: 15581 },  // Tri Cities South
  T: { centermVanterm: 14229, deltaport: 16264, fraserSurreyDocks: 14229 },  // Richmond North
  U: { centermVanterm: 14899, deltaport: 14899, fraserSurreyDocks: 14229 },  // Richmond South
  V: { centermVanterm: 16264, deltaport: 16264, fraserSurreyDocks: 13547 },  // Surrey North
  W: { centermVanterm: 18286, deltaport: 16264, fraserSurreyDocks: 16264 },  // Surrey Central
  X: { centermVanterm: 13547, deltaport: 18968, fraserSurreyDocks: 16933 },  // Vancouver North
  Y: { centermVanterm: 13547, deltaport: 18286, fraserSurreyDocks: 16264 },  // Vancouver South
  Z: { centermVanterm: 14899, deltaport: 20320, fraserSurreyDocks: 18968 },  // West Vancouver
};

// Appendix III - off-dock trip rates, cents, [origin][destination].
// Symmetric; same-zone trips are $121.00.
export const OFF_DOCK: Record<ZoneLetter, Record<ZoneLetter, number>> = {
  A: { A: 12100, B: 13400, C: 19800, D: 19800, E: 13400, F: 16900, G: 19300, H: 19300, I: 19800, J: 16300, K: 15800, L: 14500, M: 13400, N: 19300, O: 21100, P: 16900, Q: 19300, R: 16900, S: 19300, T: 20400, U: 19800, V: 18000, W: 17500, X: 21100, Y: 20400, Z: 21600 },
  B: { A: 13400, B: 12100, C: 18000, D: 18000, E: 14500, F: 15200, G: 17500, H: 17500, I: 18000, J: 15200, K: 14500, L: 13400, M: 13400, N: 17500, O: 19300, P: 15800, Q: 18000, R: 15800, S: 17500, T: 18800, U: 18000, V: 16300, W: 15800, X: 19300, Y: 18800, Z: 19800 },
  C: { A: 19800, B: 18000, C: 12100, D: 13400, E: 21600, F: 14500, G: 14500, H: 15800, I: 13900, J: 16300, K: 15800, L: 16900, M: 19300, N: 13900, O: 13900, P: 16300, Q: 14500, R: 14500, S: 13900, T: 13900, U: 14500, V: 13900, W: 14500, X: 13400, Y: 13400, Z: 14500 },
  D: { A: 19800, B: 18000, C: 13400, D: 12100, E: 21600, F: 14500, G: 13900, H: 14500, I: 13900, J: 16300, K: 15800, L: 16300, M: 19300, N: 13400, O: 13900, P: 15800, Q: 14500, R: 14500, S: 13900, T: 13900, U: 14500, V: 13900, W: 14500, X: 13400, Y: 13400, Z: 14500 },
  E: { A: 13400, B: 14500, C: 21600, D: 21600, E: 12100, F: 18000, G: 21100, H: 21100, I: 21600, J: 17500, K: 16900, L: 15800, M: 14500, N: 21100, O: 22900, P: 18000, Q: 20400, R: 18800, S: 21100, T: 22400, U: 21600, V: 19800, W: 19300, X: 22900, Y: 22400, Z: 23400 },
  F: { A: 16900, B: 15200, C: 14500, D: 14500, E: 18000, F: 12100, G: 14500, H: 13900, I: 15200, J: 15800, K: 13400, L: 13900, M: 16300, N: 13900, O: 15800, P: 13400, Q: 15200, R: 13400, S: 14500, T: 15200, U: 15200, V: 13400, W: 13400, X: 15800, Y: 15200, Z: 16300 },
  G: { A: 19300, B: 17500, C: 14500, D: 13900, E: 21100, F: 14500, G: 12100, H: 13400, I: 15200, J: 17500, K: 15200, L: 15800, M: 19300, N: 13400, O: 14500, P: 14500, Q: 15800, R: 14500, S: 14500, T: 13400, U: 13900, V: 13900, W: 13900, X: 14500, Y: 13900, Z: 15200 },
  H: { A: 19300, B: 17500, C: 15800, D: 14500, E: 21100, F: 13900, G: 13400, H: 12100, I: 15800, J: 17500, K: 15200, L: 15800, M: 19800, N: 13900, O: 15200, P: 13900, Q: 15800, R: 14500, S: 15200, T: 13900, U: 13400, V: 13400, W: 13400, X: 15200, Y: 14500, Z: 15800 },
  I: { A: 19800, B: 18000, C: 13900, D: 13900, E: 21600, F: 15200, G: 15200, H: 15800, I: 12100, J: 14500, K: 15800, L: 16300, M: 16300, N: 14500, O: 15200, P: 15800, Q: 13900, R: 15200, S: 13400, T: 15200, U: 15800, V: 13900, W: 15200, X: 15200, Y: 15200, Z: 15800 },
  J: { A: 16300, B: 15200, C: 16300, D: 16300, E: 17500, F: 15800, G: 17500, H: 17500, I: 14500, J: 12100, K: 15200, L: 15800, M: 13400, N: 15200, O: 16900, P: 16300, Q: 13400, R: 15800, S: 14500, T: 18000, U: 18000, V: 15800, W: 15800, X: 16900, Y: 17500, Z: 17500 },
  K: { A: 15800, B: 14500, C: 15800, D: 15800, E: 16900, F: 13400, G: 15200, H: 15200, I: 15800, J: 15200, K: 12100, L: 13400, M: 15800, N: 15200, O: 16900, P: 13900, Q: 16300, R: 13400, S: 15200, T: 16300, U: 15800, V: 13900, W: 13900, X: 16300, Y: 16300, Z: 17500 },
  L: { A: 14500, B: 13400, C: 16900, D: 16300, E: 15800, F: 13900, G: 15800, H: 15800, I: 16300, J: 15800, K: 13400, L: 12100, M: 15200, N: 15800, O: 17500, P: 14500, Q: 16900, R: 13900, S: 15800, T: 16900, U: 16300, V: 14500, W: 14500, X: 16900, Y: 16900, Z: 18000 },
  M: { A: 13400, B: 13400, C: 19300, D: 19300, E: 14500, F: 16300, G: 19300, H: 19800, I: 16300, J: 13400, K: 15800, L: 15200, M: 12100, N: 18800, O: 20400, P: 16900, Q: 15200, R: 16300, S: 16300, T: 21100, U: 20400, V: 16900, W: 16900, X: 21100, Y: 21100, Z: 21100 },
  N: { A: 19300, B: 17500, C: 13900, D: 13400, E: 21100, F: 13900, G: 13400, H: 13900, I: 14500, J: 15200, K: 15200, L: 15800, M: 18800, N: 12100, O: 14500, P: 14500, Q: 14500, R: 13900, S: 13900, T: 13400, U: 13900, V: 13400, W: 13900, X: 13900, Y: 13900, Z: 15200 },
  O: { A: 21100, B: 19300, C: 13900, D: 13900, E: 22900, F: 15800, G: 14500, H: 15200, I: 15200, J: 16900, K: 16900, L: 17500, M: 20400, N: 14500, O: 12100, P: 16900, Q: 15800, R: 15800, S: 15200, T: 13900, U: 14500, V: 15200, W: 15800, X: 13400, Y: 13900, Z: 13400 },
  P: { A: 16900, B: 15800, C: 16300, D: 15800, E: 18000, F: 13400, G: 14500, H: 13900, I: 15800, J: 16300, K: 13900, L: 14500, M: 16900, N: 14500, O: 16900, P: 12100, Q: 15800, R: 14500, S: 15200, T: 15200, U: 14500, V: 13900, W: 13400, X: 16300, Y: 15800, Z: 16900 },
  Q: { A: 19300, B: 18000, C: 14500, D: 14500, E: 20400, F: 15200, G: 15800, H: 15800, I: 13900, J: 13400, K: 16300, L: 16900, M: 15200, N: 14500, O: 15800, P: 15800, Q: 12100, R: 15200, S: 13900, T: 15800, U: 16300, V: 14500, W: 15200, X: 15200, Y: 15800, Z: 16300 },
  R: { A: 16900, B: 15800, C: 14500, D: 14500, E: 18800, F: 13400, G: 14500, H: 14500, I: 15200, J: 15800, K: 13400, L: 13900, M: 16300, N: 13900, O: 15800, P: 14500, Q: 15200, R: 12100, S: 14500, T: 15200, U: 15200, V: 13400, W: 13900, X: 15800, Y: 15200, Z: 16300 },
  S: { A: 19300, B: 17500, C: 13900, D: 13900, E: 21100, F: 14500, G: 14500, H: 15200, I: 13400, J: 14500, K: 15200, L: 15800, M: 16300, N: 13900, O: 15200, P: 15200, Q: 13900, R: 14500, S: 12100, T: 14500, U: 15200, V: 13400, W: 14500, X: 14500, Y: 14500, Z: 15800 },
  T: { A: 20400, B: 18800, C: 13900, D: 13900, E: 22400, F: 15200, G: 13400, H: 13900, I: 15200, J: 18000, K: 16300, L: 16900, M: 21100, N: 13400, O: 13900, P: 15200, Q: 15800, R: 15200, S: 14500, T: 12100, U: 13400, V: 13900, W: 14500, X: 13400, Y: 13400, Z: 14500 },
  U: { A: 19800, B: 18000, C: 14500, D: 14500, E: 21600, F: 15200, G: 13900, H: 13400, I: 15800, J: 18000, K: 15800, L: 16300, M: 20400, N: 13900, O: 14500, P: 14500, Q: 16300, R: 15200, S: 15200, T: 13400, U: 12100, V: 13900, W: 13900, X: 13900, Y: 13900, Z: 15200 },
  V: { A: 18000, B: 16300, C: 13900, D: 13900, E: 19800, F: 13400, G: 13900, H: 13400, I: 13900, J: 15800, K: 13900, L: 14500, M: 16900, N: 13400, O: 15200, P: 13900, Q: 14500, R: 13400, S: 13400, T: 13900, U: 13900, V: 12100, W: 13400, X: 15200, Y: 14500, Z: 15200 },
  W: { A: 17500, B: 15800, C: 14500, D: 14500, E: 19300, F: 13400, G: 13900, H: 13400, I: 15200, J: 15800, K: 13900, L: 14500, M: 16900, N: 13900, O: 15800, P: 13400, Q: 15200, R: 13900, S: 14500, T: 14500, U: 13900, V: 13400, W: 12100, X: 15800, Y: 15200, Z: 16300 },
  X: { A: 21100, B: 19300, C: 13400, D: 13400, E: 22900, F: 15800, G: 14500, H: 15200, I: 15200, J: 16900, K: 16300, L: 16900, M: 21100, N: 13900, O: 13400, P: 16300, Q: 15200, R: 15800, S: 14500, T: 13400, U: 13900, V: 15200, W: 15800, X: 12100, Y: 12100, Z: 13900 },
  Y: { A: 20400, B: 18800, C: 13400, D: 13400, E: 22400, F: 15200, G: 13900, H: 14500, I: 15200, J: 17500, K: 16300, L: 16900, M: 21100, N: 13900, O: 13900, P: 15800, Q: 15800, R: 15200, S: 14500, T: 13400, U: 13900, V: 14500, W: 15200, X: 12100, Y: 12100, Z: 14500 },
  Z: { A: 21600, B: 19800, C: 14500, D: 14500, E: 23400, F: 16300, G: 15200, H: 15800, I: 15800, J: 17500, K: 17500, L: 18000, M: 21100, N: 15200, O: 13400, P: 16900, Q: 16300, R: 16300, S: 15800, T: 14500, U: 15200, V: 15200, W: 16300, X: 13900, Y: 14500, Z: 12100 },
};

// Exact ratio; never a float. Used for every multiplier in this schedule.
export type Ratio = { readonly num: number; readonly den: number };

// Tier threshold, stated in the order as "2340 collective hours ... for any licensee".
export const HOURLY_TIER_THRESHOLD_HOURS = 2340;

// Hourly minimums, cents per hour, inclusive of benefits.
// Tier is cumulative container trucking hours across ANY licensee.
export const HOURLY = {
  DEO:       { under2340: 3456, atOrOver2340: 3603 },  // directly employed / company driver
  IEO:       { under2340: 3456, atOrOver2340: 3603 },  // indirectly employed operator
  IO_HOURLY: { under2340: 7304, atOrOver2340: 7505 },  // independent operator paid hourly
} as const;

export const OVERTIME = {
  multiplier: { num: 3, den: 2 } as Ratio, // 1.5x; applies to DEO and IEO only
  dailyThresholdHours: 9,              // over 9 hours in a day
  weeklyThresholdHours: 45,            // over 45 hours in a week
  weekStartsOn: 'sunday',              // week runs Sunday to Saturday
  onlyFirstNineHoursCountWeekly: true, // only the first 9 hours of each day count toward weekly OT
} as const;

export const CALLOUT = {
  minContinuousHours: 4,               // availability of 4+ continuous hours in a 24-hour period
  deoIeoMultiplierOfHourly: 4,         // no less than 4x the applicable hourly rate
  ioFloorCents: 34800,                 // $348 or the applicable trip rate, whichever is greater
} as const;

export const POSITIONING_MOVEMENT = {
  cents: 2500,                         // per on- or off-dock trip rate payment, 1 container
  twoContainerMultiplier: { num: 3, den: 2 } as Ratio, // 1.5x; 2 containers on multiple chassis, on- or off-dock
  mustAppearSeparatelyOnPayStatement: true, // licensee must itemise it; auditable
} as const;

// The order attaches the 1.5x two-container rule to the OFF-DOCK rate only.
// No two-container rule is stated for on-dock; the engine treats that case as a gap.
export const MULTI_CONTAINER = {
  offDockTwoContainerTripMultiplier: { num: 3, den: 2 } as Ratio, // 1.5x the Appendix III amount
} as const;

// Fuel surcharge: ((A - 1.05) / 0.05) * B * 2%
//   A = reference price of diesel, dollars per litre
//   B = minimum compensation payable that month, EXCLUDING the positioning movement rate
export const FUEL_SURCHARGE = {
  thresholdCentsPerLitre: 105,        // no surcharge at or below $1.05/L
  stepCentsPerLitre: 5,             // one step per $0.05 above the threshold
  pctPerStep: 2,                       // 2% per step
  roundReferenceDownToCents: 5,        // reference price rounded down to nearest $0.05
  excludesPositioningMovementRate: true,
  referenceSource: 'Kalibrate average Vancouver retail diesel incl. taxes, prior month; or the I/O discounted purchase price, whichever is lower',
} as const;

// OBCCTC-published monthly surcharge percentages. Published value governs;
// the formula above is a validation check, not a derivation.
export const FUEL_SURCHARGE_PUBLISHED: Record<string, { referenceCentsPerLitre: number; pct: number }> = {
  '2025-01': { referenceCentsPerLitre: 180, pct: 30 },
  '2025-02': { referenceCentsPerLitre: 190, pct: 34 },
  '2025-03': { referenceCentsPerLitre: 190, pct: 34 },
  '2025-04': { referenceCentsPerLitre: 190, pct: 34 },
  '2025-05': { referenceCentsPerLitre: 170, pct: 26 },
  '2025-06': { referenceCentsPerLitre: 170, pct: 26 },
  '2025-07': { referenceCentsPerLitre: 170, pct: 26 },
  '2025-08': { referenceCentsPerLitre: 180, pct: 30 },
  '2025-09': { referenceCentsPerLitre: 175, pct: 28 },
  '2025-10': { referenceCentsPerLitre: 175, pct: 28 },
  '2025-11': { referenceCentsPerLitre: 175, pct: 28 },
  '2025-12': { referenceCentsPerLitre: 175, pct: 28 },
  '2026-01': { referenceCentsPerLitre: 160, pct: 22 },
  '2026-02': { referenceCentsPerLitre: 160, pct: 22 },
  '2026-03': { referenceCentsPerLitre: 180, pct: 30 },
  '2026-04': { referenceCentsPerLitre: 230, pct: 50 },
  '2026-05': { referenceCentsPerLitre: 255, pct: 60 },
  '2026-06': { referenceCentsPerLitre: 240, pct: 54 },
  '2026-07': { referenceCentsPerLitre: 220, pct: 46 },
  '2026-08': { referenceCentsPerLitre: 230, pct: 50 },
  '2026-09': { referenceCentsPerLitre: 250, pct: 58 },
  '2026-10': { referenceCentsPerLitre: 280, pct: 70 },
  // 2026-11 and 2026-12 not yet published at time of entry.
};

// If an I/O employs an IEO and has not paid the IEO the regulated rate, the amount
// the licensee owes the I/O for that pay period is reduced by what the licensee paid
// the IEO for work in the same period (IEO indemnification under the CTS licence).
export const IEO_INDEMNIFICATION_OFFSET = true;

// Prior order, for retroactive runs.
export const HOURLY_2025_07_01 = {
  DEO:       { under2340: 3385, atOrOver2340: 3529 },
  IEO:       { under2340: 3385, atOrOver2340: 3529 },
  IO_HOURLY: { under2340: 7154, atOrOver2340: 7351 },
  calloutIoFloorCents: 34100,
} as const;
