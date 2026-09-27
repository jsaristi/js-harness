import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cachePath, readCache, writeCache, isStale } from './cache.mjs';

function makeTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-cache-home-'));
}

test('cachePath points at <home>/.js-harness/doctor.json', () => {
  assert.equal(cachePath('/h'), path.join('/h', '.js-harness', 'doctor.json'));
});

test('readCache returns empty defaults when the file does not exist', () => {
  const home = makeTmpHome();
  try {
    assert.deepEqual(readCache(home), { latest: { checkedAt: null, versions: {} }, notified: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('readCache round-trips what writeCache wrote', () => {
  const home = makeTmpHome();
  try {
    const cache = { latest: { checkedAt: '2026-01-01T00:00:00.000Z', versions: { 'gentle-ai': '3.7.0' } }, notified: 'abc' };
    writeCache(home, cache);
    assert.deepEqual(readCache(home), cache);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('writeCache creates the .js-harness directory when it does not exist yet', () => {
  const home = makeTmpHome();
  try {
    writeCache(home, { latest: { checkedAt: null, versions: {} }, notified: null });
    assert.ok(fs.existsSync(cachePath(home)));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('readCache treats a malformed (non-JSON) file as absent', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
    fs.writeFileSync(cachePath(home), 'not json', 'utf8');
    assert.deepEqual(readCache(home), { latest: { checkedAt: null, versions: {} }, notified: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('readCache coerces a wrong-shaped latest/versions/notified into safe defaults', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
    fs.writeFileSync(cachePath(home), JSON.stringify({ latest: 'nope', notified: 42 }), 'utf8');
    assert.deepEqual(readCache(home), { latest: { checkedAt: null, versions: {} }, notified: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('isStale is true when checkedAt is absent', () => {
  assert.equal(isStale(null), true);
  assert.equal(isStale(undefined), true);
});

test('isStale is true when checkedAt is unparseable', () => {
  assert.equal(isStale('not a date'), true);
});

test('isStale is false when checkedAt is within the last 6 hours', () => {
  const now = () => new Date('2026-01-01T06:00:00.000Z');
  assert.equal(isStale('2026-01-01T01:00:00.000Z', now), false);
});

test('isStale is true when checkedAt is 6 hours old or older', () => {
  const now = () => new Date('2026-01-01T06:00:00.000Z');
  assert.equal(isStale('2026-01-01T00:00:00.000Z', now), true);
});

// --- R3-101 (accepted T2/T3 review follow-up): a cache write must never crash `doctor` ---

test('writeCache is best-effort: it does not throw when home is a file, not a directory', () => {
  const parent = makeTmpHome();
  const home = path.join(parent, 'not-a-directory');
  try {
    fs.writeFileSync(home, 'this is a file, not a home directory', 'utf8');
    assert.doesNotThrow(() => writeCache(home, { latest: { checkedAt: null, versions: {} }, notified: null }));
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

// --- R3-103 (accepted T2/T3 review follow-up): a non-string version entry never leaks through ---

test('readCache drops a non-string, non-null version entry but keeps valid ones', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.join(home, '.js-harness'), { recursive: true });
    fs.writeFileSync(
      cachePath(home),
      JSON.stringify({
        latest: {
          checkedAt: '2026-01-01T00:00:00.000Z',
          versions: { 'gentle-ai': '3.7.0', engram: null, codegraph: 42, context7: { bad: true }, 'typescript-lsp': ['1.0.0'] },
        },
        notified: null,
      }),
      'utf8',
    );

    const cache = readCache(home);

    assert.deepEqual(cache.latest.versions, { 'gentle-ai': '3.7.0', engram: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
