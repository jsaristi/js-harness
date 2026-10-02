import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gapList, gapDigest } from './digest.mjs';

function row(overrides) {
  return { id: 'x', installed: 'ok', claude: 'ok', codex: 'ok', project: 'n/a', upToDate: 'ok', ...overrides };
}

test('gapList is empty for a fully healthy report', () => {
  assert.deepEqual(gapList([row({ id: 'gentle-ai' }), row({ id: 'engram' })]), []);
});

test('gapList collects one entry per (id, dimension) that is missing or outdated', () => {
  const rows = [
    row({ id: 'gentle-ai', claude: 'missing' }),
    row({ id: 'codegraph', codex: 'missing', upToDate: 'outdated' }),
  ];
  const gaps = gapList(rows);
  assert.deepEqual(gaps, [
    { id: 'codegraph', dimension: 'codex', state: 'missing' },
    { id: 'codegraph', dimension: 'upToDate', state: 'outdated' },
    { id: 'gentle-ai', dimension: 'claude', state: 'missing' },
  ]);
});

test('gapList counts a stale cell as a gap, so the session hook notifies about a dead hook', () => {
  assert.deepEqual(gapList([row({ id: 'gentle-ai', claude: 'stale' })]), [
    { id: 'gentle-ai', dimension: 'claude', state: 'stale' },
  ]);
});

test('gapList ignores unknown and n/a states', () => {
  const rows = [row({ id: 'context7', upToDate: 'n/a', project: 'unknown' })];
  assert.deepEqual(gapList(rows), []);
});

test('gapList sorts by tool id, then by dimension, regardless of input order', () => {
  const rows = [
    row({ id: 'zzz', installed: 'missing', project: 'missing' }),
    row({ id: 'aaa', codex: 'missing' }),
  ];
  const gaps = gapList(rows);
  assert.deepEqual(
    gaps.map((g) => `${g.id}:${g.dimension}`),
    ['aaa:codex', 'zzz:installed', 'zzz:project'],
  );
});

test('gapDigest is the empty string for a report with no gaps', () => {
  assert.equal(gapDigest([row({ id: 'gentle-ai' })]), '');
});

test('gapDigest is a non-empty stable string for the same gap list, regardless of row order', () => {
  const a = [row({ id: 'gentle-ai', claude: 'missing' }), row({ id: 'engram' })];
  const b = [row({ id: 'engram' }), row({ id: 'gentle-ai', claude: 'missing' })];
  const digestA = gapDigest(a);
  const digestB = gapDigest(b);
  assert.notEqual(digestA, '');
  assert.equal(digestA, digestB);
});

test('gapDigest changes when the gap list changes', () => {
  const before = [row({ id: 'gentle-ai', claude: 'missing' })];
  const after = [row({ id: 'gentle-ai', claude: 'missing', codex: 'missing' })];
  assert.notEqual(gapDigest(before), gapDigest(after));
});
