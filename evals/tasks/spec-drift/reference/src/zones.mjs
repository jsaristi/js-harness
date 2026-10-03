// Destination zones, from data/zones.json.
import { readFileSync } from 'node:fs';
import { QuoteError, normalizePostalCode } from './parse.mjs';

const { entries } = JSON.parse(readFileSync(new URL('../data/zones.json', import.meta.url), 'utf8'));

/** The zone and remote-area flag of a destination. */
export function lookupZone(country, postalCode) {
  const code = normalizePostalCode(postalCode);
  const match = entries
    .filter((entry) => entry.country === country && code.startsWith(entry.prefix))
    .reduce((best, entry) => (best === null || entry.prefix.length > best.prefix.length ? entry : best), null);
  if (!match) throw new QuoteError('NO_ZONE', `no zone for ${country} ${code}`);
  return { zone: match.zone, remote: match.remote };
}
