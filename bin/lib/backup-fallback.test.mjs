import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallbackNotice, projectOf, readStats } from './backup-fallback.mjs';

const RECENT = [
  { project: 'js-harness', file: 'recent/js-harness.md', entries: 100, head: 120, observations: 2449, directories: ['D:\\js-harness', 'd:\\js-harness'] },
  { project: 'client', file: 'recent/client.md', entries: 40, head: 60, observations: 490, directories: ['D:\\work\\client-site'] },
];

const resolve = (fields) => projectOf({ env: {}, cwd: 'D:\\elsewhere', main: 'D:\\elsewhere', config: () => null, origin: null, recent: RECENT, ...fields });

test('the project comes from ENGRAM_PROJECT first, then .engram/config.json', () => {
  assert.deepEqual(resolve({ env: { ENGRAM_PROJECT: 'Client' } }), { project: 'client', source: 'ENGRAM_PROJECT' });
  assert.deepEqual(resolve({ config: (dir) => (dir === 'D:\\elsewhere' ? { project_name: 'JS-Harness' } : null) }), { project: 'js-harness', source: '.engram/config.json' });
});

test('then the directories its sessions ran in, the longest match, the main checkout too, any case and slash', () => {
  assert.deepEqual(resolve({ cwd: 'D:\\work\\client-site\\src', main: 'D:\\work\\client-site\\src' }), { project: 'client', source: 'directory' });
  assert.deepEqual(resolve({ cwd: 'd:/js-harness/.claude/worktrees/x', main: 'D:\\js-harness' }), { project: 'js-harness', source: 'directory' });
  // A folder that only starts with the same letters is another folder.
  assert.deepEqual(resolve({ cwd: 'D:\\js-harness-lab', main: 'D:\\js-harness-lab' }), { project: 'js-harness-lab', source: 'folder' });
});

test("then origin's repository name, then the main checkout's folder", () => {
  assert.deepEqual(resolve({ origin: 'https://github.com/jsaristi/Shop.git' }), { project: 'shop', source: 'git remote' });
  assert.deepEqual(resolve({ origin: 'git@github.com:jsaristi/shop' }), { project: 'shop', source: 'git remote' });
  assert.deepEqual(resolve({ main: 'D:\\Projects\\My App' }), { project: 'my app', source: 'folder' });
});

test('readStats reads the observations, an unknown project, a time-out and a failure', () => {
  assert.deepEqual(readStats({ status: 0, stdout: 'Engram Memory Stats\n  Sessions:     108\n  Observations: 2449\n  Prompts:      0\n' }), { state: 'ok', observations: 2449 });
  assert.deepEqual(readStats({ status: 1, stdout: '', stderr: 'engram: unknown project: js-harness\n' }), { state: 'unknown' });
  assert.deepEqual(readStats({ status: null, error: { code: 'ETIMEDOUT' }, stdout: '', stderr: '' }), { state: 'timeout' });
  assert.deepEqual(readStats({ status: null, error: { code: 'ENOENT' }, stdout: '', stderr: '' }), { state: 'failed', reason: 'engram could not be run (ENOENT)' });
  assert.deepEqual(readStats({ status: 2, stdout: '', stderr: 'database is locked\n' }), { state: 'failed', reason: 'database is locked' });
  // `defaultRun` folds spawnSync's error into stderr and leaves the status null.
  assert.deepEqual(readStats({ status: null, stdout: '', stderr: 'Error: spawnSync engram ETIMEDOUT' }), { state: 'timeout' });
  assert.deepEqual(readStats({ status: null, stdout: '', stderr: 'Error: spawnSync engram ENOENT' }), { state: 'failed', reason: 'engram could not be run (ENOENT)' });
});

const notice = (stats, fields = {}) => fallbackNotice({ entry: RECENT[0], stats, clone: 'C:\\Users\\me\\.js-harness\\memory-backup\\repo', cloneExists: true, repo: 'me/memory', ...fields });

test('a healthy Engram says nothing, and a deletion within a tenth is health', () => {
  assert.equal(notice({ state: 'ok', observations: 2449 }), null);
  assert.equal(notice({ state: 'ok', observations: 2300 }), null);
});

test('a wiped, emptied, silent or failing Engram gets the file, its head, the order and the restore', () => {
  const cases = [
    [{ state: 'unknown' }, /Engram has no memory of js-harness/],
    [{ state: 'ok', observations: 12 }, /Engram holds 12 of the 2,449 observations of js-harness the last backup held/],
    [{ state: 'timeout' }, /Engram did not answer within 3 seconds/],
    [{ state: 'failed', reason: 'database is locked' }, /Engram failed: database is locked/],
  ];
  for (const [stats, reason] of cases) {
    const text = notice(stats);
    assert.match(text, reason);
    assert.match(text, /C:\\Users\\me\\\.js-harness\\memory-backup\\repo\\recent\\js-harness\.md/);
    assert.match(text, /lines 1-120/);
    assert.match(text, /js-harness backup restore --from "C:\\Users\\me\\\.js-harness\\memory-backup\\repo" --merge/);
    assert.match(text, /never `js-harness backup run --allow-shrink`/);
    assert.match(text, /the Engram protocol shown at this start is not working for this project/i);
    assert.doesNotMatch(text, /client/);
  }
});

test('with the clone gone, the notice reads the file from the private repository', () => {
  const text = notice({ state: 'unknown' }, { cloneExists: false });
  assert.match(text, /gh api -H "Accept: application\/vnd\.github\.raw" repos\/me\/memory\/contents\/recent\/js-harness\.md/);
  assert.match(text, /js-harness backup restore --from "https:\/\/github\.com\/me\/memory\.git" --merge/);
});

test('a home with a space keeps the restore command one argument (Codex)', () => {
  const text = notice({ state: 'unknown' }, { clone: 'C:\\Users\\First Last\\.js-harness\\memory-backup\\repo' });
  assert.ok(text.includes('js-harness backup restore --from "C:\\Users\\First Last\\.js-harness\\memory-backup\\repo" --merge'), text);
});
