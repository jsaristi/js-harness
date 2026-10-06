import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAP_STATES, gapList, gapDigest } from './digest.mjs';

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

test('gapList counts a mismatch cell as a gap, so the session hook notifies when the Claude accounts differ', () => {
  const account = { id: 'claude-account', installed: 'n/a', claude: 'mismatch', codex: 'n/a', project: 'n/a', upToDate: 'n/a' };
  assert.deepEqual(gapList([account]), [{ id: 'claude-account', dimension: 'claude', state: 'mismatch' }]);
  assert.notEqual(gapDigest([account]), gapDigest([{ ...account, claude: 'ok' }]));
});

test('gapList counts a down cell as a gap, so the session hook notifies when a launcher\'s server is not running, and again once it is back', () => {
  const server = { id: 'remote-server', installed: 'n/a', claude: 'down', codex: 'n/a', project: 'n/a', upToDate: 'n/a' };
  assert.deepEqual(gapList([server]), [{ id: 'remote-server', dimension: 'claude', state: 'down' }]);
  for (const state of ['ok', 'unknown', 'n/a']) {
    assert.deepEqual(gapList([{ ...server, claude: state }]), [], state);
    assert.notEqual(gapDigest([server]), gapDigest([{ ...server, claude: state }]), state);
  }
});

test('GAP_STATES is the one list of what counts as a gap: every state in it is one, in every dimension', () => {
  assert.deepEqual([...GAP_STATES].sort(), ['down', 'mismatch', 'missing', 'outdated', 'stale']);
  for (const state of GAP_STATES) {
    for (const dimension of ['installed', 'claude', 'codex', 'project', 'upToDate']) {
      assert.deepEqual(gapList([row({ id: 'x', [dimension]: state })]), [{ id: 'x', dimension, state }]);
    }
  }
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
