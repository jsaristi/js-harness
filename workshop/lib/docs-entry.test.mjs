import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUSES, indexFindings, parseIndex } from './docs-entry.mjs';

/** An entry document whose index holds `rows`, each `[path, status, successor]`. */
function entry(...rows) {
  return [
    '# Reading js-harness cold',
    '',
    '## Index',
    '',
    '| Document | Status | Superseded by, or where its result lives | What it is |',
    '|---|---|---|---|',
    ...rows.map(([file, status, successor = '']) => `| \`${file}\` | ${status} | ${successor} | a document |`),
    '',
    'Text after the table, with `docs/NOT-A-ROW.md` in it.',
  ].join('\n');
}

test('the four statuses are live, frozen, historical and closed', () => {
  assert.deepEqual(STATUSES, ['live', 'frozen', 'historical', 'closed']);
});

test('parseIndex reads each table row whose first cell is a path in backticks, with its status and successor', () => {
  const rows = parseIndex(entry(['docs/SPEC.md', 'live'], ['docs/origin.md', 'frozen'], ['docs/sweep-2026-10-11.md', 'closed', '`docs/ROADMAP.md`'], ['docs/sessions/', 'historical', 'the feature documents']));
  assert.deepEqual(rows, [
    { path: 'docs/SPEC.md', status: 'live', successor: '', line: 7 },
    { path: 'docs/origin.md', status: 'frozen', successor: '', line: 8 },
    { path: 'docs/sweep-2026-10-11.md', status: 'closed', successor: '`docs/ROADMAP.md`', line: 9 },
    { path: 'docs/sessions/', status: 'historical', successor: 'the feature documents', line: 10 },
  ]);
});

test('an index with a row for every file and folder directly under docs/ has no findings', () => {
  const text = entry(['docs/README.md', 'live'], ['docs/SPEC.md', 'live'], ['docs/sessions/', 'historical', 'the feature documents']);
  assert.deepEqual(indexFindings(text, ['docs/README.md', 'docs/SPEC.md', 'docs/sessions/']), []);
});

test('the findings name an entry of docs/ with no row, a row of nothing, a status of none of the four, and a status that leaves with no successor', () => {
  const text = entry(['docs/README.md', 'live'], ['docs/gone.md', 'live'], ['docs/origin.md', 'kept'], ['docs/todo.md', 'closed'], ['docs/sweep.md', 'historical', ' ']);
  assert.deepEqual(indexFindings(text, ['docs/README.md', 'docs/origin.md', 'docs/todo.md', 'docs/sweep.md', 'docs/audits/']), [
    'docs/README.md:8: `docs/gone.md` is not a file or folder directly under docs/, nor a tracked file of one of its folders',
    'docs/README.md:9: `docs/origin.md` has the status "kept", not one of live, frozen, historical, closed',
    'docs/README.md:10: `docs/todo.md` is closed and names no successor or where its result lives',
    'docs/README.md:11: `docs/sweep.md` is historical and names no successor or where its result lives',
    'docs/audits/ has no row in the index of docs/README.md',
  ]);
});

test('a file under a folder of docs/ may have its own row over its folder\'s, and a row of a file not tracked there is a finding', () => {
  const text = entry(['docs/README.md', 'live'], ['docs/host-updates/', 'historical', 'each release record'], ['docs/host-updates/README.md', 'live'], ['docs/host-updates/gone.md', 'live']);
  assert.deepEqual(indexFindings(text, ['docs/README.md', 'docs/host-updates/'], ['docs/README.md', 'docs/host-updates/README.md', 'docs/host-updates/one.md']), [
    'docs/README.md:10: `docs/host-updates/gone.md` is not a file or folder directly under docs/, nor a tracked file of one of its folders',
  ]);
});

test('a path with two rows is a finding', () => {
  const text = entry(['docs/README.md', 'live'], ['docs/README.md', 'live']);
  assert.deepEqual(indexFindings(text, ['docs/README.md']), ['docs/README.md:8: `docs/README.md` has a row already, at line 7']);
});
