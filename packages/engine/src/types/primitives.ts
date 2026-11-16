export type IsoDate = string;      // YYYY-MM-DD, checked by validateInput
export type YearMonth = string;    // YYYY-MM
export type Cents = number;        // integer
export type Minutes = number;      // integer

export interface Ratio { readonly num: number; readonly den: number }

export type Reported<T> =
  | { readonly kind: 'reported'; readonly value: T }
  | { readonly kind: 'not_reported' };

export type DriverClass = 'DEO' | 'IEO' | 'IO_HOURLY' | 'IO_TRIP';
export type HourlyClass = Exclude<DriverClass, 'IO_TRIP'>;
export type ContainerCount = 'one' | 'two';
export type RoundingMode = 'half_up' | 'half_even' | 'down' | 'up';
