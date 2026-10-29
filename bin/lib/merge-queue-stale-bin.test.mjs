import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { binDiffers, staleBin } from './merge-queue-stale-bin.mjs';

// The copy guard's two readings of one copy against main (S6 of odd/tasks/lead-manual-steps.md): `staleBin`, the land's
// guard, refuses nothing it could not read; `binDiffers`, the refresh's check, passes nothing it could not read. The
// listing of main is written here: a fake `gitIn` answers `ls-tree` and `show`.
const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

const EMPTY_BLOB = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391';

function copyWith(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-stale-bin-'));
  made.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

const gitOf = (listing, shown = {}) => (...args) => {
  if (args[0] === 'ls-tree') return listing === null ? { ok: false, out: '' } : { ok: true, out: listing };
  const file = args[1].split(':')[1];
  return file in shown ? { ok: true, out: shown[file] } : { ok: false, out: '' };
};

const LISTING = `100644 blob ${EMPTY_BLOB}\tbin/merge-queue.mjs\n100644 blob ${EMPTY_BLOB}\tbin/lib/a.mjs\n100644 blob ${'1'.repeat(40)}\tbin/lib/a.test.mjs\n`;

test('binDiffers finds none for a copy that is main, the tests the package leaves out aside', () => {
  const dir = copyWith({ 'merge-queue.mjs': '', 'lib/a.mjs': '' });
  assert.deepEqual(binDiffers(dir, 'HEAD', gitOf(LISTING)), []);
});

test('binDiffers names a file on one side only, and a file it cannot compare, which staleBin lets pass', () => {
  const dir = copyWith({ 'merge-queue.mjs': '', 'lib/a.mjs': 'changed', 'extra.mjs': '' });
  assert.deepEqual(binDiffers(dir, 'HEAD', gitOf(LISTING)), ['bin/extra.mjs', 'bin/lib/a.mjs']);
  assert.deepEqual(staleBin(path.join(dir, 'merge-queue.mjs'), 'HEAD', gitOf(LISTING)), ['bin/extra.mjs']);
  assert.deepEqual(binDiffers(dir, 'HEAD', gitOf(LISTING, { 'bin/lib/a.mjs': 'changed\n' })), ['bin/extra.mjs', 'bin/lib/a.mjs']);
  assert.deepEqual(binDiffers(dir, 'HEAD', gitOf(LISTING, { 'bin/lib/a.mjs': 'changed' })), ['bin/extra.mjs']);
});

test('binDiffers cannot tell when main cannot be listed, holds no bin/, or the copy cannot be read', () => {
  const dir = copyWith({ 'merge-queue.mjs': '' });
  assert.equal(binDiffers(dir, 'HEAD', gitOf(null)), null);
  assert.equal(binDiffers(dir, 'HEAD', gitOf('')), null);
  assert.equal(binDiffers(path.join(dir, 'missing'), 'HEAD', gitOf(LISTING)), null);
  assert.deepEqual(staleBin(path.join(dir, 'missing', 'merge-queue.mjs'), 'HEAD', gitOf(LISTING)), []);
});
