import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { loadRecordModule, PAGE_TEMPLATES, recordPageRendered } from './pages-rendered.mjs';

test('the page templates are the six ids of the rendered record\'s contract', () => {
  assert.deepEqual(PAGE_TEMPLATES, ['stretch-departure', 'stretch-status', 'stretch-return', 'feature-close', 'phase-change', 'status-report']);
});

test('a page is recorded once, with its template, its subject, its path, its time and its head, in the project\'s rendered file', async () => {
  const calls = [];
  const load = async () => ({
    renderedFile: (home, slug) => `${home}/.js-harness/throughput/${slug}/templates-rendered.jsonl`,
    recordRendered: (file, entry) => {
      calls.push({ file, entry });
      return { sha256: 'ab'.repeat(32), bytes: 10 };
    },
  });
  const said = await recordPageRendered({ home: '/h', slug: 'D--p', template: 'phase-change', subject: 'map', path: '/w/page.html', at: '2026-10-29T04:00:00.000Z', head: 'c1' }, { load });
  assert.deepEqual(calls, [{ file: '/h/.js-harness/throughput/D--p/templates-rendered.jsonl', entry: { template: 'phase-change', subject: 'map', path: '/w/page.html', at: '2026-10-29T04:00:00.000Z', head: 'c1' } }]);
  assert.deepEqual(said, { recorded: { sha256: 'ab'.repeat(32), bytes: 10 }, file: '/h/.js-harness/throughput/D--p/templates-rendered.jsonl' });
});

test('with no rendered record built yet the page is said unrecorded, never recorded in its place', async () => {
  const said = await recordPageRendered({ home: '/h', slug: 'D--p', template: 'phase-change', path: '/w/p.html', at: 'x', head: 'c1' }, { load: async () => null });
  assert.match(said.unavailable, /template-record\.mjs is not in this install/);
});

test('a record that cannot be written is said with why, and an unknown template is refused before anything is read', async () => {
  let loads = 0;
  const load = async () => {
    loads += 1;
    return { renderedFile: () => '/f', recordRendered: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
  };
  const said = await recordPageRendered({ home: '/h', slug: 's', template: 'phase-change', path: '/p', at: 'x', head: null }, { load });
  assert.equal(said.unavailable, 'the rendered record /f could not be written: EACCES');
  const where = await recordPageRendered({ home: '/h', slug: 's', template: 'phase-change', path: '/p', at: 'x', head: null }, { load: async () => ({ renderedFile: () => { throw new Error('no home'); } }) });
  assert.equal(where.unavailable, 'the rendered record of s could not be written: no home', 'a path it cannot name is said, never thrown after the page is written');
  await assert.rejects(recordPageRendered({ home: '/h', slug: 's', template: 'phase', path: '/p', at: 'x', head: null }, { load }), /unknown page template: phase/);
  assert.equal(loads, 1, 'the unknown template loaded nothing');
});

test('the record module absent is null, but one that is there and cannot load throws', async (t) => {
  assert.equal(await loadRecordModule(), null, 'this install has no template-record.mjs yet');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-rendered-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const broken = path.join(folder, 'template-record.mjs');
  fs.writeFileSync(broken, "import './gone.mjs';\nexport const renderedFile = () => '';\n");
  await assert.rejects(loadRecordModule(undefined, pathToFileURL(broken)), (err) => err.code === 'ERR_MODULE_NOT_FOUND', 'a missing import inside it is no absent module');
  fs.writeFileSync(path.join(folder, 'gone.mjs'), '');
  assert.equal(typeof (await loadRecordModule(undefined, pathToFileURL(broken))).renderedFile, 'function');
  assert.equal(await loadRecordModule(undefined, pathToFileURL(path.join(folder, 'missing.mjs'))), null);
});
