import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeReadyMain } from './merge-ready.mjs';

const HEAD = 'a'.repeat(40);
const MAIN = 'b'.repeat(40);
const OLD = 'c'.repeat(40);
const PULL_MERGE = 'd'.repeat(40);

// A spawnSync that answers git and gh from a table keyed by the command line; anything unlisted fails.
function fakeRun(table) {
  const calls = [];
  const run = (command, args) => {
    const line = [command, ...args].join(' ');
    calls.push(line);
    // The exact line first, then the longest key the line starts with.
    const key = table.has(line) ? line : [...table.keys()].filter((k) => line.startsWith(`${k} `)).sort((a, b) => b.length - a.length)[0];
    if (key) {
      const answer = table.get(key);
      return { status: answer.status ?? 0, stdout: answer.stdout ?? '', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: `no answer for ${line}` };
  };
  return { run, calls };
}

const view = (over = {}) => JSON.stringify({ number: 7, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', baseRefName: 'main', body: 'gentle-ai: passive', headRefOid: HEAD, headRefName: 'feat/x', ...over });
const runs = (list) => JSON.stringify(list);
const green = { databaseId: 42, headSha: HEAD, createdAt: '2026-10-14T10:00:00Z', status: 'completed', conclusion: 'success' };
const log = (base) => `check\tRun actions/checkout\tHEAD is now at 1234567 Merge ${HEAD} into ${base}\n`;

const table = (over = []) => new Map([
  ['git fetch -q origin', {}],
  ['git rev-parse origin/main', { stdout: `${MAIN}\n` }],
  ['gh pr view 7', { stdout: view() }],
  ['gh run list --branch feat/x', { stdout: runs([{ ...green, databaseId: 41, createdAt: '2026-10-14T09:00:00Z' }, green]) }],
  ['gh run view 42 --log', { stdout: log(MAIN) }],
  ...over,
]);

async function main(argv, entries) {
  const { run, calls } = fakeRun(table(entries));
  const out = [];
  const code = await mergeReadyMain(argv, { run, stdout: (line) => out.push(line), stderr: (line) => out.push(line) });
  return { code, out: out.join('\n'), calls };
}

test('merge-ready prints why a pull request is ready and exits 0, reading the latest run of its head', async () => {
  const { code, out, calls } = await main(['7']);
  assert.equal(code, 0, out);
  assert.match(out, /PR 7 is ready: run 42 is green on head aaaaaaa against main bbbbbbb\./);
  assert.ok(!calls.some((line) => /\bmerge\b/.test(line) && line.startsWith('gh pr')), 'it never merges');
});

test('merge-ready with a stale tested base exits 3 and reads the first parent of refs/pull/N/merge', async () => {
  const { code, out } = await main(['7'], [
    ['gh run view 42 --log', { stdout: log(OLD) }],
    ['git merge-base --is-ancestor', {}],
    [`git diff --name-only ${OLD} ${MAIN}`, { stdout: 'bin/check.mjs\n' }],
    ['git fetch -q origin refs/pull/7/merge', {}],
    ['git rev-parse FETCH_HEAD^1', { stdout: `${MAIN}\n` }],
  ]);
  assert.equal(code, 3, out);
  assert.match(out, /stale/);
  assert.match(out, /close and reopen PR 7 for a fresh run/);
});

test('merge-ready behind main only by documents checks the merge into main is clean', async () => {
  const entries = (clean) => [
    ['gh run view 42 --log', { stdout: log(OLD) }],
    ['git merge-base --is-ancestor', {}],
    [`git diff --name-only ${OLD} ${MAIN}`, { stdout: 'docs/ROADMAP.md\n' }],
    [`git merge-tree --write-tree ${MAIN} ${HEAD}`, { status: clean ? 0 : 1, stdout: PULL_MERGE }],
  ];
  assert.equal((await main(['7'], entries(true))).code, 0);
  assert.equal((await main(['7'], entries(false))).code, 1);
});

test('merge-ready with no green run for the head exits 4 and does not read a log', async () => {
  const { code, out, calls } = await main(['7'], [['gh run list --branch feat/x', { stdout: runs([{ ...green, headSha: OLD }]) }]]);
  assert.equal(code, 4, out);
  assert.ok(!calls.some((line) => line.startsWith('gh run view')));
  const pending = await main(['7'], [['gh run list --branch feat/x', { stdout: runs([{ ...green, status: 'in_progress', conclusion: '' }]) }]]);
  assert.equal(pending.code, 4);
});

test('merge-ready refuses a missing or non-numeric pull request, and a gh it cannot read, with exit 1', async () => {
  assert.equal((await main([])).code, 1);
  assert.equal((await main(['seven'])).code, 1);
  const unread = await main(['7'], [['gh pr view 7', { status: 1 }]]);
  assert.equal(unread.code, 1);
  assert.match(unread.out, /could not read PR 7/);
});

test('merge-ready --help prints its usage and exits 0, reading nothing', async () => {
  const { code, out, calls } = await main(['--help']);
  assert.equal(code, 0);
  assert.match(out, /^Usage: js-harness merge-ready <pr>/);
  assert.equal(calls.length, 0);
});
