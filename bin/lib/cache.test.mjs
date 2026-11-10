import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cachePath, readCache, readReviewed, recordReviewed, reviewedPath, writeCache, isStale } from './cache.mjs';

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

test('readCache keeps a well-formed host record, so every writer of the cache keeps it, and drops a malformed one', () => {
  const home = makeTmpHome();
  try {
    const host = { reviewed: { desktop: '2.37337.1', code: '2.1.295', at: '2026-10-15T00:00:00.000Z' } };
    writeCache(home, { latest: { checkedAt: null, versions: {} }, notified: null, host });
    assert.deepEqual(readCache(home).host, host);
    writeCache(home, { ...readCache(home), notified: 'abc' });
    assert.deepEqual(readCache(home).host, host, 'a write of another key keeps the record');
    for (const broken of [{ reviewed: 'nope' }, { reviewed: { desktop: 2, code: null, at: 'x' } }, 'nope']) {
      writeCache(home, { latest: { checkedAt: null, versions: {} }, notified: null, host: broken });
      assert.equal('host' in readCache(home), false, JSON.stringify(broken));
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// F8 S11: the gentle-ai-sync row left with gentle-ai, so the record it kept is read as nothing and drops at the next
// write, while the host record beside it stays.
test('readCache drops the gentle-ai record the gentle-ai-sync row kept, and keeps the host one beside it', () => {
  const home = makeTmpHome();
  try {
    const host = { reviewed: { desktop: '2.37337.1', code: '2.1.295', at: '2026-10-15T00:00:00.000Z' } };
    const gentleAi = { reviewed: { version: '4.2.0', at: '2026-10-16T00:00:00.000Z' } };
    writeCache(home, { latest: { checkedAt: null, versions: {} }, notified: null, host, gentleAi });
    assert.equal('gentleAi' in readCache(home), false);
    writeCache(home, { ...readCache(home), notified: 'abc' });
    assert.deepEqual(readCache(home).host, host, 'a write of another key keeps the record');
    assert.equal('gentleAi' in JSON.parse(fs.readFileSync(cachePath(home), 'utf8')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('readCache keeps a well-formed stack record beside the others, and drops a malformed one whole', () => {
  const home = makeTmpHome();
  try {
    const host = { reviewed: { desktop: '2.37337.1', code: '2.1.295', at: '2026-10-15T00:00:00.000Z' } };
    const stack = { reviewed: { versions: { claude: '2.1.296', engram: '3.3.0' }, at: '2026-10-16T00:00:00.000Z' } };
    writeCache(home, { latest: { checkedAt: null, versions: {} }, notified: null, host, stack });
    writeCache(home, { ...readCache(home), notified: 'abc' });
    assert.deepEqual(readCache(home).stack, stack, 'a write of another key keeps the record');
    assert.deepEqual(readCache(home).host, host);
    for (const broken of [{ reviewed: 'nope' }, { reviewed: { versions: { engram: 3 }, at: 'x' } }, { reviewed: { versions: [], at: 'x' } }, { reviewed: { versions: {} } }, 'nope']) {
      writeCache(home, { latest: { checkedAt: null, versions: {} }, notified: null, stack: broken });
      assert.equal('stack' in readCache(home), false, JSON.stringify(broken));
    }
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

// --- M10 of the Fable 5.2 audit (odd/tasks/audit-u5-atomic-state.md, S1 to S4): the cache is written by rename, and
// the versions last reviewed live in their own record, where a key that cannot be read is unknown, never empty ---

const HOST = { reviewed: { desktop: '2.37337.1', code: '2.1.295', at: '2026-10-15T00:00:00.000Z' } };
const STACK = { reviewed: { versions: { claude: '2.1.296', engram: '3.3.0' }, at: '2026-10-16T00:00:00.000Z' } };
const LATEST = { latest: { checkedAt: null, versions: {} }, notified: null };

/** Makes every rename onto `target` fail as a full disk would, the others going through. */
function failRenameOnto(t, target) {
  const rename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (from, to) => {
    if (path.resolve(String(to)) === path.resolve(target)) throw Object.assign(new Error('i/o error'), { code: 'EIO' });
    return rename(from, to);
  });
}

test('writeCache writes by rename: a rename that fails leaves the cache there before, and no temporary file', (t) => {
  const home = makeTmpHome();
  try {
    writeCache(home, { ...LATEST, notified: 'before' });
    const before = fs.readFileSync(cachePath(home), 'utf8');
    failRenameOnto(t, cachePath(home));
    assert.doesNotThrow(() => writeCache(home, { ...LATEST, notified: 'after' }));
    assert.equal(fs.readFileSync(cachePath(home), 'utf8'), before);
    assert.deepEqual(fs.readdirSync(path.dirname(cachePath(home))).filter((name) => name.endsWith('.tmp')), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('reviewedPath points at <home>/.js-harness/reviewed.json', () => {
  assert.equal(reviewedPath('/h'), path.join('/h', '.js-harness', 'reviewed.json'));
});

test('with no record and no cache nothing was ever reviewed, and nothing is written', () => {
  const home = makeTmpHome();
  try {
    assert.deepEqual(readReviewed(home), {});
    assert.equal(fs.existsSync(reviewedPath(home)), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an old doctor.json is read into the record without loss, and keeps its keys', () => {
  const home = makeTmpHome();
  try {
    writeCache(home, { ...LATEST, host: HOST, stack: STACK });
    const cache = fs.readFileSync(cachePath(home), 'utf8');
    assert.deepEqual(readReviewed(home), { host: HOST, stack: STACK });
    assert.deepEqual(JSON.parse(fs.readFileSync(reviewedPath(home), 'utf8')), { host: HOST, stack: STACK });
    assert.equal(fs.readFileSync(cachePath(home), 'utf8'), cache, 'the cache is not rewritten');
    // From then on the record is what is read: a later cache holds nothing of the reviews.
    writeCache(home, LATEST);
    assert.deepEqual(readReviewed(home), { host: HOST, stack: STACK });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('an old doctor.json with one record and not the other migrates that one; the other was never reviewed', () => {
  const home = makeTmpHome();
  try {
    writeCache(home, { ...LATEST, host: HOST });
    assert.deepEqual(readReviewed(home), { host: HOST });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a corrupt doctor.json with no record leaves both reviews unknown, and they stay unknown once the cache is rewritten', () => {
  const home = makeTmpHome();
  try {
    writeCache(home, { ...LATEST, host: HOST, stack: STACK });
    const raw = fs.readFileSync(cachePath(home), 'utf8');
    fs.writeFileSync(cachePath(home), raw.slice(0, Math.floor(raw.length / 2)));
    assert.deepEqual(readReviewed(home), { host: { unreadable: true }, stack: { unreadable: true } });
    writeCache(home, LATEST);
    assert.deepEqual(readReviewed(home), { host: { unreadable: true }, stack: { unreadable: true } });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// doctor writes the latest versions to the cache before it reads the reviews: that write must not lose them.
test('a write of the cache before any read of the reviews reads an old or torn cache into the record first', () => {
  const home = makeTmpHome();
  try {
    writeCache(home, { ...LATEST, host: HOST, stack: STACK });
    writeCache(home, LATEST);
    assert.deepEqual(readReviewed(home), { host: HOST, stack: STACK });
    // A cache an earlier version wrote, torn, with no record yet.
    fs.rmSync(reviewedPath(home));
    const raw = JSON.stringify({ ...LATEST, host: HOST }, null, 2);
    fs.writeFileSync(cachePath(home), raw.slice(0, Math.floor(raw.length / 2)));
    writeCache(home, LATEST);
    assert.deepEqual(readReviewed(home), { host: { unreadable: true }, stack: { unreadable: true } });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// Codex on 0b8b7c2..52367d1: a record that could not be written must not let the cache write erase what it would hold.
test('while the record cannot be written, a write of the cache leaves an old or torn cache in place', (t) => {
  const home = makeTmpHome();
  try {
    const raw = JSON.stringify({ ...LATEST, host: HOST }, null, 2);
    fs.mkdirSync(path.dirname(cachePath(home)), { recursive: true });
    fs.writeFileSync(cachePath(home), raw.slice(0, Math.floor(raw.length / 2)));
    const torn = fs.readFileSync(cachePath(home), 'utf8');
    // The record is made by a hard link, or a rename where there is none: both fail onto it.
    const failing = ['renameSync', 'linkSync'].map((name) => {
      const real = fs[name];
      return t.mock.method(fs, name, (from, to) => {
        if (path.resolve(String(to)) === path.resolve(reviewedPath(home))) throw Object.assign(new Error('i/o error'), { code: 'EIO' });
        return real(from, to);
      });
    });
    writeCache(home, LATEST);
    assert.equal(fs.readFileSync(cachePath(home), 'utf8'), torn);
    assert.equal(fs.existsSync(reviewedPath(home)), false);
    for (const mock of failing) mock.mock.restore();
    writeCache(home, LATEST);
    assert.deepEqual(readReviewed(home), { host: { unreadable: true }, stack: { unreadable: true } });
    assert.deepEqual(readCache(home), LATEST);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// The verifier on 6ee974d..52367d1, finding 1: a migration that read a cache another process had just rewritten clean
// must not overwrite the unknown record that process wrote first.
test('a migration that finds the record made meanwhile by another process reads that record, never overwrites it', (t) => {
  const home = makeTmpHome();
  try {
    const raw = JSON.stringify({ ...LATEST, host: HOST }, null, 2);
    fs.mkdirSync(path.dirname(cachePath(home)), { recursive: true });
    fs.writeFileSync(cachePath(home), raw.slice(0, Math.floor(raw.length / 2)));
    const read = fs.readFileSync;
    let raced = false;
    t.mock.method(fs, 'readFileSync', (file, ...rest) => {
      if (!raced && path.resolve(String(file)) === path.resolve(cachePath(home))) {
        // Another doctor runs whole between this one's look for the record and its read of the cache.
        raced = true;
        fs.writeFileSync(reviewedPath(home), JSON.stringify({ host: null, stack: null }));
        fs.writeFileSync(cachePath(home), JSON.stringify(LATEST));
      }
      return read(file, ...rest);
    });
    assert.deepEqual(readReviewed(home), { host: { unreadable: true }, stack: { unreadable: true } });
    assert.deepEqual(JSON.parse(read(reviewedPath(home), 'utf8')), { host: null, stack: null });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// The verifier's finding 3: a read that fails for a moment is not a corrupt file, so nothing is written from it.
test('a record or a cache that cannot be read for a moment is unknown for that read and writes nothing', (t) => {
  const home = makeTmpHome();
  try {
    writeCache(home, { ...LATEST, host: HOST, stack: STACK });
    const cacheBytes = fs.readFileSync(cachePath(home), 'utf8');
    const read = fs.readFileSync;
    const busy = (target) => t.mock.method(fs, 'readFileSync', (file, ...rest) => {
      if (path.resolve(String(file)) === path.resolve(target)) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
      return read(file, ...rest);
    });
    // The migration of an old cache that cannot be read now writes no record, and leaves the cache for the next run.
    fs.rmSync(reviewedPath(home), { force: true });
    let mock = busy(cachePath(home));
    assert.deepEqual(readReviewed(home), { host: { unreadable: true }, stack: { unreadable: true } });
    assert.equal(fs.existsSync(reviewedPath(home)), false);
    writeCache(home, LATEST);
    mock.mock.restore();
    assert.equal(fs.readFileSync(cachePath(home), 'utf8'), cacheBytes);
    assert.deepEqual(readReviewed(home), { host: HOST, stack: STACK });
    // A record that cannot be read now is recorded over by nothing: the other review is never written as unknown.
    mock = busy(reviewedPath(home));
    assert.equal(recordReviewed(home, 'host', { ...HOST.reviewed, desktop: '9.9.9' }), false);
    mock.mock.restore();
    assert.deepEqual(readReviewed(home), { host: HOST, stack: STACK });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a malformed review in an old doctor.json is unknown, not a first reading; the well-formed one beside it is kept', () => {
  const home = makeTmpHome();
  try {
    writeCache(home, { ...LATEST, host: { reviewed: { desktop: 2, code: null, at: 'x' } }, stack: STACK });
    assert.deepEqual(readReviewed(home), { host: { unreadable: true }, stack: STACK });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a corrupt record leaves both reviews unknown; a recorded review takes its key and leaves the other unknown', () => {
  const home = makeTmpHome();
  try {
    fs.mkdirSync(path.dirname(reviewedPath(home)), { recursive: true });
    fs.writeFileSync(reviewedPath(home), '{"host": {"revi');
    assert.deepEqual(readReviewed(home), { host: { unreadable: true }, stack: { unreadable: true } });
    assert.equal(recordReviewed(home, 'host', HOST.reviewed), true);
    assert.deepEqual(readReviewed(home), { host: HOST, stack: { unreadable: true } });
    assert.equal(recordReviewed(home, 'stack', STACK.reviewed), true);
    assert.deepEqual(readReviewed(home), { host: HOST, stack: STACK });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('recordReviewed keeps the other key and writes by rename: a rename that fails records nothing and says so', (t) => {
  const home = makeTmpHome();
  try {
    assert.equal(recordReviewed(home, 'host', HOST.reviewed), true);
    assert.equal(recordReviewed(home, 'stack', STACK.reviewed), true);
    assert.deepEqual(readReviewed(home), { host: HOST, stack: STACK });
    const before = fs.readFileSync(reviewedPath(home), 'utf8');
    failRenameOnto(t, reviewedPath(home));
    assert.equal(recordReviewed(home, 'host', { ...HOST.reviewed, desktop: '9.9.9' }), false);
    assert.equal(fs.readFileSync(reviewedPath(home), 'utf8'), before);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
