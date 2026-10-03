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

/** The problems of one item as `{ field, code }`; none when the item is valid. */
export function validateItem(item) {
  const errors = [];
  if (!isText(item.sku)) errors.push({ field: 'sku', code: 'ESKU' });
  if (!isText(item.name)) errors.push({ field: 'name', code: 'ENAME' });
  if (!Number.isFinite(item.price) || item.price < 0) errors.push({ field: 'price', code: 'EPRICE' });
  if (!Number.isInteger(item.qty) || item.qty < 0) errors.push({ field: 'qty', code: 'EQTY' });
  if (!isText(item.location)) errors.push({ field: 'location', code: 'ELOCATION' });
  if (typeof item.tags !== 'string') errors.push({ field: 'tags', code: 'ETAGS' });
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
