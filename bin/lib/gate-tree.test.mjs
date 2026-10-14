import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { RUNTIME, TREE_KEY_FORMAT, treeKey } from './gate-tree.mjs';

// The key of the tree a gate guards. Git is a stand-in here but for one test, of what only real git can say
// (mixed line ends); what it answers under the index a hook is handed is tested through the gate in
// check.test.mjs.

const SENSORS = [{ name: 'tests', command: 'npm run test' }];
const entry = (path, { tag = 'H', id = 'a'.repeat(40), eol = 'i/lf    w/crlf  attr/' } = {}) => `${tag} 100644 ${id} 0\t${eol}\t${path}`;
const LISTING = [entry('a.js'), entry('docs/guide.md', { id: 'b'.repeat(40) })];

/** A git that answers the status with `status` and the listing with `listing`, each a list of entries. */
function gitOf({ status = [], listing = LISTING } = {}) {
  const asked = [];
  const git = (args) => {
    asked.push(args);
    const answer = args.includes('status') ? status : listing;
    return answer === null ? null : answer.map((one) => `${one}\0`).join('');
  };
  git.asked = asked;
  return git;
}

test('treeKey: a folder that is its index has a key of 64 lowercase hex characters, the same each time it is asked, from two git processes', () => {
  const git = gitOf();
  const key = treeKey(git, { sensors: SENSORS });
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(treeKey(gitOf(), { sensors: SENSORS }), key);
  assert.deepEqual(git.asked.map((args) => args.find((arg) => !arg.startsWith('-'))), ['status', 'ls-files']);
  // The status never leaves a submodule out, and writes nothing; the listing holds how each file is on disk.
  assert.ok(git.asked[0].includes('--ignore-submodules=none') && git.asked[0].includes('--untracked-files=all') && git.asked[0][0] === '--no-optional-locks');
  assert.ok(git.asked[1].includes('--eol') && git.asked[1].includes('-s') && git.asked[1].includes('-v'));
});

// Found by two readers on 2026-10-14: a pass in WSL2 proved the tree for the Windows run meant to catch
// what WSL2 cannot, which then ran no sensor.
test('treeKey: where the sensors run is part of the key, and a gate that names no place keeps the key it had', () => {
  const plain = treeKey(gitOf(), { sensors: SENSORS });
  assert.equal(treeKey(gitOf(), { sensors: SENSORS, place: undefined }), plain);
  const wsl = treeKey(gitOf(), { sensors: SENSORS, place: 'wsl Ubuntu /home/a/.local/node/bin' });
  assert.match(wsl, /^[0-9a-f]{64}$/);
  assert.notEqual(wsl, plain);
  assert.notEqual(treeKey(gitOf(), { sensors: SENSORS, place: 'wsl Debian /home/a/.local/node/bin' }), wsl);
});

test('treeKey: what is staged and nothing else is still a folder that is its index', () => {
  const staged = treeKey(gitOf({ status: ['M  a.js', 'A  new.js', 'D  gone.js'] }), { sensors: SENSORS });
  assert.equal(staged, treeKey(gitOf(), { sensors: SENSORS }));
});

test('treeKey: no key where the folder is not the index: an unstaged change, an untracked file, an unmerged path, a file removed from the folder', () => {
  for (const status of [[' M a.js'], ['MM a.js'], ['?? scratch.txt'], ['UU a.js'], ['AA a.js'], [' D a.js'], ['M  a.js', '?? b.js'], ['x']]) {
    assert.equal(treeKey(gitOf({ status }), { sensors: SENSORS }), null, JSON.stringify(status));
  }
});

test('treeKey: no key where an entry is one git reports unchanged whatever its file holds, or is not a plain entry', () => {
  for (const tag of ['S', 'h', 's', 'M', 'R', 'C', 'K']) {
    assert.equal(treeKey(gitOf({ listing: [entry('a.js'), entry('b.js', { tag })] }), { sensors: SENSORS }), null, tag);
  }
});

test('treeKey: no key where a file has mixed line ends in the folder, wherever the listing says so and only there', () => {
  for (const eol of ['i/lf    w/mixed attr/', 'i/mixed w/mixed attr/text=auto', 'i/lf    w/mixed attr/text eol=crlf']) {
    assert.equal(treeKey(gitOf({ listing: [entry('a.js'), entry('b.js', { eol })] }), { sensors: SENSORS }), null, eol);
  }
  // A path is not the way a file is written, and neither is what the index holds.
  assert.match(treeKey(gitOf({ listing: [entry('w/mixed'), entry('b.js', { eol: 'i/mixed w/crlf  attr/' })] }), { sensors: SENSORS }), /^[0-9a-f]{64}$/);
});

// Why: under `core.autocrlf` two files with CRLF and LF at other lines are one object, one clean status and
// one line of the listing, so a key of them would be one key for two files a sensor can tell apart.
test('treeKey with real git: two arrangements of mixed line ends are one listing and a clean folder, and neither has a key', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-tree-mixed-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  const git = (args) => {
    const result = spawnSync('git', ['-c', 'core.autocrlf=true', '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: repo, encoding: 'utf8', env });
    return result.status === 0 ? result.stdout : null;
  };
  try {
    git(['init', '-q']);
    fs.writeFileSync(path.join(repo, 'plain.txt'), 'one\r\ntwo\r\n');
    fs.writeFileSync(path.join(repo, 'mixed.txt'), 'one\r\ntwo\n');
    git(['add', '.']);
    assert.notEqual(git(['commit', '-q', '-m', 'two files']), null);
    const first = git(['ls-files', '--eol']);
    assert.match(first, /w\/mixed\s.*mixed\.txt/);
    assert.equal(treeKey(git, { sensors: SENSORS }), null);

    fs.writeFileSync(path.join(repo, 'mixed.txt'), 'one\ntwo\r\n');
    assert.equal(git(['status', '--porcelain']), '');
    assert.equal(git(['ls-files', '--eol']), first);
    assert.equal(treeKey(git, { sensors: SENSORS }), null);

    // With that file written one way throughout, and staged, the folder has a key again. Staged, since git
    // calls a file of another size changed without reading it: only a rearrangement of the same size,
    // as the one above, is a clean folder.
    fs.writeFileSync(path.join(repo, 'mixed.txt'), 'one\r\ntwo\r\n');
    git(['add', 'mixed.txt']);
    assert.equal(git(['status', '--porcelain']), '');
    assert.match(treeKey(git, { sensors: SENSORS }), /^[0-9a-f]{64}$/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('treeKey: no key where git does not answer, the index holds nothing, or there is nothing to ask or to run', () => {
  assert.equal(treeKey(gitOf({ status: null }), { sensors: SENSORS }), null);
  assert.equal(treeKey(gitOf({ listing: null }), { sensors: SENSORS }), null);
  assert.equal(treeKey(gitOf({ listing: [] }), { sensors: SENSORS }), null);
  assert.equal(treeKey(gitOf(), { sensors: [] }), null);
  assert.equal(treeKey(gitOf(), {}), null);
  assert.equal(treeKey(null, { sensors: SENSORS }), null);
  assert.equal(treeKey(undefined, { sensors: SENSORS }), null);
  assert.equal(treeKey(), null);
});

test('treeKey: another object at a path, another path, a document, another way a file is written on disk, another sensor and another runtime are each another key', () => {
  const key = treeKey(gitOf(), { sensors: SENSORS });
  const others = [
    treeKey(gitOf({ listing: [entry('a.js', { id: 'c'.repeat(40) }), LISTING[1]] }), { sensors: SENSORS }),
    treeKey(gitOf({ listing: [entry('b.js'), LISTING[1]] }), { sensors: SENSORS }),
    treeKey(gitOf({ listing: [LISTING[0], entry('docs/guide.md', { id: 'd'.repeat(40) })] }), { sensors: SENSORS }),
    treeKey(gitOf({ listing: [entry('a.js', { eol: 'i/lf    w/lf    attr/' }), LISTING[1]] }), { sensors: SENSORS }),
    treeKey(gitOf({ listing: [...LISTING, entry('c.js')] }), { sensors: SENSORS }),
    treeKey(gitOf(), { sensors: [{ name: 'tests', command: 'npm run test -- --only' }] }),
    treeKey(gitOf(), { sensors: [...SENSORS, { name: 'lint', command: 'npm run lint' }] }),
    treeKey(gitOf(), { sensors: SENSORS, runtime: { ...RUNTIME, version: 'v0.0.1' } }),
    treeKey(gitOf(), { sensors: SENSORS, runtime: { ...RUNTIME, platform: 'another' } }),
    treeKey(gitOf(), { sensors: SENSORS, runtime: { ...RUNTIME, arch: 'another' } }),
  ];
  for (const other of others) assert.match(other, /^[0-9a-f]{64}$/);
  assert.equal(new Set([key, ...others]).size, others.length + 1);
  assert.equal(Number.isInteger(TREE_KEY_FORMAT), true);
});
