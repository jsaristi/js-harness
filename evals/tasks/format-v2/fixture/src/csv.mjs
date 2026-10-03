import { InventoryError, validateInventory } from './model.mjs';

const COLUMNS = ['sku', 'name', 'price', 'qty', 'location', 'tags'];

const quote = (field) => (/[",\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field);
const line = (fields) => `${fields.map((field) => quote(String(field))).join(',')}\n`;
const number = (text) => (text.trim() === '' ? NaN : Number(text));

/** The inventory as CSV text: the header row, then one row per item. */
export const exportCsv = (state) =>
  line(COLUMNS) + state.items.map((item) => line([item.sku, item.name, item.price, item.qty, item.location, item.tags])).join('');

/** Splits CSV text into rows of fields; a quoted field may hold commas, doubled quotes and line breaks. */
function parseRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = false;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      rows.push([...row, field]);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) rows.push([...row, field]);
  return rows.filter((fields) => fields.length > 1 || fields[0] !== '');
}

/** `state` with the items of the CSV `text` added; the text must hold the header row of `exportCsv`. */
export function importCsv(text, state) {
  const [header, ...rows] = parseRows(text);
  if (header?.join(',') !== COLUMNS.join(',')) throw new InventoryError('ECSV', `the header row must be ${COLUMNS.join(',')}`);
  const added = rows.map((fields) => {
    if (fields.length !== COLUMNS.length) throw new InventoryError('ECSV', `a row needs ${COLUMNS.length} fields: ${fields.join(',')}`);
    const [sku, name, price, qty, location, tags] = fields;
    return { sku, name, price: number(price), qty: number(qty), location, tags };
  });
  const next = { ...state, items: [...state.items, ...added] };
  const errors = validateInventory(next);
  if (errors.length > 0) throw new InventoryError('EINVALID', `the import leaves ${errors.length} problems`, { errors });
  return next;
}
