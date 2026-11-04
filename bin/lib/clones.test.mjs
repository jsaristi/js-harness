import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordClone, removeClones } from './clones.mjs';
import { install, manifestPath, readManifest, sync, uninstall } from './manifest.mjs';

// The idea watch's clone (odd/tasks/idea-watch.md, S6): a folder js-harness fills only when asked, recorded in the
// machine manifest before it is filled, so `uninstall machine` removes it, and nothing outside `~/.js-harness`.

const URL = 'https://example.test/up.git';
const makeHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-clones-'));
const everythingUnder = (home) => fs.readdirSync(home, { recursive: true }).map(String).sort();
/** `uninstall` as `uninstall machine` runs it, with the clones' removal handed in. */
const uninstallMachine = (home, seams = {}) => uninstall(home, { ...seams, removeClones: (records) => removeClones(records, home, seams) });

function makeClone(home, at = path.join(home, '.js-harness', 'upstream', 'repo')) {
  fs.mkdirSync(path.join(at, 'objects', 'pack'), { recursive: true });
  fs.writeFileSync(path.join(at, 'HEAD'), 'ref: refs/heads/main\n');
  fs.writeFileSync(path.join(at, 'objects', 'pack', 'pack-1.pack'), 'bytes');
  return at;
}

test('recordClone creates a manifest that says nothing is installed, and install and sync carry the record forward', () => {
  const home = makeHome();
  try {
    const at = makeClone(home);
    const record = recordClone(home, { path: at, url: URL });
    assert.deepEqual(record, { path: at, url: URL });
    assert.deepEqual(readManifest(home), { version: null, files: [], entries: [], clones: [record] });
    recordClone(home, { path: at, url: URL });
    assert.deepEqual(readManifest(home).clones, [record], 'one record a path');
    assert.deepEqual(install(home, '0.1.0').clones, [record]);
    assert.deepEqual(sync(home, '0.2.0').clones, [record]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes a recorded clone whole, with the folder it leaves empty, and the home is empty after', () => {
  const home = makeHome();
  try {
    install(home, '0.1.0');
    const at = makeClone(home);
    recordClone(home, { path: at, url: URL });
    const result = uninstallMachine(home);
    assert.ok(result.removed.includes(at), 'reported with the removed paths');
    assert.deepEqual(result.clonesKept, []);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'the upstream folder and the manifest are gone');
    assert.deepEqual(everythingUnder(home), []);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a recorded clone outside ~/.js-harness is never removed: kept, with why, and no longer recorded', () => {
  const home = makeHome();
  try {
    const outside = makeClone(home, path.join(home, 'work'));
    const sibling = makeClone(home, path.join(home, '.js-harness-other', 'up'));
    recordClone(home, { path: outside, url: URL });
    recordClone(home, { path: sibling, url: URL });
    recordClone(home, { path: path.join(home, '.js-harness'), url: URL });
    const result = uninstallMachine(home);
    assert.deepEqual(result.clonesKept.map((kept) => [kept.path, kept.reason]), [[outside, 'outside'], [sibling, 'outside'], [path.join(home, '.js-harness'), 'outside']]);
    assert.equal(fs.existsSync(path.join(outside, 'HEAD')), true);
    assert.equal(fs.existsSync(path.join(sibling, 'HEAD')), true);
    assert.equal(fs.existsSync(manifestPath(home)), false, 'a record that can never be acted on is dropped');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a clone that cannot be removed keeps its record, so uninstall run again removes it', () => {
  const home = makeHome();
  try {
    install(home, '0.1.0');
    const at = makeClone(home);
    const record = recordClone(home, { path: at, url: URL });
    const locked = (target, options) => {
      if (target === at) throw Object.assign(new Error('busy'), { code: 'EBUSY' });
      return fs.rmSync(target, options);
    };
    const first = uninstallMachine(home, { removeFile: locked });
    assert.deepEqual(first.clonesKept, [{ path: at, reason: 'unremovable', code: 'EBUSY' }]);
    assert.deepEqual(readManifest(home).clones, [record]);
    const second = uninstallMachine(home);
    assert.ok(second.removed.includes(at));
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('a recorded clone already gone is neither removed nor kept, and its record leaves', () => {
  const home = makeHome();
  try {
    const at = path.join(home, '.js-harness', 'upstream', 'repo');
    recordClone(home, { path: at, url: URL });
    const result = uninstallMachine(home);
    assert.equal(result.removed.includes(at), false);
    assert.deepEqual(result.clonesKept, []);
    assert.equal(fs.existsSync(path.join(home, '.js-harness')), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('without the removal handed in, uninstall removes no clone and keeps every record, as it does the stack\'s rows', () => {
  const home = makeHome();
  try {
    const at = makeClone(home);
    const record = recordClone(home, { path: at, url: URL });
    const result = uninstall(home);
    assert.deepEqual(result.clonesKept, [{ path: at, reason: 'not-judged' }]);
    assert.equal(fs.existsSync(path.join(at, 'HEAD')), true);
    assert.deepEqual(readManifest(home).clones, [record]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
