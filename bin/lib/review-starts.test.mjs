import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LINEAGE_ID, liveLineages, readReviewEnds, readReviewStarts, recordReviewStarts, reviewStartsFile, startOf } from './review-starts.mjs';

const NOW = Date.parse('2026-10-17T12:00:00Z');

/** A git common dir with gentle-ai's store under it, and a harness home, in a temp folder removed after `body`. */
function withStore(body) {
  return () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-starts-'));
    const commonDir = path.join(dir, 'repo', '.git');
    const v2 = path.join(commonDir, 'gentle-ai', 'review-transactions', 'v2');
    const v1 = path.join(commonDir, 'gentle-ai', 'review-transactions', 'terminal-consumption', 'v1');
    fs.mkdirSync(v2, { recursive: true });
    fs.mkdirSync(v1, { recursive: true });
    try {
      return body({ commonDir, v2, v1, home: path.join(dir, 'home') });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

const stat = (birthtimeMs, { mtimeMs = birthtimeMs + 1000, ctimeMs = birthtimeMs + 2000 } = {}) => ({ birthtimeMs, mtimeMs, ctimeMs });

test('a lineage id is gentle-ai\'s: lower-case words joined by dashes', () => {
  for (const id of ['review-b5f68ca4bb29dffe', 'mine', 'a-1-b']) assert.match(id, LINEAGE_ID);
  for (const id of ['LOCK', '.atomic-123', 'review_x', '-a', 'a-', 'a--b', '']) assert.doesNotMatch(id, LINEAGE_ID);
});

test('a start is the folder\'s birthtime when the file system keeps one it can be trusted for, else the time it was seen', () => {
  const born = Date.parse('2026-10-17T10:00:00Z');
  assert.deepEqual(startOf(stat(born), NOW, 'win32'), { at: '2026-10-17T10:00:00.000Z', from: 'birthtime' });
  assert.deepEqual(startOf(stat(born), NOW, 'linux'), { at: '2026-10-17T10:00:00.000Z', from: 'birthtime' });
  const seen = { at: '2026-10-17T12:00:00.000Z', from: 'seen' };
  // None kept, one after the folder last changed or after now, or, where statx is missing, ctime given in its place.
  assert.deepEqual(startOf(stat(0), NOW, 'win32'), seen);
  assert.deepEqual(startOf(stat(born, { mtimeMs: born - 1 }), NOW, 'win32'), seen);
  assert.deepEqual(startOf(stat(NOW + 1, { mtimeMs: NOW + 2 }), NOW, 'win32'), seen);
  assert.deepEqual(startOf(stat(born, { ctimeMs: born }), NOW, 'linux'), seen);
  // Windows and macOS keep a real birthtime, which may equal ctime.
  assert.deepEqual(startOf(stat(born, { ctimeMs: born }), NOW, 'darwin'), { at: '2026-10-17T10:00:00.000Z', from: 'birthtime' });
});

test('the live lineages are the folders of v2 named as lineages; the lock, temporary entries and a missing store are none', withStore(({ commonDir, v2 }) => {
  for (const name of ['review-aaa', 'mine', '.staging-1']) fs.mkdirSync(path.join(v2, name));
  fs.writeFileSync(path.join(v2, 'LOCK'), '');
  fs.writeFileSync(path.join(v2, 'review-file'), '');
  assert.deepEqual(liveLineages(commonDir).map((one) => one.lineage).sort(), ['mine', 'review-aaa']);
  assert.ok(liveLineages(commonDir).every((one) => typeof one.info.birthtimeMs === 'number'));
  assert.deepEqual(liveLineages(path.join(commonDir, 'none')), []);
  // A folder gone between the listing and its stat is skipped; another failure says why.
  const gone = { ...fs, statSync: (file, ...rest) => (String(file).endsWith('mine') ? (() => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); })() : fs.statSync(file, ...rest)) };
  assert.deepEqual(liveLineages(commonDir, { fileSystem: gone }).map((one) => one.lineage), ['review-aaa']);
  const denied = { ...fs, readdirSync: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
  assert.throws(() => liveLineages(commonDir, { fileSystem: denied }), /EACCES/);
}));

test('recording appends one line for each live lineage and birthtime not recorded yet, and makes the folder only to write one', withStore(({ commonDir, v2, home }) => {
  const file = reviewStartsFile(home, 'D--repo');
  assert.equal(recordReviewStarts({ commonDir, home, slug: 'D--repo', now: NOW, platform: 'win32' }), 0);
  assert.equal(fs.existsSync(path.dirname(file)), false);
  fs.mkdirSync(path.join(v2, 'review-aaa'));
  fs.writeFileSync(path.join(v2, 'LOCK'), '');
  assert.equal(recordReviewStarts({ commonDir, home, slug: 'D--repo', now: NOW, platform: 'win32' }), 1);
  assert.equal(recordReviewStarts({ commonDir, home, slug: 'D--repo', now: NOW + 5000, platform: 'win32' }), 0);
  const [line] = readReviewStarts(file);
  assert.equal(line.v, 1);
  assert.equal(line.lineage, 'review-aaa');
  assert.equal(line.from, 'birthtime');
  assert.equal(line.seenAt, '2026-10-17T12:00:00.000Z');
  assert.equal(line.at, new Date(fs.statSync(path.join(v2, 'review-aaa')).birthtimeMs).toISOString());
  // A start seen where no birthtime is kept is recorded once, whatever time the later calls see it at.
  const noBirth = { ...fs, statSync: (...args) => ({ ...fs.statSync(...args), birthtimeMs: 0, isDirectory: () => true }) };
  fs.mkdirSync(path.join(v2, 'review-bbb'));
  assert.equal(recordReviewStarts({ commonDir, home, slug: 'D--repo', now: NOW, platform: 'win32', fileSystem: noBirth }), 1);
  assert.equal(recordReviewStarts({ commonDir, home, slug: 'D--repo', now: NOW + 9000, platform: 'win32', fileSystem: noBirth }), 0);
  assert.deepEqual(readReviewStarts(file).map((one) => [one.lineage, one.from]), [['review-aaa', 'birthtime'], ['review-bbb', 'seen']]);
}));

test('the starts file is read whole lines only: a torn or foreign line is left out, and one left without its newline is ended first', withStore(({ commonDir, v2, home }) => {
  const file = reviewStartsFile(home, 'D--repo');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `not json\n${JSON.stringify({ v: 2, lineage: 'x', at: 'a', from: 'seen', seenAt: 'a' })}\n{"v":1,"lineage":"torn`);
  fs.mkdirSync(path.join(v2, 'review-ccc'));
  assert.equal(recordReviewStarts({ commonDir, home, slug: 'D--repo', now: NOW, platform: 'win32' }), 1);
  assert.deepEqual(readReviewStarts(file).map((one) => one.lineage), ['review-ccc']);
  assert.deepEqual(readReviewStarts(path.join(home, 'none.jsonl')), []);
  const denied = { ...fs, readFileSync: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
  assert.throws(() => readReviewStarts(file, { fileSystem: denied }), /EACCES/);
}));

test('the ends are the terminal records gentle-ai keeps, each its lineage at the record\'s birth', withStore(({ commonDir, v1 }) => {
  fs.writeFileSync(path.join(v1, 'aa.json'), JSON.stringify({ schema: 'gentle-ai.review-terminal-consumption/v1', repository: 'sha256:1', target: 'sha256:2', lineage: 'review-aaa' }));
  fs.writeFileSync(path.join(v1, 'bb.json'), 'not json');
  fs.writeFileSync(path.join(v1, 'cc.json'), JSON.stringify({ schema: 'other', lineage: 'review-ccc' }));
  const ends = readReviewEnds(commonDir);
  assert.deepEqual(ends.map((one) => one.lineage), ['review-aaa']);
  assert.equal(ends[0].at, new Date(fs.statSync(path.join(v1, 'aa.json')).birthtimeMs).toISOString());
  assert.deepEqual(readReviewEnds(path.join(commonDir, 'none')), []);
  const denied = { ...fs, readdirSync: () => { throw Object.assign(new Error('denied'), { code: 'EPERM' }); } };
  assert.throws(() => readReviewEnds(commonDir, { fileSystem: denied }), /EPERM/);
}));

test('an id used again after a burn is a new start, even when its first start was only seen', withStore(({ commonDir, v2, home }) => {
  const file = reviewStartsFile(home, 'D--repo');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // The id's first life, seen before this folder was born.
  fs.writeFileSync(file, `${JSON.stringify({ v: 1, lineage: 'review-ddd', at: '2000-01-01T00:00:00.000Z', from: 'seen', seenAt: '2000-01-01T00:00:00.000Z' })}\n`);
  fs.mkdirSync(path.join(v2, 'review-ddd'));
  assert.equal(recordReviewStarts({ commonDir, home, slug: 'D--repo', now: Date.now() + 1000, platform: 'win32' }), 1);
  assert.deepEqual(readReviewStarts(file).map((one) => one.from), ['seen', 'birthtime']);
  // A seen line written after the folder was born is that folder's: no second line for it.
  fs.writeFileSync(file, `${JSON.stringify({ v: 1, lineage: 'review-ddd', at: new Date().toISOString(), from: 'seen', seenAt: new Date().toISOString() })}\n`);
  assert.equal(recordReviewStarts({ commonDir, home, slug: 'D--repo', now: Date.now(), platform: 'win32' }), 0);
}));

test('a terminal record that is there and cannot be read says why, never read as no end', withStore(({ commonDir, v1 }) => {
  fs.writeFileSync(path.join(v1, 'aa.json'), '{}');
  const denied = { ...fs, readFileSync: () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); } };
  assert.throws(() => readReviewEnds(commonDir, { fileSystem: denied }), /EACCES/);
}));
