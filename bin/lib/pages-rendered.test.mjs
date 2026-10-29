import assert from 'node:assert/strict';
import test from 'node:test';
import { PAGE_TEMPLATES, recordPageRendered } from './pages-rendered.mjs';

test('the page templates are the six ids of the rendered record\'s contract', () => {
  assert.deepEqual(PAGE_TEMPLATES, ['stretch-departure', 'stretch-status', 'stretch-return', 'feature-close', 'phase-change', 'status-report']);
});

test('a page is recorded once, with its template, its path, its time and its head, in the project\'s rendered file', async () => {
  const calls = [];
  const load = async () => ({
    renderedFile: (home, slug) => `${home}/.js-harness/templates/${slug}/rendered.jsonl`,
    recordRendered: (file, entry) => {
      calls.push({ file, entry });
      return { sha256: 'ab'.repeat(32), bytes: 10 };
    },
  });
  const said = await recordPageRendered({ home: '/h', slug: 'D--p', template: 'phase-change', path: '/w/page.html', at: '2026-10-29T04:00:00.000Z', head: 'c1' }, { load });
  assert.deepEqual(calls, [{ file: '/h/.js-harness/templates/D--p/rendered.jsonl', entry: { template: 'phase-change', path: '/w/page.html', at: '2026-10-29T04:00:00.000Z', head: 'c1' } }]);
  assert.deepEqual(said, { recorded: { sha256: 'ab'.repeat(32), bytes: 10 }, file: '/h/.js-harness/templates/D--p/rendered.jsonl' });
});

test('with no rendered record built yet the page is said unrecorded, never recorded in its place', async () => {
  const said = await recordPageRendered({ home: '/h', slug: 'D--p', template: 'phase-change', path: '/w/p.html', at: 'x', head: 'c1' }, { load: async () => null });
  assert.match(said.unavailable, /template-record\.mjs is not in this install/);
});

test('a record that cannot be written is said with why, and an unknown template is refused before anything is read', async () => {
  const load = async () => ({ renderedFile: () => '/f', recordRendered: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } });
  const said = await recordPageRendered({ home: '/h', slug: 's', template: 'phase-change', path: '/p', at: 'x', head: null }, { load });
  assert.equal(said.unavailable, 'the rendered record /f could not be written: EACCES');
  await assert.rejects(recordPageRendered({ home: '/h', slug: 's', template: 'phase', path: '/p', at: 'x', head: null }, { load }), /unknown page template: phase/);
});
