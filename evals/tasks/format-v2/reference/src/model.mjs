import { isKnownCurrency } from './money.mjs';

/** An error with a stable `code`; the command line prints the code and turns it into an exit code. */
export class InventoryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'InventoryError';
    this.code = code;
    Object.assign(this, details);
  }
}

const isText = (value) => typeof value === 'string' && value !== '';

/** `WH1/B12` as `{ warehouse: 'WH1', bin: 'B12' }`, split at the first `/`; a location without one has no bin. */
export function parseLocation(text) {
  const slash = text.indexOf('/');
  return slash === -1 ? { warehouse: text, bin: null } : { warehouse: text.slice(0, slash), bin: text.slice(slash + 1) };
}

/** A location as text: `WH1/B12`, or `WH1` when it has no bin. */
export const formatLocation = ({ warehouse, bin }) => (bin === null ? warehouse : `${warehouse}/${bin}`);

/** The tags of a comma-separated list: trimmed, lower-cased, without empty tags or repeats. */
export const parseTags = (text) => [...new Set(text.split(',').map((tag) => tag.trim().toLowerCase()).filter((tag) => tag !== ''))];

/** The problems of one item as `{ field, code }`; none when the item is valid. */
export function validateItem(item) {
  const errors = [];
  if (!isText(item.sku)) errors.push({ field: 'sku', code: 'ESKU' });
  if (!isText(item.name)) errors.push({ field: 'name', code: 'ENAME' });
  if (!Number.isInteger(item.price?.amount) || item.price.amount < 0) errors.push({ field: 'price.amount', code: 'EPRICE' });
  if (!isKnownCurrency(item.price?.currency)) errors.push({ field: 'price.currency', code: 'ECURRENCY' });
  if (!Number.isInteger(item.qty) || item.qty < 0) errors.push({ field: 'qty', code: 'EQTY' });
  if (!isText(item.location?.warehouse)) errors.push({ field: 'location.warehouse', code: 'ELOCATION' });
  if (!Array.isArray(item.tags) || !item.tags.every(isText)) errors.push({ field: 'tags', code: 'ETAGS' });
  return errors;
}

/** The problems of every item as `{ index, field, code }`, and a sku that an earlier item already has. */
export function validateInventory(state) {
  const seen = new Set();
  return state.items.flatMap((item, index) => {
    const errors = validateItem(item).map((error) => ({ index, ...error }));
    if (seen.has(item.sku)) errors.push({ index, field: 'sku', code: 'EDUPLICATE' });
    seen.add(item.sku);
    return errors;
  });
}
