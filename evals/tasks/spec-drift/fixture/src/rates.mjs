// Dated rate tables, from data/rates.json.
import { readFileSync } from 'node:fs';
import { QuoteError } from './parse.mjs';

const { tables } = JSON.parse(readFileSync(new URL('../data/rates.json', import.meta.url), 'utf8'));

/** The table in force on an order date. */
export function selectRateTable(orderDate) {
  const table = tables.find((candidate) => candidate.effective < orderDate);
  if (!table) throw new QuoteError('NO_RATE_TABLE', `no rate table in force on ${orderDate}`);
  return table;
}

/** The price of the weight band that holds `billableKg` in `zone`. */
export function baseRateCents(table, zone, billableKg) {
  const index = table.bands.findIndex((limit) => limit === null || billableKg < limit);
  return table.cents[zone][index];
}
