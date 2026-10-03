import { lineValue } from './money.mjs';

const addTo = (totals, key, amount) => totals.set(key, (totals.get(key) ?? 0) + amount);

/** What the stock is worth in each currency, in minor units: `{ EUR: 2500, JPY: 1500 }`. */
export function valuation(state) {
  const totals = new Map();
  for (const item of state.items) addTo(totals, item.price.currency, lineValue(item));
  return Object.fromEntries(totals);
}

/** What the stock of each warehouse is worth, per currency: `{ WH1: { EUR: 2500 } }`. */
export function byWarehouse(state) {
  const warehouses = new Map();
  for (const item of state.items) {
    const totals = warehouses.get(item.location.warehouse) ?? new Map();
    addTo(totals, item.price.currency, lineValue(item));
    warehouses.set(item.location.warehouse, totals);
  }
  return Object.fromEntries([...warehouses].map(([warehouse, totals]) => [warehouse, Object.fromEntries(totals)]));
}
