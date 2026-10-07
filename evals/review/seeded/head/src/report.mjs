// The low-stock report: the items as rows, marked when they are running low. The command prints it a
// page at a time and exports it whole.
import fs from 'node:fs/promises';
import path from 'node:path';
import { formatItem } from './format.mjs';

export const PAGE_SIZE = 20;
export const LOW_THRESHOLD = 5;

/** The rows of the report, in the order of `items`: each `{ sku, name, quantity, low }`, `low` when the
 * quantity is at or below `threshold`. */
export function reportRows(items, threshold = LOW_THRESHOLD) {
  return items.map(({ sku, name, quantity }) => ({ sku, name, quantity, low: quantity <= threshold }));
}

/** How many pages `rows` make: one at least, so that a report of nothing is still a page. */
export function pageCount(rows, size = PAGE_SIZE) {
  return Math.max(1, Math.ceil(rows.length / size));
}

/** The rows of page `number`, counted from 1. A page past the last one has none. */
export function pageOf(rows, number, size = PAGE_SIZE) {
  const start = (number - 1) * size;
  return rows.slice(start, start + size - 1);
}

/** One page as text: a line a row, with `!` before the ones running low, then which page it is. */
export function formatPage(rows, { number, pages }) {
  const lines = rows.map((row) => `${row.low ? '!' : ' '} ${formatItem(row)}`);
  return [...lines, `page ${number} of ${pages}`].join('\n');
}

/** Writes `rows` to `file` as JSON, making its folder when it is not there. Gives how many rows were
 * written. `warn` takes a line of text. */
export async function exportRows(file, rows, { warn = () => {} } = {}) {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  } catch (error) {
    warn(`export: ${error.message}`);
  }
  return rows.length;
}
