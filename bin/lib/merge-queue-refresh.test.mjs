import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { QUIET_WAIT_MINUTES, atWorkIn, lookOnce, refreshAfterLand, refreshNow, waitForQuiet } from './merge-queue-refresh.mjs';
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

// The review of slice B of JH 72 (e30ae69d..7d8db831): no test held a worktree outside the main checkout, where a sibling
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

// The review of slice B of JH 72 (e30ae69d..7d8db831): the project's folders and the wait ran outside the try that keeps
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

// S7 of odd/tasks/lead-manual-steps.md: after its wait in vain, the land names the refresh that can run now.
test('refreshAfterLand, after its wait in vain, names merge-queue --refresh-copy as the way to bring the copy up', async () => {
  const run = (command, args) => (args[0] === 'rev-parse' ? { status: 0, stdout: `${path.join(ROOT, '.git')}\n`, stderr: '' } : { status: 1, stdout: '', stderr: '' });
  const log = { landedBranches: new Set(['feat/a']), record: { candidate: 'a'.repeat(40) } };
  const errors = [];
  const time = clock();
  const exit = await refreshAfterLand({ code: 0, log, versionOf: () => '1.0.0', home: '/h', cwd: ROOT, env: {}, run, list: () => [agent({ status: 'busy', cwd: ROOT })], ...time, refresh: async () => 0, stderr: (line) => errors.push(line) });
  assert.equal(exit, 75);
  assert.match(errors.join('\n'), /run js-harness merge-queue --refresh-copy from a checkout at origin\/main once only waits run from the copy/);
});

// odd/tasks/refresh-open-apply.md, T2: on 2026-10-31 a refresh installed PR 729 while question 140 asked his yes for it.
const ASKED = 'refresh: question 140 is open and asks the user\'s yes to apply pull request 729, which aaaaaaa holds: nothing was refreshed';

test('refreshAfterLand refuses, exit 77, before it waits for the sessions, while an open question asks to apply what main holds', async () => {
  const run = (command, args) => (args[0] === 'rev-parse' ? { status: 0, stdout: `${path.join(ROOT, '.git')}\n`, stderr: '' } : { status: 1, stdout: '', stderr: '' });
  const log = { landedBranches: new Set(['feat/a']), record: { candidate: 'a'.repeat(40) } };
  const errors = [];
  const shas = [];
  let listed = 0;
  let refreshed = 0;
  const exit = await refreshAfterLand({ code: 0, log, versionOf: () => '1.0.0', home: '/h', cwd: ROOT, env: {}, run, list: () => { listed += 1; return []; }, ...clock(), refresh: async () => { refreshed += 1; return 0; }, stderr: (line) => errors.push(line), unanswered: (sha) => (shas.push(sha), ASKED) });
  assert.deepEqual([exit, listed, refreshed, shas], [77, 0, 0, ['a'.repeat(40)]]);
  assert.deepEqual(errors, [ASKED]);
});

test('refreshAfterLand hands the refresh the same look for under its lock, for main\'s sha', async () => {
  const run = (command, args) => (args[0] === 'rev-parse' ? { status: 0, stdout: `${path.join(ROOT, '.git')}\n`, stderr: '' } : { status: 1, stdout: '', stderr: '' });
  const log = { landedBranches: new Set(['feat/a']), record: { candidate: 'a'.repeat(40) } };
  const shas = [];
  let under = null;
  const exit = await refreshAfterLand({ code: 0, log, versionOf: () => '1.0.0', home: '/h', cwd: ROOT, env: {}, run, list: () => [], ...clock(), refresh: async (opts) => { under = opts.unanswered(); return under === null ? 0 : 77; }, stderr: () => {}, unanswered: (sha) => (shas.push(sha), shas.length > 1 ? ASKED : null) });
  assert.deepEqual([exit, under, shas], [77, ASKED, ['a'.repeat(40), 'a'.repeat(40)]], 'asked first before the wait, then again under the lock');
});

// S4, S5 of odd/tasks/lead-manual-steps.md: `merge-queue --refresh-copy` run alone. Every effect is a stand-in: the
// look at the copy's processes, the stop, the listing of sessions, the refresh and the channel.
const MAIN = '0123456789abcdef0123456789abcdef01234567';
const T0 = 1_800_000_000_000;
const waitOf = (pid, ppid, args) => ({ pid, createdAt: T0 + pid, commandLine: `node "C:\\pnpm\\global\\v11\\h\\node_modules\\js-harness\\bin\\js-harness.mjs" wait ${args}`, targets: [{ pid, createdAt: T0 + pid }], ppid });
const WAITS = [waitOf(120, 100, '--pr 674'), waitOf(140, 130, '--notice-to orchestrator'), waitOf(160, 1, '--main-has 1c6b6c2')];
const SNAP = [{ pid: 100, ppid: 1, createdAt: T0 }, { pid: 130, ppid: 1, createdAt: T0 }, ...WAITS.map(({ pid, ppid, createdAt }) => ({ pid, ppid, createdAt }))];
const SESSIONS = [
  { id: 'a', title: 'JH 86 · rules and evals', waits: ['js-harness wait --pr 674'] },
  { id: 'b', title: 'JH ORQ · orquestador F8', waits: ['js-harness wait --notice-to orchestrator'] },
];
const BLOCKER = { pid: 220, createdAt: T0, verb: 'codex-review', commandLine: 'node codex-review' };

function refreshingNow({ copySha = 'f'.repeat(40), main = { sha: MAIN }, looks = [{ waits: WAITS, blockers: [], snapshot: SNAP }], running = [], code = 0, sessions = SESSIONS, stopFails = false, unanswered } = {}) {
  const said = [];
  const told = [];
  const stopped = [];
  const asked = [];
  const sleeps = [];
  let looked = 0;
  const order = [];
  const deps = {
    main,
    copySha,
    look: () => {
      order.push('look');
      return looks[Math.min((looked += 1) - 1, looks.length - 1)];
    },
    stop: (targets) => {
      stopped.push(targets);
      if (stopFails) throw new Error('powershell timed out');
      return { killed: targets.map((one) => one.pid).filter((pid) => !running.includes(pid)), gone: [], running };
    },
    sessions: () => {
      order.push('sessions');
      return sessions;
    },
    refresh: async (opts) => {
      asked.push({ ...opts, stopsBefore: stopped.length });
      // As refreshCopy does under its lock: his open question first, then the look that stops the waits.
      const refusal = opts.unanswered();
      if (refusal !== null) {
        said.push(refusal);
        return 77;
      }
      const quiet = opts.stillQuiet();
      if (quiet.quiet) return code;
      said.push(`why: ${quiet.why}`);
      return 75;
    },
    versionOf: () => '1.0.0',
    tell: (number, text, slug) => told.push(slug === undefined ? { number, text } : { number, text, slug }),
    home: '/h',
    cwd: ROOT,
    env: {},
    sleep: async (ms) => sleeps.push(ms),
    stdout: (line) => said.push(line),
    stderr: (line) => said.push(line),
    ...(unanswered && { unanswered }),
  };
  return refreshNow(deps).then((exit) => ({ exit, said: said.join('\n'), told, stopped, asked, sleeps, looked, order }));
}

test('refreshNow refreshes nothing when the copy already names main, and says so', async () => {
  const run = await refreshingNow({ copySha: MAIN });
  assert.equal(run.exit, 0);
  assert.match(run.said, /the installed copy already names 0123456, origin's main: nothing to refresh/);
  assert.deepEqual([run.looked, run.asked.length], [0, 0]);
});

test('refreshNow refuses, exit 77, before any look or stop, while an open question asks to apply what main holds', async () => {
  const shas = [];
  const run = await refreshingNow({ unanswered: (sha) => (shas.push(sha), ASKED) });
  assert.equal(run.exit, 77);
  assert.equal(run.said, ASKED);
  assert.deepEqual([run.looked, run.stopped.length, run.asked.length, shas], [0, 0, 0, [MAIN]]);
});

test('refreshNow refuses, exit 77, when the look at the questions throws: a look that cannot tell is no "none open"', async () => {
  const run = await refreshingNow({ unanswered: () => { throw new Error('EMFILE'); } });
  assert.equal(run.exit, 77);
  assert.match(run.said, /^refresh: whether an open question asks to apply what 0123456 holds could not be told \(EMFILE\): nothing was refreshed$/);
  assert.deepEqual([run.looked, run.asked.length], [0, 0]);
});

test('refreshNow asks again under the lock, and a question recorded meanwhile stops no wait', async () => {
  const shas = [];
  const run = await refreshingNow({ unanswered: (sha) => (shas.push(sha), shas.length > 1 ? ASKED : null) });
  assert.equal(run.exit, 77, run.said);
  assert.deepEqual([run.stopped.length, shas], [0, [MAIN, MAIN]]);
  assert.deepEqual(run.told, [], 'no session is told to run a wait again that was never stopped');
});

test('refreshNow refuses, with exit 1, when main cannot be read', async () => {
  const run = await refreshingNow({ main: { why: 'could not fetch origin' } });
  assert.equal(run.exit, 1);
  assert.match(run.said, /could not fetch origin: nothing was refreshed/);
});

test('refreshNow refuses, stopping nothing, while work other than a wait still runs from the copy after three looks', async () => {
  const run = await refreshingNow({ looks: [{ waits: WAITS, blockers: [BLOCKER], snapshot: SNAP }] });
  assert.equal(run.exit, 75);
  assert.match(run.said, /a process other than a wait runs from the installed copy: 220 \(codex-review, since .*\), after 3 looks 10 seconds apart: nothing was refreshed/);
  assert.deepEqual([run.looked, run.sleeps, run.stopped.length, run.asked.length], [3, [10_000, 10_000], 0, 0]);
});

test('refreshNow goes on once the blocker is gone, stops the waits only under the lock, and refreshes main', async () => {
  const quiet = { waits: WAITS, blockers: [], snapshot: SNAP };
  const run = await refreshingNow({ looks: [{ ...quiet, blockers: [BLOCKER] }, quiet] });
  assert.equal(run.exit, 0, run.said);
  assert.equal(run.asked.length, 1);
  assert.deepEqual([run.asked[0].landed, run.asked[0].sha, run.asked[0].version, run.asked[0].stopsBefore], [true, MAIN, '1.0.0', 0]);
  assert.deepEqual(run.stopped, [WAITS.flatMap((wait) => wait.targets)]);
});

test('refreshNow tells each work session whose wait it stopped to run it again, and prints the rest', async () => {
  const run = await refreshingNow();
  assert.deepEqual(run.told, [{ number: 86, text: 'The installed copy was refreshed to 0123456 by merge-queue --refresh-copy, and the wait you ran from it was stopped for it: run it again: js-harness wait --pr 674' }]);
  assert.match(run.said, /stopped the wait 120 of JH 86 · rules and evals: js-harness wait --pr 674/);
  assert.match(run.said, /run again the wait of JH ORQ · orquestador F8: js-harness wait --notice-to orchestrator/);
  assert.match(run.said, /run again the wait of no one session \(no open session ran it\): js-harness wait --main-has 1c6b6c2/);
});

test('refreshNow tells a session of another project in its own channel, apart from one of the same number here', async () => {
  const run = await refreshingNow({ sessions: [{ ...SESSIONS[0], slug: 'D--js-harness' }, { id: 'c', title: 'JH 86 · other', slug: 'D--other', waits: ['js-harness wait --main-has 1c6b6c2'] }] });
  assert.deepEqual(run.told.map(({ number, slug }) => [number, slug]), [[86, 'D--js-harness'], [86, 'D--other']]);
  assert.match(run.told[1].text, /run it again: js-harness wait --main-has 1c6b6c2$/);
});

test('refreshNow refuses under the lock when work began meanwhile, or a wait outlives its stop, and tells what it stopped', async () => {
  const began = await refreshingNow({ looks: [{ waits: WAITS, blockers: [], snapshot: SNAP }, { waits: WAITS, blockers: [BLOCKER], snapshot: SNAP }] });
  assert.equal(began.exit, 75);
  assert.deepEqual([began.stopped.length, began.told.length], [0, 0]);
  const outlives = await refreshingNow({ running: [140] });
  assert.equal(outlives.exit, 75);
  assert.match(outlives.said, /why: 1 process of the stopped waits still runs: 140/);
  assert.match(outlives.told[0].text, /^The refresh of the installed copy to 0123456 ended with exit 75/);
});

// The verifier's cases (T5).
test('refreshNow reads the sessions before its last look, and names its lock by its own mode', async () => {
  const run = await refreshingNow();
  assert.deepEqual(run.order, ['look', 'sessions', 'look']);
  assert.equal(run.asked[0].command, 'merge-queue --refresh-copy');
});

test('refreshNow tells the sessions of the waits it meant to stop when the stop fails partway', async () => {
  const run = await refreshingNow({ stopFails: true });
  assert.equal(run.exit, 75);
  assert.match(run.said, /why: the waits could not be stopped \(powershell timed out\)/);
  assert.match(run.said, /may have stopped the wait 120 of JH 86 · rules and evals: js-harness wait --pr 674/);
  assert.match(run.told[0].text, /^The refresh of the installed copy to 0123456 ended with exit 75 \(merge-queue --refresh-copy says why\), and the wait you ran from it may have been stopped for it: run it again if it no longer runs: js-harness wait --pr 674$/);
});

test('refreshNow prints, and does not tell, a session whose project channel is not known', async () => {
  const run = await refreshingNow({ sessions: [{ ...SESSIONS[0], slug: null }] });
  assert.deepEqual(run.told, []);
  assert.match(run.said, /run again the wait of JH 86 · rules and evals \(its project's channel is not known\): js-harness wait --pr 674/);
});

test('refreshNow names a session with no title by its id', async () => {
  const run = await refreshingNow({ sessions: [{ id: 'z1', title: null, waits: ['js-harness wait --pr 674'] }] });
  assert.match(run.said, /stopped the wait 120 of the session z1 \(no title\): js-harness wait --pr 674/);
});

test('refreshNow tells the sessions whose waits it stopped when the refresh after it fails', async () => {
  const run = await refreshingNow({ code: REFRESH_FAILED });
  assert.equal(run.exit, REFRESH_FAILED);
  assert.match(run.told[0].text, /ended with exit 6/);
});
