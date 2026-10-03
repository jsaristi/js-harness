import { InventoryError } from './model.mjs';
import { DEFAULT_CURRENCY, isKnownCurrency } from './money.mjs';

/** The version of the files this tool writes. */
export const VERSION = 1;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** An inventory with no item, at the version this tool writes. */
export const emptyInventory = () => ({ version: VERSION, currency: DEFAULT_CURRENCY, items: [] });

/** The state a file holds: its own fields, with the currency filled in when the file has none. */
export function readInventory(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InventoryError('EFORMAT', 'the file is not valid JSON');
  }
  if (!isObject(data) || !Array.isArray(data.items)) throw new InventoryError('EFORMAT', 'the file is not an inventory');
  if (data.version !== VERSION) throw new InventoryError('EFORMAT', `unsupported version ${data.version}`);
  const currency = data.currency ?? DEFAULT_CURRENCY;
  if (!isKnownCurrency(currency)) throw new InventoryError('ECURRENCY', `unknown currency ${currency}`);
  return { ...data, currency };
}

/** The text of a file holding `state`. */
export const writeInventory = (state) => `${JSON.stringify({ ...state, version: VERSION }, null, 2)}\n`;
