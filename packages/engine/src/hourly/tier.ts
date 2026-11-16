import type { Cents, Minutes } from '../types/primitives';
import type { TierRates } from '../types/schedule';

// The rate for the next minute worked, given minutes already performed.
export function tierRate(cumulative: Minutes, thresholdMinutes: Minutes, rates: TierRates): Cents {
  return cumulative < thresholdMinutes ? rates.underThreshold : rates.atOrOverThreshold;
}

// Minutes left at the lower tier; null once the threshold is reached.
export function minutesToTierBoundary(cumulative: Minutes, thresholdMinutes: Minutes): Minutes | null {
  return cumulative < thresholdMinutes ? thresholdMinutes - cumulative : null;
}
