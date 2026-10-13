import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNTIME, TREE_KEY_FORMAT, treeKey } from './gate-tree.mjs';

// The key of the tree a gate guards. Git is a stand-in here: what real git answers in a real repository,
// under the index a hook is handed, is tested through the gate in check.test.mjs.

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
