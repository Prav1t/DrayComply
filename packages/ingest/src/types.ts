import type { ComplianceInput } from '../../engine/src/index';

export type FileFormat = 'csv' | 'xlsx';
export interface SourceFile { readonly name: string; readonly format: FileFormat; readonly bytes: Uint8Array }

// A cell is text exactly as stored, or a spreadsheet error such as #REF!.
export type Cell =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'error'; readonly code: string };

export interface Grid { readonly rows: readonly (readonly Cell[])[]; readonly date1904: boolean }

export const TABLE_KINDS = ['drivers', 'payPeriods', 'hours', 'trips', 'payments', 'deductions', 'callouts', 'otherLicenseeHours', 'fuelPrices'] as const;
export type TableKind = (typeof TABLE_KINDS)[number];

export type FieldType = 'text' | 'date' | 'money' | 'duration' | 'integer' | 'enum' | 'list';

// What an empty cell can mean for a field. 'never' means an empty cell rejects the row.
export type BlankMeaning = 'never' | 'not_reported' | 'null' | 'generated' | 'empty_list';

export interface FieldSpec {
  readonly type: FieldType;
  readonly blank: BlankMeaning;
  readonly enumValues: readonly string[];   // empty unless type is 'enum'
  readonly help: string;
}

export type DateFormat = 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'excel_serial';

export type FieldFormat =
  | { readonly kind: 'text'; readonly map: Readonly<Record<string, string>> }      // raw value -> value; unmapped passes through
  | { readonly kind: 'date'; readonly format: DateFormat }
  | { readonly kind: 'money'; readonly unit: 'dollars' | 'cents' }
  | { readonly kind: 'duration'; readonly unit: 'hours' | 'minutes' | 'hh:mm' }
  | { readonly kind: 'integer' }
  | { readonly kind: 'enum'; readonly values: Readonly<Record<string, string>> }   // raw value -> canonical; unmapped rejects
  | { readonly kind: 'list'; readonly separator: string };

export type ColumnSource =
  | { readonly kind: 'column'; readonly header: string }
  | { readonly kind: 'constant'; readonly value: string }
  | { readonly kind: 'not_provided' };   // every row is blank for this field

// blank 'accept' opts in to the field's blank meaning; 'reject' refuses rows with an empty cell.
export interface FieldMapping {
  readonly source: ColumnSource;
  readonly format: FieldFormat;
  readonly blank: 'accept' | 'reject';
}

// 'none' is the licensee stating there are no records of this kind. It is never assumed.
export type TableMapping =
  | { readonly kind: 'mapped'; readonly file: string; readonly sheet: string | null; readonly headerRow: number; readonly delimiter: ',' | ';' | '\t'; readonly fields: Readonly<Record<string, FieldMapping>> }
  | { readonly kind: 'none' };

export interface MappingTemplate {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly tables: Readonly<Record<TableKind, TableMapping>>;
}

export type Value =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'date'; readonly value: string }
  | { readonly kind: 'cents'; readonly value: number }
  | { readonly kind: 'minutes'; readonly value: number }
  | { readonly kind: 'integer'; readonly value: number }
  | { readonly kind: 'list'; readonly value: readonly string[] }
  | { readonly kind: 'blank' };

export interface Row {
  readonly table: TableKind;
  readonly file: string;
  readonly rowNumber: number;                       // 1-based, as a person sees it in the file
  readonly values: Readonly<Record<string, Value>>;
}

// driverId is null when the row could not be tied to a driver at all.
export interface Reject {
  readonly table: TableKind;
  readonly file: string;
  readonly rowNumber: number;
  readonly field: string | null;
  readonly driverId: string | null;
  readonly raw: string;
  readonly reason: string;
}

export interface ManifestEntry {
  readonly name: string;
  readonly format: FileFormat;
  readonly sha256: string;
  readonly bytes: number;
  readonly tables: readonly { readonly table: TableKind; readonly dataRows: number; readonly acceptedRows: number }[];
}

export type IngestResult =
  | { readonly kind: 'template_invalid'; readonly errors: readonly string[] }
  | { readonly kind: 'file_invalid'; readonly errors: readonly string[] }
  | {
      readonly kind: 'completed';
      readonly input: ComplianceInput;                 // only drivers with no rejected row
      readonly rejects: readonly Reject[];
      readonly withheldDrivers: readonly { readonly driverId: string; readonly rejectedRows: number }[];
      readonly unattributedRejects: number;            // rejected rows tied to no known driver: they could belong to anyone
      readonly manifest: readonly ManifestEntry[];
      readonly templateId: string;
      readonly statement: string;
    };
