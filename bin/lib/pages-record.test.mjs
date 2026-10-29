import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PAGE_SCHEMA, appendPage, lastPage, pagesFile, readPages } from './pages-record.mjs';

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pages-record-'));

test('the page record sits beside the throughput days of the project, which uninstall keeps', () => {
  assert.equal(pagesFile('/h', 'D--p'), path.join('/h', '.js-harness', 'throughput', 'D--p', 'pages.jsonl'));
});

test('a page is appended with its kind, subject, time, head and numbers, and read back; none is an empty list', () => {
  const file = path.join(scratch(), 'deep', 'pages.jsonl');
  assert.deepEqual(readPages(file), []);
  assert.equal(appendPage(file, { kind: 'phase', subject: 'map', at: '2026-10-29T01:00:00Z', head: 'a1', numbers: { total: 1 } }), true);
  assert.deepEqual(readPages(file), [{ schema: PAGE_SCHEMA, kind: 'phase', subject: 'map', at: '2026-10-29T01:00:00Z', head: 'a1', numbers: { total: 1 } }]);
});

test('a page whose kind, subject and head equal the last of its kind and subject is not appended again', () => {
  const file = path.join(scratch(), 'pages.jsonl');
  appendPage(file, { kind: 'phase', subject: 'map', at: 't1', head: 'a1', numbers: {} });
  appendPage(file, { kind: 'feature', subject: 'odd/tasks/x.md', at: 't2', head: 'a1', numbers: {} });
  assert.equal(appendPage(file, { kind: 'phase', subject: 'map', at: 't3', head: 'a1', numbers: {} }), false);
  assert.equal(appendPage(file, { kind: 'phase', subject: 'map', at: 't4', head: 'b2', numbers: {} }), true);
  assert.equal(readPages(file).length, 3);
});

test('the last page of a kind and subject is the newest appended, and none is null', () => {
  const file = path.join(scratch(), 'pages.jsonl');
  appendPage(file, { kind: 'phase', subject: 'map', at: 't1', head: 'a1', numbers: { n: 1 } });
  appendPage(file, { kind: 'phase', subject: 'map', at: 't2', head: 'a2', numbers: { n: 2 } });
  assert.equal(lastPage(readPages(file), 'phase', 'map').numbers.n, 2);
  assert.equal(lastPage(readPages(file), 'feature', 'map'), null);
});

test('a cut last line is ended before the next page, and a line that is no page is left out', () => {
  const file = path.join(scratch(), 'pages.jsonl');
  fs.writeFileSync(file, `not json\n{"schema":"${PAGE_SCHEMA}","kind":"phase"`);
  appendPage(file, { kind: 'phase', subject: 'map', at: 't1', head: 'a1', numbers: {} });
  const pages = readPages(file);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].head, 'a1');
});

test('a record that is there and cannot be read throws, so a page never reads it as no page', () => {
  const dir = scratch();
  assert.throws(() => readPages(dir));
});
