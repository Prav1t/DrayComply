// Request bodies to typed inputs. A missing value stays null; nothing is filled in.
import type { RunRequest } from './assess';
import type { DriverFields } from './drivers';
import { invalid } from './errors';
import { isUuid, optionalStr, str } from './http';

type Body = Readonly<Record<string, unknown>>;

// Accepts a JSON number or digits typed into a form. Anything else is refused, never rounded.
export function wholeNumber(body: Body, key: string): number | null {
  const v = body[key];
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number' && Number.isSafeInteger(v)) return v;
  if (typeof v === 'string' && /^\d{1,9}$/.test(v.trim())) return Number(v.trim());
  throw invalid(`"${key}" must be a whole number.`);
}

function yesNo(body: Body, key: string): boolean | null {
  const v = body[key];
  if (v === undefined || v === null || v === '') return null;
  if (v === true || v === 'yes') return true;
  if (v === false || v === 'no') return false;
  throw invalid(`"${key}" must be yes, no or left blank.`);
}

export function driverFields(body: Body): DriverFields {
  const fuel = optionalStr(body, 'fuelBasis');
  if (fuel !== null && fuel !== 'published' && fuel !== 'io_discounted') throw invalid('"fuelBasis" must be published, io_discounted or left blank.');
  return {
    externalId: str(body, 'externalId', 100), displayName: optionalStr(body, 'displayName'),
    openingCumulativeMinutes: wholeNumber(body, 'openingCumulativeMinutes'), hourlyCoverageFrom: optionalStr(body, 'hourlyCoverageFrom'),
    fuelBasis: fuel, calloutsFlagged: yesNo(body, 'calloutsFlagged'), otherLicenseeHoursReported: yesNo(body, 'otherLicenseeHoursReported'),
  };
}

export function runRequest(body: Body): RunRequest {
  const datasetId = body['datasetId'];
  const templateId = body['templateId'];
  if (!isUuid(datasetId) || !isUuid(templateId)) throw invalid('Choose a data set and a template.');
  const from = optionalStr(body, 'periodFrom');
  const to = optionalStr(body, 'periodTo');
  if ((from === null) !== (to === null)) throw invalid('Give both ends of the pay period range, or neither.');
  const ids = body['driverIds'];
  const list = typeof ids === 'string' ? ids.split(/[\n,]/).map(s => s.trim()).filter(s => s !== '') : Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
  return {
    datasetId, templateId, asOf: str(body, 'asOf'),
    periods: from !== null && to !== null ? { kind: 'range', from, to } : { kind: 'all' },
    drivers: list.length === 0 ? { kind: 'all' } : { kind: 'only', driverIds: list },
  };
}
