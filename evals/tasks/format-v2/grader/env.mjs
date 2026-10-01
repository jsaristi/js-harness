// Helpers of the hidden grader of `format-v2`: the data the tests write, a temporary directory per test, a
// runner for the command line and a reader for CSV. The workspace root is `..` from this directory.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** A v1 file as a JavaScript value; `extra` holds the fields a file may carry besides the three it defines. */
export const v1 = (items, extra = {}) => ({ version: 1, currency: 'EUR', items, ...extra });

/** A v1 item. */
export const old = (overrides = {}) => ({ sku: 'BOLT-M4', name: 'Bolt M4', price: 0.25, qty: 100, location: 'WH1/B12', tags: 'metal, small', ...overrides });

/** A v2 item. */
export const item = (overrides = {}) => ({
  sku: 'BOLT-M4',
  name: 'Bolt M4',
  price: { amount: 25, currency: 'EUR' },
  qty: 100,
  location: { warehouse: 'WH1', bin: 'B12' },
  tags: ['metal', 'small'],
  ...overrides,
});

export const price = (amount, currency = 'EUR') => ({ amount, currency });
export const place = (warehouse, bin = null) => ({ warehouse, bin });

/** The text of a file with its own formatting and no final line feed, so that a rewrite differs from it. */
export const original = (data) => JSON.stringify(data, null, '\t');

/** A temporary directory for `body(dir)`, removed afterwards. */
export async function withDir(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-grade-'));
  try {
    return await body(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** `stock(...argv)` runs one command of the tool on `file`, through `main`, and returns what it did. */
export function stockOn(file) {
  return async (...argv) => {
    const { main } = await import('../src/cli.mjs');
    let out = '';
    let err = '';
    const code = main([...argv, '--file', file], { out: (text) => (out += text), err: (text) => (err += text) });
    return { code, out, err };
  };
}

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const bytes = (file) => fs.readFileSync(file);
export const names = (dir) => fs.readdirSync(dir).sort();

/** Splits CSV text into rows of fields (RFC 4180: quoted fields may hold commas, quotes and line breaks). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      rows.push([...row, field]);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field !== '' || row.length > 0) rows.push([...row, field]);
  return rows;
}
