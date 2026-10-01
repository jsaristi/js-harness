// Hidden grader of `format-v2`. Copied into the workspace as `.eval-grader/` after the agent exits, so
// `..` is the workspace. Every test imports the project itself, so a broken module fails tests one by one
// and the score stays fractional. Each test names the part of the prompt, of docs/proposals/format-v2.md
// (proposal) or of docs/DATA.md ("Format evolution", rules 1 to 6) or README.md that it checks. The tool is
// driven through its modules and through `main`, on temporary files the tests write themselves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bytes, item, names, old, original, parseCsv, place, price, readJson, stockOn, v1, withDir } from './env.mjs';

const T = { timeout: 5000 };
const CHILD = { timeout: 20000 };
const loadFormat = () => import('../src/format.mjs');
const loadStore = () => import('../src/store.mjs');
const loadModel = () => import('../src/model.mjs');
const loadReport = () => import('../src/report.mjs');
const loadSearch = () => import('../src/search.mjs');
const loadCsv = () => import('../src/csv.mjs');
const WORKSPACE = fileURLToPath(new URL('..', import.meta.url));
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

const read = async (data) => (await loadFormat()).readInventory(typeof data === 'string' ? data : JSON.stringify(data));
const migrated = async (items, extra) => (await read(v1(items, extra))).items;
const migratedPrice = async (value, currency) => (await migrated([old({ price: value })], { currency }))[0].price;
const V2_HEADER = 'sku,name,price_amount,price_currency,qty,warehouse,bin,tags';
const V1_HEADER = 'sku,name,price,qty,location,tags';

// A file as other tools write it: fields the tool does not know, at the top level and in items.
const WILD = v1([old({ notes: 'fragile', supplier: { id: 4 } }), old({ sku: 'WASHER', name: 'Washer', price: 0.05, qty: 400, location: 'WH2', tags: '' })], { owner: 'ops', labels: { site: 'north' } });
const WILD_V2 = {
  version: 2,
  owner: 'ops',
  labels: { site: 'north' },
  items: [item({ notes: 'fragile', supplier: { id: 4 } }), item({ sku: 'WASHER', name: 'Washer', price: price(5), qty: 400, location: place('WH2'), tags: [] })],
};

/** A directory holding `stock.json` with the text `text`, and the runner of the tool on it. */
async function withFile(text, body) {
  return withDir(async (dir) => {
    const file = path.join(dir, 'stock.json');
    if (text !== null) fs.writeFileSync(file, text);
    return body({ dir, file, stock: stockOn(file) });
  });
}

// ---- proposal "Price" ---------------------------------------------------------------------------------

// proposal "Price": the amount is in the minor units of the currency of the file, from data/currencies.json
test('a v1 price becomes an amount in the minor units of the file currency', T, async () => {
  assert.deepEqual(await migratedPrice(12.5, 'EUR'), price(1250, 'EUR'));
  assert.deepEqual(await migratedPrice(0.25, 'USD'), price(25, 'USD'));
  assert.deepEqual(await migratedPrice(1500, 'JPY'), price(1500, 'JPY'));
  assert.deepEqual(await migratedPrice(3.5, 'KWD'), price(3500, 'KWD'));
  assert.deepEqual(await migratedPrice(19.99, 'EUR'), price(1999, 'EUR'));
  assert.deepEqual(await migratedPrice(0, 'EUR'), price(0, 'EUR'));
  const [first] = await migrated([old({ sku: 'A', name: 'Alpha', qty: 7 })]);
  assert.deepEqual([first.sku, first.name, first.qty], ['A', 'Alpha', 7]);
});

// proposal "Price": rounded half away from zero (0.125 EUR is 13, 1.5 JPY is 2, 2.0005 KWD is 2001)
test('a v1 price is rounded half away from zero', T, async () => {
  assert.deepEqual(await migratedPrice(0.125, 'EUR'), price(13, 'EUR'));
  assert.deepEqual(await migratedPrice(0.124, 'EUR'), price(12, 'EUR'));
  assert.deepEqual(await migratedPrice(0.005, 'EUR'), price(1, 'EUR'));
  assert.deepEqual(await migratedPrice(0.004, 'EUR'), price(0, 'EUR'));
  assert.deepEqual(await migratedPrice(1.5, 'JPY'), price(2, 'JPY'));
  assert.deepEqual(await migratedPrice(0.5, 'JPY'), price(1, 'JPY'));
  assert.deepEqual(await migratedPrice(2.0005, 'KWD'), price(2001, 'KWD'));
  assert.deepEqual(await migratedPrice(2.0004, 'KWD'), price(2000, 'KWD'));
});

// proposal "Price": the v1 price is the decimal number as written, not the binary number nearest to it
test('a v1 price is read as the decimal that is written', T, async () => {
  assert.deepEqual(await migratedPrice(1.005, 'EUR'), price(101, 'EUR'));
  assert.deepEqual(await migratedPrice(0.285, 'USD'), price(29, 'USD'));
  assert.deepEqual(await migratedPrice(10.075, 'EUR'), price(1008, 'EUR'));
  assert.deepEqual(await migratedPrice(1.255, 'EUR'), price(126, 'EUR'));
});

// proposal "Price": a file without a currency is in EUR, and the top-level currency no longer exists
test('a file without a currency is in EUR, and no v2 state has a top-level currency', T, async () => {
  const withoutCurrency = await read(JSON.stringify({ version: 1, items: [old({ price: 12.5 })] }));
  assert.deepEqual(withoutCurrency.items[0].price, price(1250, 'EUR'));
  const dollars = await read(v1([old({ price: 12.5 })], { currency: 'USD' }));
  assert.deepEqual(dollars.items[0].price, price(1250, 'USD'));
  for (const state of [withoutCurrency, dollars]) {
    assert.equal(state.version, 2);
    assert.equal('currency' in state, false);
  }
});

// ---- proposal "Location" and "Tags" -------------------------------------------------------------------

// proposal "Location": split at the first `/`; without one, a warehouse with no bin
test('a v1 location is split at its first slash', T, async () => {
  const locations = (await migrated([old({ location: 'WH1/B12' }), old({ location: 'WH2' }), old({ location: 'WH1/A/3' })])).map((entry) => entry.location);
  assert.deepEqual(locations, [place('WH1', 'B12'), place('WH2', null), place('WH1', 'A/3')]);
});

// proposal "Tags": split on commas, trimmed, lower-cased, empty ones dropped, repeats kept once at their first place
test('a v1 tag list becomes a clean array', T, async () => {
  const lists = ['Red, small', ' Red, small , , RED,small ', 'Metal,metal ,SMALL, Small', '', ' , '];
  const tags = (await migrated(lists.map((text) => old({ tags: text })))).map((entry) => entry.tags);
  assert.deepEqual(tags, [['red', 'small'], ['red', 'small'], ['metal', 'small'], [], []]);
});

// ---- DATA.md "Format evolution" 1 to 3 ----------------------------------------------------------------

// DATA rule 1: reading a file already in the newest version changes nothing, and what is written reads back as it was
test('a v2 file is read as it is, and a state read from what was written is that state', T, async () => {
  const { readInventory, writeInventory } = await loadFormat();
  const file = { version: 2, items: [item({ price: price(1250, 'USD'), location: place('WH1'), tags: ['a'] })] };
  assert.deepEqual(readInventory(JSON.stringify(file)), file);
  const state = await read(WILD);
  assert.deepEqual(readInventory(writeInventory(state)), state);
});

// DATA rule 3: fields the reader does not know are kept, at the top level and in items
test('unknown fields, at the top level and in items, survive a round trip', T, async () => {
  const { writeInventory } = await loadFormat();
  assert.deepEqual(JSON.parse(writeInventory(await read(WILD))), WILD_V2);
  await withFile(original(WILD), async ({ file }) => {
    const { loadInventory, saveInventory } = await loadStore();
    saveInventory(file, loadInventory(file));
    assert.deepEqual(readJson(file), WILD_V2);
  });
});

// DATA rule 2: writers always write the newest version
test('what the tool writes is in version 2', T, async () => {
  const { writeInventory } = await loadFormat();
  assert.equal(JSON.parse(writeInventory(await read(v1([old()])))).version, 2);
  await withFile(null, async ({ file }) => {
    const { loadInventory, saveInventory } = await loadStore();
    saveInventory(file, loadInventory(file));
    assert.equal(readJson(file).version, 2);
  });
});

// DATA rule 5: a version newer than the tool knows is refused with EVERSION
test('a file in a newer version is refused with EVERSION', T, async () => {
  const { readInventory } = await loadFormat();
  const { loadInventory } = await loadStore();
  const future = (version) => JSON.stringify({ version, items: [{ sku: 'X', future: true }] });
  assert.throws(() => readInventory(future(3)), { code: 'EVERSION' });
  assert.throws(() => readInventory(future(99)), { code: 'EVERSION' });
  await withFile(future(3), ({ file }) => assert.throws(() => loadInventory(file), { code: 'EVERSION' }));
});

// ---- DATA.md "Format evolution" 4 to 6, through the commands ------------------------------------------

// DATA rules 1 to 4, prompt ("Existing v1 files must keep working"): `add` on a v1 file
test('add on a v1 file writes a backup of its bytes and a v2 file that keeps unknown fields', T, async () => {
  const text = original(WILD);
  await withFile(text, async ({ dir, file, stock }) => {
    assert.equal((await stock('add', 'NUT-M4', 'Nut M4', '--price', '0.1', '--location', 'WH1/B3')).code, 0);
    assert.ok(bytes(`${file}.v1.bak`).equals(Buffer.from(text)));
    assert.deepEqual(names(dir), ['stock.json', 'stock.json.v1.bak']);
    const added = item({ sku: 'NUT-M4', name: 'Nut M4', price: price(10), qty: 0, location: place('WH1', 'B3'), tags: [] });
    assert.deepEqual(readJson(file), { ...WILD_V2, items: [...WILD_V2.items, added] });
  });
});

// DATA rules 1 to 4: `move` on a v1 file
test('move on a v1 file writes a backup of its bytes and a v2 file that keeps unknown fields', T, async () => {
  const text = original(WILD);
  await withFile(text, async ({ dir, file, stock }) => {
    assert.equal((await stock('move', 'WASHER', 'WH3/C4')).code, 0);
    assert.ok(bytes(`${file}.v1.bak`).equals(Buffer.from(text)));
    assert.deepEqual(names(dir), ['stock.json', 'stock.json.v1.bak']);
    const [first, washer] = WILD_V2.items;
    assert.deepEqual(readJson(file), { ...WILD_V2, items: [first, { ...washer, location: place('WH3', 'C4') }] });
  });
});

// DATA rules 1 to 4, proposal "CSV": `import` on a v1 file
test('import on a v1 file writes a backup of its bytes and a v2 file that keeps unknown fields', T, async () => {
  const text = original(WILD);
  await withFile(text, async ({ dir, file, stock }) => {
    const csv = path.join(dir, 'items.csv');
    fs.writeFileSync(csv, `${V2_HEADER}\nNUT-M4,Nut M4,10,EUR,250,WH1,B3,metal;small\n`);
    assert.equal((await stock('import', csv)).code, 0);
    assert.ok(bytes(`${file}.v1.bak`).equals(Buffer.from(text)));
    assert.deepEqual(names(dir), ['items.csv', 'stock.json', 'stock.json.v1.bak']);
    const added = item({ sku: 'NUT-M4', name: 'Nut M4', price: price(10), qty: 250, location: place('WH1', 'B3'), tags: ['metal', 'small'] });
    assert.deepEqual(readJson(file), { ...WILD_V2, items: [...WILD_V2.items, added] });
  });
});

// DATA rule 4: the backup is written the first time only, only for a file in an older version, and never over an existing one
test('the backup is written once, never over an earlier one, and not for a file that is already in version 2', T, async () => {
  const text = original(WILD);
  await withFile(text, async ({ dir, file, stock }) => {
    await stock('add', 'NUT-M4', 'Nut M4', '--price', '0.1', '--location', 'WH1/B3');
    await stock('move', 'NUT-M4', 'WH2');
    assert.ok(bytes(`${file}.v1.bak`).equals(Buffer.from(text)));
    assert.deepEqual(names(dir), ['stock.json', 'stock.json.v1.bak']);
  });
  await withFile(original(WILD_V2), async ({ dir, stock }) => {
    assert.equal((await stock('move', 'WASHER', 'WH3')).code, 0);
    assert.deepEqual(names(dir), ['stock.json']);
  });
  await withFile(original(WILD), async ({ dir, file, stock }) => {
    fs.writeFileSync(`${file}.v1.bak`, 'an earlier backup\n');
    assert.equal((await stock('move', 'WASHER', 'WH3')).code, 0);
    assert.equal(fs.readFileSync(`${file}.v1.bak`, 'utf8'), 'an earlier backup\n');
    assert.equal(readJson(file).version, 2);
    assert.deepEqual(names(dir), ['stock.json', 'stock.json.v1.bak']);
  });
});

// DATA rule 5: every command refuses a newer file with exit 3 and leaves it alone
test('every command refuses a file in a newer version with exit 3 and changes nothing', T, async () => {
  const text = original({ version: 3, currency: 'EUR', items: [{ sku: 'X', future: true }] });
  await withFile(text, async ({ dir, file, stock }) => {
    const csv = path.join(dir, 'items.csv');
    fs.writeFileSync(csv, `${V1_HEADER}\nNUT-M4,Nut M4,0.1,250,WH1/B3,metal\n`);
    const commands = [['list'], ['value'], ['export'], ['add', 'NUT', 'Nut', '--price', '1', '--location', 'WH1'], ['move', 'X', 'WH2'], ['import', csv]];
    for (const argv of commands) {
      const { code, out, err } = await stock(...argv);
      assert.equal(code, 3, argv[0]);
      assert.match(err, /^EVERSION: /, argv[0]);
      assert.equal(out, '', argv[0]);
      assert.ok(bytes(file).equals(Buffer.from(text)), argv[0]);
    }
    assert.deepEqual(names(dir), ['items.csv', 'stock.json']);
  });
});

// DATA rule 5: the exit code of the process, through bin/stock.mjs
test('bin/stock.mjs exits with 3 on a file in a newer version', CHILD, async () => {
  await withFile(original({ version: 3, items: [] }), ({ dir, file }) => {
    const run = spawnSync(process.execPath, [path.join(WORKSPACE, 'bin', 'stock.mjs'), 'list', '--file', file], { cwd: dir, encoding: 'utf8', timeout: 15000 });
    assert.equal(run.status, 3, run.stderr);
    assert.match(run.stderr, /^EVERSION: /);
  });
});

// DATA rule 6, README "Usage": list, value and export leave a v1 file as it is and write no backup
test('guard: list, value and export do not rewrite a v1 file or write a backup', T, async () => {
  const text = original(WILD);
  await withFile(text, async ({ dir, file, stock }) => {
    for (const command of ['list', 'value', 'export']) {
      assert.equal((await stock(command)).code, 0, command);
      assert.ok(bytes(file).equals(Buffer.from(text)), command);
      assert.deepEqual(names(dir), ['stock.json'], command);
    }
  });
});

// ---- proposal "Validation" ----------------------------------------------------------------------------

// proposal "Validation": a non-negative integer amount, EPRICE on `price.amount`
test('validateItem reports EPRICE for an amount that is not a non-negative integer', T, async () => {
  const { validateItem } = await loadModel();
  assert.deepEqual(validateItem(item()), []);
  assert.deepEqual(validateItem(item({ price: price(0) })), []);
  const wrong = { field: 'price.amount', code: 'EPRICE' };
  for (const amount of [-1, 12.5, '25', null, Number.NaN]) assert.deepEqual(validateItem(item({ price: price(amount) })), [wrong], String(amount));
});

// proposal "Validation": a code of data/currencies.json, ECURRENCY on `price.currency`
test('validateItem reports ECURRENCY for a currency the tool does not know', T, async () => {
  const { validateItem } = await loadModel();
  assert.deepEqual(validateItem(item({ price: price(25, 'KWD') })), []);
  const wrong = { field: 'price.currency', code: 'ECURRENCY' };
  for (const currency of ['XXX', 'eur', '', null]) assert.deepEqual(validateItem(item({ price: price(25, currency) })), [wrong], String(currency));
});

// proposal "Validation": a non-empty warehouse, ELOCATION on `location.warehouse`
test('validateItem reports ELOCATION for a location without a warehouse', T, async () => {
  const { validateItem } = await loadModel();
  assert.deepEqual(validateItem(item({ location: place('WH2', null) })), []);
  const wrong = { field: 'location.warehouse', code: 'ELOCATION' };
  assert.deepEqual(validateItem(item({ location: place('', 'B1') })), [wrong]);
  assert.deepEqual(validateItem(item({ location: place(5, 'B1') })), [wrong]);
});

// proposal "Validation": an array of non-empty strings, ETAGS on `tags`
test('validateItem reports ETAGS for tags that are not an array of non-empty strings', T, async () => {
  const { validateItem } = await loadModel();
  assert.deepEqual(validateItem(item({ tags: [] })), []);
  const wrong = { field: 'tags', code: 'ETAGS' };
  for (const tags of ['metal', ['metal', ''], ['metal', 3], null]) assert.deepEqual(validateItem(item({ tags })), [wrong], JSON.stringify(tags));
});

// DATA "Validation": the other fields and codes stay as they are (a duplicate sku, a quantity)
test('guard: a duplicate sku and a bad quantity keep their codes', T, async () => {
  const { validateInventory, validateItem } = await loadModel();
  const state = { items: [{ sku: 'A' }, { sku: 'B' }, { sku: 'A' }] };
  assert.deepEqual(validateInventory(state).filter(({ field }) => field === 'sku'), [{ index: 2, field: 'sku', code: 'EDUPLICATE' }]);
  assert.deepEqual(validateItem({ qty: 1.5 }).filter(({ field }) => field === 'qty'), [{ field: 'qty', code: 'EQTY' }]);
  assert.deepEqual(validateItem({ qty: -1 }).filter(({ field }) => field === 'qty'), [{ field: 'qty', code: 'EQTY' }]);
});

// ---- proposal "Reports" and "Search" ------------------------------------------------------------------

const STOCK = {
  version: 2,
  items: [
    item({ sku: 'A', price: price(1250, 'EUR'), qty: 2, location: place('WH1', 'B1') }),
    item({ sku: 'B', price: price(399, 'USD'), qty: 3, location: place('WH1') }),
    item({ sku: 'C', price: price(1500, 'JPY'), qty: 1, location: place('WH2', 'B1') }),
    item({ sku: 'D', price: price(50, 'EUR'), qty: 10, location: place('WH2') }),
  ],
};

// proposal "Reports": amount times qty, summed per currency, in minor units
test('valuation adds up the stock per currency', T, async () => {
  const { valuation } = await loadReport();
  assert.deepEqual(valuation(STOCK), { EUR: 3000, USD: 1197, JPY: 1500 });
  assert.deepEqual(valuation({ version: 2, items: [] }), {});
});

// proposal "Reports": per warehouse, then per currency
test('byWarehouse adds up the stock per warehouse and currency', T, async () => {
  const { byWarehouse } = await loadReport();
  assert.deepEqual(byWarehouse(STOCK), { WH1: { EUR: 2500, USD: 1197 }, WH2: { JPY: 1500, EUR: 500 } });
});

// proposal "Search": the tag, lower-cased, against whole tags
test('filterItems matches a tag against whole tags, after lower-casing it', T, async () => {
  const { filterItems } = await loadSearch();
  const state = {
    items: [item({ sku: 'A', tags: ['red', 'small'] }), item({ sku: 'B', tags: ['reddish'] }), item({ sku: 'C', tags: ['blue'] }), item({ sku: 'D', tags: [] })],
  };
  const skus = (filter) => filterItems(state, filter).map((entry) => entry.sku);
  assert.deepEqual(skus({ tag: 'red' }), ['A']);
  assert.deepEqual(skus({ tag: 'Red' }), ['A']);
  assert.deepEqual(skus({ tag: 'SMALL' }), ['A']);
  assert.deepEqual(skus({ tag: 'reddish' }), ['B']);
  assert.deepEqual(skus({ tag: 'smal' }), []);
  assert.deepEqual(skus({}), ['A', 'B', 'C', 'D']);
});

// proposal "Search": `warehouse` or `warehouse/bin`, split at the first slash, compared as written; every filter must match
test('filterItems matches a location as a warehouse or as a warehouse and bin', T, async () => {
  const { filterItems } = await loadSearch();
  const state = {
    items: [
      item({ sku: 'A', location: place('WH1', 'B12'), tags: ['red'] }),
      item({ sku: 'B', location: place('WH1', 'B13'), tags: ['blue'] }),
      item({ sku: 'C', location: place('WH10', 'B12') }),
      item({ sku: 'D', location: place('WH2') }),
      item({ sku: 'E', location: place('WH1', 'A/3') }),
    ],
  };
  const skus = (filter) => filterItems(state, filter).map((entry) => entry.sku);
  assert.deepEqual(skus({ location: 'WH1' }), ['A', 'B', 'E']);
  assert.deepEqual(skus({ location: 'WH1/B12' }), ['A']);
  assert.deepEqual(skus({ location: 'WH10' }), ['C']);
  assert.deepEqual(skus({ location: 'WH2' }), ['D']);
  assert.deepEqual(skus({ location: 'WH1/A/3' }), ['E']);
  assert.deepEqual(skus({ location: 'WH2/B1' }), []);
  assert.deepEqual(skus({ location: 'wh1' }), []);
  assert.deepEqual(skus({ location: 'WH1', tag: 'blue' }), ['B']);
});

// ---- proposal "CSV" -----------------------------------------------------------------------------------

// proposal "CSV": the v2 columns, the amount as the integer of the file, the tags joined with `;`
test('exportCsv writes the v2 header and the amount, currency, warehouse, bin and tags', T, async () => {
  const { exportCsv } = await loadCsv();
  const text = exportCsv({ version: 2, items: [item()] });
  assert.equal(text.split('\n')[0], V2_HEADER);
  assert.deepEqual(parseCsv(text), [V2_HEADER.split(','), ['BOLT-M4', 'Bolt M4', '25', 'EUR', '100', 'WH1', 'B12', 'metal;small']]);
});

// proposal "CSV": an item without a bin has an empty bin field; DATA "CSV": quoting
test('exportCsv leaves the bin of an item without one empty and quotes what needs it', T, async () => {
  const { exportCsv } = await loadCsv();
  const name = 'Washer, "flat"\nM4';
  const text = exportCsv({ version: 2, items: [item({ sku: 'W', name, price: price(1500, 'JPY'), location: place('WH2'), tags: [] })] });
  assert.deepEqual(parseCsv(text)[1], ['W', name, '1500', 'JPY', '100', 'WH2', '', '']);
});

// proposal "CSV": a v2 file is read as it is; an empty bin is no bin, an empty tags field no tags
test('importCsv reads a v2 file and keeps what the inventory already holds', T, async () => {
  const { importCsv } = await loadCsv();
  const state = await read(WILD);
  const text = `${V2_HEADER}\nNUT-M4,Nut M4,10,EUR,250,WH1,B3,metal;small\nRING,"Ring, big",1500,JPY,3,WH2,,\n`;
  const next = importCsv(text, state);
  assert.deepEqual(next, {
    ...WILD_V2,
    items: [
      ...WILD_V2.items,
      item({ sku: 'NUT-M4', name: 'Nut M4', price: price(10), qty: 250, location: place('WH1', 'B3'), tags: ['metal', 'small'] }),
      item({ sku: 'RING', name: 'Ring, big', price: price(1500, 'JPY'), qty: 3, location: place('WH2'), tags: [] }),
    ],
  });
});

// proposal "CSV": the v1 header is accepted and its rows are converted like v1 data, in EUR
test('importCsv reads a file with the v1 header and converts its rows', T, async () => {
  const { importCsv } = await loadCsv();
  const text = `${V1_HEADER}\nNUT,Nut M4,1.005,250,WH1/A/3,"Red, small, RED"\nRING,Ring,12.5,3,WH9,\n`;
  const { items } = importCsv(text, { version: 2, items: [] });
  assert.deepEqual(items, [
    item({ sku: 'NUT', name: 'Nut M4', price: price(101), qty: 250, location: place('WH1', 'A/3'), tags: ['red', 'small'] }),
    item({ sku: 'RING', name: 'Ring', price: price(1250), qty: 3, location: place('WH9'), tags: [] }),
  ]);
});

// proposal "CSV": what is exported is what is imported
test('what exportCsv writes, importCsv reads back', T, async () => {
  const { exportCsv, importCsv } = await loadCsv();
  const state = {
    version: 2,
    items: [item({ name: 'Bolt, "M4"' }), item({ sku: 'RING', price: price(1500, 'JPY'), location: place('WH2'), tags: [] }), item({ sku: 'OIL', price: price(12345, 'KWD'), tags: ['a'] })],
  };
  assert.deepEqual(importCsv(exportCsv(state), { version: 2, items: [] }).items, state.items);
});

// DATA "CSV": a header that is not known, or a row with the wrong number of fields, is ECSV
test('guard: importCsv refuses an unknown header and a short row with ECSV', T, async () => {
  const { importCsv } = await loadCsv();
  assert.throws(() => importCsv('sku,name\nA,Alpha\n', { items: [] }), { code: 'ECSV' });
  assert.throws(() => importCsv(`${V1_HEADER}\nA,Alpha,1\n`, { items: [] }), { code: 'ECSV' });
});

// DATA "CSV": an import that leaves a duplicate sku is refused with EINVALID and changes nothing
test('guard: import refuses a sku that is already there and changes nothing', T, async () => {
  await withFile(original(WILD), async ({ dir, file, stock }) => {
    const csv = path.join(dir, 'items.csv');
    fs.writeFileSync(csv, `${V1_HEADER}\nBOLT-M4,Bolt again,0.3,1,WH1,\n`);
    const { code, err } = await stock('import', csv);
    assert.equal(code, 1);
    assert.match(err, /^EINVALID: /);
    assert.ok(bytes(file).equals(Buffer.from(original(WILD))));
    assert.deepEqual(names(dir), ['items.csv', 'stock.json']);
  });
});

// ---- proposal "Command line" --------------------------------------------------------------------------

// proposal "Command line" (add, the default currency, `--tags`), Price, Location, Tags; README ("the first command that changes it creates it")
test('add creates a v2 file with EUR as the default currency, a split location and clean tags', T, async () => {
  await withFile(null, async ({ dir, file, stock }) => {
    const { code } = await stock('add', 'BOLT', 'Bolt M4', '--price', '12.5', '--location', 'WH1/B12', '--qty', '5', '--tags', 'Metal, small, METAL');
    assert.equal(code, 0);
    assert.deepEqual(readJson(file), { version: 2, items: [item({ sku: 'BOLT', price: price(1250), qty: 5, tags: ['metal', 'small'] })] });
    assert.deepEqual(names(dir), ['stock.json']);
  });
});

// proposal "Command line" (add, --currency, an unknown currency is ECURRENCY), Price (rounding, decimal as written)
test('add --currency converts the price with that currency, and refuses an unknown one', T, async () => {
  await withFile(null, async ({ file, stock }) => {
    const add = (sku, value, ...more) => stock('add', sku, sku, '--price', value, '--location', 'WH1', ...more);
    assert.equal((await add('A', '1.5', '--currency', 'JPY')).code, 0);
    assert.equal((await add('B', '2.0005', '--currency', 'KWD')).code, 0);
    assert.equal((await add('C', '1.005', '--currency', 'USD')).code, 0);
    assert.equal((await add('D', '0.125')).code, 0);
    assert.deepEqual(readJson(file).items.map((entry) => entry.price), [price(2, 'JPY'), price(2001, 'KWD'), price(101, 'USD'), price(13, 'EUR')]);
    const before = bytes(file);
    const refused = await add('E', '1', '--currency', 'XXX');
    assert.equal(refused.code, 1);
    assert.match(refused.err, /^ECURRENCY: /);
    assert.ok(bytes(file).equals(before));
  });
});

// proposal "Command line" (move <sku> <warehouse>[/<bin>]), Location
test('move sets a warehouse and a bin, split at the first slash, or a warehouse alone', T, async () => {
  await withFile(original({ version: 2, items: [item()] }), async ({ file, stock }) => {
    const moveTo = async (location) => {
      assert.equal((await stock('move', 'BOLT-M4', location)).code, 0, location);
      return readJson(file).items[0].location;
    };
    assert.deepEqual(await moveTo('WH2'), place('WH2', null));
    assert.deepEqual(await moveTo('WH3/C4/5'), place('WH3', 'C4/5'));
    assert.deepEqual(await moveTo('WH4/B1'), place('WH4', 'B1'));
  });
});

// proposal "Command line": one line per currency, `<CODE> <amount>`, sorted by code, the decimals of the currency, no grouping
test('value prints one line per currency, sorted by code', T, async () => {
  const items = [
    item({ sku: 'A', price: price(1250, 'EUR'), qty: 2 }),
    item({ sku: 'B', price: price(100000, 'EUR'), qty: 1 }),
    item({ sku: 'C', price: price(5, 'USD'), qty: 1 }),
    item({ sku: 'D', price: price(1500, 'JPY'), qty: 1 }),
    item({ sku: 'E', price: price(12345, 'KWD'), qty: 1 }),
  ];
  await withFile(original({ version: 2, items }), async ({ stock }) => {
    const { code, out } = await stock('value');
    assert.equal(code, 0);
    assert.deepEqual(out.trimEnd().split('\n'), ['EUR 1025.00', 'JPY 1500', 'KWD 12.345', 'USD 0.05']);
  });
});

// proposal "Command line": list prints `12.50 EUR`, `1500 JPY` and the location with or without its bin
test('list prints the price with its currency and the location of a v2 file', T, async () => {
  const items = [
    item(),
    item({ sku: 'RING', name: 'Ring', price: price(1500, 'JPY'), qty: 3, location: place('WH2') }),
    item({ sku: 'OIL', name: 'Oil', price: price(12345, 'KWD'), qty: 1, location: place('WH3', 'A/3') }),
    item({ sku: 'PEN', name: 'Pen', price: price(5, 'USD'), qty: 7, location: place('WH1') }),
  ];
  await withFile(original({ version: 2, items }), async ({ stock }) => {
    const { code, out } = await stock('list');
    assert.equal(code, 0);
    assert.deepEqual(out.trimEnd().split('\n').map((line) => line.split('\t')), [
      ['BOLT-M4', 'Bolt M4', '0.25 EUR', '100', 'WH1/B12'],
      ['RING', 'Ring', '1500 JPY', '3', 'WH2'],
      ['OIL', 'Oil', '12.345 KWD', '1', 'WH3/A/3'],
      ['PEN', 'Pen', '0.05 USD', '7', 'WH1'],
    ]);
  });
});

// ---- behaviour that v2 leaves as it is ----------------------------------------------------------------

// README "Usage" (list): the output for a v1 file does not change, in any currency, and the filters still work
test('guard: list prints a v1 file as it always did, and filters it', T, async () => {
  const rows = [old(), old({ sku: 'WASHER', name: 'Washer, flat', price: 0.05, qty: 400, location: 'WH2', tags: 'metal' })];
  await withFile(original(v1(rows)), async ({ stock }) => {
    assert.deepEqual((await stock('list')).out.trimEnd().split('\n').map((line) => line.split('\t')), [
      ['BOLT-M4', 'Bolt M4', '0.25 EUR', '100', 'WH1/B12'],
      ['WASHER', 'Washer, flat', '0.05 EUR', '400', 'WH2'],
    ]);
    assert.equal((await stock('list', '--tag', 'small')).out.split('\t')[0], 'BOLT-M4');
    assert.equal((await stock('list', '--location', 'WH2')).out.split('\t')[0], 'WASHER');
    assert.equal((await stock('list', '--tag', 'small', '--location', 'WH2')).out, '');
  });
  for (const [currency, value, shown] of [['JPY', 1500, '1500 JPY'], ['KWD', 12.345, '12.345 KWD'], ['USD', 0.05, '0.05 USD']]) {
    await withFile(original(v1([old({ price: value })], { currency })), async ({ stock }) => {
      assert.equal((await stock('list')).out.split('\t')[2], shown);
    });
  }
});

// README "Usage" (export): a field that holds a comma is quoted, so every row has the same number of fields
test('guard: export of a v1 file quotes a name that holds a comma', T, async () => {
  await withFile(original(v1([old(), old({ sku: 'WASHER', name: 'Washer, flat' })])), async ({ stock }) => {
    const rows = parseCsv((await stock('export')).out);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((row) => row.length === rows[0].length));
    assert.equal(rows[2][1], 'Washer, flat');
  });
});

// DATA "Validation", README "Usage" (add): a duplicate sku and a bad quantity are refused with their codes, and change nothing
test('guard: add refuses a duplicate sku and a bad quantity', T, async () => {
  const text = original(WILD);
  await withFile(text, async ({ dir, file, stock }) => {
    const refuse = async (code, ...argv) => {
      const run = await stock('add', ...argv, '--price', '1', '--location', 'WH3');
      assert.equal(run.code, 1);
      assert.match(run.err, new RegExp(`^${code}: `));
    };
    await refuse('EDUPLICATE', 'WASHER', 'Another washer');
    await refuse('EQTY', 'NUT', 'Nut', '--qty', '1.5');
    await refuse('EQTY', 'NUT', 'Nut', '--qty', '-1');
    assert.ok(bytes(file).equals(Buffer.from(text)));
    assert.deepEqual(names(dir), ['stock.json']);
  });
});

// README "Usage" (move): an unknown sku is ENOSKU with exit 1
test('guard: move refuses an unknown sku and changes nothing', T, async () => {
  const text = original(WILD);
  await withFile(text, async ({ dir, file, stock }) => {
    const { code, err } = await stock('move', 'NO-SUCH', 'WH3');
    assert.equal(code, 1);
    assert.match(err, /^ENOSKU: /);
    assert.ok(bytes(file).equals(Buffer.from(text)));
    assert.deepEqual(names(dir), ['stock.json']);
  });
});

// README "Usage": STOCK_FILE, exit 2 for a command that is not used correctly, a missing file is an empty inventory
test('guard: STOCK_FILE, usage errors and a missing file', T, async () => {
  const { main } = await import('../src/cli.mjs');
  await withFile(original(v1([old()])), async ({ file, stock }) => {
    let out = '';
    assert.equal(main(['list'], { out: (text) => (out += text), err: () => {}, env: { STOCK_FILE: file } }), 0);
    assert.equal(out, (await stock('list')).out);
  });
  await withFile(null, async ({ dir, stock }) => {
    assert.deepEqual(await stock('list'), { code: 0, out: '', err: '' });
    assert.equal((await stock('frobnicate')).code, 2);
    assert.equal((await stock('add', 'ONLY-A-SKU')).code, 2);
    assert.deepEqual(names(dir), []);
  });
});

// DATA "Format (version 1)", README: a file that is not JSON or has no list of items is EFORMAT
test('guard: a file that is not an inventory is refused with EFORMAT', T, async () => {
  const { readInventory } = await loadFormat();
  assert.throws(() => readInventory('{ items: '), { code: 'EFORMAT' });
  assert.throws(() => readInventory('{"version":1,"currency":"EUR"}'), { code: 'EFORMAT' });
});

// ---- the project ---------------------------------------------------------------------------------------

// Definition of done: the project's own tests are green when the work ends.
test("the project's own test suite passes", { timeout: 30000 }, () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/**/*.spec.mjs'], { cwd: WORKSPACE, env, encoding: 'utf8', timeout: 25000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^# tests [1-9]\d*$/m);
});

// The accepted proposal and the currency data are not part of the work.
test('guard: the proposal and the currency data are unchanged', T, () => {
  assert.equal(sha256('../docs/proposals/format-v2.md'), '69bbd6ab3397d3f39affb8805d91ae016369020004392db32b494f314b35dbe6');
  assert.equal(sha256('../data/currencies.json'), 'ac4555945f0e9e21769a834b2a8e3f454632ed4b04d9e4737e391a2ae639ec7f');
});
