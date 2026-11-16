import type { BlankMeaning, FieldSpec, FieldType, TableKind } from './types';

const f = (type: FieldType, blank: BlankMeaning, help: string, enumValues: readonly string[] = []): FieldSpec => ({ type, blank, enumValues, help });
const DRIVER = f('text', 'never', 'Driver identifier, the same in every table.');

export const PAY_LINE_KINDS = ['hourly', 'overtime', 'trip_rate', 'pmr', 'fuel', 'wait_time', 'callout', 'other'] as const;

// Every field of every table, and what an empty cell means for it. This is the whole contract with a template.
export const SPECS: Readonly<Record<TableKind, Readonly<Record<string, FieldSpec>>>> = {
  drivers: {
    driverId: DRIVER,
    class: f('enum', 'never', 'Driver class for this period.', ['DEO', 'IEO', 'IO_HOURLY', 'IO_TRIP']),
    classFrom: f('date', 'never', 'First day this class applies.'),
    classTo: f('date', 'null', 'Last day this class applies. Blank, if accepted, means still current.'),
    employingIoDriverId: f('text', 'null', 'For an IEO: the driver id of the employing I/O.'),
    openingCumulativeHours: f('duration', 'not_reported', 'Container trucking hours for any licensee before the first hours row supplied.'),
    hourlyCoverageFrom: f('date', 'not_reported', 'Date from which the hours table is complete for this driver.'),
    fuelBasis: f('enum', 'not_reported', 'Whether fuel is priced on the published figure or the operator\'s discounted price.', ['published', 'io_discounted']),
    calloutsFlagged: f('enum', 'not_reported', 'yes if callout days are recorded in the callouts table. Blank means not flagged.', ['yes', 'no']),
    otherLicenseeHoursReported: f('enum', 'not_reported', 'yes if hours for other licensees are in the otherLicenseeHours table.', ['yes', 'no']),
  },
  payPeriods: {
    driverId: DRIVER,
    payPeriodId: f('text', 'never', 'Pay period identifier, unique per driver.'),
    from: f('date', 'never', 'First work date of the period.'),
    to: f('date', 'never', 'Last work date of the period.'),
    payDate: f('date', 'never', 'Date the statement is paid.'),
    payer: f('enum', 'never', 'Who paid: the licensee, or the I/O employing an IEO.', ['licensee', 'employing_io']),
    waitTimeReceived: f('money', 'not_reported', 'Wait time remuneration the licensee received for this driver and period.'),
  },
  hours: {
    driverId: DRIVER,
    entryId: f('text', 'generated', 'Entry identifier.'),
    workDate: f('date', 'never', 'Date worked.'),
    duration: f('duration', 'never', 'Time worked.'),
    seq: f('integer', 'generated', 'Order within the day. Blank uses the row order in the file.'),
  },
  trips: {
    driverId: DRIVER,
    tripId: f('text', 'generated', 'Trip identifier. Payments link to it.'),
    workDate: f('date', 'never', 'Date of the trip.'),
    moveKind: f('enum', 'never', 'on_dock or off_dock.', ['on_dock', 'off_dock']),
    zone: f('text', 'not_reported', 'On-dock: area letter.'),
    terminal: f('text', 'not_reported', 'On-dock: terminal key as the rate schedule names it.'),
    origin: f('text', 'not_reported', 'Off-dock: origin area letter.'),
    destination: f('text', 'not_reported', 'Off-dock: destination area letter.'),
    containers: f('enum', 'not_reported', 'one or two.', ['one', 'two']),
  },
  payments: {
    driverId: DRIVER,
    payPeriodId: f('text', 'never', 'The statement this line appears on.'),
    lineId: f('text', 'generated', 'Line identifier.'),
    kind: f('enum', 'never', 'What the payment is for.', PAY_LINE_KINDS),
    amount: f('money', 'never', 'Amount paid.'),
    workFrom: f('date', 'not_reported', 'First work date this payment is for. Blank with workTo blank means not stated.'),
    workTo: f('date', 'not_reported', 'Last work date this payment is for.'),
    tripId: f('text', 'null', 'For a trip rate payment: the trip it pays. Blank means unlinked.'),
  },
  deductions: {
    driverId: DRIVER,
    payPeriodId: f('text', 'never', 'The statement this deduction appears on.'),
    deductionId: f('text', 'generated', 'Deduction identifier.'),
    category: f('text', 'never', 'Deduction category. Map the licensee\'s own labels to policy categories in the template.'),
    amount: f('money', 'never', 'Amount deducted.'),
  },
  callouts: {
    driverId: DRIVER,
    calloutId: f('text', 'generated', 'Callout identifier.'),
    workDate: f('date', 'never', 'Day of the availability window.'),
    entryIds: f('list', 'empty_list', 'Hours entries worked inside the window.'),
    tripIds: f('list', 'empty_list', 'Trips performed inside the window.'),
  },
  otherLicenseeHours: {
    driverId: DRIVER,
    workDate: f('date', 'never', 'Date worked for another licensee.'),
    duration: f('duration', 'never', 'Time worked for another licensee.'),
  },
  fuelPrices: {
    driverId: DRIVER,
    month: f('text', 'never', 'Month as YYYY-MM.'),
    pricePerLitre: f('money', 'never', 'The operator\'s discounted diesel price per litre.'),
  },
};
