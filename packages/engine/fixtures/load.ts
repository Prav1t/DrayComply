import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeFixture, type Fixture } from './schema';

const CASES = fileURLToPath(new URL('./cases', import.meta.url));

// Every .json file in cases/, in name order. A malformed file throws with its path.
export function loadFixtures(dir: string = CASES): Fixture[] {
  return readdirSync(dir)
    .filter(name => name.endsWith('.json'))
    .sort()
    .map(name => {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      const fixture = decodeFixture(parsed, name);
      if (`${fixture.id}.json` !== name) throw new TypeError(`fixture ${name}: id "${fixture.id}" does not match the file name`);
      return fixture;
    });
}
