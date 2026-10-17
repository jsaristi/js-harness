import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { batchDir, markBatch, readBatch } from './batch-mark.mjs';
import { GATE_STALE_MS, gateDir } from './gate-lock.mjs';

// The mark an eval batch leaves while it runs, which the guard reads as it reads a gate's holder (first-version
// T6a). Every test writes under a home of its own in the temp folder: none reads or writes this machine's.

function inHome(body) {
  return async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-batch-mark-'));
    try {
      await body(home);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  };
}

test('a batch mark is read while it lives, with its folder, command and pid, and is gone once released', inHome((home) => {
  assert.equal(readBatch(home), null);
  const release = markBatch(home, { cwd: 'D:\\js-harness', command: 'node evals/suite.mjs --name screen', pid: 4242 });
  const mark = readBatch(home);
  assert.equal(mark.cwd, 'D:\\js-harness');
  assert.equal(mark.command, 'node evals/suite.mjs --name screen');
  assert.equal(mark.pid, 4242);
  assert.equal(mark.batch, true);
  release();
  release();
  assert.equal(readBatch(home), null);
  assert.deepEqual(fs.readdirSync(batchDir(home)), []);
}));

test('the batch mark lives under the gate folder, which uninstall removes whole', inHome((home) => {
  assert.equal(path.dirname(batchDir(home)), gateDir(home));
}));

test('a mark that has not beaten for the stale time is a batch that died: not read, and swept by the next mark', inHome((home) => {
  const release = markBatch(home, { cwd: 'D:\\one', pid: 1 });
  const [name] = fs.readdirSync(batchDir(home));
  const old = new Date(Date.now() - GATE_STALE_MS - 1_000);
  fs.utimesSync(path.join(batchDir(home), name), old, old);
  assert.equal(readBatch(home), null);
  const next = markBatch(home, { cwd: 'D:\\two', pid: 2 });
  assert.equal(readBatch(home).cwd, 'D:\\two');
  assert.equal(fs.readdirSync(batchDir(home)).length, 1);
  next();
  release();
}));

test('a living batch beats: its mark stays fresh past the stale time of its first write', inHome(async (home) => {
  const release = markBatch(home, { cwd: 'D:\\one', pid: 1, beatMs: 10 });
  try {
    const [name] = fs.readdirSync(batchDir(home));
    const old = new Date(Date.now() - GATE_STALE_MS - 1_000);
    fs.utimesSync(path.join(batchDir(home), name), old, old);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(readBatch(home)?.cwd, 'D:\\one');
  } finally {
    release();
  }
}));

test('a stale mark that cannot be swept, or a mark that cannot be written, is no failure of the batch', inHome((home) => {
  const release = markBatch(home, { cwd: 'D:\\one', pid: 1 });
  const [name] = fs.readdirSync(batchDir(home));
  const old = new Date(Date.now() - GATE_STALE_MS - 1_000);
  fs.utimesSync(path.join(batchDir(home), name), old, old);
  const busy = () => { throw Object.assign(new Error('busy'), { code: 'EPERM' }); };
  const next = markBatch(home, { cwd: 'D:\\two', pid: 2, fileSystem: { ...fs, rmSync: busy } });
  assert.equal(readBatch(home).cwd, 'D:\\two');
  next();
  release();
  const unwritable = markBatch(home, { pid: 3, fileSystem: { ...fs, writeFileSync: busy } });
  assert.doesNotThrow(unwritable);
}));

test('a torn mark is skipped, not fatal', inHome((home) => {
  fs.mkdirSync(batchDir(home), { recursive: true });
  fs.writeFileSync(path.join(batchDir(home), 'batch-9-torn.json'), '{"pid": 9, "cwd"');
  assert.equal(readBatch(home), null);
}));
