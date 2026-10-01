import { InventoryError, parseLocation, parseTags } from './model.mjs';
import { DEFAULT_CURRENCY, isKnownCurrency, toMinor } from './money.mjs';

/** The version of the files this tool writes. */
export const VERSION = 2;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** An inventory with no item, at the version this tool writes. */
export const emptyInventory = () => ({ version: VERSION, items: [] });

/** A v1 item as a v2 item, its price converted with `currency`; the fields it does not know stay as they are. */
export const migrateItemV1 = (item, currency) => ({
  ...item,
  price: { amount: toMinor(item.price, currency), currency },
  location: parseLocation(item.location),
  tags: parseTags(item.tags),
});

/** The v2 state of a v1 file: the currency of the file moves into each price. */
function migrateV1(data) {
  const { currency = DEFAULT_CURRENCY, ...rest } = data;
  if (!isKnownCurrency(currency)) throw new InventoryError('ECURRENCY', `unknown currency ${currency}`);
  const items = data.items.map((item) => {
    if (!isObject(item) || typeof item.location !== 'string' || typeof item.tags !== 'string') throw new InventoryError('EFORMAT', 'an item is not a version 1 item');
    const migrated = migrateItemV1(item, currency);
    if (Number.isNaN(migrated.price.amount)) throw new InventoryError('EFORMAT', `the price of ${item.sku} is not a non-negative decimal`);
    return migrated;
  });
  return { ...rest, version: 2, items };
}

/** The migrations, each from the version it is keyed by to the next one. */
const MIGRATIONS = new Map([[1, migrateV1]]);

function parse(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InventoryError('EFORMAT', 'the file is not valid JSON');
  }
  if (!isObject(data) || !Number.isInteger(data.version) || data.version < 1) throw new InventoryError('EFORMAT', 'the file is not an inventory');
  if (data.version > VERSION) throw new InventoryError('EVERSION', `the file is in version ${data.version}, and this tool knows up to ${VERSION}`);
  return data;
}

/** The version a file is in. */
export const versionOf = (text) => parse(text).version;

/** Whether an item has the two objects that the readers of a version 2 item go into. */
const hasStructure = (item) => isObject(item) && isObject(item.price) && isObject(item.location);

/** The state a file holds, migrated to the newest version. */
export function readInventory(text) {
  let state = parse(text);
  if (!Array.isArray(state.items)) throw new InventoryError('EFORMAT', 'the file is not an inventory');
  while (state.version < VERSION) state = MIGRATIONS.get(state.version)(state);
  if (!state.items.every(hasStructure)) throw new InventoryError('EFORMAT', 'an item has no price or no location');
  return state;
}

/** The text of a file holding `state`. */
export const writeInventory = (state) => `${JSON.stringify({ ...state, version: VERSION }, null, 2)}\n`;
