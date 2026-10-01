import { migrateItemV1 } from './format.mjs';
import { InventoryError, parseTags, validateInventory } from './model.mjs';
import { DEFAULT_CURRENCY } from './money.mjs';

const COLUMNS = ['sku', 'name', 'price_amount', 'price_currency', 'qty', 'warehouse', 'bin', 'tags'];

const quote = (field) => (/[",\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field);
const line = (fields) => `${fields.map((field) => quote(String(field))).join(',')}\n`;
const number = (text) => (text.trim() === '' ? NaN : Number(text));

/** An item of a row with the columns of version 2. */
function itemOfV2(fields) {
  const [sku, name, amount, currency, qty, warehouse, bin, tags] = fields;
  return {
    sku,
    name,
    price: { amount: number(amount), currency },
    qty: number(qty),
    location: { warehouse, bin: bin === '' ? null : bin },
    tags: parseTags(tags, ';'),
  };
}

/** An item of a row with the columns of version 1, converted like the items of a version 1 file; its price is the text of its field. */
function itemOfV1(fields) {
  const [sku, name, price, qty, location, tags] = fields;
  return migrateItemV1({ sku, name, price: price.trim(), qty: number(qty), location, tags }, DEFAULT_CURRENCY);
}

/** The row formats an import accepts, told apart by their header row, and how each turns a row into an item. */
const FORMATS = [
  { columns: COLUMNS, toItem: itemOfV2 },
  { columns: ['sku', 'name', 'price', 'qty', 'location', 'tags'], toItem: itemOfV1 },
];

/** The inventory as CSV text: the header row, then one row per item. */
export const exportCsv = (state) =>
  line(COLUMNS) +
  state.items
    .map((item) => line([item.sku, item.name, item.price.amount, item.price.currency, item.qty, item.location.warehouse, item.location.bin ?? '', item.tags.join(';')]))
    .join('');

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

/** `state` with the items of the CSV `text` added; the header row says which columns the text has. */
export function importCsv(text, state) {
  const [header, ...rows] = parseRows(text);
  const format = FORMATS.find(({ columns }) => header?.join(',') === columns.join(','));
  if (format === undefined) throw new InventoryError('ECSV', `the header row must be ${FORMATS.map(({ columns }) => columns.join(',')).join(' or ')}`);
  const added = rows.map((fields) => {
    if (fields.length !== format.columns.length) throw new InventoryError('ECSV', `a row needs ${format.columns.length} fields: ${fields.join(',')}`);
    return format.toItem(fields);
  });
  const next = { ...state, items: [...state.items, ...added] };
  const errors = validateInventory(next);
  if (errors.length > 0) throw new InventoryError('EINVALID', `the import leaves ${errors.length} problems`, { errors });
  return next;
}
