import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { forgetStackRow, install, manifestPath, readManifest, recordStackRow, uninstall } from './manifest.mjs';

// The records of what `stack install` ran (odd/tasks/stack-install.md, D7): kept in the machine manifest's own array,
// carried by `install`, and handed to `uninstall`'s `undoStack`, which alone judges and runs their undo.

const CODEX = { tool: 'codex', dimension: 'installed', run: ['pnpm', 'add', '-g', '@openai/codex'], undo: ['pnpm', 'remove', '-g', '@openai/codex'], applies: '0.50.0', env: {}, at: '2026-10-19T00:00:00.000Z' };
const CLAUDE = { tool: 'codegraph', dimension: 'claude', run: ['claude', 'mcp', 'add'], undo: ['claude', 'mcp', 'remove'], applies: { command: 'codegraph' }, env: {}, at: '2026-10-19T00:00:01.000Z' };

function withHome(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-home-'));
  try {
    return fn(home);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('recordStackRow keeps one record per tool and dimension, in a manifest that says nothing is installed', () => withHome((home) => {
  recordStackRow(home, { ...CODEX, applies: null });
  recordStackRow(home, CLAUDE);
  recordStackRow(home, CODEX);
  const manifest = readManifest(home);
  assert.equal(manifest.version, null);
  assert.deepEqual(manifest.stack, [CODEX, CLAUDE]);
}));

test('forgetStackRow drops a record, and the manifest it alone made goes with the last one', () => withHome((home) => {
  recordStackRow(home, CODEX);
  recordStackRow(home, CLAUDE);
  assert.equal(forgetStackRow(home, CODEX), true);
  assert.deepEqual(readManifest(home).stack, [CLAUDE]);
  assert.equal(forgetStackRow(home, CLAUDE), true);
  assert.equal(fs.existsSync(manifestPath(home)), false);
  assert.equal(forgetStackRow(home, CLAUDE), false);
}));

test('install carries the stack records forward', () => withHome((home) => {
  recordStackRow(home, CODEX);
  install(home, '1.0.0');
  assert.deepEqual(readManifest(home).stack, [CODEX]);
}));

test('uninstall hands the records to undoStack and keeps only those it failed, alone, for a second run', () => withHome((home) => {
  recordStackRow(home, CODEX);
  recordStackRow(home, CLAUDE);
  const handed = [];
  const result = uninstall(home, {
    undoStack: (records) => {
      handed.push(...records);
      return { undone: [{ tool: 'codegraph', dimension: 'claude' }], kept: [{ tool: 'codex', dimension: 'installed', reason: 'failed', why: 'exit 1' }], failedRecords: [CODEX] };
    },
  });
  assert.deepEqual(handed, [CODEX, CLAUDE]);
  assert.deepEqual(result.stackUndone, [{ tool: 'codegraph', dimension: 'claude' }]);
  assert.deepEqual(result.stackKept, [{ tool: 'codex', dimension: 'installed', reason: 'failed', why: 'exit 1' }]);
  assert.deepEqual(readManifest(home).stack, [CODEX]);
}));

test('uninstall with every stack record undone removes the manifest', () => withHome((home) => {
  recordStackRow(home, CODEX);
  const result = uninstall(home, { undoStack: () => ({ undone: [{ tool: 'codex', dimension: 'installed' }], kept: [], failedRecords: [] }) });
  assert.deepEqual(result.stackUndone, [{ tool: 'codex', dimension: 'installed' }]);
  assert.equal(fs.existsSync(manifestPath(home)), false);
}));

test('uninstall without an undoStack leaves the stack records as they are', () => withHome((home) => {
  recordStackRow(home, CODEX);
  const result = uninstall(home, {});
  assert.deepEqual(result.stackKept, [{ tool: 'codex', dimension: 'installed', reason: 'not-judged' }]);
  assert.deepEqual(readManifest(home).stack, [CODEX]);
}));

test('a manifest with no stack record never calls undoStack and reports no stack', () => withHome((home) => {
  install(home, '1.0.0');
  const result = uninstall(home, { undoStack: () => assert.fail('called with no record') });
  assert.equal(result.stackUndone, undefined);
}));
