import type { ContainerCount } from '../types/primitives';
import type { PmrRules } from '../types/schedule';
import { fromInt, mulRatio, type Frac } from '../math/ratio';

export function pmrOwed(rules: PmrRules, containers: ContainerCount): Frac {
  const one = fromInt(rules.cents);
  return containers === 'two' ? mulRatio(one, rules.twoContainerMultiplier) : one;
}
