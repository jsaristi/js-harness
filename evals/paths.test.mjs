// `exists` of ./paths.mjs: what it says for a path the system refuses to look below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { exists, resolveReal } from './paths.mjs';

/** A file system whose `lstatSync` throws the error of `code`, as Linux does for a path below a file. */
const throwing = (code) => ({
  lstatSync() {
    throw Object.assign(new Error(`${code}: refused`), { code });
  },
});

test('exists says a path below a file is not there, where the system says ENOTDIR', () => {
  assert.equal(exists('/a/file/below', throwing('ENOTDIR')), false);
});

test('exists lets any other error of the system through', () => {
  assert.throws(() => exists('/a/locked', throwing('EACCES')), { code: 'EACCES' });
});

test('exists says what is there and what is not, on the real file system', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-paths-'));
  try {
    const file = path.join(dir, 'a-file');
    fs.writeFileSync(file, 'x', 'utf8');
    assert.equal(exists(file), true);
    assert.equal(exists(path.join(dir, 'missing')), false);
    assert.equal(exists(path.join(file, 'below')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveReal of a path below a file gives that path, for the caller to refuse in its own words', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-paths-'));
  try {
    const file = path.join(dir, 'a-file');
    fs.writeFileSync(file, 'x', 'utf8');
    assert.equal(resolveReal(path.join(file, 'below')), path.join(fs.realpathSync(file), 'below'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
