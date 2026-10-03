import { lineValue, minorUnits } from './money.mjs';

/** What the stock is worth, in the currency of the file, rounded to that currency's decimals. */
export function valuation(state) {
  const total = state.items.reduce((sum, item) => sum + lineValue(item), 0);
  return Number(total.toFixed(minorUnits(state.currency)));
}

/** What the stock of each warehouse is worth: a warehouse is the part of a location before its first `/`. */
export function byWarehouse(state) {
  const totals = new Map();
  for (const item of state.items) {
    const warehouse = item.location.split('/')[0];
    totals.set(warehouse, (totals.get(warehouse) ?? 0) + lineValue(item));
  }
  return Object.fromEntries(totals);
}
