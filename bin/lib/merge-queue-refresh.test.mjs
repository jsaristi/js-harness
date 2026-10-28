import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { QUIET_WAIT_MINUTES, atWorkIn, lookOnce, refreshAfterLand, waitForQuiet } from './merge-queue-refresh.mjs';
import { REFRESH_FAILED } from './refresh-copy.mjs';

// The wait of `merge-queue --land --refresh-copy` for the work sessions to be between runs, against listings of
// `claude agents` written here: no claude runs, and the clock is the test's.

const ROOT = path.resolve('/proj');
const roots = [ROOT, path.resolve('/proj-worktrees/board')];
const agent = (fields) => ({ kind: 'background', cwd: path.join(ROOT, '.claude', 'worktrees', 'a'), sessionId: 'aaaa1111-0000', name: 'JH 7 · a', status: 'idle', ...fields });

test('atWorkIn names the project\'s sessions that are busy, waiting on a prompt or working, and not the one that refreshes', () => {
  const agents = [
    agent({ name: 'busy', status: 'busy', state: 'working' }),
    agent({ name: 'prompt', status: 'waiting', waitingFor: 'permission' }),
    agent({ name: 'between runs', status: 'idle', state: 'done' }),
    agent({ name: 'stopped', status: undefined, state: 'stopped' }),
    agent({ name: 'sibling worktree', status: 'busy', cwd: roots[1] }),
    agent({ name: 'another project', status: 'busy', cwd: path.resolve('/other') }),
    agent({ name: 'the lead', status: 'busy', sessionId: 'self-0000', kind: 'interactive' }),
    agent({ name: 'no folder', status: 'busy', cwd: undefined }),
  ];
  assert.deepEqual(atWorkIn(agents, { roots, self: 'self-0000' }).map((one) => one.name), ['busy', 'prompt', 'sibling worktree']);
  // With no session named as the one that refreshes, every busy one counts.
  assert.equal(atWorkIn(agents, { roots, self: null }).length, 4);
});

/** A clock that `sleep` moves, and what the wait printed. */
function clock() {
  let at = 0;
  const said = [];
  return { now: () => at, sleep: async (ms) => { at += ms; }, stdout: (line) => said.push(line), said, at: () => at };
}

test('lookOnce says whether a session of the project is at work, and that claude agents could not say', () => {
  assert.deepEqual(lookOnce({ list: () => [agent({})], roots }), { quiet: true });
  assert.deepEqual(lookOnce({ list: () => [agent({ status: 'busy' })], roots, self: 'other' }), { quiet: false, why: 'JH 7 · a (busy) began a run' });
  assert.deepEqual(lookOnce({ list: () => [agent({ status: 'busy' })], roots, self: 'aaaa1111-0000' }), { quiet: true }, 'the session that refreshes is left out');
  assert.match(lookOnce({ list: () => { throw new Error('no claude'); }, roots }).why, /claude agents could not say which sessions are at work \(no claude\)/);
});

test('waitForQuiet returns at once when no session of the project is at work, and looks once', async () => {
  const time = clock();
  let looks = 0;
  const quiet = await waitForQuiet({ list: () => { looks += 1; return [agent({})]; }, roots, self: null, ...time });
  assert.deepEqual(quiet, { quiet: true });
  assert.deepEqual([looks, time.said, time.at()], [1, [], 0]);
});

test('waitForQuiet waits while a session runs, says once whom it waits for, and returns when it is between runs', async () => {
  const time = clock();
  const listings = [[agent({ status: 'busy' })], [agent({ status: 'busy' })], [agent({ status: 'idle' })]];
  const quiet = await waitForQuiet({ list: () => listings.shift(), roots, self: null, ...time });
  assert.deepEqual(quiet, { quiet: true });
  assert.equal(time.said.length, 1);
  assert.match(time.said[0], /waiting for JH 7 · a \(busy\) to be between runs/);
  assert.ok(time.at() > 0);
});

test('waitForQuiet gives up after its minutes with the sessions still at work, and when claude agents cannot be read', async () => {
  const time = clock();
  const busy = await waitForQuiet({ list: () => [agent({ status: 'busy' }), agent({ name: 'JH 8 · b', status: 'waiting' })], roots, self: null, ...time });
  assert.equal(busy.quiet, false);
  assert.match(busy.why, new RegExp(`after ${QUIET_WAIT_MINUTES} minutes 2 sessions are still in the middle of a run: JH 7 · a \\(busy\\), JH 8 · b \\(waiting\\)`));
  assert.ok(time.at() >= QUIET_WAIT_MINUTES * 60000);
  // Not known is never "none": a listing that fails refreshes nothing.
  const blind = await waitForQuiet({ list: () => { throw new Error('claude is not on PATH'); }, roots, self: null, ...clock() });
  assert.deepEqual(blind, { quiet: false, why: 'claude agents could not say which sessions are at work (claude is not on PATH)' });
});

// gentle-ai on slice B of JH 72 (e30ae69d..7d8db831): no test held a worktree outside the main checkout, where a sibling
// folder of worktrees puts it.
test('refreshAfterLand waits for a session in a worktree outside the main checkout, which git lists', async () => {
  const outside = roots[1];
  const run = (command, args) => {
    if (args[0] === 'rev-parse') return { status: 0, stdout: `${path.join(ROOT, '.git')}\n`, stderr: '' };
    if (args[0] === 'worktree') return { status: 0, stdout: `worktree ${ROOT}\nHEAD ${'1'.repeat(40)}\nbranch refs/heads/main\n\nworktree ${outside}\nHEAD ${'2'.repeat(40)}\nbranch refs/heads/feat/board\n\n`, stderr: '' };
    throw new Error(`unexpected ${command} ${args.join(' ')}`);
  };
  const listings = [[agent({ status: 'busy', cwd: outside })], [agent({ status: 'idle', cwd: outside })]];
  const time = clock();
  let refreshed = 0;
  const log = { landedBranches: new Set(['feat/a']), record: { candidate: 'a'.repeat(40) } };
  const exit = await refreshAfterLand({ code: 0, log, versionOf: () => '1.0.0', home: '/h', cwd: ROOT, env: {}, run, list: () => (listings.length > 1 ? listings.shift() : listings[0]), ...time, refresh: async () => { refreshed += 1; return 0; }, stderr: () => {} });
  assert.deepEqual([exit, refreshed], [0, 1]);
  assert.match(time.said.join('\n'), /waiting for JH 7 · a \(busy\) to be between runs/);
});

// gentle-ai on slice B of JH 72 (e30ae69d..7d8db831): the project's folders and the wait ran outside the try that keeps
// the land record written, so a git that threw there, or a wait that did, ended the land before its record.
test('refreshAfterLand turns a throw while it finds the folders or waits into a failed refresh, and refreshes nothing', async () => {
  const log = { landedBranches: new Set(['feat/a']), record: { candidate: 'a'.repeat(40) } };
  const base = { code: 0, log, versionOf: () => '1.0.0', home: '/h', cwd: ROOT, env: {}, list: () => [], now: () => 0, stdout: () => {} };
  for (const [what, overrides] of [
    ['git', { run: () => { throw new Error('git is gone'); }, sleep: async () => {} }],
    ['the wait', { run: () => ({ status: 1, stdout: '', stderr: '' }), list: () => [agent({ status: 'busy' })], sleep: async () => { throw new Error('the clock stopped'); } }],
  ]) {
    const errors = [];
    let refreshed = 0;
    const exit = await refreshAfterLand({ ...base, ...overrides, refresh: async () => { refreshed += 1; return 0; }, stderr: (line) => errors.push(line) });
    assert.equal(exit, REFRESH_FAILED, what);
    assert.equal(refreshed, 0, what);
    assert.match(errors.join('\n'), /refresh failed: (git is gone|the clock stopped)/, what);
  }
});
