import type { PayPeriod } from '../types/input';
import { fromInt, type Frac } from '../math/ratio';

// Everything the licensee received must reach the driver. Null when receipts were not reported.
export function waitTimeOwed(period: PayPeriod): Frac | null {
  return period.waitTimeReceived.kind === 'reported' ? fromInt(period.waitTimeReceived.value) : null;
}
