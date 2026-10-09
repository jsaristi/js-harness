import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import {
  childEnv, codexArgs, codexReviewMain, parseEvents, patchKeys, quoteWindowsArg, REVIEW_EFFORT, REVIEW_MODEL, reviewEvidence, windowsCommandLine,
} from './codex-review.mjs';
import { checkCodexReviewDebt, checkCodexReviews } from './check.mjs';
import { createLeanHome, leanHomesDir } from './lib/codex-review-home.mjs';
import { planLines, reviewPlan } from './lib/codex-review-plan.mjs';
import { REVIEW_PART_PROMPT_VERSION, REVIEW_PROMPT_VERSION, reviewPrompt } from './lib/codex-review-prompt.mjs';
import { codexReviewRunsPath, readCodexReviewRuns, runFindings, runPart, runPrompt } from './lib/codex-review-runs.mjs';
import { appendCodexReview, codexReviewsPath, isValidCodexReview, readCodexReviews } from './lib/codex-reviews.mjs';

// Real git and a fake `codex` (injected spawns): no test ever calls a real Codex. The OS home is a
// temporary folder too (`run` injects it), with a fixture for a Codex login, so no test reads, links or
// stats anything of the machine's own Codex home or writes into its own state dir.
const LOGIN = 'FIXTURE login, not a token\n';
let configDir;
let osHome;
const made = [];
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-review-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  osHome = fakeHome().home;
});
after(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function tmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}

/** A fake OS home: `home`, with the Codex home `codexHome` in it and, unless `login` is `null`, a
 * fixture for the login in `auth`. `homes` is where the lean homes of that OS home are made. */
function fakeHome({ login = LOGIN } = {}) {
  const home = tmp('js-harness-codex-review-oshome-');
  const codexHome = path.join(home, '.codex');
  fs.mkdirSync(codexHome);
  const auth = path.join(codexHome, 'auth.json');
  if (login !== null) fs.writeFileSync(auth, login, 'utf8');
  return { home, codexHome, auth, homes: leanHomesDir(home), homedir: () => home };
}

/** The device and file id of `file`: two names with the same one are the same file. */
const fileId = (file) => {
  const { dev, ino } = fs.statSync(file, { bigint: true });
  return `${dev}:${ino}`;
};

/** The entries of `dir`, or none when it is not there. */
const listed = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);

/** A repo whose first commit (`base`) holds `before` and second (`head`) holds `after`, both maps
 * of file name to content. */
function makeRepoWith(before, after) {
  const root = tmp('js-harness-codex-review-');
  git(root, 'init');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  for (const [name, content] of Object.entries(before)) fs.writeFileSync(path.join(root, name), content, 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'one');
  const base = git(root, 'rev-parse', 'HEAD');
  for (const [name, content] of Object.entries(after)) fs.writeFileSync(path.join(root, name), content, 'utf8');
  git(root, 'commit', '-am', 'two');
  return { root, base, head: git(root, 'rev-parse', 'HEAD') };
}

/** A repo with two commits; `base` is the first, `head` the second. The patch is `-one` / `+two`. */
function makeRepo() {
  return makeRepoWith({ 'f.txt': 'one' }, { 'f.txt': 'two' });
}

/** Two files changed by the second commit. */
function makeTwoFileRepo() {
  return makeRepoWith(
    { 'a.txt': 'a1\na2\na3\n', 'b.txt': 'b1\nb2\nb3\n' },
    { 'a.txt': 'a1\nA2 changed\na3\n', 'b.txt': 'b1\nB2 changed\nb3\n' },
  );
}

/** What `git diff <base>` prints in `root`: the patch Codex is expected to have looked at. */
const patchOf = (root, base) => git(root, 'diff', '--no-color', '--no-ext-diff', base, 'HEAD');

// The JSONL events `codex exec --json` prints, as seen live (Codex 0.159.1).
const thread = { type: 'thread.started', thread_id: 't1' };
const turn = { type: 'turn.started' };
const done = { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } };
const cmd = (command, exitCode = 0, output = '') => ({
  type: 'item.completed',
  item: { id: 'c', type: 'command_execution', command, aggregated_output: output, exit_code: exitCode, status: exitCode === 0 ? 'completed' : 'failed' },
});
const msg = (text) => ({ type: 'item.completed', item: { id: 'm', type: 'agent_message', text } });
const itemError = (message) => ({ type: 'item.completed', item: { id: 'e', type: 'error', message } });
const jsonl = (...events) => `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;

/** The command as the review really ran it: through the Windows PowerShell 5.1 launcher. */
const diffCmd = (base) =>
  `"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content x; git diff ${base}; git ls-files"`;
const FINDINGS = '- [P2] Drops a record — bin/x.mjs:3\n  The last line is lost.';
/** A review that ran `git diff` over the range and got the whole patch back. */
const reviewed = (root, base) => jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), done);
const reviewedWith = (...commands) => jsonl(thread, turn, ...commands, msg(FINDINGS), done);

const PROBE_OK = { status: 0, stdout: 'codex-cli 0.159.1\n' };

/** A fake async child: `stdout` (a string or an array of chunks) is written, then it closes with
 * `status`/`signal`; `error` is emitted instead as a failed start; `hang` never ends. As a real child,
 * it has a `stdin` only when it was spawned with one (`piped`), and `received` is what was written there. */
function fakeChild({ stdout = '', status = 0, signal = null, error, hang = false, piped = false }) {
  const child = new EventEmitter();
  child.pid = 4242;
  child.stdout = new PassThrough();
  child.stdin = null;
  child.received = null;
  if (piped) {
    child.stdin = new PassThrough();
    child.received = { text: '', ended: false };
    child.stdin.setEncoding('utf8');
    child.stdin.on('data', (chunk) => {
      child.received.text += chunk;
    });
    child.stdin.on('end', () => {
      child.received.ended = true;
    });
  }
  child.kill = () => {};
  setImmediate(() => {
    if (error) return child.emit('error', error);
    if (hang) return undefined;
    child.stdout.once('end', () => setImmediate(() => child.emit('close', status, signal)));
    for (const chunk of Array.isArray(stdout) ? stdout : [stdout]) child.stdout.write(chunk);
    child.stdout.end();
    return undefined;
  });
  return child;
}

// What the review's sub-agent ends with when it found nothing, as one real lean review did (0.160.1).
const NO_FINDINGS = { findings: [], overall_correctness: 'patch is correct', overall_explanation: 'Nothing in the diff breaks existing behaviour.' };

/** The rollout file of the review sub-agent's thread, as lines: its first line names the sub-agent, and
 * its last message of the model is the answer `said`, an object (written as JSON) or a text taken as it is.
 * With `null` the model never answered. */
const reviewSession = (said = NO_FINDINGS) => [
  { type: 'session_meta', payload: { id: 'review', cli_version: '0.160.1', source: { subagent: 'review' } } },
  { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Review the code changes' }] } },
  ...(said === null ? [] : [{ type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: typeof said === 'string' ? said : JSON.stringify(said, null, 2) }] } }]),
];

const ANSWER_FILE = ['sessions', '2026', '10', '07', 'rollout-2026-10-07T05-34-59-review-answer.jsonl'];

// What makes a rollout file name the model its session ran on, and nothing more: the `turn_context` line of
// a turn, with the model a review runs on and no effort, so that a run at an injected effort is not one at
// another; and one `token_count` line, since the reader takes the model from a thread that made a request.
// That line holds no total, so the tokens of such a session stay unknown, as they were before it named a
// model: one request, in one thread, and nothing counted.
const RAN_ON_THE_MODEL = [
  { type: 'turn_context', payload: { cwd: 'D:\\x', approval_policy: 'never', model: REVIEW_MODEL, summary: 'auto' } },
  { type: 'event_msg', payload: { type: 'token_count', info: {}, rate_limits: null } },
];

/** Whether the folder `dir` holds a rollout file, at any depth, named as Codex names one. */
function holdsRollouts(dir) {
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir, { recursive: true }).some((name) => /^rollout-.*\.jsonl$/.test(path.basename(name)));
}

/** The deps for a run: real git and a fake `codex --version` probe through `spawn`, a fake async
 * review through `spawnAsync`, and a `killTree` that only records. `calls`, `probes` and `killed`
 * log what happened; each call holds its `child`, for what it was sent on stdin.
 *
 * As a real Codex does in a session that is not ephemeral, the fake leaves the rollout file of the
 * review's sub-agent in the home it is given: `said` is the answer in it (see `reviewSession`), a review
 * that found nothing unless a test says otherwise, and `false` writes no such file at all.
 *
 * That file names the model the session ran on, the one a review runs on, as every real lean session has:
 * a review whose file names none does not stand. It does so with the two lines the reader of a home asks
 * for (`RAN_ON_THE_MODEL`), unless the test has put rollout files of its own in that home before the
 * session starts (`spending`, the `threads` of `fakeCodexInParts`): those then say what ran, or do not. */
function fakeCodex(stdout, answer = {}, probe = PROBE_OK, said = NO_FINDINGS) {
  const calls = [];
  const probes = [];
  const killed = [];
  const spawn = (command, args, opts) => {
    if (command === 'git') return spawnSync(command, args, opts);
    probes.push({ command, args, opts });
    return probe;
  };
  const spawnAsync = (command, args, opts) => {
    const home = opts.env?.CODEX_HOME;
    // A Codex that never started wrote nothing.
    if (said !== false && !answer.error && typeof home === 'string' && fs.existsSync(home)) {
      const [first, ...rest] = reviewSession(said);
      const ran = holdsRollouts(path.join(home, 'sessions')) ? [] : RAN_ON_THE_MODEL;
      fs.mkdirSync(path.join(home, ...ANSWER_FILE.slice(0, -1)), { recursive: true });
      fs.writeFileSync(path.join(home, ...ANSWER_FILE), jsonl(first, ...ran, ...rest), 'utf8');
    }
    const child = fakeChild({ stdout, ...answer, piped: opts.stdio?.[0] === 'pipe' });
    calls.push({ command, args, opts, child });
    return child;
  };
  const lifetimes = [];
  const killTree = (child, lifetime) => {
    killed.push(child.pid);
    lifetimes.push(lifetime);
  };
  return { spawn, spawnAsync, killTree, calls, probes, killed, lifetimes };
}

const RUN_ID = '00000000-0000-4000-8000-000000000001';

/** Runs the command with output captured; `now`, the monotonic clock and the run's id are fixed so
 * the record is comparable, and the platform is fixed to linux unless a test says otherwise. The OS
 * home is the file's fake one unless a test gives its own `homedir`. `shown` is what the review passed
 * through to the user, `out` what the command itself logged. */
async function run(argv, extra = {}, env = {}) {
  const out = [];
  const err = [];
  const shown = [];
  const code = await codexReviewMain(argv, env, {
    now: () => new Date('2026-09-29T12:00:00.000Z'),
    monotonicNow: () => 0,
    randomUUID: () => RUN_ID,
    homedir: () => osHome,
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    write: (text) => shown.push(text),
    platform: 'linux',
    ...extra,
  });
  return { code, out: out.join('\n'), err: err.join('\n'), shown: shown.join('') };
}

/** What a run logged after its plan, as lines. Every run prints its plan first
 * (`./lib/codex-review-plan.mjs`), and the plan ends with the line of its estimate. */
function afterPlan(out) {
  const lines = out.split('\n');
  const estimate = lines.findIndex((line) => /^(Estimate|No estimate): /.test(line));
  assert.notEqual(estimate, -1, `no plan in:\n${out}`);
  return lines.slice(estimate + 1);
}

const reviewedRecord = (base, head) => ({
  schema: 'js-harness.codex-review/v1',
  base,
  head,
  reviewedAt: '2026-09-29T12:00:00.000Z',
  outcome: 'reviewed',
  run: RUN_ID,
});

/** An explicit skip: it launched nothing, so it names no run. */
const skippedRecord = (base, head, reason) => ({
  schema: 'js-harness.codex-review/v1',
  base,
  head,
  reviewedAt: '2026-09-29T12:00:00.000Z',
  outcome: 'unavailable',
  reason,
});

const wrote = (root) => fs.existsSync(codexReviewsPath(root));
const loggedRun = (root) => fs.existsSync(codexReviewRunsPath(root));

/** The one run line of `root`'s log. */
function onlyRun(root) {
  const runs = readCodexReviewRuns(root);
  assert.equal(runs.length, 1, `${runs.length} run lines`);
  return runs[0];
}

/** A function that answers each call with the next of `values`, then keeps giving the last. */
function ticking(...values) {
  let calls = 0;
  return () => values[Math.min(calls++, values.length - 1)];
}

/** A wall clock (`now`) that answers each call with the next of `times`. */
function clock(...times) {
  const next = ticking(...times);
  return () => new Date(next());
}

// --- the run ---

test('a review whose commands showed the whole patch appends a reviewed record with full commit ids and exits 0', async () => {
  const { root, base, head } = makeRepo();
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(result.code, 0);
  assert.match(base, /^[0-9a-f]{40}$/);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
  assert.match(result.out, /recorded/i);
  assert.ok(result.out.includes('codex-reviews.jsonl'));
});

test('the review text is shown, and each command is listed once with its exit code as it completes', async () => {
  const { root, base } = makeRepo();
  const long = `git diff ${base} --unified=${'9'.repeat(300)}`;
  const fake = fakeCodex(jsonl(thread, turn, cmd(long, 0, patchOf(root, base)), cmd('git status', 128), msg(FINDINGS), done));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 0);
  assert.ok(result.shown.includes(FINDINGS));
  assert.match(result.out, /Codex is reviewing/);
  assert.match(result.out, /exit 0 {2}git diff [0-9a-f]{40} --unified=9+/);
  assert.match(result.out, /exit 128 {2}git status/);
  assert.equal(result.out.match(/exit 128/g).length, 1, 'the list is not printed again at the end');
  assert.ok(!result.out.includes('9'.repeat(200)), 'a long command is truncated');
});

test('output that arrives in chunks split mid-line is still read line by line', async () => {
  const { root, base } = makeRepo();
  const all = reviewed(root, base);
  const cut = Math.floor(all.length / 3);
  const fake = fakeCodex([all.slice(0, cut), all.slice(cut, cut + 7), all.slice(cut + 7)]);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 0);
  assert.equal(result.out.match(/exit 0 {2}/g).length, 1);
});

test('how Codex is launched: as `codex`, with the resolved base, stdin ignored, a process group of its own, no shell off Windows; `--session lean` changes none of it', async () => {
  const { root, base } = makeRepo();
  for (const flags of [[], ['--session', 'lean']]) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', '--again', ...flags, '--cwd', root], fake);
    assert.equal(result.code, 0, flags.join(' '));
    assert.equal(fake.calls.length, 1);
    const { command, args, opts } = fake.calls[0];
    assert.equal(command, 'codex');
    // The resolved id, not the raw `HEAD~1`: the record and the review cover the same range.
    assert.deepEqual(args.slice(args.indexOf('--base'), args.indexOf('--base') + 2), ['--base', base], flags.join(' '));
    assert.equal(fs.realpathSync(opts.cwd), fs.realpathSync(root));
    assert.deepEqual(opts.stdio, ['ignore', 'pipe', 'inherit'], 'Codex would wait on an open stdin');
    assert.equal(opts.detached, true, 'its own process group, so the whole tree can be killed');
    assert.ok(!opts.shell, 'no shell off Windows');
  }
});

test('Codex runs from the repository root even when --cwd is a subdirectory', async () => {
  const { root, base } = makeRepo();
  fs.mkdirSync(path.join(root, 'sub'));
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', '--cwd', path.join(root, 'sub')], fake);
  assert.equal(result.code, 0);
  assert.equal(fs.realpathSync(fake.calls[0].opts.cwd), fs.realpathSync(root));
});

test('on Windows the .cmd shim runs through a shell as one quoted command line, not detached, with or without `--session lean`', async () => {
  const { root, base } = makeRepo();
  for (const flags of [[], ['--session', 'lean']]) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', '--again', ...flags, '--cwd', root], { ...fake, platform: 'win32' });
    const which = flags.join(' ') || 'no flag';
    assert.equal(result.code, 0, which);
    const { command, args, opts } = fake.calls[0];
    assert.equal(opts.shell, true, which);
    assert.ok(!opts.detached, which);
    assert.deepEqual(args, [], which);
    assert.equal(command, windowsCommandLine('codex', codexArgs(base, 'win32')), which);
    // A setting that holds quotes of its own goes through with them escaped, inside one quoted argument.
    assert.ok(command.includes(' -c "model_reasoning_effort=\\"high\\"" '), command);
    assert.ok(command.endsWith(` --base ${base}`), command);
  }
});

/** The one variable the review adds to Codex's environment, the home of the run, with no session named and
 * under `--session lean`, which is the same. Each is `[flags, what is added]`, for the tests of what else
 * the environment holds. */
const sessionEnvs = () => [[], ['--session', 'lean']].map((flags) => [flags, { CODEX_HOME: path.join(leanHomesDir(osHome), RUN_ID) }]);

test('on Windows the child PATH drops the WindowsApps entries and keeps the rest of the environment', async () => {
  const { root, base } = makeRepo();
  for (const [flags, added] of sessionEnvs()) {
    const fake = fakeCodex(reviewed(root, base));
    const env = { Path: 'C:\\Windows;C:\\Users\\x\\AppData\\Local\\Microsoft\\WindowsApps\\;D:\\bin', SystemRoot: 'C:\\Windows' };
    await run(['--base', 'HEAD~1', '--again', ...flags, '--cwd', root], { ...fake, platform: 'win32' }, env);
    assert.deepEqual(fake.calls[0].opts.env, { Path: 'C:\\Windows;D:\\bin', SystemRoot: 'C:\\Windows', ...added }, flags.join(' '));
    assert.equal(env.Path.includes('WindowsApps'), true, 'the caller\'s environment is not mutated');
  }
});

test('off Windows the environment is passed through untouched, but for the home of the run', async () => {
  const { root, base } = makeRepo();
  for (const [flags, added] of sessionEnvs()) {
    const fake = fakeCodex(reviewed(root, base));
    const env = { PATH: '/usr/bin:/x/Microsoft/WindowsApps' };
    await run(['--base', 'HEAD~1', '--again', ...flags, '--cwd', root], fake, env);
    assert.deepEqual(fake.calls[0].opts.env, { ...env, ...added }, flags.join(' '));
    assert.deepEqual(env, { PATH: '/usr/bin:/x/Microsoft/WindowsApps' }, 'the caller\'s environment is not mutated');
  }
});

test('a completed turn whose successful commands showed none of the patch writes nothing and says how much it saw', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewedWith(
    cmd('git status'),
    cmd('Get-Content f.txt', 0, 'two'),
    cmd('git diff --stat', 0, ' f.txt | 2 +-'),
  ));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 1);
  assert.equal(wrote(root), false);
  assert.match(result.err, /showed 0 of 2 changed lines of [0-9a-f]{7}\.\.HEAD; nothing was recorded/);
  assert.match(result.err, /-one/);
  assert.match(result.err, /\+two/);
  assert.match(result.err, /--unavailable <reason>/);
  assert.ok(result.shown.includes(FINDINGS), 'the review text is still shown');
});

test('the output of a failed command does not count, even when it holds the whole patch', async () => {
  const { root, base } = makeRepo();
  const patch = patchOf(root, base);
  for (const exitCode of [1, 128, -1, null]) {
    const fake = fakeCodex(reviewedWith(cmd(diffCmd(base), exitCode, patch), cmd('git status')));
    const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
    assert.equal(result.code, 1, String(exitCode));
    assert.equal(wrote(root), false);
    assert.match(result.err, /showed 0 of 2 changed lines/);
  }
});

test('a chained command that exits 0 without printing the patch is not evidence', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewedWith(cmd(`git diff ${base} --bad; git status`, 0, 'On branch main\nnothing to commit, working tree clean\n')));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 1);
  assert.equal(wrote(root), false);
  assert.match(result.err, /showed 0 of 2/);
});

test('a patch of only some of the files is partial coverage: nothing is recorded and the message shows N of M', async () => {
  const { root, base } = makeTwoFileRepo();
  const onlyA = git(root, 'diff', '--no-color', base, 'HEAD', '--', 'a.txt');
  const fake = fakeCodex(reviewedWith(cmd(`git diff ${base} -- a.txt`, 0, onlyA)));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 1);
  assert.equal(wrote(root), false);
  assert.match(result.err, /showed 2 of 4 changed lines of [0-9a-f]{7}\.\.HEAD/);
  assert.match(result.err, /\+B2 changed/, 'a missing line is named');
  assert.doesNotMatch(result.err, /\+A2 changed/, 'a seen line is not');
});

test('at most three missing lines are shown, each truncated', async () => {
  const lines = Array.from({ length: 6 }, (_, i) => `${i}${'x'.repeat(300)}\n`).join('');
  const { root } = makeRepoWith({ 'f.txt': 'start\n' }, { 'f.txt': `start\n${lines}` });
  const fake = fakeCodex(reviewedWith(cmd('git status')));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 1);
  assert.equal(result.err.match(/\+\dx+/g).length, 3);
  assert.ok(!result.err.includes('x'.repeat(200)), 'a long line is truncated');
});

test('output that carries the patch among other things (`--stat -p`) is enough', async () => {
  const { root, base, head } = makeTwoFileRepo();
  const both = git(root, 'diff', '--no-color', '--stat', '-p', base, 'HEAD');
  assert.match(both, /a\.txt +\| 2 /);
  const fake = fakeCodex(reviewedWith(cmd(`git diff --stat -p ${base}`, 0, both)));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 0);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
});

test('the patch may be spread over several commands: the outputs are pooled', async () => {
  const { root, base, head } = makeTwoFileRepo();
  const a = git(root, 'diff', '--no-color', base, 'HEAD', '--', 'a.txt');
  const b = git(root, 'diff', '--no-color', base, 'HEAD', '--', 'b.txt');
  const fake = fakeCodex(reviewedWith(cmd('git diff -- a.txt', 0, a), cmd('git status'), cmd('git diff -- b.txt', 0, b)));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 0);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
});

test('non-ASCII changed lines still match when the shell stripped or re-encoded them', async () => {
  const { root, base } = makeRepoWith({ 'n.txt': 'plain\n' }, { 'n.txt': 'plain\nit\u2019s done\u2026\ncaf\u00e9 ok\n' });
  const patch = patchOf(root, base);
  assert.ok(patch.includes('\u2019'));
  const outputs = {
    stripped: patch.replace(/[^\x20-\x7e\r\n]/g, ''),
    // What PowerShell 5.1 does to UTF-8: each character comes out as several non-ASCII ones.
    mojibake: patch.replace(/\u2019/g, '\u00e2\u20ac\u2122').replace(/\u2026/g, '\u00e2\u20ac\u00a6').replace(/\u00e9/g, '\u00c3\u00a9'),
  };
  for (const [name, output] of Object.entries(outputs)) {
    const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewedWith(cmd('git diff', 0, output))));
    assert.equal(result.code, 0, name);
  }
});

test('CRLF line endings in the output do not matter', async () => {
  const { root, base } = makeTwoFileRepo();
  const crlf = patchOf(root, base).replace(/\n/g, '\r\n');
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewedWith(cmd('git diff', 0, crlf))));
  assert.equal(result.code, 0);
});

test('a range that changes only blank lines has nothing to match, so one successful command is enough', async () => {
  const { root } = makeRepoWith({ 'b.txt': 'a\nb\n' }, { 'b.txt': 'a\n\nb\n' });
  const ok = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewedWith(cmd('git status'))));
  assert.equal(ok.code, 0);
  for (const commands of [[], [cmd('git status', 1)]]) {
    const result = await run(['--base', 'HEAD~1', '--again', '--cwd', root], fakeCodex(reviewedWith(...commands)));
    assert.equal(result.code, 1);
    assert.match(result.err, /ran no successful command/);
    assert.doesNotMatch(result.err, /showed/);
  }
  assert.equal(readCodexReviews(root).length, 1);
});

test('a completed turn with no command at all writes nothing', async () => {
  const { root } = makeRepo();
  const fake = fakeCodex(jsonl(thread, turn, msg('No actionable regression was found.'), done));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 1);
  assert.equal(wrote(root), false);
  assert.match(result.err, /Codex ran no commands/);
});

test('a completed turn that ended without a review message writes nothing', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), done));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 1);
  assert.equal(wrote(root), false);
  assert.match(result.err, /without a review message/);
});

test('our own diff is computed from the resolved base to HEAD, with room for a large patch', async () => {
  const { root, base } = makeRepo();
  const calls = [];
  const fake = fakeCodex(reviewed(root, base));
  const spawn = (command, args, opts) => {
    if (command === 'git') calls.push({ args, opts });
    return fake.spawn(command, args, opts);
  };
  await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, spawn });
  const diff = calls.find((call) => call.args[0] === 'diff');
  assert.deepEqual(diff.args, ['diff', '--no-color', '--no-ext-diff', base, 'HEAD']);
  assert.equal(fs.realpathSync(diff.opts.cwd), fs.realpathSync(root));
  assert.ok(diff.opts.maxBuffer > 1024 * 1024, `maxBuffer ${diff.opts.maxBuffer}`);
});

test('a failed git diff refuses to start the review: nothing written, Codex not spawned', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const spawn = (command, args, opts) =>
    command === 'git' && args[0] === 'diff' ? { status: 128, stdout: '', stderr: 'fatal: bad object' } : fake.spawn(command, args, opts);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, spawn });
  assert.equal(result.code, 1);
  assert.match(result.err, /git diff/);
  assert.equal(wrote(root), false);
  assert.equal(fake.calls.length, 0);
  assert.equal(fake.probes.length, 0);
});

test('a failed turn shows its error, writes nothing and exits 1 even when Codex exited 0', async () => {
  const { root, base } = makeRepo();
  const failed = jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), { type: 'turn.failed', error: { message: 'The model is not supported with a ChatGPT account.' } });
  for (const status of [0, 1]) {
    const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(failed, { status }));
    assert.equal(result.code, 1);
    assert.equal(wrote(root), false);
    assert.match(result.err, /did not complete/i);
    assert.match(result.err, /model is not supported/);
    assert.match(result.err, /--unavailable <reason>/);
  }
});

test('a non-zero Codex exit is returned as is, even after a turn that showed the patch', async () => {
  const { root, base } = makeRepo();
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base), { status: 7 }));
  assert.equal(result.code, 7);
  assert.equal(wrote(root), false);
  assert.match(result.err, /did not complete.*exited 7/is);
});

test('no turn.completed means the review did not complete', async () => {
  const { root, base } = makeRepo();
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS))));
  assert.equal(result.code, 1);
  assert.equal(wrote(root), false);
  assert.match(result.err, /did not complete/i);
});

test('a signal, or a start that fails, writes nothing and returns 1', async () => {
  const { root } = makeRepo();
  const enoent = Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' });
  for (const answer of [{ status: null, signal: 'SIGTERM' }, { error: new Error('boom') }, { error: enoent }]) {
    const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex('', answer));
    assert.equal(result.code, 1);
    assert.equal(wrote(root), false);
    assert.match(result.err, /did not complete/i);
    if (answer.error) assert.match(result.err, /could not start it/);
  }
});

test('a codex CLI that does not answer `--version` names the install, the login and the skip; the review is not spawned', async () => {
  const { root, base } = makeRepo();
  const notFound = Object.assign(new Error('spawnSync codex ENOENT'), { code: 'ENOENT' });
  // On Windows the shell answers for a missing command: exit 1 (or 9009) and nothing on stdout.
  const probes = [
    ['linux', { status: null, error: notFound }],
    ['linux', { status: 0, stdout: 'not a version\n' }],
    ['linux', { status: null, signal: 'SIGTERM', error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) }],
    ['win32', { status: 1, stdout: '' }],
    ['win32', { status: 9009, stdout: '' }],
  ];
  for (const [platform, probe] of probes) {
    const fake = fakeCodex(reviewed(root, base), {}, probe);
    const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, platform });
    assert.equal(result.code, 1, `${platform} ${probe.status}`);
    assert.match(result.err, /npm i -g @openai\/codex/);
    assert.match(result.err, /codex login/);
    assert.match(result.err, /--unavailable <reason>/);
    assert.equal(wrote(root), false);
    assert.equal(fake.calls.length, 0, 'the review is not spawned');
  }
});

test('the `codex --version` probe goes through the same launch path and environment as the review', async () => {
  const { root, base } = makeRepo();
  const linux = fakeCodex(reviewed(root, base));
  await run(['--base', 'HEAD~1', '--cwd', root], linux, { PATH: '/x' });
  assert.equal(linux.probes.length, 1);
  assert.equal(linux.probes[0].command, 'codex');
  assert.deepEqual(linux.probes[0].args, ['--version']);
  assert.deepEqual(linux.probes[0].opts.env, { PATH: '/x' });
  assert.deepEqual(linux.probes[0].opts.stdio, ['ignore', 'pipe', 'pipe']);
  assert.equal(linux.probes[0].opts.timeout, 15000);
  assert.ok(!linux.probes[0].opts.shell);

  const win = fakeCodex(reviewed(root, base));
  const env = { Path: 'C:\\Windows;C:\\Users\\x\\AppData\\Local\\Microsoft\\WindowsApps' };
  await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...win, platform: 'win32' }, env);
  assert.equal(win.probes[0].command, windowsCommandLine('codex', ['--version']));
  assert.deepEqual(win.probes[0].args, []);
  assert.equal(win.probes[0].opts.shell, true);
  assert.deepEqual(win.probes[0].opts.env, { Path: 'C:\\Windows' });
});

test('no probe is run for --unavailable, or when the tree is dirty', async () => {
  const { root } = makeRepo();
  const skipped = fakeCodex('');
  await run(['--base', 'HEAD~1', '--unavailable', 'x', '--cwd', root], skipped);
  assert.equal(skipped.probes.length, 0);
  fs.writeFileSync(path.join(root, 'f.txt'), 'dirty', 'utf8');
  const dirty = fakeCodex('');
  await run(['--base', 'HEAD~1', '--cwd', root], dirty);
  assert.equal(dirty.probes.length, 0);
});

test('an exit 1 with no events after a good probe is a failed review, not a missing CLI', async () => {
  const { root } = makeRepo();
  for (const platform of ['linux', 'win32']) {
    const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex('', { status: 1 }), platform });
    assert.equal(result.code, 1);
    assert.doesNotMatch(result.err, /npm i -g/);
    assert.match(result.err, /did not complete.*exited 1/is);
  }
});

test('Codex\'s configuration warnings are passed on as warnings and do not fail the review', async () => {
  const { root, base, head } = makeRepo();
  const fake = fakeCodex(jsonl(thread, turn, itemError('Codex is ignoring 1 unrecognized configuration setting'), cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), done));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 0);
  assert.match(result.err, /ignoring 1 unrecognized configuration setting/);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
});

test('junk lines in the JSONL are ignored', async () => {
  const { root, base } = makeRepo();
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(`Reading prompt from stdin...\n\n${reviewed(root, base)}{"truncated":\n`));
  assert.equal(result.code, 0);
});

// --- a stall cannot outlive the bound ---

test('a review that never ends is stopped at the timeout: the tree is killed and the run reports it', async () => {
  const { root } = makeRepo();
  const fake = fakeCodex('', { hang: true });
  let child;
  let unrefed = false;
  const spawnAsync = (...args) => {
    child = fake.spawnAsync(...args);
    child.unref = () => { unrefed = true; };
    return child;
  };
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, spawnAsync, timeoutMs: 30 });
  assert.equal(result.code, 1);
  assert.deepEqual(fake.killed, [4242]);
  assert.equal(child.stdout.destroyed, true, 'the pipe is released, so it cannot keep the process alive');
  assert.equal(unrefed, true, 'the child no longer holds the event loop');
  assert.match(result.err, /ran past 30 minutes/);
  assert.doesNotMatch(result.err, /could not start/);
  assert.equal(wrote(root), false);
});

test('a base that moved past the fork point: Codex reviews from the merge-base, and that patch is the evidence', async () => {
  const { root, base: fork } = makeRepo();
  const head = git(root, 'rev-parse', 'HEAD');
  // `main` moves on from the fork point with a commit the branch does not have.
  git(root, 'checkout', '-q', '-b', 'main-ahead', fork);
  fs.writeFileSync(path.join(root, 'other.txt'), 'only on main', 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'main moves on');
  const movedBase = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '-q', head);
  const fake = fakeCodex(reviewed(root, fork));
  const result = await run(['--base', movedBase, '--cwd', root], fake);
  assert.equal(result.code, 0, result.err);
  const args = fake.calls[0].args.join(' ');
  assert.ok(args.includes(`--base ${fork}`), `codex reviews from the merge-base: ${args}`);
  const [record] = readCodexReviews(root);
  assert.equal(record.base, movedBase, 'the record keeps the base it was asked for');
  const logged = onlyRun(root);
  assert.equal(logged.base, movedBase, 'the run line keeps the base it was asked for');
  assert.equal(logged.from, fork, 'and says where Codex reviewed from');
  assert.equal(logged.head, head);
});

test('Ctrl-C during the review kills the tree first, so Codex is not left running; nothing is written', async () => {
  const { root } = makeRepo();
  const fake = fakeCodex('', { hang: true });
  const signals = new EventEmitter();
  const pending = run(['--base', 'HEAD~1', '--cwd', root], { ...fake, signals });
  while (fake.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));
  signals.emit('SIGINT');
  const result = await pending;
  assert.equal(result.code, 1);
  assert.deepEqual(fake.killed, [4242]);
  assert.match(result.err, /interrupted/);
  assert.equal(signals.listenerCount('SIGINT') + signals.listenerCount('SIGTERM'), 0, 'handlers removed');
  assert.equal(wrote(root), false);
});

test('output past the cap kills the tree and is named as an overflow, not a failed start', async () => {
  const { root } = makeRepo();
  const fake = fakeCodex(['x'.repeat(20), 'y'.repeat(20)]);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, maxBuffer: 30 });
  assert.equal(result.code, 1);
  assert.deepEqual(fake.killed, [4242]);
  assert.match(result.err, /output exceeded/);
  assert.doesNotMatch(result.err, /could not start/);
  assert.equal(wrote(root), false);
});

test('a normal run kills nothing', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, timeoutMs: 60000 });
  assert.deepEqual(fake.killed, []);
});

// The kill itself (a snapshot, a selection by pid and creation time, one process at a time) is proven in
// `lib/process-tree.test.mjs`. Here: the review hands it what it needs, and says so when it could not kill.
test('the tree kill is told when the review was spawned, so that a parent pid alone never names what to kill', async () => {
  const { root } = makeRepo();
  const fake = fakeCodex('', { hang: true });
  const before = Date.now();
  await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, timeoutMs: 30 });
  assert.equal(fake.lifetimes.length, 1);
  assert.ok(fake.lifetimes[0].startedAt >= before && fake.lifetimes[0].startedAt <= Date.now());
  assert.equal('exitedAt' in fake.lifetimes[0], false, 'it was running when it was killed');
});

test('a tree kill that fails is said in the report of the stopped run, not swallowed', async () => {
  const { root } = makeRepo();
  const fake = fakeCodex('', { hang: true });
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, timeoutMs: 30, killTree: () => { throw new Error('the process snapshot failed (exit 1): CIM is down'); } });
  assert.equal(result.code, 1);
  assert.match(result.err, /ran past 30 minutes/);
  assert.match(result.err, /process tree could not be killed \(the process snapshot failed.*CIM is down\).*may still be running/);
});

// --- what the run refuses or skips ---

test('uncommitted changes to tracked files refuse the review: nothing written, Codex not spawned', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  fs.writeFileSync(path.join(root, 'f.txt'), 'edited but not committed', 'utf8');
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 1);
  assert.match(result.err, /base\.\.HEAD/);
  assert.match(result.err, /commit or stash/i);
  assert.equal(wrote(root), false);
  assert.equal(fake.calls.length, 0);
});

test('staged but uncommitted changes refuse the review too', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  fs.writeFileSync(path.join(root, 'f.txt'), 'staged only', 'utf8');
  git(root, 'add', 'f.txt');
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 1);
  assert.equal(fake.calls.length, 0);
});

test('an untracked file does not block the review', async () => {
  const { root, base } = makeRepo();
  fs.writeFileSync(path.join(root, 'scratch.txt'), 'not tracked', 'utf8');
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(result.code, 0);
});

test('a failed git status refuses the review instead of reading as a clean tree', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const spawn = (command, args, opts) =>
    command === 'git' && args[0] === 'status' ? { status: 128, stdout: '', stderr: 'fatal: broken index' } : spawnSync(command, args, opts);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, spawn });
  assert.equal(result.code, 1);
  assert.match(result.err, /git status/);
  assert.equal(wrote(root), false);
  assert.equal(fake.calls.length, 0);
});

test('--unavailable is recorded even with uncommitted changes, since it reviews nothing', async () => {
  const { root } = makeRepo();
  fs.writeFileSync(path.join(root, 'f.txt'), 'edited but not committed', 'utf8');
  const result = await run(['--base', 'HEAD~1', '--unavailable', 'model rejected', '--cwd', root]);
  assert.equal(result.code, 0);
  assert.equal(readCodexReviews(root).length, 1);
});

test('--unavailable records the skip with its reason and spawns no Codex', async () => {
  const { root, base, head } = makeRepo();
  const spawned = [];
  const spawn = (command, args, opts) => {
    spawned.push(command);
    return spawnSync(command, args, opts);
  };
  const fake = fakeCodex('');
  const result = await run(['--base', 'HEAD~1', '--unavailable', '  model rejected  ', '--cwd', root], { ...fake, spawn });
  assert.equal(result.code, 0);
  assert.ok(spawned.length > 0 && spawned.every((command) => command === 'git'));
  assert.equal(fake.calls.length, 0);
  assert.deepEqual(readCodexReviews(root), [skippedRecord(base, head, 'model rejected')]);
  assert.match(result.out, /unavailable/i);
});

test('records accumulate, one line each', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  assert.equal((await run(['--base', 'HEAD~1', '--cwd', root], fake)).code, 0);
  assert.equal((await run(['--base', 'HEAD~1', '--again', '--unavailable', 'later', '--cwd', root], fake)).code, 0);
  assert.deepEqual(readCodexReviews(root).map((r) => r.outcome), ['reviewed', 'unavailable']);
});

test('an unknown base is an error, and nothing is written or spawned', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'no-such-rev', '--cwd', root], fake);
  assert.equal(result.code, 1);
  assert.match(result.err, /no-such-rev/);
  assert.equal(wrote(root), false);
  assert.equal(fake.calls.length, 0);
});

test('outside a git repository it is a clear error, exit 1', async () => {
  const dir = tmp('js-harness-codex-review-nongit-');
  const result = await run(['--base', 'main', '--cwd', dir]);
  assert.equal(result.code, 1);
  assert.match(result.err, /not a git repository/i);
});

test('a flag with no value exits 2 with usage and does nothing', async () => {
  const { root } = makeRepo();
  for (const argv of [
    ['--base'],
    ['--base', '--cwd', root],
    ['--base', 'HEAD~1', '--unavailable'],
    ['--base', 'HEAD~1', '--cwd'],
    ['--base', 'HEAD~1', '--home'],
    ['--base', 'HEAD~1', '--session'],
    ['--base', 'HEAD~1', '--session', '--cwd', root],
  ]) {
    const result = await run(argv);
    assert.equal(result.code, 2, argv.join(' '));
    assert.match(result.err, /Usage: js-harness codex-review/);
  }
  assert.equal(wrote(root), false);
});

test('--base is required, and an empty --unavailable reason is a usage error', async () => {
  const { root } = makeRepo();
  const missing = await run(['--cwd', root]);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /--base/);
  const empty = await run(['--base', 'HEAD~1', '--unavailable', '   ', '--cwd', root]);
  assert.equal(empty.code, 2);
  assert.match(empty.err, /reason/);
  assert.equal(wrote(root), false);
});

// --- the session: one, the lean one. `--session lean` is still read, and `--session current` was removed on 2026-10-08 ---

/** The argv of a review, token by token: what the command hands Codex for a review from `base`, with no
 * session named and under `--session lean`, which is the same. It is not `--ephemeral`, and on Windows
 * alone it names the sandbox its commands run in. */
const leanArgv = (base, platform = 'linux') => [
  'exec', 'review', '--json',
  '--ignore-user-config', '--ignore-rules',
  '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
  '-m', 'gpt-6.1-sol',
  '-c', 'model_reasoning_effort="high"',
  '-c', 'sandbox_mode=read-only',
  '-c', 'approval_policy=never',
  ...(platform === 'win32' ? ['-c', 'windows.sandbox="unelevated"'] : []),
  '-c', 'skills.include_instructions=false',
  '--base', base,
];

/** The model and the effort Codex is handed in `argv`: every `-m` and every `model_reasoning_effort`
 * setting, so that a second one, of another value, is seen. */
const modelAndEffort = (argv) => ({
  models: argv.filter((_, at) => argv[at - 1] === '-m'),
  efforts: argv.filter((token, at) => argv[at - 1] === '-c' && token.startsWith('model_reasoning_effort=')),
});

test('the model and the effort of a review are named in one place: gpt-6.1-sol at high', () => {
  assert.equal(REVIEW_MODEL, 'gpt-6.1-sol');
  assert.equal(REVIEW_EFFORT, 'high');
});

test('codexArgs: there is one argv, the lean one, and no session to choose: the platform comes right after the base', () => {
  const base = 'a'.repeat(40);
  assert.deepEqual(codexArgs(base), codexArgs(base, process.platform), 'with no platform named, the one it runs on');
  assert.deepEqual(codexArgs(base, 'linux'), leanArgv(base));
  assert.deepEqual(codexArgs(base, 'win32'), leanArgv(base, 'win32'));
  for (const platform of ['win32', 'linux', 'darwin']) {
    const argv = codexArgs(base, platform);
    assert.ok(!argv.some((token) => token.includes('openai-bundled')), `${platform}: plugins are off wholesale, not one by one`);
    // What the session that is gone carried, and this one must not: it is read back from its own home.
    assert.equal(argv.includes('--ephemeral'), false, platform);
    assert.equal(argv.includes('--ignore-user-config'), true, platform);
  }
  // A call written for the signature that took a session is not taken for a platform and a prompt in silence.
  for (const session of ['lean', 'current']) assert.throws(() => codexArgs(base, session, 'linux'), /Unknown prompt "linux"/, session);
});

test('codexArgs: on every platform and under either prompt it names one model and one effort: gpt-6.1-sol at high', () => {
  const base = 'a'.repeat(40);
  const launches = ['win32', 'linux', 'darwin'].flatMap((platform) => [codexArgs(base, platform), codexArgs(base, platform, 'own')]);
  assert.equal(launches.length, 6);
  for (const argv of launches) assert.deepEqual(modelAndEffort(argv), { models: ['gpt-6.1-sol'], efforts: ['model_reasoning_effort="high"'] }, argv.join(' '));
});

test('codexArgs: the lean argv, token by token, on Windows and elsewhere', () => {
  const base = 'a'.repeat(40);
  const lean = [
    'exec', 'review', '--json',
    '--ignore-user-config', '--ignore-rules',
    '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
    '-m', 'gpt-6.1-sol',
    '-c', 'model_reasoning_effort="high"',
    '-c', 'sandbox_mode=read-only',
    '-c', 'approval_policy=never',
    '-c', 'skills.include_instructions=false',
    '--base', base,
  ];
  assert.deepEqual(codexArgs(base, 'linux'), lean);
  assert.deepEqual(codexArgs(base, 'darwin'), lean);
  // On Windows a read-only session that asks nobody refuses every shell command unless it has a sandbox
  // to run them in, and the lean session ignores the config file that names the user's.
  assert.deepEqual(codexArgs(base, 'win32'), [
    'exec', 'review', '--json',
    '--ignore-user-config', '--ignore-rules',
    '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
    '-m', 'gpt-6.1-sol',
    '-c', 'model_reasoning_effort="high"',
    '-c', 'sandbox_mode=read-only',
    '-c', 'approval_policy=never',
    '-c', 'windows.sandbox="unelevated"',
    '-c', 'skills.include_instructions=false',
    '--base', base,
  ]);
  // Its home is thrown away after the run, and only a session that is not ephemeral writes its tokens there.
  for (const platform of ['win32', 'linux']) assert.equal(codexArgs(base, platform).includes('--ephemeral'), false, platform);
});

test('--session lean spawns Codex with the lean argv, from the repository root, in the same environment but for its home', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const env = { PATH: '/x', HOME: '/home/x' };
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fake, env);
  assert.equal(result.code, 0, result.err);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].command, 'codex');
  assert.deepEqual(fake.calls[0].args, leanArgv(base));
  assert.equal(fs.realpathSync(fake.calls[0].opts.cwd), fs.realpathSync(root));
  // A home of its own, named after the run, and nothing else added or taken away.
  assert.deepEqual(fake.calls[0].opts.env, { ...env, CODEX_HOME: path.join(leanHomesDir(osHome), RUN_ID) });
  assert.deepEqual(env, { PATH: '/x', HOME: '/home/x' }, 'the caller\'s environment is not mutated');
  // The probe asks only for the version, which no home changes, so it runs before one is made.
  assert.deepEqual(fake.probes[0].args, ['--version']);
  assert.deepEqual(fake.probes[0].opts.env, env);
});

test('without --session the review runs in the lean session: the lean argv, in a Codex home of the run\'s own, and the run line says so', async () => {
  const { root, base, head } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const env = { PATH: '/x', HOME: '/home/x' };
  const seen = [];
  const result = await run(['--base', 'HEAD~1', '--cwd', root], watching(fake, (home) => seen.push(fs.existsSync(path.join(home, 'auth.json')))), env);
  assert.equal(result.code, 0, result.err);
  assert.equal(fake.calls.length, 1);
  assert.deepEqual(fake.calls[0].args, leanArgv(base));
  // The home of the run, with the login in it while Codex runs, and gone once it has ended.
  assert.deepEqual(fake.calls[0].opts.env, { ...env, CODEX_HOME: path.join(leanHomesDir(osHome), RUN_ID) });
  assert.deepEqual(seen, [true]);
  assert.deepEqual(listed(leanHomesDir(osHome)), []);
  assert.equal(afterPlan(result.out)[0], `Codex is reviewing ${base.slice(0, 7)}..${head.slice(0, 7)} with the lean session (gpt-6.1-sol, high); this can take several minutes.`);
  const line = onlyRun(root);
  assert.deepEqual([line.outcome, line.session, line.model, line.effort, line.prompt], ['reviewed', 'lean', 'gpt-6.1-sol', 'high', 'codex']);
});

test('`--session lean` is still read and means what no flag means: the same argv, the same Codex home of the run made and removed, the same lines printed, the same run line', async () => {
  for (const platform of ['linux', 'win32']) {
    const { root, base } = makeRepo();
    const mine = fakeHome();
    const state = tmp('js-harness-codex-review-state-');
    /** One run of the command over the same range, in everything a session could change: what Codex was
     * launched with and in, what its home held while it ran, what was left of it, and what was printed. */
    const once = async (flags) => {
      const during = {};
      const fake = watching(fakeCodex(reviewed(root, base)), (home) => Object.assign(during, { home, entries: listed(home), links: fs.statSync(mine.auth).nlink }));
      const result = await run(['--base', 'HEAD~1', '--again', ...flags, '--home', state, '--cwd', root], { ...fake, platform, homedir: mine.homedir }, { PATH: '/x' });
      const { command, args, opts } = fake.calls[0];
      return { code: result.code, err: result.err, out: result.out, shown: result.shown, command, args, env: opts.env, stdio: opts.stdio, shell: opts.shell, during, left: [listed(state), fs.statSync(mine.auth).nlink] };
    };
    const plain = await once([]);
    const named = await once(['--session', 'lean']);
    assert.equal(plain.code, 0, plain.err);
    assert.deepEqual(named, plain, platform);
    const [first, second] = readCodexReviewRuns(root);
    assert.deepEqual(second, first, `${platform}: the run line, to the field`);
    // And what they share is the lean session: its argv, a home of the run's own holding the login alone, gone afterwards.
    if (platform === 'win32') assert.equal(plain.command, windowsCommandLine('codex', leanArgv(base, 'win32')));
    else assert.deepEqual(plain.args, leanArgv(base));
    assert.deepEqual(plain.during, { home: path.join(leanHomesDir(state), RUN_ID), entries: ['auth.json'], links: 2 }, platform);
    assert.equal(plain.env.CODEX_HOME, plain.during.home, platform);
    assert.deepEqual(plain.left, [[], 1], platform);
    assert.equal(first.session, 'lean', platform);
  }
  // Said twice, or beside the flags of a review, it is still the one session.
  const { root, base } = makeRepo();
  const twice = fakeCodex(reviewed(root, base));
  assert.equal((await run(['--base', 'HEAD~1', '--session', 'lean', '--session', 'lean', '--prompt', 'codex', '--part-lines', '400', '--cwd', root], twice)).code, 0);
  assert.deepEqual(twice.calls[0].args, leanArgv(base));
});

// What `--session current` answers since the session was removed: the reason, and what a machine where the
// lean session cannot run does instead. The usage follows it, as it follows every flag given wrong.
const SESSION_REMOVED =
  '`--session current` was removed on 2026-10-08: a review runs only on gpt-6.1-sol at high effort, and the model that session ran on could not be verified. ' +
  'On a machine where the lean session cannot run, record an explicit skip with `js-harness codex-review --base <rev> --unavailable <reason>`.';

test('--session current is a usage error since the session was removed: exit 2 with the reason and what to do instead, and nothing is probed, launched, made, logged or recorded', async () => {
  const doc = featureDoc();
  const cases = [
    ['--session', 'current'],
    ['--session', 'current', '--unavailable', 'model rejected'],
    ['--unavailable', 'model rejected', '--session', 'current'],
    // Beside the flags it once refused, and beside the session that is left, in either order.
    ['--session', 'current', '--keep-home'],
    ['--prompt', 'own', '--doc', doc, '--session', 'current'],
    ['--part-lines', '400', '--session', 'current'],
    ['--session', 'lean', '--session', 'current'],
    ['--session', 'current', '--session', 'lean'],
  ];
  for (const flags of cases) {
    const { root, base } = makeRepo();
    const mine = fakeHome();
    const state = tmp('js-harness-codex-review-state-');
    const never = () => {
      throw new Error('a flag given wrong makes no Codex home');
    };
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', ...flags, '--home', state, '--cwd', root], { ...fake, homedir: mine.homedir, createLeanHome: never });
    const which = flags.join(' ');
    assert.equal(result.code, 2, which);
    assert.equal(result.err.split('\n')[0], SESSION_REMOVED, which);
    assert.match(result.err, /\n\nUsage: js-harness codex-review --base <rev> /, which);
    assert.equal(result.out, '', which);
    assert.equal(fake.calls.length, 0, `${which}: nothing was launched`);
    assert.equal(fake.probes.length, 0, `${which}: nor probed`);
    assert.equal(wrote(root), false, `${which}: no record, not even of the skip that was asked for`);
    assert.equal(loggedRun(root), false, which);
    assert.deepEqual(listed(state), [], `${which}: no home was made`);
    assert.equal(fs.statSync(mine.auth).nlink, 1, which);
  }
  // The message names the model and the effort the command fixes, not a copy of them.
  assert.ok(SESSION_REMOVED.includes(`on ${REVIEW_MODEL} at ${REVIEW_EFFORT} effort`));
});

// The last line of the usage: a run pays for no review twice, and the flag that reviews again on purpose.
const STARTS_WHERE_RECORDS_END =
  'A run starts where the Codex review records end: commits a record covers are not reviewed again, and a range they cover whole starts nothing; --again takes the range as it was given.';

test('the usage names no session: its flags are those of a review, and its second line says what a review loads and that it runs on gpt-6.1-sol at high effort', async () => {
  const result = await run(['--cwd', '.']);
  assert.equal(result.code, 2);
  const [, , usage, loads, ...more] = result.err.split('\n');
  assert.equal(usage, 'Usage: js-harness codex-review --base <rev> [--plan] [--again] [--prompt <codex|own>] [--doc <feature document>] [--part-lines <n>] [--max-parts <n>] [--keep-home] [--unavailable <reason>] [--cwd <path>] [--home <path>]');
  assert.equal(
    loads,
    `Codex gets the diff, the repository to read and the project's AGENTS.md, and none of your Codex configuration; the review runs on ${REVIEW_MODEL} at ${REVIEW_EFFORT} effort, which the command fixes.`,
  );
  // What a person has to know of the cost before starting: how to see it, and that a large run is not started by itself.
  // And what a review reads, with how a project says what it does not; and that it reviews nothing twice.
  assert.deepEqual(more, [
    '--plan prints what the run would start and what it is estimated to send, and starts nothing; a run of more than 6 parts is not started without --max-parts <n>.',
    'A review reads code: Markdown files and the paths a .gitattributes marks `-codex-review` are left out of it, and the plan says how many.',
    STARTS_WHERE_RECORDS_END,
  ]);
  assert.ok(loads.includes('on gpt-6.1-sol at high effort'), loads);
  // Nothing in it names a session to choose, nor says that a review can run on a model of the user's choosing.
  assert.doesNotMatch(result.err, /--session|current|medium|own model|your own Codex configuration loaded/);
});

test('a `--session` that is not `lean` exits 2 with usage and does nothing', async () => {
  const { root, base } = makeRepo();
  for (const session of ['fast', 'LEAN', 'lean ', 'default', '', 'Current', 'current ']) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', '--session', session, '--cwd', root], fake);
    assert.equal(result.code, 2, JSON.stringify(session));
    assert.equal(result.err.split('\n')[0], '--session must be `lean`: a review runs in one session, and the flag is still read only for the command lines that named it', JSON.stringify(session));
    assert.match(result.err, /\n\nUsage: js-harness codex-review --base <rev> /);
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.probes.length, 0);
  }
  // A flag with no value is what it is for every flag.
  const bare = await run(['--base', 'HEAD~1', '--cwd', root, '--session'], fakeCodex(reviewed(root, base)));
  assert.equal(bare.code, 2);
  assert.match(bare.err, /^--session requires a value/);
  assert.equal(wrote(root), false);
  assert.equal(loggedRun(root), false);
});

test('on Windows the lean argv goes through the shell as one quoted line: no token is refused', async () => {
  const { root, base } = makeRepo();
  assert.doesNotThrow(() => leanArgv(base, 'win32').map(quoteWindowsArg));
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, platform: 'win32' });
  assert.equal(result.code, 0, result.err);
  const { command, args, opts } = fake.calls[0];
  assert.equal(opts.shell, true);
  assert.deepEqual(args, []);
  assert.equal(command, windowsCommandLine('codex', leanArgv(base, 'win32')));
  assert.equal(
    command,
    'codex exec review --json --ignore-user-config --ignore-rules --disable plugins --disable apps --disable hooks ' +
      '-m gpt-6.1-sol -c "model_reasoning_effort=\\"high\\"" -c sandbox_mode=read-only -c approval_policy=never ' +
      `-c "windows.sandbox=\\"unelevated\\"" -c skills.include_instructions=false --base ${base}`,
  );
});

test('off Windows the lean argv names no Windows sandbox, whatever the host the tests run on', async () => {
  const { root, base } = makeRepo();
  for (const platform of ['linux', 'darwin']) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...fake, platform });
    assert.equal(result.code, 0, result.err);
    assert.deepEqual(fake.calls[0].args, leanArgv(base, platform), platform);
    assert.equal(fake.calls[0].args.some((token) => token.includes('windows')), false, platform);
  }
});

test('the run line says `lean`, the one session there is, with the model and the effort the command passed, however the attempt ends', async () => {
  const { root, base } = makeRepo();
  await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base)));
  await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base), { status: 7 }));
  // With no session named the line says `lean`, the one that ran, and never a word for "the default".
  await run(['--base', 'HEAD~1', '--again', '--cwd', root], fakeCodex(reviewed(root, base)));
  const runs = readCodexReviewRuns(root);
  assert.deepEqual(runs.map((line) => [line.outcome, line.session, line.model, line.effort]), [
    ['reviewed', 'lean', 'gpt-6.1-sol', 'high'],
    ['failed', 'lean', 'gpt-6.1-sol', 'high'],
    ['reviewed', 'lean', 'gpt-6.1-sol', 'high'],
  ]);
  assert.deepEqual(Object.keys(runs[2]), Object.keys(runs[0]), 'the same fields in the same order, named or not');
  assert.deepEqual(readCodexReviews(root).map((record) => Object.keys(record)), [
    ['schema', 'base', 'head', 'reviewedAt', 'outcome', 'run'],
    ['schema', 'base', 'head', 'reviewedAt', 'outcome', 'run'],
  ]);
});

test('the line that announces the review names the session, and the model and the effort it runs on', async () => {
  const { root, base, head } = makeRepo();
  const range = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  for (const flags of [[], ['--session', 'lean']]) {
    const lean = await run(['--base', 'HEAD~1', '--again', ...flags, '--cwd', root], fakeCodex(reviewed(root, base)));
    assert.equal(afterPlan(lean.out)[0], `Codex is reviewing ${range} with the lean session (gpt-6.1-sol, high); this can take several minutes.`, flags.join(' '));
  }
});

test('--unavailable with a session launches nothing and records the skip as before', async () => {
  const { root, base, head } = makeRepo();
  const fake = fakeCodex('');
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--unavailable', 'model rejected', '--cwd', root], fake);
  assert.equal(result.code, 0);
  assert.equal(fake.calls.length, 0);
  assert.deepEqual(readCodexReviews(root), [skippedRecord(base, head, 'model rejected')]);
  assert.equal(loggedRun(root), false);
});

// A flag that only shapes a launch says nothing beside `--unavailable`, which launches nothing. It is
// accepted all the same, as it always was beside an explicit `--session lean`: the skip is what was asked
// for, and refusing it over a flag that changes nothing of it would only cost a second command. With lean
// the default, the same holds with no session named.
test('the flags of the lean session beside --unavailable change nothing of the skip: it is recorded, and nothing is launched, made or kept', async () => {
  const doc = featureDoc();
  const shaping = [['--keep-home'], ['--prompt', 'own'], ['--prompt', 'own', '--doc', doc], ['--part-lines', '400'], ['--keep-home', '--prompt', 'own', '--part-lines', '6']];
  for (const flags of shaping) {
    for (const session of [[], ['--session', 'lean']]) {
      const { root, base, head } = makeRepo();
      const mine = fakeHome();
      const state = tmp('js-harness-codex-review-state-');
      const never = () => {
        throw new Error('a skip makes no Codex home');
      };
      const fake = fakeCodex('');
      const argv = ['--base', 'HEAD~1', ...session, ...flags, '--unavailable', 'model rejected', '--home', state, '--cwd', root];
      const result = await run(argv, { ...fake, homedir: mine.homedir, createLeanHome: never });
      const which = [...session, ...flags].join(' ');
      assert.equal(result.code, 0, `${which}: ${result.err}`);
      assert.equal(result.err, '', which);
      assert.deepEqual(readCodexReviews(root), [skippedRecord(base, head, 'model rejected')], which);
      assert.equal(fake.calls.length, 0, `${which}: nothing was launched`);
      assert.equal(fake.probes.length, 0, `${which}: nor probed`);
      assert.equal(loggedRun(root), false, which);
      assert.deepEqual(listed(state), [], `${which}: no home was made, so none was kept`);
      assert.doesNotMatch(result.out, /kept|Codex is reviewing|part/i, which);
      assert.equal(fs.statSync(mine.auth).nlink, 1);
    }
  }
});

// --- the lean session's home: a folder of its own for one run, with the login as a hard link ---

/** `fake` with a look at Codex's home at the moment it is launched: `during(home, opts)`. */
const watching = (fake, during) => ({
  ...fake,
  spawnAsync: (command, args, opts) => {
    during(opts.env.CODEX_HOME, opts);
    return fake.spawnAsync(command, args, opts);
  },
});

/** What a Codex session leaves in its home: files and folders beside the login. */
function codexWrites(home) {
  fs.mkdirSync(path.join(home, 'sessions', '2026', '10'), { recursive: true });
  fs.writeFileSync(path.join(home, 'sessions', '2026', '10', 'rollout.jsonl'), '{}\n', 'utf8');
  fs.writeFileSync(path.join(home, 'version.json'), '{}', 'utf8');
}

test('the lean session runs in a Codex home of its own: a new folder named after the run, holding the login as a hard link and nothing else', async () => {
  const { root, base, head } = makeRepo();
  const mine = fakeHome();
  fs.writeFileSync(path.join(mine.codexHome, 'AGENTS.md'), 'the global instructions a review must not load', 'utf8');
  const seen = {};
  const fake = watching(fakeCodex(reviewed(root, base)), (home) => {
    Object.assign(seen, { home, entries: listed(home), id: fileId(path.join(home, 'auth.json')), links: fs.statSync(mine.auth).nlink });
  });
  const realId = fileId(mine.auth);
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, homedir: mine.homedir });
  assert.equal(result.code, 0, result.err);
  assert.equal(result.err, '');
  assert.equal(seen.home, path.join(mine.homes, RUN_ID));
  assert.deepEqual(seen.entries, ['auth.json'], 'no global AGENTS.md, no config, no skills');
  assert.equal(seen.id, realId, 'the same file as the real login, not a copy');
  assert.equal(seen.links, 2);
  // After the run: the folder is gone, and the login is as it was, under its one name.
  assert.deepEqual(listed(mine.homes), []);
  assert.equal(fs.readFileSync(mine.auth, 'utf8'), LOGIN);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
  assert.equal(fileId(mine.auth), realId);
  assert.deepEqual(listed(mine.codexHome).sort(), ['AGENTS.md', 'auth.json'], 'nothing is written into the real Codex home');
  // The folder's name is the id of the run line, which the record names.
  assert.equal(onlyRun(root).id, RUN_ID);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
});

test('a CODEX_HOME the user set is where the login is taken from, and the child gets the lean home instead', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome({ login: null });
  const elsewhere = path.join(tmp('js-harness-codex-review-codexhome-'), 'codex');
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(elsewhere, 'auth.json'), LOGIN, 'utf8');
  let links;
  const fake = watching(fakeCodex(reviewed(root, base)), () => {
    links = fs.statSync(path.join(elsewhere, 'auth.json')).nlink;
  });
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, homedir: mine.homedir }, { CODEX_HOME: elsewhere });
  assert.equal(result.code, 0, result.err);
  assert.equal(links, 2, 'the login of the home the user named');
  assert.equal(fake.calls[0].opts.env.CODEX_HOME, path.join(mine.homes, RUN_ID));
  assert.equal(fs.statSync(path.join(elsewhere, 'auth.json')).nlink, 1);
});

/** An OS home `mine` with a login in its `.codex`, and a second Codex home `elsewhere` with a login of its
 * own, both under one temporary folder so that a link from either can be made. */
function twoLogins() {
  const mine = fakeHome();
  const elsewhere = path.join(mine.home, 'elsewhere', 'codex');
  fs.mkdirSync(elsewhere, { recursive: true });
  const other = path.join(elsewhere, 'auth.json');
  fs.writeFileSync(other, 'FIXTURE login of another Codex home\n', 'utf8');
  return { mine, elsewhere, other };
}

test('on Windows a CODEX_HOME spelled in another case is the home whose login is linked, and it is replaced, not left beside the lean one', async () => {
  const { root, base } = makeRepo();
  const { mine, elsewhere, other } = twoLogins();
  let links;
  const fake = watching(fakeCodex(reviewed(root, base)), () => {
    links = { named: fs.statSync(other).nlink, default: fs.statSync(mine.auth).nlink };
  });
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, platform: 'win32', homedir: mine.homedir }, { Codex_Home: elsewhere, SystemRoot: 'C:\\Windows' });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(links, { named: 2, default: 1 }, 'the login of the home the variable names, not the one under the OS home');
  assert.deepEqual(fake.calls[0].opts.env, { SystemRoot: 'C:\\Windows', CODEX_HOME: path.join(mine.homes, RUN_ID) });
  assert.equal(fs.statSync(other).nlink, 1);
});

test('off Windows a variable spelled in another case is another variable: the login comes from the OS home, and the child keeps it', async () => {
  const { root, base } = makeRepo();
  // Each platform by name: the answer must not rest on the host these tests run on, nor on what `run` passes
  // when a test names none.
  for (const platform of ['linux', 'darwin']) {
    const { mine, elsewhere, other } = twoLogins();
    let links;
    const fake = watching(fakeCodex(reviewed(root, base)), () => {
      links = { named: fs.statSync(other).nlink, default: fs.statSync(mine.auth).nlink };
    });
    const result = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...fake, platform, homedir: mine.homedir }, { Codex_Home: elsewhere });
    assert.equal(result.code, 0, `${platform}: ${result.err}`);
    assert.deepEqual(links, { named: 1, default: 2 }, platform);
    assert.deepEqual(fake.calls[0].opts.env, { Codex_Home: elsewhere, CODEX_HOME: path.join(mine.homes, RUN_ID) }, platform);
    assert.equal(fake.calls[0].command, 'codex', `${platform}: launched as off Windows, with no shell`);
    assert.equal(fs.statSync(mine.auth).nlink, 1, platform);
  }
});

test('where the lean homes go: --home, else JS_HARNESS_HOME, else the OS home; the login always comes from the real Codex home', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const flagHome = tmp('js-harness-codex-review-state-');
  const envHome = tmp('js-harness-codex-review-state-');
  const cases = [
    [['--home', flagHome], { JS_HARNESS_HOME: envHome }, flagHome],
    [[], { JS_HARNESS_HOME: envHome }, envHome],
    [[], {}, mine.home],
  ];
  for (const [flags, env, expected] of cases) {
    let links;
    const fake = watching(fakeCodex(reviewed(root, base)), () => {
      links = fs.statSync(mine.auth).nlink;
    });
    const result = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', ...flags, '--cwd', root], { ...fake, homedir: mine.homedir }, env);
    assert.equal(result.code, 0, result.err);
    assert.equal(fake.calls[0].opts.env.CODEX_HOME, path.join(leanHomesDir(expected), RUN_ID));
    assert.equal(links, 2, 'the login of the real Codex home, wherever the state dir is');
    assert.deepEqual(listed(leanHomesDir(expected)), []);
  }
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('a review leaves nothing on the machine: the folder of its homes and an empty state dir go with the home, however the review ends', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const state = tmp('js-harness-codex-review-state-');
  const endings = [
    [0, () => ({ ...fakeCodex(reviewed(root, base)) })],
    [7, () => ({ ...fakeCodex(reviewed(root, base), { status: 7 }) })],
    [1, () => ({ ...fakeCodex(reviewedWith(cmd('git status'))) })],
    [1, () => ({ ...fakeCodex('', { hang: true }), timeoutMs: 30 })],
  ];
  for (const [code, fake] of endings) {
    let during;
    const result = await run(['--base', 'HEAD~1', '--again', '--home', state, '--cwd', root], { ...watching(fake(), () => { during = listed(leanHomesDir(state)); }), homedir: mine.homedir });
    assert.equal(result.code, code, result.err);
    assert.deepEqual(during, [RUN_ID], 'the home was there while Codex ran');
    assert.deepEqual(listed(state), [], `exit ${code}: no \`.js-harness\` is left behind`);
    assert.doesNotMatch(result.err, /Warning/);
  }
  // A state dir that holds something else, as an installed harness's does, stays with what it held.
  fs.mkdirSync(path.join(state, '.js-harness'));
  fs.writeFileSync(path.join(state, '.js-harness', 'manifest.json'), '{}', 'utf8');
  assert.equal((await run(['--base', 'HEAD~1', '--again', '--home', state, '--cwd', root], { ...fakeCodex(reviewed(root, base)), homedir: mine.homedir })).code, 0);
  assert.deepEqual(listed(path.join(state, '.js-harness')), ['manifest.json']);
  // And a home that was asked to be kept keeps the folders it is in.
  const kept = await run(['--base', 'HEAD~1', '--again', '--keep-home', '--home', state, '--cwd', root], { ...fakeCodex(reviewed(root, base)), homedir: mine.homedir });
  assert.equal(kept.code, 0, kept.err);
  assert.deepEqual(listed(leanHomesDir(state)), [RUN_ID]);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('an empty --home or JS_HARNESS_HOME counts as unset: the next source is used, and nothing is made under the working directory', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const envHome = tmp('js-harness-codex-review-state-');
  // An empty path resolves to the working directory. This one is a temporary folder on the volume of the
  // fake login, so that a home made there by mistake would be made, and seen, and not stopped by `EXDEV`.
  // This file's tests run one at a time in a process of their own, so the change is seen by no other.
  const cwd = process.cwd();
  const workdir = tmp('js-harness-codex-review-workdir-');
  process.chdir(workdir);
  try {
    const cases = [
      [['--home', ''], {}, mine.home],
      [[], { JS_HARNESS_HOME: '' }, mine.home],
      [['--home', ''], { JS_HARNESS_HOME: '' }, mine.home],
      [['--home', ''], { JS_HARNESS_HOME: envHome }, envHome],
    ];
    for (const [flags, env, expected] of cases) {
      const fake = fakeCodex(reviewed(root, base));
      const result = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', ...flags, '--cwd', root], { ...fake, homedir: mine.homedir }, env);
      const name = JSON.stringify([flags, env]);
      assert.equal(result.code, 0, `${name}: ${result.err}`);
      assert.equal(fake.calls[0].opts.env.CODEX_HOME, path.join(leanHomesDir(expected), RUN_ID), name);
      assert.deepEqual(listed(workdir), [], `${name}: nothing under the working directory`);
    }
  } finally {
    process.chdir(cwd);
  }
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('the lean home is removed on every way out, and the login is left as it was', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const realId = fileId(mine.auth);
  const spawnThrows = () => {
    throw new Error('spawn EINVAL');
  };
  const endings = [
    ['reviewed', fakeCodex(reviewed(root, base)), {}, 0],
    ['a failed turn', fakeCodex(jsonl(thread, turn, { type: 'turn.failed', error: { message: 'model overloaded' } })), {}, 1],
    ['a non-zero exit', fakeCodex(reviewed(root, base), { status: 7 }), {}, 7],
    ['not inspected', fakeCodex(reviewedWith(cmd('git status'))), {}, 1],
    ['a start that fails', fakeCodex('', { error: new Error('boom') }), {}, 1],
    ['a timeout', fakeCodex('', { hang: true }), { timeoutMs: 30 }, 1],
    ['an overflow', fakeCodex(['x'.repeat(20), 'y'.repeat(20)]), { maxBuffer: 30 }, 1],
  ];
  for (const [name, fake, extra, code] of endings) {
    let seen;
    const watched = watching(fake, (home) => {
      codexWrites(home);
      seen = { home, links: fs.statSync(mine.auth).nlink };
    });
    const result = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...watched, ...extra, homedir: mine.homedir });
    assert.equal(result.code, code, name);
    assert.equal(seen.links, 2, name);
    assert.equal(fs.existsSync(seen.home), false, `${name}: the folder is gone`);
    assert.deepEqual(listed(mine.homes), [], name);
    assert.equal(fs.statSync(mine.auth).nlink, 1, name);
    assert.equal(fs.readFileSync(mine.auth, 'utf8'), LOGIN, name);
    assert.equal(fileId(mine.auth), realId, name);
    assert.doesNotMatch(result.err, /lean Codex home/, `${name}: nothing to warn about`);
  }

  // A spawn that throws launches nothing, and still leaves nothing.
  const thrown = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...fakeCodex(''), spawnAsync: spawnThrows, homedir: mine.homedir });
  assert.equal(thrown.code, 1);
  assert.match(thrown.err, /could not start it: spawn EINVAL/);
  assert.deepEqual(listed(mine.homes), []);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('Ctrl-C during a lean review removes its home too', async () => {
  const { root } = makeRepo();
  const mine = fakeHome();
  const fake = fakeCodex('', { hang: true });
  const signals = new EventEmitter();
  const pending = run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, signals, homedir: mine.homedir });
  while (fake.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));
  // Read, then interrupt, then assert: a failed assertion before the signal would leave the review waiting.
  const linksDuring = fs.statSync(mine.auth).nlink;
  signals.emit('SIGINT');
  const result = await pending;
  assert.equal(linksDuring, 2);
  assert.equal(result.code, 1);
  assert.equal(onlyRun(root).outcome, 'interrupted');
  assert.deepEqual(listed(mine.homes), []);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
  assert.equal(fs.readFileSync(mine.auth, 'utf8'), LOGIN);
});

test('a login Codex refreshed during a lean review is the real login afterwards: the link, not a copy', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const realId = fileId(mine.auth);
  const refreshed = 'FIXTURE login after a refresh, longer than the first one\n';
  const fake = watching(fakeCodex(reviewed(root, base)), (home) => {
    codexWrites(home);
    // As Codex saves it: the same path opened for writing and truncated.
    fs.writeFileSync(path.join(home, 'auth.json'), refreshed, { encoding: 'utf8', flag: 'w' });
  });
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, homedir: mine.homedir });
  assert.equal(result.code, 0, result.err);
  assert.equal(fs.readFileSync(mine.auth, 'utf8'), refreshed);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
  assert.equal(fileId(mine.auth), realId);
  assert.deepEqual(listed(mine.homes), []);
});

test('a lean home that cannot be made launches nothing: exit 1 with the reason, no run line, no record', async () => {
  const { root, base } = makeRepo();
  const loggedOut = fakeHome({ login: null });
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, homedir: loggedOut.homedir });
  assert.equal(result.code, 1);
  assert.match(result.err, /not logged in/);
  assert.match(result.err, /codex login/);
  assert.match(result.err, /not started/);
  assert.doesNotMatch(result.out, /Codex is reviewing|Codex used|Codex ran/);
  assert.equal(fake.calls.length, 0);
  assert.equal(wrote(root), false);
  assert.equal(loggedRun(root), false);
  assert.deepEqual(listed(loggedOut.homes), []);

  // A link that cannot be made (the state dir on another volume): the same, and no copy instead.
  const mine = fakeHome();
  const otherVolume = (options) => createLeanHome({
    ...options,
    link: () => {
      throw Object.assign(new Error('EXDEV: cross-device link not permitted'), { code: 'EXDEV' });
    },
  });
  const crossed = fakeCodex(reviewed(root, base));
  const refused = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...crossed, homedir: mine.homedir, createLeanHome: otherVolume });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /EXDEV/);
  assert.match(refused.err, /No copy is made/);
  assert.equal(crossed.calls.length, 0);
  assert.equal(loggedRun(root), false);
  assert.deepEqual(listed(mine.homes), []);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

// The last line of the refusal when the home of the review cannot be made. There is no other session to
// send a person to since 2026-10-08, so the way out of a machine the review cannot run on is the one the
// command has for a review that could not be made at all: the explicit skip, in the words it uses elsewhere.
const WAY_OUT = 'The way out, on a machine where the lean session cannot run: record an explicit skip with `js-harness codex-review --base <rev> --unavailable <reason>`.';

test('a home that cannot be made is a refusal whose way out is to record the skip, whatever the flags: nothing launched, nothing left, and the skip it names is recorded', async () => {
  const { root, base, head } = makeRepo();
  const doc = featureDoc();
  const failing = (code) => (options) => createLeanHome({
    ...options,
    link: () => {
      throw Object.assign(new Error(`${code}: link failed`), { code });
    },
  });
  const noFolder = () => {
    throw new Error('Could not make the lean Codex home X (EACCES).');
  };
  const cases = [
    // Codex is not logged in through `auth.json`: a login in the system keyring, or none.
    ['no auth.json', { login: null }, undefined, /There is no .*auth\.json, so Codex is not logged in there/],
    // The harness's state dir on another volume than the Codex home.
    ['EXDEV', {}, failing('EXDEV'), /\(EXDEV\): the two folders are on different volumes/],
    ['EPERM', {}, failing('EPERM'), /Could not hard-link .*\(EPERM\)/],
    ['mkdir', {}, noFolder, /Could not make the lean Codex home X \(EACCES\)/],
  ];
  // The sentence names no flag to leave out, as it did while the way out was a session that refused some:
  // it is the same one beside every flag of a review.
  const commands = [[], ['--session', 'lean'], ['--keep-home'], ['--part-lines', '400'], ['--prompt', 'own', '--doc', doc], ['--keep-home', '--part-lines', '400', '--doc', doc, '--prompt', 'own', '--session', 'lean']];
  for (const [name, home, createHome, reason] of cases) {
    for (const flags of commands) {
      const mine = fakeHome(home);
      const fake = fakeCodex(reviewed(root, base));
      const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], { ...fake, homedir: mine.homedir, ...(createHome ? { createLeanHome: createHome } : {}) });
      const which = `${name} ${flags.join(' ')}`;
      assert.equal(result.code, 1, which);
      assert.match(result.err, reason, which);
      assert.deepEqual(result.err.split('\n').slice(-2), ['The lean review was not started and nothing was recorded.', WAY_OUT], which);
      assert.doesNotMatch(result.err, /--session|current|Leave out/, which);
      assert.equal(fake.calls.length, 0, `${which}: nothing was launched`);
      assert.equal(wrote(root), false);
      assert.equal(loggedRun(root), false);
      assert.deepEqual(listed(mine.home), ['.codex'], `${which}: no home, and no state dir, is left`);
      if (home.login !== null) assert.equal(fs.statSync(mine.auth).nlink, 1);
    }
  }
  // And the way out is one: on the machine with no `auth.json`, the command it names records the skip.
  const loggedOut = fakeHome({ login: null });
  const skip = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', '--unavailable', 'no auth.json on this machine', '--cwd', root], { ...skip, homedir: loggedOut.homedir });
  assert.equal(result.code, 0, result.err);
  assert.equal(skip.calls.length, 0);
  assert.deepEqual(readCodexReviews(root), [skippedRecord(base, head, 'no auth.json on this machine')]);
  assert.deepEqual(listed(loggedOut.home), ['.codex']);
});

/** An id source that fails. */
const noId = () => {
  throw new Error('no entropy');
};

test('a run id that cannot be made stops a lean review before it starts, since it names the home', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, homedir: mine.homedir, randomUUID: noId });
  assert.equal(result.code, 1);
  assert.match(result.err, /no entropy/);
  assert.match(result.err, /not started/);
  assert.equal(fake.calls.length, 0);
  assert.equal(wrote(root), false);
  assert.equal(loggedRun(root), false);
  assert.deepEqual(listed(mine.home), ['.codex'], 'no state dir was made');
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('a lean home that cannot be removed is a warning that names it, and the review ends as it would', async () => {
  const { root, base, head } = makeRepo();
  const mine = fakeHome();
  const homes = [];
  // The real home, whose removal then reports a failure, as a folder still held by a process would.
  const stuck = (options) => {
    const lean = createLeanHome(options);
    homes.push(lean.home);
    return { home: lean.home, dispose: () => lean.dispose() ?? `could not remove ${lean.home} (EBUSY)` };
  };
  const reviewedRun = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base)), homedir: mine.homedir, createLeanHome: stuck });
  assert.equal(reviewedRun.code, 0);
  assert.ok(reviewedRun.err.includes(`could not remove ${homes[0]} (EBUSY)`), reviewedRun.err);
  assert.match(reviewedRun.err, /^Warning: /m);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);

  const failed = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base), { status: 7 }), homedir: mine.homedir, createLeanHome: stuck });
  assert.equal(failed.code, 7);
  assert.ok(failed.err.includes(`could not remove ${homes[1]} (EBUSY)`), failed.err);
  assert.match(failed.err, /did not complete.*exited 7/is);
  assert.deepEqual(readCodexReviewRuns(root).map((line) => line.outcome), ['reviewed', 'failed']);
});

test('before a lean review the homes a killed run left are removed: older than twice the timeout, never a younger one', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const at = Date.parse('2026-09-29T12:00:00.000Z');
  const minute = 60 * 1000;
  const leftBehind = (id, ageMs) => {
    const lean = createLeanHome({ realHome: mine.codexHome, parent: mine.homes, id });
    fs.utimesSync(lean.home, new Date(at - ageMs), new Date(at - ageMs));
  };
  leftBehind('killed', 21 * minute);
  leftBehind('running', 19 * minute);
  let seen;
  const fake = watching(fakeCodex(reviewed(root, base)), () => {
    seen = { homes: listed(mine.homes).sort(), links: fs.statSync(mine.auth).nlink };
  });
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, homedir: mine.homedir, timeoutMs: 10 * minute });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(seen.homes, [RUN_ID, 'running'], 'the stale one was gone before Codex was launched');
  assert.equal(seen.links, 3);
  assert.deepEqual(listed(mine.homes), ['running']);
  assert.equal(fs.statSync(mine.auth).nlink, 2);
  assert.equal(fs.readFileSync(mine.auth, 'utf8'), LOGIN);
});

// --- `--keep-home`: the lean home stays after the run, without the login, for a person to read ---

test('--keep-home leaves the lean home with what Codex wrote in it and without the login, and says where it is', async () => {
  const { root, base, head } = makeRepo();
  const mine = fakeHome();
  const realId = fileId(mine.auth);
  let linksDuring;
  const fake = watching(fakeCodex(reviewed(root, base)), (home) => {
    codexWrites(home);
    linksDuring = fs.statSync(mine.auth).nlink;
  });
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--keep-home', '--cwd', root], { ...fake, homedir: mine.homedir });
  assert.equal(result.code, 0, result.err);
  assert.equal(result.err, '');
  assert.equal(linksDuring, 2);
  const kept = path.join(mine.homes, RUN_ID);
  // The login: one name again, the file it was, with its bytes. The folder holds no login at all.
  assert.equal(fs.statSync(mine.auth).nlink, 1);
  assert.equal(fileId(mine.auth), realId);
  assert.equal(fs.readFileSync(mine.auth, 'utf8'), LOGIN);
  assert.deepEqual(listed(kept).sort(), ['sessions', 'version.json']);
  assert.equal(fs.readFileSync(path.join(kept, 'sessions', '2026', '10', 'rollout.jsonl'), 'utf8'), '{}\n');
  // One line names the folder and says that it does not stay for ever.
  const line = result.out.split('\n').find((text) => text.includes(kept));
  assert.ok(line, result.out);
  assert.match(line, /kept/);
  assert.match(line, /without the login/);
  assert.match(line, /rollout/);
  assert.match(line, /next lean review removes/);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
});

test('--keep-home keeps the home of an attempt that failed too, and the tokens are still read from it', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const fake = spending(fakeCodex(reviewed(root, base), { status: 7 }), parentThread, reviewThread);
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--keep-home', '--cwd', root], { ...fake, homedir: mine.homedir });
  assert.equal(result.code, 7);
  const kept = path.join(mine.homes, RUN_ID);
  assert.deepEqual(listed(kept), ['sessions']);
  assert.ok(result.out.includes(kept), result.out);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
  assert.deepEqual(onlyRun(root).usage, REVIEW_SPENT);
});

test('--keep-home when the login could not be taken out of the kept home: a warning says so, the line that names the home does not say it is without the login, and the review ends as it would', async () => {
  const { root, base, head } = makeRepo();
  const mine = fakeHome();
  const homes = [];
  // The real home, whose login cannot be unlinked, as one another process holds open: the folder stays, as
  // asked, and the second name of the login stays in it, which was not.
  const held = (options) => {
    const lean = createLeanHome(options);
    homes.push(lean);
    return { home: lean.home, dispose: ({ keep }) => (keep ? `could not remove ${path.join(lean.home, 'auth.json')} (EPERM)` : lean.dispose()) };
  };
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--keep-home', '--cwd', root], { ...watching(fakeCodex(reviewed(root, base)), codexWrites), homedir: mine.homedir, createLeanHome: held });
  const kept = path.join(mine.homes, RUN_ID);
  const linksAfter = fs.statSync(mine.auth).nlink;
  // The fixture's second name is removed before anything is asserted, so a failure leaves no link behind.
  assert.equal(homes[0].dispose(), null);
  assert.equal(result.code, 0, result.err);
  assert.equal(result.err, `Warning: the lean Codex home of this run was not left clean: could not remove ${path.join(kept, 'auth.json')} (EPERM).`);
  assert.equal(linksAfter, 2, 'the login was still in the kept home, which is what the warning is for');
  const line = result.out.split('\n').find((text) => text.includes('was kept'));
  assert.ok(line, result.out);
  assert.match(line, /was kept, for its rollout files/);
  assert.doesNotMatch(line, /without the login/, 'it would not be true');
  assert.equal(line.endsWith(`: ${kept}`), true, 'the path comes last, whole');
  assert.match(line, /next lean review removes/);
  // The attempt stands, and a failed one still keeps its exit code.
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
  const failed = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--keep-home', '--cwd', root], { ...fakeCodex(reviewed(root, base), { status: 7 }), homedir: mine.homedir, createLeanHome: held, randomUUID: () => 'second-run' });
  assert.equal(homes[1].dispose(), null);
  assert.equal(failed.code, 7);
  assert.match(failed.err, /^Warning: .*not left clean: could not remove .*second-run.*\(EPERM\)\.$/m);
  assert.doesNotMatch(failed.out, /without the login/);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('a kept lean home is removed by a later lean review once it is older than twice the timeout', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const at = Date.parse('2026-09-29T12:00:00.000Z');
  const minute = 60 * 1000;
  const first = await run(['--base', 'HEAD~1', '--session', 'lean', '--keep-home', '--cwd', root], { ...watching(fakeCodex(reviewed(root, base)), codexWrites), homedir: mine.homedir, randomUUID: () => 'kept-run', timeoutMs: 10 * minute });
  assert.equal(first.code, 0, first.err);
  assert.match(first.out, /once it is 20 minutes old/);
  const kept = path.join(mine.homes, 'kept-run');
  assert.equal(fs.existsSync(kept), true);
  fs.utimesSync(kept, new Date(at - 21 * minute), new Date(at - 21 * minute));
  const second = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base)), homedir: mine.homedir, timeoutMs: 10 * minute });
  assert.equal(second.code, 0, second.err);
  assert.deepEqual(listed(mine.homes), []);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('without --keep-home nothing is said about a kept home, and none is kept', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...watching(fakeCodex(reviewed(root, base)), codexWrites), homedir: mine.homedir });
  assert.equal(result.code, 0, result.err);
  assert.doesNotMatch(result.out, /kept/);
  assert.deepEqual(listed(mine.homes), []);
});

test('the flags of a review need no --session, since there is one session: --keep-home, --prompt own and --part-lines', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const kept = await run(['--base', 'HEAD~1', '--keep-home', '--cwd', root], { ...fakeCodex(reviewed(root, base)), homedir: mine.homedir });
  assert.equal(kept.code, 0, kept.err);
  assert.deepEqual(listed(mine.homes), [RUN_ID], 'the home of the run was kept');
  assert.ok(kept.out.includes(path.join(mine.homes, RUN_ID)));
  const asked = fakeCodex(reviewedWith(cmd(`git diff ${base} HEAD`, 0, patchOf(root, base))));
  const own = await run(['--base', 'HEAD~1', '--again', '--prompt', 'own', '--cwd', root], asked);
  assert.equal(own.code, 0, own.err);
  assert.equal(asked.calls[0].args.at(-1), '-', 'the own prompt goes in on stdin');
  assert.equal(asked.calls[0].args.includes('--base'), false);
  assert.ok(asked.calls[0].child.received.text.length > 0);
  const bounded = fakeCodex(reviewed(root, base));
  const parts = await run(['--base', 'HEAD~1', '--again', '--part-lines', '400', '--cwd', root], bounded);
  assert.equal(parts.code, 0, parts.err);
  assert.deepEqual(bounded.calls[0].args, leanArgv(base));
});

// --- the prompt: the sentence Codex writes for `--base`, or this command's own, read from stdin ---

/** The lean argv of a review asked with this command's own prompt, token by token: the lean flags, no
 * `--base`, and `-` as the prompt, which makes Codex read it from stdin. */
const ownArgv = (platform = 'linux') => [
  'exec', 'review', '--json',
  '--ignore-user-config', '--ignore-rules',
  '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
  '-m', 'gpt-6.1-sol',
  '-c', 'model_reasoning_effort="high"',
  '-c', 'sandbox_mode=read-only',
  '-c', 'approval_policy=never',
  ...(platform === 'win32' ? ['-c', 'windows.sandbox="unelevated"'] : []),
  '-c', 'skills.include_instructions=false',
  '-',
];

const OWN = ['--session', 'lean', '--prompt', 'own'];

// A feature document as the task contract shapes it, with what a command line would choke on.
const GOAL = 'Say "done" & keep 100% of %PATH%, even with ^ | < > in it.';
const DONE_WHEN = '- `npm run check` exits 0\n- Sebastián reads the result';
const FEATURE_DOC = `# A feature\n\n## Goal\n${GOAL}\n\n## Why\nBecause.\n\n## Done when\n${DONE_WHEN}\n\n## Constraints\n- None\n`;

/** Writes a feature document outside any repository and returns its path. */
function featureDoc(markdown = FEATURE_DOC) {
  const file = path.join(tmp('js-harness-codex-review-doc-'), 'feature.md');
  fs.writeFileSync(file, markdown, 'utf8');
  return file;
}

test('codexArgs: under the own prompt the lean argv names no base and ends with `-`, the prompt on stdin', () => {
  const base = 'a'.repeat(40);
  assert.deepEqual(codexArgs(base, 'linux', 'own'), [
    'exec', 'review', '--json',
    '--ignore-user-config', '--ignore-rules',
    '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
    '-m', 'gpt-6.1-sol',
    '-c', 'model_reasoning_effort="high"',
    '-c', 'sandbox_mode=read-only',
    '-c', 'approval_policy=never',
    '-c', 'skills.include_instructions=false',
    '-',
  ]);
  for (const platform of ['win32', 'linux', 'darwin']) {
    const argv = codexArgs(base, platform, 'own');
    assert.deepEqual(argv, ownArgv(platform), platform);
    // `--base` and a prompt exclude each other on Codex's command line: the range is in the prompt.
    assert.equal(argv.some((token) => token === '--base' || token.includes(base)), false, platform);
    assert.equal(argv.includes('--ephemeral'), false, platform);
  }
  // The default prompt is the argv as it was.
  assert.deepEqual(codexArgs(base, 'linux', 'codex'), leanArgv(base));
  assert.throws(() => codexArgs(base, 'linux', 'mine'), /prompt/);
});

test('--prompt own hands Codex this command\'s prompt on stdin: the committed range, and no --base', async () => {
  const { root, base, head } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', ...OWN, '--cwd', root], fake);
  assert.equal(result.code, 0, result.err);
  const { command, args, opts, child } = fake.calls[0];
  assert.equal(command, 'codex');
  assert.deepEqual(args, ownArgv());
  assert.deepEqual(opts.stdio, ['pipe', 'pipe', 'inherit']);
  // The whole prompt, and then the end of the input, which is what Codex waits for.
  assert.deepEqual(child.received, { text: reviewPrompt({ from: base, head }), ended: true });
  assert.ok(child.received.text.includes(`git diff ${base} ${head}`));
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
});

test('without --prompt, and with --prompt codex, the review is the `--base` one: nothing is sent on stdin', async () => {
  const { root, base } = makeRepo();
  for (const flags of [[], ['--prompt', 'codex'], ['--session', 'lean'], ['--session', 'lean', '--prompt', 'codex']]) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', '--again', ...flags, '--cwd', root], fake);
    assert.equal(result.code, 0, `${flags.join(' ')}: ${result.err}`);
    assert.deepEqual(fake.calls[0].args, leanArgv(base), flags.join(' '));
    assert.deepEqual(fake.calls[0].opts.stdio, ['ignore', 'pipe', 'inherit'], 'Codex would wait on an open stdin');
    assert.equal(fake.calls[0].child.stdin, null);
  }
});

test('--doc adds the Goal and the Done when of the feature document to the own prompt', async () => {
  const { root, base, head } = makeRepo();
  const expected = reviewPrompt({ from: base, head, intent: { goal: GOAL, doneWhen: DONE_WHEN } });
  // A path as it is, and one from `--cwd`, as the other commands read a document.
  fs.mkdirSync(path.join(root, 'odd'));
  fs.writeFileSync(path.join(root, 'odd', 'feature.md'), FEATURE_DOC, 'utf8');
  for (const doc of [featureDoc(), path.join('odd', 'feature.md')]) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', '--again', ...OWN, '--doc', doc, '--cwd', root], fake);
    assert.equal(result.code, 0, result.err);
    assert.deepEqual(fake.calls[0].args, ownArgv(), 'the document changes the prompt and no argument');
    assert.equal(fake.calls[0].child.received.text, expected);
  }
  assert.ok(expected.includes(GOAL));
  assert.ok(expected.includes(DONE_WHEN));
});

test('on Windows the own prompt never goes through cmd.exe: the line ends with `-`, and the prompt arrives whole on stdin', async () => {
  const { root, base, head } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', ...OWN, '--doc', featureDoc(), '--cwd', root], { ...fake, platform: 'win32' });
  assert.equal(result.code, 0, result.err);
  const { command, args, opts, child } = fake.calls[0];
  assert.equal(opts.shell, true);
  assert.deepEqual(args, []);
  assert.equal(command, windowsCommandLine('codex', ownArgv('win32')));
  assert.equal(command.endsWith(' -c skills.include_instructions=false -'), true, command);
  assert.equal(/[\r\n%&^|<>]/.test(command), false, 'nothing of the prompt is on the line cmd.exe parses');
  // Newlines, quotes, `%` and `&` and the rest: as an argument cmd.exe would act on them, so it is refused there.
  const prompt = reviewPrompt({ from: base, head, intent: { goal: GOAL, doneWhen: DONE_WHEN } });
  assert.throws(() => quoteWindowsArg(prompt), /cmd\.exe/);
  assert.deepEqual(child.received, { text: prompt, ended: true });
  assert.ok(child.received.text.includes('Say "done" & keep 100% of %PATH%, even with ^ | < > in it.\n'));
});

test('the run line says which prompt the review was asked with, and the version of this command\'s own', async () => {
  const { root, base } = makeRepo();
  await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base)));
  await run(['--base', 'HEAD~1', '--again', ...OWN, '--cwd', root], fakeCodex(reviewed(root, base)));
  await run(['--base', 'HEAD~1', '--again', ...OWN, '--cwd', root], fakeCodex(reviewed(root, base), { status: 7 }));
  const runs = readCodexReviewRuns(root);
  assert.equal(REVIEW_PROMPT_VERSION, 'js-harness.codex-review-prompt/v1');
  assert.deepEqual(runs.map((line) => [line.outcome, line.session, line.prompt, line.promptVersion]), [
    ['reviewed', 'lean', 'codex', null],
    ['reviewed', 'lean', 'own', REVIEW_PROMPT_VERSION],
    ['failed', 'lean', 'own', REVIEW_PROMPT_VERSION],
  ]);
  assert.deepEqual(runs.map(runPrompt), ['codex', 'own', 'own']);
  for (const line of runs) assert.deepEqual(Object.keys(line).filter((name) => name !== 'reason'), Object.keys(runs[0]), 'the same fields in the same order under either prompt');
  // The record of the review does not change with the prompt.
  assert.deepEqual(readCodexReviews(root).map((record) => Object.keys(record)), Array.from({ length: 2 }, () => ['schema', 'base', 'head', 'reviewedAt', 'outcome', 'run']));
});

test('the line that announces the review names this command\'s own prompt when it is the one sent', async () => {
  const { root, base, head } = makeRepo();
  const result = await run(['--base', 'HEAD~1', ...OWN, '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(
    afterPlan(result.out)[0],
    `Codex is reviewing ${base.slice(0, 7)}..${head.slice(0, 7)} with the lean session (gpt-6.1-sol, high) and this command's own prompt; this can take several minutes.`,
  );
});

test('--prompt and --doc: a prompt that is not one, and a document with no own prompt, are usage errors', async () => {
  const { root, base } = makeRepo();
  const doc = featureDoc();
  const cases = [
    [['--session', 'lean', '--prompt', 'mine'], /--prompt must be `codex` or `own`/],
    [['--prompt', 'OWN'], /--prompt must be `codex` or `own`/],
    [['--session', 'lean', '--prompt'], /--prompt requires a value/],
    [['--session', 'lean', '--doc', doc], /--doc needs --prompt own/],
    [['--session', 'lean', '--prompt', 'codex', '--doc', doc], /--doc needs --prompt own/],
    [['--doc', doc], /--doc needs --prompt own/],
    [[...OWN, '--doc'], /--doc requires a value/],
  ];
  for (const [flags, message] of cases) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], fake);
    assert.equal(result.code, 2, flags.join(' '));
    assert.match(result.err, message, flags.join(' '));
    assert.match(result.err, /Usage: js-harness codex-review .*\[--prompt <codex\|own>\] \[--doc <feature document>\]/);
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.probes.length, 0);
  }
  assert.equal(wrote(root), false);
  assert.equal(loggedRun(root), false);
});

test('a --doc that cannot be read, or holds no Goal or no Done when, is a usage error that names what is missing', async () => {
  const { root, base } = makeRepo();
  const cases = [
    [path.join(tmp('js-harness-codex-review-doc-'), 'nowhere.md'), /--doc .*nowhere\.md: cannot read it \(ENOENT\)/],
    [featureDoc(FEATURE_DOC.replace('## Done when', '## Finished when')), /--doc .*feature\.md: .*no `## Done when` heading/],
    [featureDoc(FEATURE_DOC.replace('## Goal', '## Aim')), /--doc .*feature\.md: .*no `## Goal` heading/],
    [featureDoc(FEATURE_DOC.replace(`${GOAL}\n`, '')), /--doc .*feature\.md: .*`## Goal` section .* is empty/],
  ];
  for (const [doc, message] of cases) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', ...OWN, '--doc', doc, '--cwd', root], fake);
    assert.equal(result.code, 2, doc);
    assert.match(result.err, message);
    assert.match(result.err, /Usage: js-harness codex-review/);
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.probes.length, 0);
  }
  assert.equal(wrote(root), false);
  assert.equal(loggedRun(root), false);
});

test('the evidence rule holds under the own prompt: every changed line in the output of a successful command, or nothing is recorded', async () => {
  const { root, base, head } = makeRepo();
  // The command the prompt names, with the whole patch in its output.
  const shown = fakeCodex(reviewedWith(cmd(`git diff ${base} ${head}`, 0, patchOf(root, base))));
  const inspected = await run(['--base', 'HEAD~1', ...OWN, '--cwd', root], shown);
  assert.equal(inspected.code, 0, inspected.err);
  assert.deepEqual(readCodexReviewRuns(root).at(-1).coverage, { seen: 2, total: 2 });
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);

  // A review that answered without reading the diff: a valid answer is not evidence that it did.
  const unseen = await run(['--base', 'HEAD~1', '--again', ...OWN, '--cwd', root], fakeCodex(reviewedWith(cmd('git status'))));
  assert.equal(unseen.code, 1);
  assert.match(unseen.err, /showed 0 of 2 changed lines/);
  const logged = readCodexReviewRuns(root).at(-1);
  assert.equal(logged.outcome, 'not-inspected');
  assert.equal(logged.answerSource, 'rollout');
  assert.equal(readCodexReviews(root).length, 1, 'no second record');
});

/** Three files, each with lines the second commit changes: two changed lines in `a.txt`, four in `b.txt`
 * and two in `c.txt`, counting a line removed and the one added in its place as two. */
function makeThreeFileRepo() {
  return makeRepoWith(
    { 'a.txt': 'a1\na2\na3\n', 'b.txt': 'b1\nb2\nb3\nb4\nb5\n', 'c.txt': 'c1\nc2\nc3\n' },
    { 'a.txt': 'a1\nA2 changed\na3\n', 'b.txt': 'b1\nB2 changed\nb3\nB4 changed\nb5\n', 'c.txt': 'c1\nC2 changed\nc3\n' },
  );
}

/** What `git diff <base> <head> -- <files>` prints in `root`, as a session of the review gets it. */
const diffOfFiles = (root, base, head, ...files) => git(root, 'diff', '--no-color', '--no-ext-diff', base, head, '--', ...files);

test('the evidence rule holds under the lean session with either prompt: a session that showed every changed line is a review', async () => {
  const { root, base, head } = makeThreeFileRepo();
  for (const flags of [['--session', 'lean'], ['--session', 'lean', '--prompt', 'codex'], OWN]) {
    // The diff read file by file, as a model does on a range it does not print at once.
    const fake = fakeCodex(reviewedWith(...['a.txt', 'b.txt', 'c.txt'].map((file) => cmd(`git diff ${base} ${head} -- ${file}`, 0, diffOfFiles(root, base, head, file)))));
    const result = await run(['--base', 'HEAD~1', '--again', ...flags, '--cwd', root], fake);
    assert.equal(result.code, 0, `${flags.join(' ')}: ${result.err}`);
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual([logged.outcome, logged.session, logged.coverage], ['reviewed', 'lean', { seen: 8, total: 8 }], flags.join(' '));
    assert.equal(result.err, '');
  }
  assert.deepEqual(readCodexReviews(root), Array.from({ length: 3 }, () => reviewedRecord(base, head)));
});

test('under the lean session, with either prompt, a session that missed changed lines is not a review, and the refusal names each file it did not read in full', async () => {
  const { root, base, head } = makeThreeFileRepo();
  // All of `a.txt`, `b.txt` cut before its last changed line as a bounded tool output cuts it, and no `c.txt`.
  const cut = diffOfFiles(root, base, head, 'b.txt').split('\n');
  const lastChange = cut.findLastIndex((line) => line.startsWith('+B4'));
  assert.notEqual(lastChange, -1);
  const shown = [cmd('git diff -- a.txt', 0, diffOfFiles(root, base, head, 'a.txt')), cmd('git diff -- b.txt', 0, cut.slice(0, lastChange).join('\n'))];
  for (const flags of [['--session', 'lean'], OWN]) {
    const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], fakeCodex(reviewedWith(...shown)));
    assert.equal(result.code, 1, flags.join(' '));
    assert.match(result.err, /showed 5 of 8 changed lines of [0-9a-f]{7}\.\.HEAD; nothing was recorded/);
    // The files by their path from the root of the repository, each with how much of it was missed.
    const named = result.err.split('\n').find((line) => line.includes('not read in full'));
    assert.equal(named, '  not read in full: b.txt (1 of 4 changed lines missing), c.txt (2 of 2 changed lines missing)', result.err);
    assert.doesNotMatch(named, /a\.txt/, 'a file that was read in full is not named');
    assert.match(result.err, /--unavailable <reason>/);
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual([logged.outcome, logged.coverage, logged.prompt], ['not-inspected', { seen: 5, total: 8 }, flags === OWN ? 'own' : 'codex']);
    assert.equal(wrote(root), false, 'a session that missed lines writes no review record');
  }
});

test('the files a refusal names are bounded: eight of them, and the rest counted', async () => {
  const names = Array.from({ length: 11 }, (_, index) => `f${String(index).padStart(2, '0')}.txt`);
  const { root } = makeRepoWith(Object.fromEntries(names.map((name) => [name, 'one\n'])), Object.fromEntries(names.map((name) => [name, 'two\n'])));
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(reviewedWith(cmd('git status'))));
  assert.equal(result.code, 1);
  const named = result.err.split('\n').find((line) => line.includes('not read in full'));
  assert.equal(named, `  not read in full: ${names.slice(0, 8).map((name) => `${name} (2 of 2 changed lines missing)`).join(', ')}, and 3 more`);
  // Exactly at the bound nothing is counted.
  const eight = names.slice(0, 8);
  const atBound = makeRepoWith(Object.fromEntries(eight.map((name) => [name, 'one\n'])), Object.fromEntries(eight.map((name) => [name, 'two\n'])));
  const exact = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', atBound.root], fakeCodex(reviewedWith(cmd('git status'))));
  assert.match(exact.err, /not read in full: f00\.txt .*f07\.txt \(2 of 2 changed lines missing\)$/m);
  assert.doesNotMatch(exact.err, /more/);
});

test('a child that ends before it has read the prompt: the failed write is not an error of its own, and how the child ended is what is reported', async () => {
  const { root } = makeRepo();
  const fake = fakeCodex('');
  const offered = [];
  // A Codex that exits at once, with a code of its own: the pipe is closed under the write of the prompt,
  // which fails as a real one does, with EPIPE, before the child's exit is seen.
  const earlyExit = () => {
    const child = new EventEmitter();
    child.pid = 4242;
    child.stdout = new PassThrough();
    child.kill = () => {};
    child.stdin = new Writable({
      write(chunk, _encoding, callback) {
        offered.push(String(chunk));
        callback(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));
      },
    });
    child.stdin.once('close', () => setImmediate(() => {
      child.stdout.end();
      child.emit('close', 3, null);
    }));
    return child;
  };
  // The timeout only bounds this test, should the child's exit never be seen.
  const result = await run(['--base', 'HEAD~1', ...OWN, '--cwd', root], { ...fake, spawnAsync: earlyExit, timeoutMs: 5000 });
  assert.equal(offered.length > 0, true, 'the prompt was offered to the child');
  assert.equal(result.code, 3, 'the exit code of the child, not one made up for the failed write');
  assert.match(result.err, /did not complete \(it exited 3\)/);
  assert.doesNotMatch(result.err, /EPIPE|no stdin|could not start/);
  assert.deepEqual(fake.killed, [], 'nothing was stopped: the child ended by itself');
  const logged = onlyRun(root);
  assert.deepEqual([logged.outcome, logged.reason], ['failed', 'it exited 3']);
  assert.equal(wrote(root), false);
});

test('a child with no stdin cannot be handed the prompt: it is stopped and the attempt fails, instead of waiting for a prompt that never comes', async () => {
  const { root } = makeRepo();
  const fake = fakeCodex('', { hang: true });
  // What no real spawn does when asked for a pipe; the review must still end.
  const noStdin = (command, args, opts) => fake.spawnAsync(command, args, { ...opts, stdio: ['ignore', 'pipe', 'inherit'] });
  // The timeout only bounds this test: should the child be left waiting, the run ends as timed out, which
  // the assertions below tell apart, instead of holding the runner for the half hour a review may take.
  const result = await run(['--base', 'HEAD~1', ...OWN, '--cwd', root], { ...fake, spawnAsync: noStdin, timeoutMs: 5000 });
  assert.equal(result.code, 1);
  assert.match(result.err, /could not start it: .*no stdin/);
  assert.deepEqual(fake.killed, [4242]);
  assert.equal(onlyRun(root).outcome, 'failed');
  assert.equal(wrote(root), false);
});

// --- the answer as data: the findings of a lean review, read from the rollout file of its sub-agent ---

/** One finding as the rubric asks for it, at `file` (absolute) from line `start` to `end`. */
const found = (file, start, end, over = {}) => ({
  title: 'Drops the last record',
  body: 'The loop stops one short, so the last line is never written.',
  confidence_score: 0.8,
  priority: 1,
  code_location: { absolute_file_path: file, line_range: { start, end } },
  ...over,
});

/** An answer with three findings in the repository at `root`, named as git names it. One gives no priority. */
function answerWith(root) {
  const top = git(root, 'rev-parse', '--show-toplevel');
  const { priority, ...unranked } = found(`${top}/f.txt`, 2, 4, { title: 'No priority given' });
  assert.equal(priority, 1);
  return {
    findings: [found(`${top}/f.txt`, 1, 1, { title: '[P1] Drops the\n  last record' }), found(`${top}/lib/deep.mjs`, 3, 9, { priority: 3, title: 'Slow on large input' }), unranked],
    overall_correctness: 'patch is incorrect',
    overall_explanation: 'One record\nis lost.',
    overall_confidence_score: 0.7,
  };
}

const THREE_FOUND = { total: 3, bySeverity: { P0: 0, P1: 1, P2: 0, P3: 1, none: 1 } };
// A finding as this command prints it: `file:line severity title`.
const FINDING_LINE = /^\S+:\d+(-\d+)? (P[0-3]|-) /;

test('a lean review prints each finding as `file:line severity title` and then the verdict, and counts them by severity in its run line', async () => {
  const { root, base, head } = makeRepo();
  // The host's own platform: the paths of the findings are the host's, as git gives them.
  for (const flags of [['--session', 'lean'], OWN]) {
    const fake = fakeCodex(reviewed(root, base), {}, PROBE_OK, answerWith(root));
    const result = await run(['--base', 'HEAD~1', '--again', ...flags, '--cwd', root], { ...fake, platform: process.platform });
    assert.equal(result.code, 0, result.err);
    const lines = result.out.split('\n');
    const at = lines.indexOf('f.txt:1 P1 [P1] Drops the last record');
    assert.notEqual(at, -1, result.out);
    assert.deepEqual(lines.slice(at, at + 4), [
      'f.txt:1 P1 [P1] Drops the last record',
      'lib/deep.mjs:3-9 P3 Slow on large input',
      'f.txt:2-4 - No priority given',
      'Codex\'s verdict: the patch is incorrect (confidence 0.7). One record is lost.',
    ]);
    assert.equal(lines.filter((line) => FINDING_LINE.test(line)).length, 3);
    assert.ok(at > lines.findIndex((line) => /exit 0 {2}/.test(line)), 'after the commands');
    assert.ok(at < lines.findIndex((line) => /^Recorded/.test(line)), 'before the record');
    assert.ok(result.shown.includes(FINDINGS), 'the review as Codex rendered it is still passed through, with the body of each finding');
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual([logged.outcome, logged.findings, logged.verdict, logged.answerSource], ['reviewed', THREE_FOUND, 'incorrect', 'rollout']);
    assert.deepEqual(runFindings(logged), THREE_FOUND);
  }
  // The record is what it was: `check --push` reads it alone, and it holds nothing of the answer.
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head), reviewedRecord(base, head)]);
});

test('a lean review that found nothing prints the verdict alone, and its run line counts zero findings, not none', async () => {
  const { root, base } = makeRepo();
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(result.code, 0, result.err);
  const lines = result.out.split('\n');
  assert.ok(lines.includes('Codex\'s verdict: the patch is correct. Nothing in the diff breaks existing behaviour.'), result.out);
  assert.equal(lines.some((line) => FINDING_LINE.test(line)), false, result.out);
  const logged = onlyRun(root);
  assert.deepEqual(logged.findings, { total: 0, bySeverity: { P0: 0, P1: 0, P2: 0, P3: 0, none: 0 } });
  assert.deepEqual([logged.verdict, logged.answerSource], ['correct', 'rollout']);
});

// What the command says of an answer it read from an attempt that does not stand.
const NOT_STANDING = 'Codex answered, but this attempt does not stand, so what it answered is not shown as a review; the run log keeps its counts.';

test('the findings and the verdict are printed only for an attempt that stands: one that failed or was not inspected says in one line that it does not', async () => {
  const { root, base } = makeRepo();
  const said = answerWith(root);
  const endings = [
    ['failed', 7, fakeCodex(reviewed(root, base), { status: 7 }, PROBE_OK, said), {}],
    ['failed', 1, fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), { type: 'turn.failed', error: { message: 'model overloaded' } }), {}, PROBE_OK, said), {}],
    ['not-inspected', 1, fakeCodex(reviewedWith(cmd('git status')), {}, PROBE_OK, said), {}],
    ['timed-out', 1, fakeCodex('', { hang: true }, PROBE_OK, said), { timeoutMs: 30 }],
  ];
  for (const [outcome, code, fake, extra] of endings) {
    for (const flags of [['--session', 'lean'], OWN]) {
      const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], { ...fake, ...extra, platform: process.platform });
      assert.equal(result.code, code, outcome);
      const lines = result.out.split('\n');
      assert.equal(lines.filter((line) => line === NOT_STANDING).length, 1, `${outcome}: ${result.out}`);
      assert.doesNotMatch(result.out, /verdict|the patch is|incorrect/i, `${outcome}: no wording of a verdict`);
      assert.equal(lines.some((line) => FINDING_LINE.test(line)), false, `${outcome}: ${result.out}`);
      assert.ok(lines.indexOf(NOT_STANDING) < lines.findIndex((line) => /^Codex (used|ran) /.test(line)), 'where the findings would have been: before what it spent');
      // The run line is a measurement, and keeps what the answer held whatever the attempt came to.
      const logged = readCodexReviewRuns(root).at(-1);
      assert.deepEqual([logged.outcome, logged.findings, logged.verdict, logged.answerSource], [outcome, THREE_FOUND, 'incorrect', 'rollout']);
    }
  }
  assert.equal(wrote(root), false);
});

test('an attempt that stands is not said to fall, and one whose answer could not be read has nothing to say of one', async () => {
  const { root, base } = makeRepo();
  const stands = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base), {}, PROBE_OK, answerWith(root)), platform: process.platform });
  assert.equal(stands.code, 0, stands.err);
  assert.match(stands.out, /^Codex's verdict: the patch is incorrect/m);
  assert.doesNotMatch(stands.out, /does not stand/);
  // An answer that could not be read is its own failure, said in the error, whether or not Codex completed.
  const unread = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base), {}, PROBE_OK, 'not an answer'));
  assert.equal(unread.code, 1);
  const none = await run(['--base', 'HEAD~1', '--again', '--cwd', root], fakeCodex(reviewed(root, base), { status: 7 }, PROBE_OK, false));
  assert.equal(none.code, 7);
  for (const result of [unread, none]) assert.doesNotMatch(result.out, /does not stand|verdict/);
});

test('a lean review whose answer cannot be read as data is a failed attempt: logged with the reason, exit 1, and no record', async () => {
  const offSchema = {
    findings: [found('/x', 1, 1, { priority: 7 }), found('/x', 0, 1), found('/x', 1, 1, { title: 7 }), found('/x', 1, 1, { body: 7 })],
    overall_correctness: 'patch is correct',
  };
  const cases = [
    [false, 'its Codex home holds no session of the review sub-agent, so there is no answer to read'],
    [null, 'the session of the review sub-agent holds no answer'],
    ['No actionable bugs were identified.', 'the answer of the review is not JSON'],
    [
      offSchema,
      'the answer of the review is off its schema (js-harness.codex-review-answer/v1): findings[0].priority: 7 is above 3; ' +
        'findings[1].code_location.line_range.start: 0 is below 1; findings[2].title: expected a string, got a number; and 2 more',
    ],
    [{ ...NO_FINDINGS, overall_correctness: 'fine' }, 'the answer of the review is off its schema (js-harness.codex-review-answer/v1): overall_correctness: expected "patch is correct" or "patch is incorrect", got "fine"'],
  ];
  for (const [said, reason] of cases) {
    for (const flags of [['--session', 'lean'], OWN]) {
      const { root, base } = makeRepo();
      const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], fakeCodex(reviewed(root, base), {}, PROBE_OK, said));
      assert.equal(result.code, 1, reason);
      const logged = onlyRun(root);
      assert.equal(logged.outcome, 'failed', reason);
      assert.equal(logged.reason, reason);
      assert.ok(result.err.includes(`Codex's turn completed, but ${reason}; no record was written.`), result.err);
      assert.match(result.err, /Rerun the review/);
      assert.deepEqual([logged.findings, logged.verdict, logged.answerSource], [null, null, null], reason);
      assert.equal(runFindings(logged), null);
      // The session did show the whole patch: that alone is still not a review.
      assert.deepEqual(logged.coverage, { seen: 2, total: 2 });
      assert.equal(result.out.includes('Codex\'s verdict'), false);
      assert.equal(wrote(root), false, 'a failed attempt is never a review record');
    }
  }
});

test('a Codex that did not complete fails as it did, with its own reason and exit code, whatever its home holds of an answer', async () => {
  const { root, base } = makeRepo();
  // No answer to read, and one that is not JSON: the exit of Codex is what is reported.
  for (const said of [false, 'not an answer']) {
    const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base), { status: 7 }, PROBE_OK, said));
    assert.equal(result.code, 7);
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual([logged.outcome, logged.reason, logged.findings], ['failed', 'it exited 7', null]);
  }
  const hung = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fakeCodex('', { hang: true }, PROBE_OK, false), timeoutMs: 30 });
  assert.equal(hung.code, 1);
  assert.equal(readCodexReviewRuns(root).at(-1).outcome, 'timed-out');
  // What it did answer before it failed is kept with what it spent: a measurement, and no review.
  const answered = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base), { status: 7 }, PROBE_OK, answerWith(root)), platform: process.platform });
  assert.equal(answered.code, 7);
  const logged = readCodexReviewRuns(root).at(-1);
  assert.deepEqual([logged.outcome, logged.reason, logged.findings, logged.verdict], ['failed', 'it exited 7', THREE_FOUND, 'incorrect']);
  assert.equal(wrote(root), false);
});

test('the answer is read from the home of the run and from no other: what the user\'s own Codex home holds of another review is never taken for this one', async () => {
  const { root, base, head } = makeRepo();
  const mine = fakeHome();
  const named = path.join(mine.home, 'named-codex-home');
  fs.mkdirSync(named);
  fs.writeFileSync(path.join(named, 'auth.json'), LOGIN, 'utf8');
  // A review session with three findings, as a real home may hold of a review that is not this one.
  writeRollouts(mine.codexHome, reviewSession(answerWith(root)));
  writeRollouts(named, reviewSession(answerWith(root)));
  for (const env of [{}, { CODEX_HOME: named }]) {
    // This review found nothing, and says so in the home of its own run.
    const result = await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...fakeCodex(reviewed(root, base)), homedir: mine.homedir }, env);
    assert.equal(result.code, 0, result.err);
    assert.match(result.out, /^Codex's verdict: the patch is correct/m);
    assert.equal(result.out.split('\n').some((line) => FINDING_LINE.test(line)), false, result.out);
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual([logged.prompt, logged.promptVersion, logged.verdict, logged.answerSource], ['codex', null, 'correct', 'rollout']);
    assert.deepEqual(runFindings(logged), { total: 0, bySeverity: { P0: 0, P1: 0, P2: 0, P3: 0, none: 0 } });
  }
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head), reviewedRecord(base, head)]);
});

// --- the run log: every attempt that launched Codex leaves one measured line ---

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// The usage of the one review of this repository that was measured in full (2026-09-30), as a
// `turn.completed` carried it then. Codex 0.160.0 reports zeros there for a review, by construction, so
// the command no longer keeps what this event says: the tokens come from the rollout files of a lean home.
const spent = { type: 'turn.completed', usage: { input_tokens: 297479, cached_input_tokens: 240640, output_tokens: 2396, reasoning_output_tokens: 703 } };
// What `exec review --json` reports on 0.160.0, whatever the review spent.
const zeros = { type: 'turn.completed', usage: { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 } };
const UNKNOWN_USAGE = { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningOutputTokens: null };

/** The counts of one token usage, in Codex's own names. */
const usageOf = (input, cached, output, reasoning) => ({
  input_tokens: input,
  cached_input_tokens: cached,
  cache_write_input_tokens: 0,
  output_tokens: output,
  reasoning_output_tokens: reasoning,
  total_tokens: input + output,
});

/** One `token_count` line of a rollout file, as Codex writes one when a response of the model ends: the
 * thread's running `total` and the `last` response's own counts. */
const tokenCount = (total, last = total) => ({
  type: 'event_msg',
  payload: { type: 'token_count', info: { total_token_usage: total, last_token_usage: last, model_context_window: 272000 }, rate_limits: null },
});

/** Writes the rollout files of `threads` (each a list of lines) into the Codex home `home`, where a
 * session that is not ephemeral leaves them. */
function writeRollouts(home, ...threads) {
  const dir = path.join(home, 'sessions', '2026', '10', '07');
  fs.mkdirSync(dir, { recursive: true });
  threads.forEach((lines, index) => fs.writeFileSync(path.join(dir, `rollout-2026-10-07T05-34-0${index}-thread-${index}.jsonl`), jsonl(...lines), 'utf8'));
}

/** `fake`, whose Codex writes the rollout files of `threads` into its home when it is launched. */
const spending = (fake, ...threads) => watching(fake, (home) => writeRollouts(home, ...threads));

// A review as its two threads leave it: the parent, which asks the model nothing, and the review's
// sub-agent, which made seven requests. The last count is the thread's total.
const parentThread = [{ type: 'session_meta', payload: { id: 'parent' } }, { type: 'event_msg', payload: { type: 'token_count', info: null, rate_limits: null } }];
const reviewThread = [
  { type: 'session_meta', payload: { id: 'review' } },
  tokenCount(usageOf(18200, 0, 210, 90)),
  tokenCount(usageOf(40100, 18176, 480, 150), usageOf(21900, 18176, 270, 60)),
  tokenCount(usageOf(71350, 40064, 820, 260), usageOf(31250, 21888, 340, 110)),
  tokenCount(usageOf(114800, 71296, 1090, 330), usageOf(43450, 31232, 270, 70)),
  tokenCount(usageOf(166300, 114688, 1400, 420), usageOf(51500, 43392, 310, 90)),
  tokenCount(usageOf(227000, 166272, 1800, 540), usageOf(60700, 51584, 400, 120)),
  tokenCount(usageOf(297479, 240640, 2396, 703), usageOf(70479, 74368, 596, 163)),
];
const REVIEW_SPENT = { inputTokens: 297479, cachedInputTokens: 240640, outputTokens: 2396, reasoningOutputTokens: 703 };

/** One `turn_context` line of a rollout file, which Codex writes for every turn with what the turn runs
 * with: the `model` and the `effort` among it (seen in a real file of codex-cli 0.161.0, names only). */
const turnContext = (model, effort) => ({ type: 'turn_context', payload: { cwd: 'D:\\x', approval_policy: 'never', model, effort, summary: 'auto' } });
/** `reviewThread` as a session that ran with what the command passes leaves it: a review of it stands. */
const ranThread = [turnContext(REVIEW_MODEL, REVIEW_EFFORT), ...reviewThread];
/** What a run line says its session ran with. */
const sessionRan = (line) => [line.sessionModel, line.sessionEffort];

test('a reviewed attempt leaves one run line, dated when the review started and timed on the monotonic clock, and the record is written after the run ended and names it', async () => {
  const { root, base, head } = makeRepo();
  // The wall clock is read for the sweep of the old homes, then when the review starts and when the
  // record is written; the time between comes from the monotonic clock, in milliseconds with a fraction.
  const now = clock('2026-09-29T11:59:59.000Z', '2026-09-29T12:00:00.000Z', '2026-09-29T12:02:00.000Z');
  const monotonicNow = ticking(5000.4, 112000.2);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), now, monotonicNow });
  assert.equal(result.code, 0, result.err);
  const logged = onlyRun(root);
  assert.deepEqual(
    [logged.id, logged.startedAt, logged.durationMs, logged.base, logged.from, logged.head, logged.outcome, logged.cli, logged.session],
    [RUN_ID, '2026-09-29T12:00:00.000Z', 107000, base, base, head, 'reviewed', '0.159.1', 'lean'],
  );
  // The record is written after the run ended, and names the run by its id.
  assert.deepEqual(readCodexReviews(root), [{ ...reviewedRecord(base, head), reviewedAt: '2026-09-29T12:02:00.000Z' }]);
});

test('a lean attempt\'s run line holds what its rollout files say it spent: the tokens, the requests, the first request and the threads', async () => {
  const { root, base, head } = makeRepo();
  const mine = fakeHome();
  // Codex's own events report zeros for a review, and they are not what is kept.
  const fake = spending(fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), zeros)), parentThread, [turnContext('gpt-6.1-sol', 'high'), ...reviewThread]);
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, homedir: mine.homedir, monotonicNow: ticking(5000.4, 112000.2) });
  assert.equal(result.code, 0, result.err);
  const expected = {
    schema: 'js-harness.codex-review-run/v1',
    id: RUN_ID,
    startedAt: '2026-09-29T12:00:00.000Z',
    durationMs: 107000,
    base,
    from: base,
    head,
    outcome: 'reviewed',
    cli: '0.159.1',
    session: 'lean',
    model: 'gpt-6.1-sol',
    effort: 'high',
    prompt: 'codex',
    promptVersion: null,
    usage: REVIEW_SPENT,
    usageSource: 'rollout',
    requests: 7,
    firstRequestInputTokens: 18200,
    threads: 1,
    // The model and the effort the session itself wrote down, apart from the two the command passed above.
    sessionModel: 'gpt-6.1-sol',
    sessionEffort: 'high',
    turns: 1,
    items: { agent_message: 1, command_execution: 1 },
    commands: { total: 1, failed: 0 },
    coverage: { seen: 2, total: 2 },
    // The answer of the review's sub-agent, read from the same home: it found nothing.
    findings: { total: 0, bySeverity: { P0: 0, P1: 0, P2: 0, P3: 0, none: 0 } },
    verdict: 'correct',
    answerSource: 'rollout',
  };
  const logged = onlyRun(root);
  assert.deepEqual(logged, expected);
  assert.deepEqual(Object.keys(logged), Object.keys(expected), 'the fields come in a fixed order');
  // They were read before the home went: nothing of it is left.
  assert.deepEqual(listed(mine.homes), []);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('the counts of several threads are added up, and a lean home with no rollout file says nothing is known', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const second = [tokenCount(usageOf(1000, 512, 40, 10)), tokenCount(usageOf(2521, 1360, 104, 97), usageOf(1521, 848, 64, 87))];
  await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...spending(fakeCodex(reviewed(root, base)), ranThread, second), homedir: mine.homedir });
  const summed = onlyRun(root);
  assert.deepEqual(summed.usage, { inputTokens: 300000, cachedInputTokens: 242000, outputTokens: 2500, reasoningOutputTokens: 800 });
  assert.deepEqual([summed.usageSource, summed.requests, summed.firstRequestInputTokens, summed.threads], ['rollout', 9, 18200, 2]);

  // Codex wrote no rollout file (an older CLI, another layout): unknown, said as `null`, and never zeros.
  // With no file there is no answer to read either, which is what fails the attempt, not the tokens.
  const noFile = fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), zeros), {}, PROBE_OK, false);
  await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...noFile, homedir: mine.homedir });
  const unknown = readCodexReviewRuns(root)[1];
  assert.deepEqual(unknown.usage, UNKNOWN_USAGE);
  assert.deepEqual([unknown.usageSource, unknown.requests, unknown.firstRequestInputTokens, unknown.threads], [null, null, null, null]);
  assert.equal(unknown.outcome, 'failed');
  assert.match(unknown.reason, /no session of the review sub-agent/);

  // Rollout files with no count in them: the files were read, so no request and no thread, and still no
  // token. A thread that made no request names no model either, which is what fails the attempt.
  await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...spending(fakeCodex(reviewed(root, base)), parentThread), homedir: mine.homedir });
  const empty = readCodexReviewRuns(root)[2];
  assert.deepEqual(empty.usage, UNKNOWN_USAGE);
  assert.deepEqual([empty.usageSource, empty.requests, empty.firstRequestInputTokens, empty.threads], [null, 0, null, 0]);
  assert.equal(empty.outcome, 'failed');
  assert.match(empty.reason, /names no model/);
});

test('the tokens are read on every way out that launched Codex, before its home is removed', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const endings = [
    ['reviewed', fakeCodex(reviewed(root, base)), {}],
    ['failed', fakeCodex(jsonl(thread, turn, { type: 'turn.failed', error: { message: 'model overloaded' } })), {}],
    ['failed', fakeCodex(reviewed(root, base), { status: 7 }), {}],
    ['not-inspected', fakeCodex(reviewedWith(cmd('git status'))), {}],
    ['timed-out', fakeCodex('', { hang: true }), { timeoutMs: 30 }],
    ['failed', fakeCodex(['x'.repeat(20), 'y'.repeat(20)]), { maxBuffer: 30 }],
  ];
  for (const [outcome, fake, extra] of endings) {
    await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...spending(fake, parentThread, ranThread), ...extra, homedir: mine.homedir });
    const logged = readCodexReviewRuns(root).at(-1);
    assert.equal(logged.outcome, outcome);
    assert.deepEqual(logged.usage, REVIEW_SPENT, outcome);
    assert.deepEqual([logged.usageSource, logged.requests, logged.firstRequestInputTokens, logged.threads], ['rollout', 7, 18200, 1], outcome);
    assert.deepEqual(listed(mine.homes), [], outcome);
  }
  assert.equal(readCodexReviewRuns(root).length, endings.length);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('what a review spent and ran on is read from the home of the run and from no other: not from the home the user named, nor from the one under the OS home', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const named = path.join(mine.home, 'named-codex-home');
  fs.mkdirSync(named);
  fs.writeFileSync(path.join(named, 'auth.json'), LOGIN, 'utf8');
  // Both hold rollout files with counts and a model, as a real home does, of sessions that are not this review.
  writeRollouts(mine.codexHome, [turnContext('gpt-another-session', 'low'), ...reviewThread]);
  writeRollouts(named, [turnContext('gpt-another-session', 'low'), ...reviewThread]);
  for (const env of [{}, { CODEX_HOME: named }]) {
    // The home of this run holds the answer of one request and no total: nothing is known of what it spent,
    // and that is what is said.
    const result = await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), spent)), homedir: mine.homedir }, env);
    assert.deepEqual([result.code, result.err], [0, '']);
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual(logged.usage, UNKNOWN_USAGE);
    assert.deepEqual([logged.usageSource, logged.requests, logged.firstRequestInputTokens, logged.threads], [null, 1, null, 1]);
    // Nor is the model of another session held against this review: it stands on the model its own file names.
    assert.deepEqual([logged.outcome, ...sessionRan(logged)], ['reviewed', REVIEW_MODEL, null]);
  }
});

test('a run line says which model and effort its session really ran with, read from its rollout file and kept apart from what the command passed', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const lean = (...threads) => run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...spending(fakeCodex(reviewed(root, base)), ...threads), homedir: mine.homedir });
  // The command asked for one model at one effort, and the session's own file says it ran with another:
  // the line keeps both, and neither is written over the other. (Such an attempt does not stand: see below.)
  await lean(parentThread, [turnContext('gpt-first-turn', 'high'), ...reviewThread, turnContext('gpt-it-ran', 'low')]);
  const differs = readCodexReviewRuns(root).at(-1);
  assert.deepEqual([differs.model, differs.effort], ['gpt-6.1-sol', 'high'], 'what the command passed');
  assert.deepEqual(sessionRan(differs), ['gpt-it-ran', 'low'], 'what the last turn of the session ran with');
  // The parent thread asks the model nothing, so what it names is not what the review ran with.
  await lean([turnContext('gpt-parent', 'high'), ...parentThread], reviewThread);
  assert.deepEqual(sessionRan(readCodexReviewRuns(root).at(-1)), [null, null], 'a review thread that names none');
  // A model with no effort beside it, and a value that is no name: each is known or not on its own.
  await lean([turnContext('gpt-it-ran', undefined), ...reviewThread]);
  assert.deepEqual(sessionRan(readCodexReviewRuns(root).at(-1)), ['gpt-it-ran', null]);
  await lean([turnContext(7, 'low'), ...reviewThread]);
  assert.deepEqual(sessionRan(readCodexReviewRuns(root).at(-1)), [null, 'low']);
  // It is read on a way out that is no review too, as the tokens are.
  await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...spending(fakeCodex(reviewedWith(cmd('git status'))), [turnContext('gpt-6.1-sol', 'high'), ...reviewThread]), homedir: mine.homedir });
  const fell = readCodexReviewRuns(root).at(-1);
  assert.deepEqual([fell.outcome, ...sessionRan(fell)], ['not-inspected', 'gpt-6.1-sol', 'high']);
  assert.equal(readCodexReviewRuns(root).every((line) => 'sessionModel' in line && 'sessionEffort' in line), true, 'every line has both fields, `null` when not known');
});

// --- one model: a review whose session ran on anything but what the command passed does not stand ---

// What a refusal over the model or the effort ends with, after the two it names.
const RAN_ON_ANOTHER = '; a review that ran on anything else does not stand, so nothing of what it answered is shown and no record was written.\nRerun the review, or record an explicit skip with `js-harness codex-review --base <rev> --unavailable <reason>`.';

/** A lean review of `root` that showed the whole patch, rendered `FINDINGS` and answered with three
 * findings, in a session whose own rollout file says it ran with `ran` (a `turnContext`, or none). */
const leanReviewThatRan = (root, base, ran, mine, extra = {}) => run(
  ['--base', 'HEAD~1', '--cwd', root],
  { ...spending(fakeCodex(reviewed(root, base), {}, PROBE_OK, answerWith(root)), parentThread, [...(ran ? [ran] : []), ...reviewThread]), homedir: mine.homedir, platform: process.platform, ...extra },
);

test('a lean review whose session ran on another model does not stand: no record, nothing of its answer shown, exit 1, and a failed run line that names what was asked and what ran', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const result = await leanReviewThatRan(root, base, turnContext('gpt-6-astra', 'high'), mine);
  assert.equal(result.code, 1);
  const why = 'its session ran on gpt-6-astra at high effort, and the command passed gpt-6.1-sol at high effort';
  assert.equal(result.err, `Codex's turn completed, but ${why}${RAN_ON_ANOTHER}`);
  // Nothing of the answer: not the review as Codex rendered it, not a finding, not the verdict.
  assert.equal(result.shown, '', 'what Codex rendered is not passed through');
  const lines = result.out.split('\n');
  assert.equal(lines.some((line) => FINDING_LINE.test(line) || /verdict|the patch is/.test(line)), false, result.out);
  assert.equal(lines.filter((line) => line === NOT_STANDING).length, 1, result.out);
  assert.doesNotMatch(result.out, /Recorded/);
  assert.equal(wrote(root), false, 'no record');
  // The run line: a failed attempt, with the reason, both pairs, and what it measured all the same.
  const logged = onlyRun(root);
  assert.deepEqual([logged.outcome, logged.reason], ['failed', why]);
  assert.deepEqual([logged.model, logged.effort, ...sessionRan(logged)], ['gpt-6.1-sol', 'high', 'gpt-6-astra', 'high']);
  assert.deepEqual([logged.usage, logged.findings, logged.coverage], [REVIEW_SPENT, THREE_FOUND, { seen: 2, total: 2 }]);
  assert.deepEqual(listed(mine.homes), []);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('a lean review whose session ran at another effort does not stand either, and each of the two is held to on its own', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const asked = 'and the command passed gpt-6.1-sol at high effort';
  const refusals = [
    // The effort the command passed until 2026-10-08, on the right model.
    [turnContext('gpt-6.1-sol', 'medium'), 'its session ran on gpt-6.1-sol at medium effort'],
    [turnContext('gpt-6-astra', 'low'), 'its session ran on gpt-6-astra at low effort'],
    // One of the two is not known and the other differs: what is known is enough.
    [turnContext('gpt-6-astra', undefined), 'its session ran on gpt-6-astra at an effort its rollout file does not name'],
    [turnContext(7, 'low'), 'its session ran on a model its rollout file does not name at low effort'],
  ];
  for (const [ran, said] of refusals) {
    const result = await leanReviewThatRan(root, base, ran, mine);
    assert.equal(result.code, 1, said);
    assert.equal(result.err, `Codex's turn completed, but ${said}, ${asked}${RAN_ON_ANOTHER}`);
    assert.equal(result.shown, '', said);
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual([logged.outcome, logged.reason], ['failed', `${said}, ${asked}`]);
  }
  assert.equal(wrote(root), false);
});

test('a lean review whose session names no model does not stand: a review that cannot say which model it ran on is refused as one that ran on another', async () => {
  const mine = fakeHome();
  const why = 'its session\'s rollout file names no model, so nothing says that it ran on gpt-6.1-sol, the model the command passed';
  const unnamed = [
    // No `turn_context` line at all, as the files this reader was first written against.
    [null, [null, null]],
    // The effort the command passed, beside a model that is no name: the effort does not stand in for it.
    [turnContext(7, 'high'), [null, 'high']],
  ];
  for (const [ran, measured] of unnamed) {
    const { root, base } = makeRepo();
    const result = await leanReviewThatRan(root, base, ran, mine);
    assert.equal(result.code, 1, JSON.stringify(measured));
    assert.equal(
      result.err,
      `Codex's turn completed, but ${why}; a review that cannot say which model it ran on does not stand, so nothing of what it answered is shown and no record was written.\n` +
        'Rerun the review, or record an explicit skip with `js-harness codex-review --base <rev> --unavailable <reason>`.',
    );
    // Nothing of the answer, as for a session that ran on another model: nobody can say whose review it is.
    assert.equal(result.shown, '', 'what Codex rendered is not passed through');
    const lines = result.out.split('\n');
    assert.equal(lines.some((line) => FINDING_LINE.test(line) || /verdict|the patch is/.test(line)), false, result.out);
    assert.equal(lines.filter((line) => line === NOT_STANDING).length, 1, result.out);
    assert.equal(wrote(root), false, 'no record');
    // The run line: a failed attempt, with the reason, what was asked and what it measured all the same.
    const logged = onlyRun(root);
    assert.deepEqual([logged.outcome, logged.reason, logged.model, logged.effort, ...sessionRan(logged)], ['failed', why, 'gpt-6.1-sol', 'high', ...measured]);
    assert.deepEqual([logged.usage, logged.findings, logged.coverage], [REVIEW_SPENT, THREE_FOUND, { seen: 2, total: 2 }]);
  }
  assert.deepEqual(listed(mine.homes), []);
});

test('the effort keeps its rule: a lean review whose session names the model and no effort stands, since what was not measured of the effort is not held against it', async () => {
  const mine = fakeHome();
  const named = [
    // The model the command passed and no effort.
    [turnContext('gpt-6.1-sol', undefined), ['gpt-6.1-sol', null]],
    // And both, as asked.
    [turnContext('gpt-6.1-sol', 'high'), ['gpt-6.1-sol', 'high']],
  ];
  for (const [ran, measured] of named) {
    const { root, base, head } = makeRepo();
    const result = await leanReviewThatRan(root, base, ran, mine);
    assert.deepEqual([result.code, result.err], [0, ''], JSON.stringify(measured));
    assert.ok(result.shown.includes(FINDINGS), 'the review is passed through');
    assert.match(result.out, /^Codex's verdict: the patch is incorrect/m);
    assert.doesNotMatch(result.out, /does not stand/);
    const logged = onlyRun(root);
    assert.deepEqual([logged.outcome, 'reason' in logged, ...sessionRan(logged)], ['reviewed', false, ...measured]);
    assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
  }
});

test('when the turn did not complete, that is what is said, whatever the session ran on: the model is asked of a review that completed', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const fake = spending(fakeCodex(reviewed(root, base), { status: 7 }, PROBE_OK, answerWith(root)), parentThread, [turnContext('gpt-6-astra', 'low'), ...reviewThread]);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, homedir: mine.homedir, platform: process.platform });
  assert.equal(result.code, 7);
  assert.match(result.err, /The Codex review did not complete \(it exited 7\)/);
  assert.doesNotMatch(result.err, /its session ran on/);
  assert.deepEqual([onlyRun(root).outcome, onlyRun(root).reason, ...sessionRan(onlyRun(root))], ['failed', 'it exited 7', 'gpt-6-astra', 'low']);
  // Nor is what it rendered shown: it is the review of a model the command did not ask for.
  assert.equal(result.shown, '');
});

test('the run log is a second file in the folder of the review record, and a run line is not a record', async () => {
  const { root, base } = makeRepo();
  await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(path.basename(codexReviewRunsPath(root)), 'codex-review-runs.jsonl');
  assert.equal(path.dirname(codexReviewRunsPath(root)), path.dirname(codexReviewsPath(root)));
  assert.equal(readCodexReviews(root).length, 1);
  assert.equal(readCodexReviewRuns(root).length, 1);
  assert.equal(git(root, 'status', '--porcelain'), '', 'neither file joins the working tree');
});

test('without an injected id each run gets a UUID of its own, and the record names the one of its run', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, randomUUID: undefined });
  await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...fake, randomUUID: undefined });
  const ids = readCodexReviewRuns(root).map((line) => line.id);
  assert.equal(ids.length, 2);
  for (const id of ids) assert.match(id, UUID);
  assert.notEqual(ids[0], ids[1]);
  assert.deepEqual(readCodexReviews(root).map((record) => record.run), ids);
});

test('the run line holds the turns and every item by type, known or not; the usage of Codex\'s events is not kept', async () => {
  const { root, base } = makeRepo();
  const other = { type: 'item.completed', item: { id: 'x', type: 'mcp_tool_call', server: 's', tool: 't' } };
  const reasoning = { type: 'item.completed', item: { id: 'r', type: 'reasoning', text: 'thinking' } };
  const events = jsonl(thread, turn, reasoning, cmd('git status', 128), spent, turn, other, cmd(diffCmd(base), 0, patchOf(root, base)), reasoning, msg(FINDINGS), spent);
  // With no count in the rollout files of its home, a `usage` in the events is never taken instead.
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(events));
  assert.equal(result.code, 0, result.err);
  const logged = onlyRun(root);
  assert.deepEqual(logged.usage, UNKNOWN_USAGE);
  assert.equal(logged.usageSource, null);
  assert.equal(logged.turns, 2);
  assert.deepEqual(logged.items, { agent_message: 1, command_execution: 2, mcp_tool_call: 1, reasoning: 2 });
  assert.deepEqual(logged.commands, { total: 2, failed: 1 });
});

test('`cli` is the version `codex --version` printed', async () => {
  for (const [stdout, version] of [['codex-cli 0.160.0\n', '0.160.0'], ['codex-cli 0.161.0-alpha.2\r\n', '0.161.0-alpha.2'], ['0.158.3', '0.158.3']]) {
    const { root, base } = makeRepo();
    const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base), {}, { status: 0, stdout }));
    assert.equal(result.code, 0);
    assert.equal(onlyRun(root).cli, version);
  }
});

test('a turn that completed without meeting the evidence rule is logged as not inspected, with the reason the error gives', async () => {
  const blank = () => makeRepoWith({ 'b.txt': 'a\nb\n' }, { 'b.txt': 'a\n\nb\n' });
  const cases = [
    [makeRepo, () => reviewedWith(cmd('git status')), /^its successful commands showed 0 of 2 changed lines of [0-9a-f]{7}\.\.HEAD$/, { seen: 0, total: 2 }],
    [makeRepo, (root, base) => jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), done), /^it ended without a review message$/, { seen: 2, total: 2 }],
    [blank, () => reviewedWith(cmd('git status', 1)), /^it ran no successful command$/, { seen: 0, total: 0 }],
  ];
  for (const [repo, stdout, reason, coverage] of cases) {
    const { root, base } = repo();
    const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(stdout(root, base)));
    assert.equal(result.code, 1);
    const logged = onlyRun(root);
    assert.equal(logged.outcome, 'not-inspected');
    assert.match(logged.reason, reason);
    assert.ok(result.err.includes(logged.reason), 'the same words as the error');
    assert.deepEqual(logged.coverage, coverage);
    assert.equal(logged.turns, 1);
    assert.equal(wrote(root), false, 'a run line is not a review record');
  }
});

test('an attempt that did not complete is logged as failed, with the reason the error gives and the exit code unchanged', async () => {
  const boom = { error: new Error('boom') };
  const cases = [
    [(root, base) => fakeCodex(reviewed(root, base), { status: 7 }), 'it exited 7', 7],
    [() => fakeCodex('', { status: null, signal: 'SIGTERM' }), 'it exited on SIGTERM', 1],
    [(root, base) => fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), { type: 'turn.failed', error: { message: 'model rejected' } })), 'the turn failed', 1],
    [(root, base) => fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS))), 'the turn never completed', 1],
    [() => fakeCodex('', boom), 'could not start it: boom', 1],
    [() => ({ ...fakeCodex(['x'.repeat(20), 'y'.repeat(20)]), maxBuffer: 30 }), 'its output exceeded 64 MiB', 1],
  ];
  for (const [fake, reason, code] of cases) {
    const { root, base } = makeRepo();
    const result = await run(['--base', 'HEAD~1', '--cwd', root], fake(root, base));
    assert.equal(result.code, code, reason);
    const logged = onlyRun(root);
    assert.equal(logged.outcome, 'failed', reason);
    assert.equal(logged.reason, reason);
    assert.ok(result.err.includes(`did not complete (${reason})`), 'the same words as the error');
    assert.equal(wrote(root), false, 'a failed attempt is never a review record');
  }
});

test('a failed attempt still holds what Codex spent before it failed', async () => {
  const { root, base, head } = makeRepo();
  const fake = spending(fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), zeros), { status: 7 }), parentThread, reviewThread);
  await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, monotonicNow: ticking(100, 9600) });
  const logged = onlyRun(root);
  assert.equal(logged.outcome, 'failed');
  assert.equal(logged.usage.inputTokens, 297479);
  assert.equal(logged.usage.reasoningOutputTokens, 703);
  assert.equal(logged.requests, 7);
  assert.deepEqual(logged.items, { agent_message: 1, command_execution: 1 });
  assert.deepEqual(logged.coverage, { seen: 2, total: 2 });
  assert.equal(logged.durationMs, 9500);
  assert.deepEqual([logged.base, logged.from, logged.head, logged.cli], [base, base, head, '0.159.1']);
});

test('an attempt that never started has a run line with nothing measured: null counts, not zeros', async () => {
  const { root } = makeRepo();
  for (const flags of [[], ['--session', 'lean']]) {
    const which = flags.join(' ') || 'no flag';
    await run(['--base', 'HEAD~1', ...flags, '--cwd', root], fakeCodex('', { error: new Error('boom') }));
    const logged = readCodexReviewRuns(root).at(-1);
    assert.equal(logged.session, 'lean', which);
    assert.deepEqual(logged.usage, UNKNOWN_USAGE, which);
    assert.deepEqual([logged.usageSource, logged.requests, logged.firstRequestInputTokens, logged.threads], [null, null, null, null], which);
    assert.equal(logged.turns, 0);
    assert.deepEqual(logged.items, {});
    assert.deepEqual(logged.commands, { total: 0, failed: 0 });
    assert.deepEqual(logged.coverage, { seen: 0, total: 2 });
  }
});

test('a review stopped at the timeout is logged as timed out', async () => {
  const { root } = makeRepo();
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex('', { hang: true }), timeoutMs: 30 });
  assert.equal(result.code, 1);
  const logged = onlyRun(root);
  assert.equal(logged.outcome, 'timed-out');
  assert.equal(logged.reason, 'it ran past 30 minutes and was stopped');
  assert.equal(wrote(root), false);
});

test('a review stopped by Ctrl-C is logged as interrupted', async () => {
  const { root } = makeRepo();
  const fake = fakeCodex('', { hang: true });
  const signals = new EventEmitter();
  const pending = run(['--base', 'HEAD~1', '--cwd', root], { ...fake, signals });
  while (fake.calls.length === 0) await new Promise((resolve) => setImmediate(resolve));
  signals.emit('SIGINT');
  const result = await pending;
  assert.equal(result.code, 1);
  const logged = onlyRun(root);
  assert.equal(logged.outcome, 'interrupted');
  assert.equal(logged.reason, 'it was interrupted and stopped');
  assert.equal(wrote(root), false);
});

test('every attempt adds its own line, and only the reviewed one adds a record', async () => {
  const { root, base } = makeRepo();
  await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base), { status: 7 }));
  await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewedWith(cmd('git status'))));
  await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.deepEqual(readCodexReviewRuns(root).map((line) => line.outcome), ['failed', 'not-inspected', 'reviewed']);
  assert.deepEqual(readCodexReviews(root).map((record) => record.outcome), ['reviewed']);
});

test('what launches no Codex leaves no run line: a skip, a refusal, a missing CLI', async () => {
  const { root, base, head } = makeRepo();
  const skipped = await run(['--base', 'HEAD~1', '--unavailable', 'model rejected', '--cwd', root], fakeCodex(''));
  assert.equal(skipped.code, 0);
  assert.deepEqual(readCodexReviews(root), [skippedRecord(base, head, 'model rejected')], 'the skip is recorded as before, with no run');

  const unknown = await run(['--base', 'no-such-rev', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(unknown.code, 1);

  const missing = await run(['--base', 'HEAD~1', '--again', '--cwd', root], fakeCodex(reviewed(root, base), {}, { status: 1, stdout: '' }));
  assert.match(missing.err, /npm i -g @openai\/codex/);

  const fake = fakeCodex(reviewed(root, base));
  const noDiff = (command, args, opts) =>
    command === 'git' && args[0] === 'diff' ? { status: 128, stdout: '', stderr: 'fatal: bad object' } : fake.spawn(command, args, opts);
  assert.equal((await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...fake, spawn: noDiff })).code, 1);

  fs.writeFileSync(path.join(root, 'f.txt'), 'dirty', 'utf8');
  const dirty = await run(['--base', 'HEAD~1', '--again', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.match(dirty.err, /commit or stash/i);

  assert.equal(loggedRun(root), false);
  assert.doesNotMatch([skipped, unknown, missing, dirty].map((result) => result.out).join('\n'), /Codex used|Codex ran/);
});

test('the wall time is measured on the monotonic clock: a wall clock that steps during the review changes nothing', async () => {
  const { root, base } = makeRepo();
  // The wall clock is set back an hour while Codex runs; `startedAt` is still its reading at the launch.
  // The default session reads the wall clock once more before that, to sweep the homes a killed run left,
  // so the clock answers that reading first.
  const now = clock('2026-09-29T12:00:00.000Z', '2026-09-29T12:00:00.000Z', '2026-09-29T11:00:00.000Z');
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), now, monotonicNow: ticking(1000, 3500.6) });
  assert.equal(result.code, 0);
  const logged = onlyRun(root);
  assert.equal(logged.startedAt, '2026-09-29T12:00:00.000Z');
  assert.equal(logged.durationMs, 2501, 'whole milliseconds, rounded');
  assert.match(result.out, /^Codex ran for 3 s; /m);
});

test('the wall time is never below zero', async () => {
  const { root, base } = makeRepo();
  await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), monotonicNow: ticking(10, 4) });
  assert.equal(onlyRun(root).durationMs, 0);
});

test('a monotonic clock that gives no finite number leaves the wall time unknown: `null` in the run line, said in the summary', async () => {
  const { root, base, head } = makeRepo();
  const broken = [() => Number.NaN, ticking(0, Infinity), ticking(-Infinity, 0), () => undefined, () => '2500', ticking(0, null)];
  for (const monotonicNow of broken) {
    const result = await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...fakeCodex(reviewed(root, base)), monotonicNow });
    assert.equal(result.code, 0, result.err);
    assert.match(result.out, /^Codex ran for unknown s; /m);
    assert.doesNotMatch(result.out, /NaN|Infinity/);
  }
  const runs = readCodexReviewRuns(root);
  assert.deepEqual(runs.map((line) => line.durationMs), broken.map(() => null));
  assert.equal(Object.keys(runs[0]).includes('durationMs'), true, 'the field is there, and says not measured');
  assert.equal(readCodexReviews(root).length, broken.length);
  assert.deepEqual(readCodexReviews(root)[0], reviewedRecord(base, head));
});

test('a monotonic clock that throws does not change how an attempt ends: the wall time is unknown and the rest is kept', async () => {
  const { root, base, head } = makeRepo();
  const noClock = () => {
    throw new Error('no clock');
  };
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), monotonicNow: noClock });
  assert.equal(result.code, 0, result.err);
  assert.equal(onlyRun(root).durationMs, null);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
  const failed = await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...fakeCodex(reviewed(root, base), { status: 7 }), monotonicNow: noClock });
  assert.equal(failed.code, 7);
  assert.match(failed.err, /did not complete.*exited 7/is);
});

test('without an injected monotonic clock the wall time is a whole number of milliseconds, zero or more', async () => {
  const { root, base } = makeRepo();
  await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), monotonicNow: undefined });
  const { durationMs } = onlyRun(root);
  assert.ok(Number.isInteger(durationMs) && durationMs >= 0, String(durationMs));
});

/** Puts a folder where the run log goes, so that the append fails. */
function blockRunLog(root) {
  fs.mkdirSync(codexReviewRunsPath(root), { recursive: true });
}

/** Puts a folder where the review record goes, so that its append fails; the run log, a second file
 * in the same folder, can still be written. */
function blockRecord(root) {
  fs.mkdirSync(codexReviewsPath(root), { recursive: true });
}

test('a record that cannot be written after a reviewed run: exit 1, the error says so, and the run log holds the one reviewed line', async () => {
  const { root, base, head } = makeRepo();
  blockRecord(root);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(result.code, 1);
  assert.match(result.err, /Could not write the record: /);
  assert.doesNotMatch(result.err, /run log/);
  assert.doesNotMatch(result.out, /Recorded/);
  // The session happened and met the evidence rule, so its measurement stays; no record names it.
  const logged = onlyRun(root);
  assert.equal(logged.outcome, 'reviewed');
  assert.equal('reason' in logged, false);
  assert.deepEqual([logged.id, logged.base, logged.head], [RUN_ID, base, head]);
  assert.equal(fs.statSync(codexReviewsPath(root)).isDirectory(), true, 'no record file was written');
  assert.deepEqual(readCodexReviews(root), []);
});

/** A wall clock whose reading at the start of the review is no date, so that the run line cannot even be
 * built (its `startedAt` cannot be written). The readings around it are dates: the one before, for the
 * sweep of the old homes, and the one after, for the record. The id of the run is no way to the same
 * failure: it is made before the launch, to name the home, and a source that fails starts no review
 * (tested with the lean home, above). */
const noStartDate = () => clock('2026-09-29T12:00:00.000Z', 'no date at all', '2026-09-29T12:00:00.000Z');

test('a run line that cannot be built is the same warning: the reviewed attempt still writes its record, naming no run', async () => {
  const { root, base, head } = makeRepo();
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), now: noStartDate() });
  assert.equal(result.code, 0, result.err);
  assert.match(result.err, /^Could not write the run log, so what this attempt measured was not kept: Invalid time value$/);
  const { run: _run, ...withoutRun } = reviewedRecord(base, head);
  assert.deepEqual(readCodexReviews(root), [withoutRun]);
  assert.match(result.out, /Recorded the Codex review/);
  assert.equal(loggedRun(root), false);
  assert.deepEqual(listed(leanHomesDir(osHome)), [], 'and its home went as it does');
});

test('a run line that cannot be built does not change how a failed attempt ends', async () => {
  const { root, base } = makeRepo();
  const failed = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base), { status: 7 }), now: noStartDate() });
  assert.equal(failed.code, 7);
  assert.match(failed.err, /Could not write the run log.*Invalid time value/);
  assert.match(failed.err, /did not complete.*exited 7/is);
  const unseen = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewedWith(cmd('git status'))), now: noStartDate() });
  assert.equal(unseen.code, 1);
  assert.match(unseen.err, /Could not write the run log.*Invalid time value/);
  assert.match(unseen.err, /showed 0 of 2 changed lines/);
  assert.equal(wrote(root), false);
  assert.equal(loggedRun(root), false);
});

test('a run log that cannot be written is a warning: the reviewed attempt still writes its record, naming no run', async () => {
  const { root, base, head } = makeRepo();
  blockRunLog(root);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(result.code, 0);
  assert.match(result.err, /Could not write the run log/);
  const { run: _run, ...withoutRun } = reviewedRecord(base, head);
  assert.deepEqual(readCodexReviews(root), [withoutRun]);
  assert.match(result.out, /Recorded the Codex review/);
});

test('a run log that cannot be written does not change how a failed attempt ends', async () => {
  const { root, base } = makeRepo();
  blockRunLog(root);
  const failed = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base), { status: 7 }));
  assert.equal(failed.code, 7);
  assert.match(failed.err, /Could not write the run log/);
  assert.match(failed.err, /did not complete.*exited 7/is);
  const unseen = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewedWith(cmd('git status'))));
  assert.equal(unseen.code, 1);
  assert.match(unseen.err, /Could not write the run log/);
  assert.match(unseen.err, /showed 0 of 2 changed lines/);
  assert.equal(wrote(root), false);
});

test('after a lean run one line says what Codex spent: tokens, wall time, requests and the items, most frequent first', async () => {
  const { root, base } = makeRepo();
  const statuses = Array.from({ length: 5 }, () => cmd('git status'));
  const fake = spending(fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), ...statuses, msg(FINDINGS), zeros)), parentThread, ranThread);
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, monotonicNow: ticking(0, 107000) });
  assert.equal(result.code, 0);
  const lines = result.out.split('\n');
  const at = lines.indexOf('Codex used 297,479 input tokens (240,640 cached) and 2,396 output (703 reasoning) in 107 s over 7 requests: 6 command_execution, 1 agent_message.');
  assert.notEqual(at, -1, result.out);
  assert.ok(at > lines.findIndex((line) => /exit 0 {2}/.test(line)), 'after the commands');
  assert.ok(at < lines.findIndex((line) => /^Recorded/.test(line)), 'before the record');
});

test('the summary says `unknown` for a count the rollout files did not report, and one request is one `request`', async () => {
  const { root, base } = makeRepo();
  const reasoning = { type: 'item.completed', item: { id: 'r', type: 'reasoning', text: 'thinking' } };
  const partial = spending(fakeCodex(jsonl(thread, turn, reasoning, cmd(diffCmd(base), 0, patchOf(root, base)), reasoning, msg(FINDINGS), zeros)), [turnContext(REVIEW_MODEL, REVIEW_EFFORT), tokenCount({ input_tokens: 1200, output_tokens: 0 })]);
  const reviewedRun = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], partial);
  assert.ok(reviewedRun.out.includes('Codex used 1,200 input tokens (unknown cached) and 0 output (unknown reasoning) in 0 s over 1 request: 2 reasoning, 1 agent_message, 1 command_execution.'), reviewedRun.out);
  // A wall time that was not measured is said in this line as in the other.
  const untimed = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...spending(fakeCodex(reviewed(root, base)), ranThread), monotonicNow: () => Number.NaN });
  assert.match(untimed.out, /\(703 reasoning\) in unknown s over 7 requests: /);
});

test('when the tokens are not known the summary says so plainly, with no zeros and no row of `unknown`', async () => {
  const { root, base } = makeRepo();
  // The home of the run held no token count, whatever Codex's own events carry: they are never taken instead.
  for (const completed of [zeros, spent, done]) {
    const result = await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), completed)), monotonicNow: ticking(0, 18000) });
    assert.equal(result.code, 0, result.err);
    const lines = result.out.split('\n');
    const at = lines.indexOf('Codex ran for 18 s; its tokens are not known for this session (its Codex home held no token count): 1 agent_message, 1 command_execution.');
    assert.notEqual(at, -1, result.out);
    assert.ok(at > lines.findIndex((line) => /exit 0 {2}/.test(line)), 'after the commands');
    assert.ok(at < lines.findIndex((line) => /^Recorded/.test(line)), 'before the record');
    assert.doesNotMatch(result.out, /Codex used|unknown| 0 input| 0 output|ephemeral/);
  }
  // It is printed for a failed attempt too.
  const failed = await run(['--base', 'HEAD~1', '--again', '--cwd', root], fakeCodex('', { error: new Error('boom') }));
  assert.equal(failed.code, 1);
  assert.ok(failed.out.includes('Codex ran for 0 s; its tokens are not known for this session (its Codex home held no token count): no items.'), failed.out);
});

// --- a large range, in parts: several lean sessions, one after another, each over some of the files ---

/** The id of the `n`-th run of one command, from 1. */
const idOf = (n) => `00000000-0000-4000-8000-00000000000${n}`;

/** A source of ids for the runs of one command, in order: every part of a range is a run of its own. */
function runIds() {
  let made = 0;
  return () => idOf((made += 1));
}

/** What `git --literal-pathspecs diff --no-renames <base> <head> -- <files>` prints in `root`: the command the
 * prompt of a part names, where each of `files` is that one path and no pattern. */
const partDiff = (root, base, head, ...files) => git(root, '--literal-pathspecs', 'diff', '--no-color', '--no-ext-diff', '--no-renames', base, head, '--', ...files);

/** The events of a session that ran the command of its part, got the whole diff of `files` back, and ended
 * with the review `rendered`; with `null`, it ended with no message at all. */
const partSaid = (rendered, root, base, head, ...files) =>
  jsonl(thread, turn, cmd(`git --literal-pathspecs diff --no-renames ${base} ${head} -- ${files.join(' ')}`, 0, partDiff(root, base, head, ...files)), ...(rendered === null ? [] : [msg(rendered)]), done);

/** The events of a session that ran the command of its part and got the whole diff of `files` back. */
const partShown = (root, base, head, ...files) => partSaid(FINDINGS, root, base, head, ...files);

/** A fake Codex for a range reviewed in parts: the n-th session launched is `sessions[n]`, each `{ stdout,
 * answer, said }` as `fakeCodex` takes them, with `threads` to leave as rollout files in its home and
 * `during(home)` to look at that home as the session starts. `order` logs each session starting and ending,
 * and a session nobody listed fails to start. */
function fakeCodexInParts(...sessions) {
  const { spawn, killTree, probes, killed } = fakeCodex('');
  const calls = [];
  const order = [];
  const spawnAsync = (command, args, opts) => {
    const at = calls.length;
    const session = sessions[at];
    if (session === undefined) throw new Error(`session ${at + 1} was launched, and ${sessions.length} were expected`);
    order.push(`start ${at + 1}`);
    const home = opts.env.CODEX_HOME;
    if (session.threads) writeRollouts(home, ...session.threads);
    session.during?.(home);
    const { stdout = '', answer = {}, said = NO_FINDINGS } = session;
    const child = fakeCodex(stdout, answer, PROBE_OK, said).spawnAsync(command, args, opts);
    child.on('close', () => order.push(`end ${at + 1}`));
    calls.push({ command, args, opts, child, home });
    return child;
  };
  return { spawn, spawnAsync, killTree, probes, killed, calls, order };
}

// The three files of `makeThreeFileRepo` as two parts of at most six changed lines, and as three of at most four.
const TWO_PARTS = ['--session', 'lean', '--part-lines', '6'];
const THREE_PARTS = ['--session', 'lean', '--part-lines', '4'];

test('a lean range over the bound is reviewed in parts: one session after another, each over its own files and in a home of its own, and one record for the whole range', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const mine = fakeHome();
  const seen = [];
  const during = (home) => seen.push({ home, entries: listed(home), homes: listed(mine.homes) });
  const fake = fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt', 'b.txt'), during }, { stdout: partShown(root, base, head, 'c.txt'), during });
  const result = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--cwd', root], { ...fake, homedir: mine.homedir, randomUUID: runIds() });
  assert.equal(result.code, 0, result.err);
  assert.equal(result.err, '');
  assert.deepEqual(fake.order, ['start 1', 'end 1', 'start 2', 'end 2'], 'never two sessions at once');
  // Each part is asked with this command's own prompt, on stdin, naming its files in the command that shows them.
  const parts = [{ index: 1, of: 2, files: ['a.txt', 'b.txt'] }, { index: 2, of: 2, files: ['c.txt'] }];
  fake.calls.forEach((call, at) => {
    assert.deepEqual(call.args, ownArgv(), `part ${at + 1}`);
    assert.deepEqual(call.opts.stdio, ['pipe', 'pipe', 'inherit']);
    assert.deepEqual(call.child.received, { text: reviewPrompt({ from: base, head, part: parts[at] }), ended: true });
  });
  assert.ok(fake.calls[0].child.received.text.includes(`\`git --literal-pathspecs diff --no-renames ${base} ${head} -- a.txt b.txt\``));
  // A home per part, named after its run, holding the login alone, and the only one there while it runs.
  assert.deepEqual(seen, [idOf(1), idOf(2)].map((id) => ({ home: path.join(mine.homes, id), entries: ['auth.json'], homes: [id] })));
  assert.deepEqual(listed(mine.homes), []);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
  // A run line per part: its own evidence, over the changed lines of its own files, and the range of the whole.
  const runs = readCodexReviewRuns(root);
  assert.deepEqual(runs.map((line) => [line.id, line.outcome, line.part, line.coverage, line.prompt, line.promptVersion]), [
    [idOf(1), 'reviewed', { index: 1, of: 2, files: 2, changedLines: 6 }, { seen: 6, total: 6 }, 'own', REVIEW_PART_PROMPT_VERSION],
    [idOf(2), 'reviewed', { index: 2, of: 2, files: 1, changedLines: 2 }, { seen: 2, total: 2 }, 'own', REVIEW_PART_PROMPT_VERSION],
  ]);
  assert.deepEqual(runs.map(runPart), runs.map((line) => line.part));
  for (const line of runs) assert.deepEqual([line.base, line.from, line.head, line.session], [base, base, head, 'lean']);
  assert.deepEqual(Object.keys(runs[0]).slice(4, 9), ['base', 'from', 'head', 'part', 'outcome'], 'the part comes after the range it is a part of');
  // One record, of the shape `check --push` reads, for the whole range; it names the runs of its parts.
  assert.deepEqual(readCodexReviews(root), [{ ...reviewedRecord(base, head), run: idOf(2), runs: [idOf(1), idOf(2)] }]);
  // `check --push` counts a record only when this says it is one, so the fields of a review in parts must not unmake it.
  assert.equal(isValidCodexReview(readCodexReviews(root)[0]), true);
  // What is said: that the range is split and why each part is asked as it is, each part as it starts, and the record.
  const lines = result.out.split('\n');
  const short = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  assert.equal(afterPlan(result.out)[0], `The range ${short} changes 8 lines in 3 files, more than the 6 a part holds, so it is reviewed in 2 parts, one after another.`);
  assert.equal(afterPlan(result.out)[1], 'Each part is asked with this command\'s own prompt: the sentence Codex writes for `--base` cannot be limited to some files.');
  assert.ok(lines.includes(`Codex is reviewing part 1 of 2 of ${short} (2 files, 6 changed lines) with the lean session (gpt-6.1-sol, high) and this command's own prompt; this can take several minutes.`), result.out);
  assert.ok(lines.includes(`Codex is reviewing part 2 of 2 of ${short} (1 file, 2 changed lines) with the lean session (gpt-6.1-sol, high) and this command's own prompt; this can take several minutes.`), result.out);
  assert.match(lines.at(-1), new RegExp(`^Recorded the Codex review of ${short}, made in 2 parts, in .*codex-reviews\\.jsonl\\.$`));
});

test('the run line of each part says what its own session ran with', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const mine = fakeHome();
  const fake = fakeCodexInParts(
    { stdout: partShown(root, base, head, 'a.txt', 'b.txt'), threads: [parentThread, [turnContext('gpt-6.1-sol', 'high'), ...reviewThread]] },
    { stdout: partShown(root, base, head, 'c.txt'), threads: [parentThread, [turnContext('gpt-6.1-sol', undefined), ...reviewThread]] },
  );
  const result = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--cwd', root], { ...fake, homedir: mine.homedir, randomUUID: runIds() });
  assert.equal(result.code, 0, result.err);
  // Each part is a session in a home of its own, so the second does not repeat what the first one measured.
  assert.deepEqual(readCodexReviewRuns(root).map((line) => [line.part.index, line.model, line.effort, ...sessionRan(line)]), [
    [1, 'gpt-6.1-sol', 'high', 'gpt-6.1-sol', 'high'],
    [2, 'gpt-6.1-sol', 'high', 'gpt-6.1-sol', null],
  ]);
});

test('a part whose session ran on another model fails the range: the parts after it are not started, nothing any part answered is shown, and no review is recorded', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const mine = fakeHome();
  // Three parts. The first passes, with findings, on the model the command passed; the second ran another.
  const fake = fakeCodexInParts(
    { stdout: partSaid(RENDERED[0], root, base, head, 'a.txt'), said: answerWith(root), threads: [parentThread, [turnContext('gpt-6.1-sol', 'high'), ...reviewThread]] },
    { stdout: partSaid(RENDERED[1], root, base, head, 'b.txt'), said: answerWith(root), threads: [parentThread, [turnContext('gpt-6-astra', 'low'), ...reviewThread]] },
  );
  const result = await run(['--base', 'HEAD~1', ...THREE_PARTS, '--cwd', root], { ...fake, homedir: mine.homedir, platform: process.platform, randomUUID: runIds() });
  assert.equal(result.code, 1);
  assert.equal(fake.calls.length, 2, 'the third part was never started');
  const why = 'its session ran on gpt-6-astra at low effort, and the command passed gpt-6.1-sol at high effort';
  assert.ok(result.err.includes(`Codex's turn completed, but ${why}; a review that ran on anything else does not stand`), result.err);
  assert.match(result.err, /^Part 2 of 3 \(b\.txt\) did not pass, so the part after it was not started and no review of [0-9a-f]{7}\.\.[0-9a-f]{7} was recorded\.\nThe part before it passed, and what it answered is not shown: without every part it is no review of [0-9a-f]{7}\.\.[0-9a-f]{7}\.$/m);
  // Nothing of what either part answered, in either form.
  assert.equal(result.shown, '');
  assert.equal(result.out.split('\n').some((line) => FINDING_LINE.test(line) || /verdict|the patch is|as Codex rendered/.test(line)), false, result.out);
  assert.doesNotMatch(`${result.out}\n${result.err}`, /Rendered of|Recorded|All \d parts/);
  assert.deepEqual(readCodexReviewRuns(root).map((line) => [line.part.index, line.outcome, line.reason ?? null, ...sessionRan(line)]), [
    [1, 'reviewed', null, 'gpt-6.1-sol', 'high'],
    [2, 'failed', why, 'gpt-6-astra', 'low'],
  ]);
  assert.equal(wrote(root), false);
  assert.deepEqual(listed(mine.homes), []);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('a run line of a part that cannot be written leaves its place empty in the record: `runs` has an entry for every part, and `run` is there only when the last part has its line', async () => {
  const twoParts = (root, base, head, { first, second } = {}) => fakeCodexInParts(
    { stdout: partShown(root, base, head, 'a.txt', 'b.txt'), during: first },
    { stdout: partShown(root, base, head, 'c.txt'), during: second },
  );
  const review = async (root, fake) => {
    const result = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--cwd', root], { ...fake, randomUUID: runIds() });
    assert.equal(result.code, 0, result.err);
    assert.match(result.out, /Recorded the Codex review of [0-9a-f]{7}\.\.[0-9a-f]{7}, made in 2 parts, in /);
    const records = readCodexReviews(root);
    assert.equal(records.length, 1);
    // Whatever was lost of its measurements, it is a review of the range, and `check --push` takes it as one.
    assert.equal(isValidCodexReview(records[0]), true);
    return { result, record: records[0] };
  };
  const warnings = (result) => (result.err.match(/Could not write the run log, so what this attempt measured was not kept/g) ?? []).length;

  // No part has its line: the log could not be written at all. The record still says there were two parts.
  const none = makeThreeFileRepo();
  blockRunLog(none.root);
  const { result: lostBoth, record: unmeasured } = await review(none.root, twoParts(none.root, none.base, none.head));
  const { run: _run, ...noRun } = reviewedRecord(none.base, none.head);
  assert.deepEqual(unmeasured, { ...noRun, runs: [null, null] });
  assert.equal(warnings(lostBoth), 2);

  // The first part lost its line and the last has one: the log could be written from the second session on.
  const early = makeThreeFileRepo();
  blockRunLog(early.root);
  const unblock = () => fs.rmSync(codexReviewRunsPath(early.root), { recursive: true });
  const { result: lostFirst, record: lastMeasured } = await review(early.root, twoParts(early.root, early.base, early.head, { second: unblock }));
  assert.deepEqual(lastMeasured, { ...reviewedRecord(early.base, early.head), run: idOf(2), runs: [null, idOf(2)] });
  assert.deepEqual(readCodexReviewRuns(early.root).map((line) => [line.id, line.part.index]), [[idOf(2), 2]]);
  assert.equal(warnings(lostFirst), 1);

  // The last part lost its line: the record names no `run`, and the first part keeps its place in `runs`.
  const late = makeThreeFileRepo();
  const block = () => {
    const log = codexReviewRunsPath(late.root);
    fs.renameSync(log, `${log}.of-the-first-part`);
    fs.mkdirSync(log);
  };
  const { result: lostLast, record: firstMeasured } = await review(late.root, twoParts(late.root, late.base, late.head, { second: block }));
  const { run: _last, ...noLast } = reviewedRecord(late.base, late.head);
  assert.deepEqual(firstMeasured, { ...noLast, runs: [idOf(1), null] });
  assert.equal(warnings(lostLast), 1);
});

test('a lean range of more files than a part holds is reviewed in parts though it changes few lines, and says which bound it is over', async () => {
  const names = Array.from({ length: 41 }, (_, index) => `f${String(index).padStart(2, '0')}.txt`);
  const { root, base, head } = makeRepoWith(Object.fromEntries(names.map((name) => [name, 'one\n'])), Object.fromEntries(names.map((name) => [name, 'two\n'])));
  const fake = fakeCodexInParts({ stdout: partShown(root, base, head, ...names.slice(0, 40)) }, { stdout: partShown(root, base, head, names[40]) });
  // The default bound of lines, 400, which 82 changed lines are far under.
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, randomUUID: runIds() });
  assert.equal(result.code, 0, result.err);
  const short = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  assert.equal(afterPlan(result.out)[0], `The range ${short} changes 82 lines in 41 files, more files than the 40 a part holds, so it is reviewed in 2 parts, one after another.`);
  assert.deepEqual(readCodexReviewRuns(root).map((line) => line.part), [{ index: 1, of: 2, files: 40, changedLines: 80 }, { index: 2, of: 2, files: 1, changedLines: 2 }]);
  // The command the first part is told to run names forty files and stops there.
  const asked = fake.calls[0].child.received.text;
  assert.ok(asked.includes(`-- ${names.slice(0, 40).join(' ')}\``), asked);
  assert.equal(asked.includes(names[40]), false);
});

test('the findings of every part are printed once, after the last part, by file and then by line, with the verdict of each part and the totals of them all', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const top = git(root, 'rev-parse', '--show-toplevel');
  const first = {
    findings: [found(`${top}/b.txt`, 3, 3, { title: 'B three' }), found(`${top}/a.txt`, 7, 9, { title: 'A seven' }), found(`${top}/a.txt`, 2, 2, { title: 'A two', priority: 0 })],
    overall_correctness: 'patch is incorrect',
    overall_explanation: 'One record\nis lost.',
    overall_confidence_score: 0.7,
  };
  // A finding the second part gives at a line the first gave one at: the shorter range first, then the order of the parts.
  const second = { ...NO_FINDINGS, findings: [found(`${top}/c.txt`, 1, 1, { title: 'C one', priority: 3 }), found(`${top}/a.txt`, 2, 5, { title: 'A two to five' })] };
  const lines = [];
  let beforeLastPart;
  const fake = fakeCodexInParts(
    { stdout: partShown(root, base, head, 'a.txt', 'b.txt'), said: first, threads: [parentThread, ranThread] },
    { stdout: partShown(root, base, head, 'c.txt'), said: second, threads: [parentThread, ranThread], during: () => { beforeLastPart = [...lines]; } },
  );
  const result = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--cwd', root], { ...fake, platform: process.platform, randomUUID: runIds(), monotonicNow: ticking(0, 10000, 20000, 40000), log: (line) => lines.push(line) });
  assert.equal(result.code, 0, result.err);
  const at = lines.indexOf('a.txt:2 P0 A two');
  assert.notEqual(at, -1, lines.join('\n'));
  assert.deepEqual(lines.slice(at, at + 8), [
    'a.txt:2 P0 A two',
    'a.txt:2-5 P1 A two to five',
    'a.txt:7-9 P1 A seven',
    'b.txt:3 P1 B three',
    'c.txt:1 P3 C one',
    'Part 1 of 2: Codex\'s verdict: the patch is incorrect (confidence 0.7). One record is lost.',
    'Part 2 of 2: Codex\'s verdict: the patch is correct. Nothing in the diff breaks existing behaviour.',
    'All 2 parts passed: Codex used 594,958 input tokens (481,280 cached) and 4,792 output (1,406 reasoning) in 30 s over 14 requests.',
  ]);
  assert.match(lines[at + 8], /^Recorded the Codex review/);
  assert.equal(lines.filter((line) => FINDING_LINE.test(line)).length, 5, 'each finding once');
  // Nothing of the first part's answer is printed while a later part can still fail.
  assert.equal(beforeLastPart.some((line) => FINDING_LINE.test(line) || /verdict/.test(line)), false, beforeLastPart.join('\n'));
  // Each part still says what it spent, and its run line counts its own findings.
  assert.equal(lines.filter((line) => line === 'Codex used 297,479 input tokens (240,640 cached) and 2,396 output (703 reasoning) in 10 s over 7 requests: 1 agent_message, 1 command_execution.').length, 1);
  assert.equal(lines.filter((line) => /^Codex used 297,479 .* in 20 s over 7 requests/.test(line)).length, 1);
  const runs = readCodexReviewRuns(root);
  assert.deepEqual(runs.map((line) => [line.findings.total, line.verdict, line.durationMs, line.usage.inputTokens]), [[3, 'incorrect', 10000, 297479], [2, 'correct', 20000, 297479]]);
});

test('the totals of a range reviewed in parts say what is not known instead of adding it as zero', async () => {
  const { root, base, head } = makeThreeFileRepo();
  // No part left a token count: the tokens of the whole are not known.
  const none = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--cwd', root], {
    ...fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt', 'b.txt') }, { stdout: partShown(root, base, head, 'c.txt') }), randomUUID: runIds(), monotonicNow: ticking(0, 4000, 4000, 9000),
  });
  assert.equal(none.code, 0, none.err);
  assert.ok(none.out.split('\n').includes('All 2 parts passed, in 9 s; the tokens of the whole are not known, since the Codex home of a part held no token count.'), none.out);
  // One part did and one did not, and one wall time was not measured: neither total is known, and none is made up.
  const some = await run(['--base', 'HEAD~1', '--again', ...TWO_PARTS, '--cwd', root], {
    ...fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt', 'b.txt'), threads: [ranThread] }, { stdout: partShown(root, base, head, 'c.txt') }), randomUUID: runIds(), monotonicNow: ticking(0, 4000, Number.NaN),
  });
  assert.equal(some.code, 0, some.err);
  assert.ok(some.out.split('\n').includes('All 2 parts passed, in unknown s; the tokens of the whole are not known, since the Codex home of a part held no token count.'), some.out);
  assert.doesNotMatch(some.out, /NaN|All 2 parts passed: Codex used/);
});

test('--doc goes into the prompt of every part, and under --prompt own nothing is said of a prompt that was not asked for', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const intent = { goal: GOAL, doneWhen: DONE_WHEN };
  const fake = fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt', 'b.txt') }, { stdout: partShown(root, base, head, 'c.txt') });
  const result = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--prompt', 'own', '--doc', featureDoc(), '--cwd', root], { ...fake, randomUUID: runIds() });
  assert.equal(result.code, 0, result.err);
  assert.equal(fake.calls[0].child.received.text, reviewPrompt({ from: base, head, intent, part: { index: 1, of: 2, files: ['a.txt', 'b.txt'] } }));
  assert.equal(fake.calls[1].child.received.text, reviewPrompt({ from: base, head, intent, part: { index: 2, of: 2, files: ['c.txt'] } }));
  for (const call of fake.calls) assert.ok(call.child.received.text.includes(GOAL));
  assert.doesNotMatch(result.out, /cannot be limited to some files/);
  assert.match(result.out, /reviewed in 2 parts/);
});

test('a lean range at or under the bound is one part: the review is the one it was, under either prompt, and nothing is said or logged of parts but its plan, which is of one', async () => {
  const { root, base, head } = makeThreeFileRepo();
  // Eight changed lines: under the default bound, and exactly at one of eight.
  for (const bound of [[], ['--part-lines', '8'], ['--part-lines', '5000']]) {
    for (const [flags, argv] of [[['--session', 'lean'], leanArgv(base)], [OWN, ownArgv()]]) {
      const fake = fakeCodex(reviewed(root, base));
      const result = await run(['--base', 'HEAD~1', '--again', ...flags, ...bound, '--cwd', root], fake);
      const name = [...flags, ...bound].join(' ');
      assert.equal(result.code, 0, `${name}: ${result.err}`);
      assert.equal(fake.calls.length, 1, name);
      assert.deepEqual(fake.calls[0].args, argv, name);
      if (flags === OWN) assert.equal(fake.calls[0].child.received.text, reviewPrompt({ from: base, head }), name);
      assert.match(result.out.split('\n')[0], /, 1 part, 8 changed lines in 3 files\.$/, name);
      assert.doesNotMatch(afterPlan(result.out).join('\n'), /\bparts?\b/i, name);
      const logged = readCodexReviewRuns(root).at(-1);
      assert.equal('part' in logged, false, name);
      assert.equal(runPart(logged), null, name);
      assert.deepEqual(readCodexReviews(root).at(-1), reviewedRecord(base, head), name);
    }
  }
});

test('the first part that does not pass stops the run: no later part is started, no review is recorded, and the error names the part and its files', async () => {
  const short = /[0-9a-f]{7}\.\.[0-9a-f]{7}/.source;
  // What each failure of a single review exits with and logs, a part exits with and logs too.
  const failures = [
    ['not inspected: one of its two files was not shown', 1, 'not-inspected', (root, base, head) => ({ stdout: reviewedWith(cmd('git diff -- a.txt', 0, partDiff(root, base, head, 'a.txt'))) }),
      /showed 2 of 6 changed lines of part 1 of 2 of [0-9a-f]{7}\.\.HEAD; nothing was recorded\.\n {2}not read in full: b\.txt \(4 of 4 changed lines missing\)/],
    ['Codex exited with a code of its own', 7, 'failed', (root, base, head) => ({ stdout: partShown(root, base, head, 'a.txt', 'b.txt'), answer: { status: 7 } }), /did not complete \(it exited 7\)/],
    ['an answer that cannot be read', 1, 'failed', (root, base, head) => ({ stdout: partShown(root, base, head, 'a.txt', 'b.txt'), said: 'not an answer' }), /the answer of the review is not JSON; no record was written/],
    ['a timeout', 1, 'timed-out', () => ({ answer: { hang: true } }), /ran past 30 minutes/],
  ];
  for (const [name, code, outcome, session, said] of failures) {
    const { root, base, head } = makeThreeFileRepo();
    const mine = fakeHome();
    const fake = fakeCodexInParts(session(root, base, head));
    const result = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--cwd', root], { ...fake, homedir: mine.homedir, randomUUID: runIds(), timeoutMs: 1500 });
    assert.equal(result.code, code, name);
    assert.deepEqual(fake.order.filter((event) => event.startsWith('start')), ['start 1'], `${name}: the second part was never started`);
    assert.match(result.err, said, name);
    assert.match(result.err, new RegExp(`^Part 1 of 2 \\(a\\.txt, b\\.txt\\) did not pass, so the part after it was not started and no review of ${short} was recorded\\.$`, 'm'), name);
    const logged = onlyRun(root);
    assert.deepEqual([logged.outcome, logged.part], [outcome, { index: 1, of: 2, files: 2, changedLines: 6 }], name);
    assert.equal(wrote(root), false, name);
    assert.doesNotMatch(result.out, /Recorded|All 2 parts/, name);
    assert.deepEqual(listed(mine.homes), [], `${name}: the home of the part is gone`);
    assert.equal(fs.statSync(mine.auth).nlink, 1, name);
  }
});

test('a later part that does not pass leaves the lines of the parts before it in the run log and still records no review, nor prints what they found', async () => {
  const { root, base, head } = makeThreeFileRepo();
  // Three parts. The first passes with findings; the second is shown the files of the first and not its own.
  const fake = fakeCodexInParts(
    { stdout: partShown(root, base, head, 'a.txt'), said: answerWith(root) },
    { stdout: partShown(root, base, head, 'a.txt') },
  );
  const result = await run(['--base', 'HEAD~1', ...THREE_PARTS, '--cwd', root], { ...fake, platform: process.platform, randomUUID: runIds() });
  assert.equal(result.code, 1);
  assert.equal(fake.calls.length, 2, 'the third part was never started');
  assert.match(result.err, /showed 0 of 4 changed lines of part 2 of 3 of [0-9a-f]{7}\.\.HEAD/, 'the evidence of a part is the changed lines of its own files alone');
  assert.match(result.err, /not read in full: b\.txt \(4 of 4 changed lines missing\)/);
  assert.match(result.err, /^Part 2 of 3 \(b\.txt\) did not pass, so the part after it was not started and no review of .* was recorded\.$/m);
  const runs = readCodexReviewRuns(root);
  assert.deepEqual(runs.map((line) => [line.id, line.outcome, line.part.index, line.coverage]), [[idOf(1), 'reviewed', 1, { seen: 2, total: 2 }], [idOf(2), 'not-inspected', 2, { seen: 0, total: 4 }]]);
  assert.deepEqual(runs[0].findings, THREE_FOUND, 'the measurement of the part that passed is kept');
  assert.equal(wrote(root), false);
  const lines = result.out.split('\n');
  assert.equal(lines.some((line) => FINDING_LINE.test(line) || /verdict|the patch is/.test(line)), false, result.out);
  assert.equal(lines.filter((line) => line === NOT_STANDING).length, 1, 'said of the part that did not stand');

  // The last part failing is the same: every part must pass for the range to be reviewed.
  const last = fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt') }, { stdout: partShown(root, base, head, 'b.txt') }, { stdout: partShown(root, base, head, 'c.txt'), answer: { status: 9 } });
  const failed = await run(['--base', 'HEAD~1', ...THREE_PARTS, '--cwd', root], { ...last, randomUUID: runIds() });
  assert.equal(failed.code, 9);
  assert.match(failed.err, /^Part 3 of 3 \(c\.txt\) did not pass, so no review of .* was recorded\.$/m);
  assert.deepEqual(readCodexReviewRuns(root).slice(2).map((line) => line.outcome), ['reviewed', 'reviewed', 'failed']);
  assert.equal(wrote(root), false);

  // And the first of three: both later parts are left unstarted, and said to be.
  const early = fakeCodexInParts({ stdout: reviewedWith(cmd('git status')) });
  const stopped = await run(['--base', 'HEAD~1', ...THREE_PARTS, '--cwd', root], { ...early, randomUUID: runIds() });
  assert.equal(stopped.code, 1);
  assert.match(stopped.err, /^Part 1 of 3 \(a\.txt\) did not pass, so the 2 parts after it were not started and no review of .* was recorded\.$/m);
  assert.equal(early.calls.length, 1);
});

// What Codex rendered of a review is passed through to the user (`write`), apart from what the command logs.
// The three tests that follow read both, in the order they were said: the findings of a part are in the
// rendered text too, and a test that reads the log alone does not see them shown.
const RENDERED = ['- [P1] ONE — a.txt:2\n  Rendered of the first part.', '- [P2] TWO — b.txt:2\n  Rendered of the second part.', 'Nothing found in the third part.'];

/** A `log` and a `write` that keep what they are given in one list, `said`, each entry `[how, text]`. */
function inOrder() {
  const said = [];
  return { said, log: (line) => said.push(['log', line]), write: (text) => said.push(['write', text]), written: () => said.filter(([how]) => how === 'write').map(([, text]) => text) };
}

test('what Codex rendered of each part is held until every part has passed, and is then shown in the order of the parts, before the findings of the range', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const top = git(root, 'rev-parse', '--show-toplevel');
  const heard = inOrder();
  let asLastPartStarts;
  const fake = fakeCodexInParts(
    { stdout: partSaid(RENDERED[0], root, base, head, 'a.txt'), said: { ...NO_FINDINGS, findings: [found(`${top}/a.txt`, 2, 2, { title: 'ONE' })] } },
    { stdout: partSaid(RENDERED[1], root, base, head, 'b.txt'), said: { ...NO_FINDINGS, findings: [found(`${top}/b.txt`, 2, 2, { title: 'TWO', priority: 2 })] } },
    { stdout: partSaid(RENDERED[2], root, base, head, 'c.txt'), during: () => { asLastPartStarts = heard.written(); } },
  );
  const result = await run(['--base', 'HEAD~1', ...THREE_PARTS, '--cwd', root], { ...fake, platform: process.platform, randomUUID: runIds(), log: heard.log, write: heard.write });
  assert.equal(result.code, 0, result.err);
  // While a later part can still fail, nothing of what an earlier one answered has been shown, in either form.
  assert.deepEqual(asLastPartStarts, [], 'nothing was passed through before the last part started');
  // Each once, whole, in the order of the parts.
  assert.deepEqual(heard.written(), RENDERED.map((text) => `${text}\n`));
  // After the last part ended, and before the findings of the range as this command prints them.
  const where = (matches) => heard.said.findIndex(([how, text]) => matches(how, text));
  const lastSpent = heard.said.findLastIndex(([how, text]) => how === 'log' && /^Codex (used|ran) /.test(text));
  const firstShown = where((how) => how === 'write');
  const lastShown = heard.said.findLastIndex(([how]) => how === 'write');
  const firstFinding = where((how, text) => how === 'log' && FINDING_LINE.test(text));
  assert.notEqual(firstFinding, -1);
  assert.ok(lastSpent < firstShown, 'after the last part said what it spent');
  assert.ok(lastShown < firstFinding, 'before the findings of the range');
  // Each is under a line that says which part it is of, since nothing else between them does any more.
  heard.said.forEach(([how], at) => {
    if (how === 'write') assert.deepEqual(heard.said[at - 1], ['log', `Part ${heard.written().indexOf(heard.said[at][1]) + 1} of 3, as Codex rendered its review:`]);
  });
  assert.equal(readCodexReviews(root).length, 1);
});

test('a part that does not pass shows nothing of what any part answered: not what Codex rendered of the parts before it, nor of its own', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const failures = [
    // The last part is shown the files of another: its turn completed, with a review of its own, and it is not inspected.
    ['the last part was not inspected', 1, [{ stdout: partSaid(RENDERED[0], root, base, head, 'a.txt'), said: answerWith(root) }, { stdout: partSaid(RENDERED[1], root, base, head, 'b.txt') }, { stdout: partSaid(RENDERED[2], root, base, head, 'a.txt') }],
      /^Part 3 of 3 \(c\.txt\) did not pass, so no review of .* was recorded\.\nThe 2 parts before it passed, and what they answered is not shown: without every part it is no review of [0-9a-f]{7}\.\.[0-9a-f]{7}\.$/m],
    ['a middle part exited with a code of its own', 7, [{ stdout: partSaid(RENDERED[0], root, base, head, 'a.txt'), said: answerWith(root) }, { stdout: partSaid(RENDERED[1], root, base, head, 'b.txt'), answer: { status: 7 } }],
      /^Part 2 of 3 \(b\.txt\) did not pass, so the part after it was not started and no review of .* was recorded\.\nThe part before it passed, and what it answered is not shown: without every part it is no review of [0-9a-f]{7}\.\.[0-9a-f]{7}\.$/m],
    // No part passed before the first, so there is nothing withheld to speak of: the error is the one it was.
    ['the first part was not inspected', 1, [{ stdout: partSaid(RENDERED[0], root, base, head, 'c.txt') }],
      /^Part 1 of 3 \(a\.txt\) did not pass, so the 2 parts after it were not started and no review of .* was recorded\.$/],
  ];
  for (const [name, code, sessions, said] of failures) {
    const heard = inOrder();
    const before = readCodexReviewRuns(root).length;
    const result = await run(['--base', 'HEAD~1', ...THREE_PARTS, '--cwd', root], { ...fakeCodexInParts(...sessions), platform: process.platform, randomUUID: runIds(), log: heard.log, write: heard.write });
    assert.equal(result.code, code, name);
    assert.deepEqual(heard.written(), [], `${name}: nothing Codex rendered was passed through`);
    const logged = heard.said.map(([, text]) => text);
    assert.equal(logged.some((line) => FINDING_LINE.test(line) || /verdict|the patch is|as Codex rendered/.test(line)), false, `${name}: ${logged.join('\n')}`);
    const failure = result.err.split('\n').slice(result.err.split('\n').findIndex((line) => /^Part \d of 3 /.test(line))).join('\n');
    assert.match(failure, said, name);
    assert.doesNotMatch(result.err, /RENDERED|Rendered of|Nothing found in the third/, name);
    // As it was: no record, and the run line of every part that was launched.
    assert.equal(wrote(root), false, name);
    assert.equal(readCodexReviewRuns(root).length - before, sessions.length, name);
  }
});

test('a part whose session rendered no review does not pass, so no part is shown as a line that says whose review follows with nothing under it', async () => {
  const { root, base, head } = makeThreeFileRepo();
  // The evidence rule asks every attempt for a review message, whatever its commands showed (`reviewEvidence`:
  // `inspected`). So a part that rendered nothing is a part that did not pass, and the parts that are shown
  // once all have passed each have a review to show: no message, an empty one, one of blanks alone.
  for (const silent of [null, '', '  \n ']) {
    const heard = inOrder();
    const fake = fakeCodexInParts({ stdout: partSaid(RENDERED[0], root, base, head, 'a.txt') }, { stdout: partSaid(silent, root, base, head, 'b.txt') });
    const result = await run(['--base', 'HEAD~1', ...THREE_PARTS, '--cwd', root], { ...fake, randomUUID: runIds(), log: heard.log, write: heard.write });
    const name = JSON.stringify(silent);
    assert.equal(result.code, 1, name);
    assert.equal(fake.calls.length, 2, `${name}: the third part was never started`);
    assert.match(result.err, /Codex's turn completed, but it ended without a review message; nothing was recorded\./, name);
    assert.match(result.err, /^Part 2 of 3 \(b\.txt\) did not pass, so the part after it was not started/m, name);
    assert.deepEqual(heard.written(), [], `${name}: nothing was passed through`);
    assert.equal(heard.said.some(([, text]) => /as Codex rendered|undefined|null/.test(text)), false, `${name}: ${heard.said.map(([, text]) => text).join('\n')}`);
    assert.deepEqual(readCodexReviewRuns(root).slice(-2).map((line) => [line.outcome, line.part.index]), [['reviewed', 1], ['not-inspected', 2]], name);
  }
  assert.equal(wrote(root), false);
});

test('a review that is not in parts shows what Codex rendered as it always did: as soon as its one session ends, whatever the attempt comes to', async () => {
  const { root, base } = makeThreeFileRepo();
  const stands = inOrder();
  const whole = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base)), log: stands.log, write: stands.write });
  assert.equal(whole.code, 0, whole.err);
  assert.deepEqual(stands.written(), [`${FINDINGS}\n`]);
  assert.ok(stands.said.findIndex(([how]) => how === 'write') < stands.said.findIndex(([how, text]) => how === 'log' && /^Codex (used|ran) /.test(text)), 'before what the session spent');
  assert.equal(stands.said.some(([, text]) => /as Codex rendered/.test(text)), false);
  // One that does not stand passes it through too, above the error that says so, as a review always did.
  const falls = inOrder();
  const short = await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...fakeCodex(reviewedWith(cmd('git status'))), log: falls.log, write: falls.write });
  assert.equal(short.code, 1);
  assert.deepEqual(falls.written(), [`${FINDINGS}\n`]);
});

test('Ctrl-C during a part stops that part, removes its home and starts no further part', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const mine = fakeHome();
  const fake = fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt') }, { answer: { hang: true } }, { stdout: partShown(root, base, head, 'c.txt') });
  const signals = new EventEmitter();
  let ended = false;
  // The timeout only bounds this test: a second part that hung unseen would end as timed out, which the assertions tell apart.
  const pending = run(['--base', 'HEAD~1', ...THREE_PARTS, '--cwd', root], { ...fake, signals, homedir: mine.homedir, randomUUID: runIds(), timeoutMs: 20000 }).finally(() => { ended = true; });
  while (fake.calls.length < 2 && !ended) await new Promise((resolve) => setImmediate(resolve));
  // Read, then interrupt, then assert: a failed assertion before the signal would leave the review waiting.
  const during = { homes: listed(mine.homes), links: fs.statSync(mine.auth).nlink };
  signals.emit('SIGINT');
  const result = await pending;
  assert.deepEqual(during, { homes: [idOf(2)], links: 2 });
  assert.equal(result.code, 1);
  assert.deepEqual(fake.order, ['start 1', 'end 1', 'start 2'], 'the third part was never started');
  assert.deepEqual(fake.killed, [4242]);
  assert.match(result.err, /interrupted/);
  assert.match(result.err, /^Part 2 of 3 \(b\.txt\) did not pass, so the part after it was not started/m);
  assert.deepEqual(readCodexReviewRuns(root).map((line) => [line.outcome, line.part.index]), [['reviewed', 1], ['interrupted', 2]]);
  assert.deepEqual(listed(mine.homes), [], 'the home of the interrupted part is gone');
  assert.equal(fs.statSync(mine.auth).nlink, 1);
  assert.equal(signals.listenerCount('SIGINT') + signals.listenerCount('SIGTERM'), 0, 'handlers removed');
  assert.equal(wrote(root), false);
});

test('--keep-home keeps the home of every part, each without the login, and names each', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const mine = fakeHome();
  const fake = fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt', 'b.txt'), during: codexWrites }, { stdout: partShown(root, base, head, 'c.txt'), during: codexWrites });
  const result = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--keep-home', '--cwd', root], { ...fake, homedir: mine.homedir, randomUUID: runIds() });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(listed(mine.homes).sort(), [idOf(1), idOf(2)]);
  for (const id of [idOf(1), idOf(2)]) {
    const kept = path.join(mine.homes, id);
    assert.deepEqual(listed(kept).sort(), ['sessions', 'version.json'], 'what Codex wrote, and no login');
    assert.equal(result.out.split('\n').filter((line) => /was kept, without the login/.test(line) && line.endsWith(kept)).length, 1);
  }
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('a home kept for an early part is not swept by a later part of the same run, however long the parts took', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const mine = fakeHome();
  // Once the first part's home is there, the clock jumps years ahead: by the time the second part starts,
  // that home is far older than twice the timeout, which is the age at which a run sweeps what it finds.
  const first = path.join(mine.homes, idOf(1));
  const now = () => new Date(fs.existsSync(first) ? '2099-01-01T00:00:00.000Z' : '2026-09-29T12:00:00.000Z');
  let homesAsLastPartStarts;
  const fake = fakeCodexInParts(
    { stdout: partShown(root, base, head, 'a.txt', 'b.txt') },
    { stdout: partShown(root, base, head, 'c.txt'), during: () => { homesAsLastPartStarts = listed(mine.homes).sort(); } },
  );
  const result = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--keep-home', '--cwd', root], { ...fake, homedir: mine.homedir, randomUUID: runIds(), now });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(homesAsLastPartStarts, [idOf(1), idOf(2)]);
  assert.deepEqual(listed(mine.homes).sort(), [idOf(1), idOf(2)]);
});

test('a path that one command line cannot hold safely refuses the split before anything is launched, and the same range in one part is reviewed', async () => {
  // A straight quote, and two of the typographic ones PowerShell reads as quotes: a single one (U+2019),
  // which would end the single quotes the path is written in, and a pair of double ones (U+201C, U+201D).
  for (const name of ['it\'s.txt', 'it\u2019s.txt', 'say \u201chi\u201d.txt']) {
    const before = { [name]: 'one\n', 'b.txt': 'one\n' };
    const after = { [name]: 'two\n', 'b.txt': 'two\n' };
    const { root, base } = makeRepoWith(before, after);
    const fake = fakeCodexInParts();
    const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--part-lines', '2', '--cwd', root], fake);
    assert.equal(result.code, 1, name);
    assert.ok(result.err.includes(`The path ${JSON.stringify(name)} cannot be written safely on one command line`), `${name}: ${result.err}`);
    assert.match(result.err, /part 2 of 2/, name);
    assert.match(result.err, /not started and nothing was recorded/, name);
    assert.equal(fake.calls.length, 0, name);
    assert.equal(fake.probes.length, 0, name);
    assert.equal(wrote(root), false, name);
    assert.equal(loggedRun(root), false, name);
    // Within the bound no path is written anywhere: the review of the whole range is the one it was.
    const whole = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base)));
    assert.equal(whole.code, 0, `${name}: ${whole.err}`);
  }
});

/** The command the prompt of a part tells the model to run, run as it is written: its words, each path
 * without the single quotes a shell would take off it, handed to git with no shell in between. */
function runCommandOf(root, prompt) {
  const command = /Run `(git [^`]+)`/.exec(prompt)?.[1];
  assert.ok(command, prompt);
  const words = [...command.matchAll(/'([^']*)'|(\S+)/g)].map(([, quoted, plain]) => quoted ?? plain);
  return git(root, ...words.slice(1));
}

test('a file whose name git would read as a pattern is reviewed as that one file: the command of its part, and what the part must have seen, take the name literally', async () => {
  // `a[1].txt` is a file, and as a pathspec a pattern that matches `a1.txt` as well: the file of another part.
  const names = ['a1.txt', 'a[1].txt', 'b.txt'];
  const { root, base, head } = makeRepoWith(Object.fromEntries(names.map((name) => [name, `${name} one\n`])), Object.fromEntries(names.map((name) => [name, `${name} two\n`])));
  // Read as a pattern, which is how git reads a pathspec unless told otherwise, it shows two files.
  const asPattern = git(root, 'diff', '--no-renames', base, head, '--', 'a[1].txt');
  assert.deepEqual([...new Set(patchKeys(asPattern).map((key) => key.split('\n')[0]))], ['a1.txt', 'a[1].txt'], 'this git reads the name as a pattern');
  // Three parts of one file, in the order of the names. Each session shows the diff of its own file alone.
  const fake = fakeCodexInParts(...names.map((name) => ({ stdout: partShown(root, base, head, name) })));
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--part-lines', '2', '--cwd', root], { ...fake, randomUUID: runIds() });
  assert.equal(result.code, 0, result.err);
  // What each part must have seen is the two changed lines of its own file, as its count of changed lines says.
  assert.deepEqual(readCodexReviewRuns(root).map((line) => [line.part, line.coverage]), [1, 2, 3].map((index) => [{ index, of: 3, files: 1, changedLines: 2 }, { seen: 2, total: 2 }]));
  assert.equal(readCodexReviews(root).length, 1);
  // The command the part of that file was told to run, run for real: it shows that file and no other.
  const asked = fake.calls[1].child.received.text;
  assert.ok(asked.includes(`\`git --literal-pathspecs diff --no-renames ${base} ${head} -- 'a[1].txt'\``), asked);
  assert.deepEqual(patchKeys(runCommandOf(root, asked)), ['a[1].txt\n-a[1].txt one', 'a[1].txt\n+a[1].txt two']);
  // And the lines of the file the pattern also matches are no evidence for this part: a session that showed
  // that other file alone did not show its own.
  const other = fakeCodexInParts({ stdout: partShown(root, base, head, 'a1.txt') }, { stdout: partShown(root, base, head, 'a1.txt') });
  const refused = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--part-lines', '2', '--cwd', root], { ...other, randomUUID: runIds() });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /showed 0 of 2 changed lines of part 2 of 3/);
});

test('--part-lines takes a positive integer: anything else is a usage error, and nothing runs', async () => {
  const { root, base } = makeRepo();
  const cases = [
    [['--session', 'lean', '--part-lines', '0'], /--part-lines must be a positive integer/],
    [['--session', 'lean', '--part-lines', '-3'], /--part-lines must be a positive integer/],
    [['--session', 'lean', '--part-lines', '1.5'], /--part-lines must be a positive integer/],
    [['--session', 'lean', '--part-lines', '4e2'], /--part-lines must be a positive integer/],
    [['--session', 'lean', '--part-lines', 'many'], /--part-lines must be a positive integer/],
    [['--session', 'lean', '--part-lines', ''], /--part-lines must be a positive integer/],
    [['--session', 'lean', '--part-lines', '99999999999999999999'], /--part-lines must be a positive integer/],
    [['--part-lines'], /--part-lines requires a value/],
    [['--part-lines', '0'], /--part-lines must be a positive integer/],
    [['--part-lines', '0', '--unavailable', 'model rejected'], /--part-lines must be a positive integer/],
  ];
  for (const [flags, message] of cases) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], fake);
    assert.equal(result.code, 2, flags.join(' '));
    assert.match(result.err, message, flags.join(' '));
    assert.match(result.err, /Usage: js-harness codex-review .*\[--part-lines <n>\]/);
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.probes.length, 0);
  }
  assert.equal(wrote(root), false);
  assert.equal(loggedRun(root), false);
});

test('a range over the default bound of 400 changed lines is reviewed in parts with no flag at all, and with `--session lean`: three parts of two files', async () => {
  const names = Array.from({ length: 6 }, (_, index) => `f${index}.txt`);
  const body = (mark) => Array.from({ length: 100 }, (_, line) => `${mark} ${line}`).join('\n');
  // 1,200 changed lines, 200 a file. No session reviews a range of that size whole any more.
  const { root, base, head } = makeRepoWith(Object.fromEntries(names.map((name) => [name, `${body('old')}\n`])), Object.fromEntries(names.map((name) => [name, `${body('new')}\n`])));
  for (const flags of [[], ['--session', 'lean']]) {
    const which = flags.join(' ') || 'no flag';
    const before = readCodexReviewRuns(root).length;
    const fake = fakeCodexInParts(...[0, 2, 4].map((at) => ({ stdout: partShown(root, base, head, names[at], names[at + 1]) })));
    const inParts = await run(['--base', 'HEAD~1', '--again', ...flags, '--cwd', root], { ...fake, randomUUID: runIds() });
    assert.equal(inParts.code, 0, `${which}: ${inParts.err}`);
    assert.equal(fake.calls.length, 3, which);
    assert.match(inParts.out, /^The range .* changes 1,200 lines in 6 files, more than the 400 a part holds, so it is reviewed in 3 parts, one after another\.$/m, which);
    assert.deepEqual(readCodexReviewRuns(root).slice(before).map((line) => line.part), [1, 2, 3].map((index) => ({ index, of: 3, files: 2, changedLines: 400 })), which);
  }
});

test('a renamed file and a binary one, in parts: the renamed file is shown whole under both its names, and a part of binary files alone needs one command that worked', async () => {
  const root = tmp('js-harness-codex-review-');
  git(root, 'init');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  fs.writeFileSync(path.join(root, 'old.txt'), 'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\n', 'utf8');
  fs.writeFileSync(path.join(root, 'z.txt'), 'z1\n', 'utf8');
  fs.writeFileSync(path.join(root, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255]));
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'one');
  const base = git(root, 'rev-parse', 'HEAD');
  git(root, 'mv', 'old.txt', 'new.txt');
  fs.writeFileSync(path.join(root, 'new.txt'), 'l1\nl2\nL3 changed\nl4\nl5\nl6\nl7\nl8\n', 'utf8');
  fs.writeFileSync(path.join(root, 'z.txt'), 'z2\n', 'utf8');
  fs.writeFileSync(path.join(root, 'blob.bin'), Buffer.from([0, 9, 9, 0, 255]));
  git(root, 'commit', '-am', 'two');
  const head = git(root, 'rev-parse', 'HEAD');
  // As git shows the range whole, it is a rename with one line changed; a part cannot show a rename whose
  // two names are in different parts, so every part is asked, and checked, with renames off.
  assert.match(patchOf(root, base), /rename from old\.txt/);
  const order = ['blob.bin', 'new.txt', 'old.txt', 'z.txt'];
  const fake = fakeCodexInParts(...order.map((file) => ({ stdout: partShown(root, base, head, file) })));
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--part-lines', '4', '--cwd', root], { ...fake, randomUUID: runIds() });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(readCodexReviewRuns(root).map((line) => [line.part, line.coverage]), [
    [{ index: 1, of: 4, files: 1, changedLines: 0 }, { seen: 0, total: 0 }],
    [{ index: 2, of: 4, files: 1, changedLines: 8 }, { seen: 8, total: 8 }],
    [{ index: 3, of: 4, files: 1, changedLines: 8 }, { seen: 8, total: 8 }],
    [{ index: 4, of: 4, files: 1, changedLines: 2 }, { seen: 2, total: 2 }],
  ]);
  assert.equal(readCodexReviews(root).length, 1);
  // A session that showed the new name as git shows it in the whole range, a rename with one line changed, did
  // not show every line of its part: the file is new there, and all of it is to be read.
  const renamed = git(root, 'diff', '--no-color', base, head, '--', 'old.txt', 'new.txt');
  const partial = fakeCodexInParts({ stdout: partShown(root, base, head, 'blob.bin') }, { stdout: reviewedWith(cmd('git diff', 0, renamed)) });
  const refused = await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--part-lines', '4', '--cwd', root], { ...partial, randomUUID: runIds() });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /showed 1 of 8 changed lines of part 2 of 4/);
  assert.equal(readCodexReviews(root).length, 1, 'no second record');
});

test('the parts must show every changed line of the range between them: a split that would leave lines out is refused before anything is launched', async () => {
  const { root } = makeThreeFileRepo();
  const refusals = [
    // What git says of the files of one part is not what it says of the range: the lines of `c.txt` are in no part.
    [(args) => args.includes('--') && args.includes('c.txt'), { status: 0, stdout: '' }, /The 2 parts .* do not show 2 of the changed lines of the range between them \(the first: c\.txt: -c2\)/],
    [(args) => args.includes('--') && args.includes('c.txt'), { status: 128, stdout: '', stderr: 'fatal' }, /Could not run `git diff` over the files of part 2 of 2/],
    [(args) => args.includes('--numstat'), { status: 128, stdout: '', stderr: 'fatal' }, /Could not run `git diff --numstat`/],
    [(args) => args.includes('--numstat'), { status: 0, stdout: '1\t1\ta.txt\n' }, /Could not read which files the range changes/],
  ];
  for (const [matches, answer, message] of refusals) {
    const fake = fakeCodexInParts();
    const spawn = (command, args, opts) => (command === 'git' && matches(args) ? answer : fake.spawn(command, args, opts));
    const result = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--cwd', root], { ...fake, spawn });
    assert.equal(result.code, 1, String(message));
    assert.match(result.err, message);
    assert.match(result.err, /not started and nothing was recorded/);
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.probes.length, 0);
  }
  assert.equal(wrote(root), false);
  assert.equal(loggedRun(root), false);
});

// --- the plan: what a run would start and send, said before anything is started ---

/** The content of `file`, `null` when it is not there, and why it cannot be read when it is something else
 * than a file (a folder a test put in its place). */
function contentOf(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    return err.code === 'ENOENT' ? null : err.code;
  }
}

/** A machine where nothing may be started: no `codex` is on it, and a Codex home that is made, a session
 * that is launched or an OS home that is asked for fails the run. `deps` are those of such a run, `home` the
 * `--home` flag of a state dir of its own, and `untouched(which)` asserts that nothing was looked for,
 * launched, made, logged or recorded, by what the repository and that state dir hold. `started(which)`
 * asserts all of that but the record, for a run that starts nothing and still records what it found. */
function startsNothing(root) {
  const state = tmp('js-harness-codex-review-state-');
  const fake = fakeCodexInParts();
  const lookedFor = [];
  const spawn = (command, args, opts) => {
    if (command === 'git') return spawnSync(command, args, opts);
    lookedFor.push(command);
    return { error: new Error('spawn codex ENOENT') };
  };
  const never = (what) => () => {
    throw new Error(`nothing ${what} here`);
  };
  const [records, runLog] = [codexReviewsPath(root), codexReviewRunsPath(root)].map(contentOf);
  const started = (which) => {
    assert.equal(fake.calls.length, 0, `${which}: nothing was launched`);
    assert.deepEqual(lookedFor, [], `${which}: Codex was not looked for`);
    assert.equal(contentOf(codexReviewRunsPath(root)), runLog, `${which}: no run line`);
    assert.deepEqual(listed(state), [], `${which}: no home was made`);
  };
  const untouched = (which) => {
    started(which);
    assert.equal(contentOf(codexReviewsPath(root)), records, `${which}: no record`);
  };
  return { deps: { ...fake, spawn, createLeanHome: never('makes a Codex home'), homedir: never('asks for the OS home, where the login is') }, home: ['--home', state], untouched, started };
}

/** The lines of the plan of `root`'s review of `base..head` in `parts` (each `{ files, changedLines }`), from
 * the run log the repository holds now; `over` is `maxParts`, for a run that named a count. */
const planned = (root, base, head, parts, over = {}) =>
  planLines(reviewPlan({ base, head, model: REVIEW_MODEL, effort: REVIEW_EFFORT, parts, runs: readCodexReviewRuns(root), ...over }));

// The three files of `makeThreeFileRepo` as one part, and as the two of `--part-lines 6`.
const AS_ONE = [{ files: ['a.txt', 'b.txt', 'c.txt'], changedLines: 8 }];
const AS_TWO = [{ files: ['a.txt', 'b.txt'], changedLines: 6 }, { files: ['c.txt'], changedLines: 2 }];

test('--plan prints the plan of the run and exits 0, and starts nothing: no Codex is looked for, no home is made, nothing is logged or recorded', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const short = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  for (const [flags, parts] of [[[], AS_ONE], [['--part-lines', '6'], AS_TWO], [['--session', 'lean', '--prompt', 'own', '--keep-home', '--part-lines', '6'], AS_TWO]]) {
    const which = flags.join(' ') || 'no flag';
    const nothing = startsNothing(root);
    const result = await run(['--base', 'HEAD~1', '--plan', ...flags, ...nothing.home, '--cwd', root], nothing.deps);
    assert.equal(result.code, 0, `${which}: ${result.err}`);
    assert.deepEqual([result.err, result.shown], ['', ''], which);
    assert.deepEqual(result.out.split('\n'), planned(root, base, head, parts), which);
    nothing.untouched(which);
  }
  // What it says, with `--part-lines` changing the parts as it does for a run. No part was ever measured in
  // this repository, so there is no estimate, and the plan says that instead of a number.
  const nothing = startsNothing(root);
  const two = await run(['--base', 'HEAD~1', '--plan', '--part-lines', '6', ...nothing.home, '--cwd', root], nothing.deps);
  assert.deepEqual(two.out.split('\n'), [
    `Plan of the Codex review of ${short}: gpt-6.1-sol at high effort, 2 parts, 8 changed lines in 3 files.`,
    '  part 1 of 2: 2 files, 6 changed lines',
    '  part 2 of 2: 1 file, 2 changed lines',
    'No estimate: the run log of this machine holds no part whose changed lines and input tokens were measured, and an estimate is never a guess.',
  ]);
  // A plan is of the committed range and records nothing, so uncommitted changes, which stop a review, do not stop it.
  fs.writeFileSync(path.join(root, 'a.txt'), 'not committed\n', 'utf8');
  const dirty = await run(['--base', 'HEAD~1', '--plan', '--part-lines', '6', ...nothing.home, '--cwd', root], nothing.deps);
  assert.equal(dirty.code, 0, dirty.err);
  assert.deepEqual(dirty.out, two.out);
  nothing.untouched('a dirty tree');
  // A range git cannot size has no plan: that is an error, exit 1, and not a plan of no part.
  const unsized = (command, args, opts) => (command === 'git' && args.includes('--numstat') ? { status: 128, stdout: '', stderr: 'fatal' } : nothing.deps.spawn(command, args, opts));
  const failed = await run(['--base', 'HEAD~1', '--plan', ...nothing.home, '--cwd', root], { ...nothing.deps, spawn: unsized });
  assert.deepEqual([failed.code, failed.out], [1, '']);
  assert.match(failed.err, /^Could not run `git diff --numstat` over [0-9a-f]{7}\.\.[0-9a-f]{7} to know how large the range is, so there is no plan of its review\.$/);
  nothing.untouched('a range that cannot be sized');
});

test('--plan over a range that changes nothing is a plan of no part, which still names the model and the effort, and exits 0', async () => {
  const { root, head } = makeRepo();
  const nothing = startsNothing(root);
  const result = await run(['--base', 'HEAD', '--plan', ...nothing.home, '--cwd', root], nothing.deps);
  assert.equal(result.code, 0, result.err);
  assert.equal(result.err, '');
  assert.deepEqual(result.out.split('\n'), [
    `Plan of the Codex review of ${head.slice(0, 7)}..${head.slice(0, 7)}: gpt-6.1-sol at high effort, 0 parts, 0 changed lines in 0 files.`,
    'No estimate: the range changes no file, so there is no part to review.',
  ]);
  nothing.untouched('an empty range');
});

test('a run prints its plan before its first session starts, and the estimate of a plan is made from the run lines this machine wrote', async () => {
  const { root, base, head } = makeThreeFileRepo();
  // Each session leaves the rollout files a real one does: 297,479 input tokens, on the model and at the effort of a review.
  const ran = [parentThread, [turnContext('gpt-6.1-sol', 'high'), ...reviewThread]];
  const twoSessions = (during) => fakeCodexInParts(
    { stdout: partShown(root, base, head, 'a.txt', 'b.txt'), threads: ran, during },
    { stdout: partShown(root, base, head, 'c.txt'), threads: ran, during },
  );
  /** A run in two parts, with what it had logged by the time each of its sessions started. */
  const inTwoParts = async () => {
    const out = [];
    const onScreen = [];
    const result = await run(['--base', 'HEAD~1', '--again', ...TWO_PARTS, '--cwd', root], { ...twoSessions(() => onScreen.push([...out])), randomUUID: runIds(), log: (line) => out.push(line) });
    assert.equal(result.code, 0, result.err);
    return { out, onScreen };
  };
  // The first run of this repository: nothing was measured yet, and its plan says so before anything is spent.
  const none = planned(root, base, head, AS_TWO);
  assert.match(none.at(-1), /^No estimate: /);
  const first = await inTwoParts();
  assert.deepEqual(first.onScreen[0].slice(0, none.length), none, 'on screen when the first session started');
  assert.ok(first.onScreen[0].findIndex((line) => line.startsWith('Codex is reviewing part 1 of 2')) >= none.length, 'and before the session is announced');
  assert.equal(first.out.filter((line) => line.startsWith('Plan of the Codex review')).length, 1, 'once a run, not once a part');
  // Its two parts are in the run log now, 6 and 2 changed lines at 297,479 input tokens each, and the plan
  // is made from them: the median of 49,580 and 148,740 a changed line, and no part under 297,479.
  const measured = planned(root, base, head, AS_TWO);
  assert.deepEqual(measured.slice(1, 3), ['  part 1 of 2: 2 files, 6 changed lines, about 590,000 input tokens', '  part 2 of 2: 1 file, 2 changed lines, about 300,000 input tokens']);
  // Both ran on the model and at the effort of a review, so nothing is said of another effort. The whole is
  // a range: its high figure puts both parts at the 148,740 a changed line of the dearer one, 890,000 and 300,000.
  assert.ok(measured[3].startsWith('Estimate: about 890,000 to 1,190,000 input tokens in all. It rests on 2 parts this machine\'s run log measured on gpt-6.1-sol at high effort: '), measured[3]);
  assert.ok(measured[3].endsWith(' The higher figure puts every part at the most a changed line cost in them, in place of the median, and is no ceiling: how far a session looks into the code moves what it costs more than the size of its part does.'), measured[3]);
  const nothing = startsNothing(root);
  const plan = await run(['--base', 'HEAD~1', '--again', '--plan', '--part-lines', '6', ...nothing.home, '--cwd', root], nothing.deps);
  assert.equal(plan.code, 0, plan.err);
  assert.deepEqual(plan.out.split('\n'), measured);
  nothing.untouched('--plan');
  // And the next run prints that same plan, before its first session.
  const second = await inTwoParts();
  assert.deepEqual(second.onScreen[0].slice(0, measured.length), measured);
  // A range reviewed whole is planned as its one part, on the same stream, before its session.
  const out = [];
  const onScreen = [];
  const whole = await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...watching(fakeCodex(reviewed(root, base)), () => onScreen.push([...out])), log: (line) => out.push(line) });
  assert.equal(whole.code, 0, whole.err);
  assert.equal(onScreen[0].length, 4, 'the header, the part and the estimate, and the session that is announced');
  assert.equal(onScreen[0][0], `Plan of the Codex review of ${base.slice(0, 7)}..${head.slice(0, 7)}: gpt-6.1-sol at high effort, 1 part, 8 changed lines in 3 files.`);
  assert.match(onScreen[0][1], /^ {2}part 1 of 1: 3 files, 8 changed lines, about [\d,]+ input tokens$/);
  assert.match(onScreen[0][3], /^Codex is reviewing /);
});

test('a run log that cannot be read is one that measured nothing: the plan says there is no estimate, and a run goes on as it would', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const ran = [parentThread, [turnContext('gpt-6.1-sol', 'high'), ...reviewThread]];
  const twoSessions = () => fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt', 'b.txt'), threads: ran }, { stdout: partShown(root, base, head, 'c.txt'), threads: ran });
  // A run that leaves two measured parts in the log, so that there is an estimate to lose.
  const first = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--cwd', root], { ...twoSessions(), randomUUID: runIds() });
  assert.equal(first.code, 0, first.err);
  assert.match(planned(root, base, head, AS_TWO).at(-1), /^Estimate: about 890,000 to 1,190,000 input tokens/);
  const none = planLines(reviewPlan({ base, head, model: REVIEW_MODEL, effort: REVIEW_EFFORT, parts: AS_TWO }));
  assert.match(none.at(-1), /^No estimate: the run log of this machine holds no part /);
  /** `spawn`, but the first time git is asked where the common dir is, which is how the run log is found,
   * the answer is that of `instead`. The later times, when the run writes its lines there, git answers. */
  const logNotFound = (spawn, instead) => {
    let asked = 0;
    return (command, args, opts) => (command === 'git' && args.includes('--git-common-dir') && (asked += 1) === 1 ? instead() : spawn(command, args, opts));
  };
  const failures = [
    ['git cannot say where the log is', () => ({ status: 128, stdout: '', stderr: 'fatal' })],
    ['git cannot be started', () => {
      throw new Error('spawn git EACCES');
    }],
    // An answer the reader of the log throws on: what it cannot take never reaches the run.
    ['the reader of the log throws', () => ({ status: 0, stdout: 7 })],
  ];
  for (const [which, instead] of failures) {
    const nothing = startsNothing(root);
    const plan = await run(['--base', 'HEAD~1', '--again', '--plan', '--part-lines', '6', ...nothing.home, '--cwd', root], { ...nothing.deps, spawn: logNotFound(nothing.deps.spawn, instead) });
    assert.equal(plan.code, 0, `${which}: ${plan.err}`);
    assert.equal(plan.err, '', which);
    assert.deepEqual(plan.out.split('\n'), none, which);
    nothing.untouched(`${which}, --plan`);
    // The run prints the same plan and then goes on: its two sessions, their two lines in the log, its record.
    const [records, lines] = [readCodexReviews(root).length, readCodexReviewRuns(root).length];
    const fake = twoSessions();
    const result = await run(['--base', 'HEAD~1', '--again', ...TWO_PARTS, '--cwd', root], { ...fake, spawn: logNotFound(fake.spawn, instead), randomUUID: runIds() });
    assert.equal(result.code, 0, `${which}: ${result.err}`);
    assert.equal(result.err, '', which);
    assert.deepEqual(result.out.split('\n').slice(0, none.length), none, which);
    assert.equal(fake.calls.length, 2, which);
    assert.deepEqual([readCodexReviews(root).length, readCodexReviewRuns(root).length], [records + 1, lines + 2], which);
  }
});

test('a base that shares no history with HEAD has no range: --plan exits 1 and says so, as a run does, and nothing is started', async () => {
  const { root, head: other } = makeRepo();
  // A branch with a first commit of its own: no commit is an ancestor of both it and `other`.
  git(root, 'checkout', '--orphan', 'alone');
  git(root, 'commit', '-m', 'alone');
  const nothing = startsNothing(root);
  const plan = await run(['--base', other, '--plan', ...nothing.home, '--cwd', root], nothing.deps);
  assert.deepEqual([plan.code, plan.out], [1, '']);
  assert.equal(plan.err, `${other.slice(0, 7)} and HEAD share no history, so there is no range to plan the review of.`);
  nothing.untouched('--plan');
  const result = await run(['--base', other, ...nothing.home, '--cwd', root], nothing.deps);
  assert.deepEqual([result.code, result.out], [1, '']);
  assert.equal(result.err, `${other.slice(0, 7)} and HEAD share no history, so there is no range to review; nothing was recorded.`);
  nothing.untouched('a run');
});

test('a run over a range that holds no commit starts nothing and records nothing: after its plan it says there was nothing to review, and exits 0', async () => {
  const { root, head } = makeRepo();
  const range = `${head.slice(0, 7)}..${head.slice(0, 7)}`;
  for (const flags of [[], ['--session', 'lean', '--prompt', 'own', '--keep-home'], ['--part-lines', '2', '--max-parts', '1']]) {
    const which = flags.join(' ') || 'no flag';
    const nothing = startsNothing(root);
    const result = await run(['--base', 'HEAD', ...flags, ...nothing.home, '--cwd', root], nothing.deps);
    assert.equal(result.code, 0, `${which}: ${result.err}`);
    assert.deepEqual([result.err, result.shown], ['', ''], which);
    assert.deepEqual(result.out.split('\n'), [
      `Plan of the Codex review of ${range}: gpt-6.1-sol at high effort, 0 parts, 0 changed lines in 0 files.`,
      'No estimate: the range changes no file, so there is no part to review.',
      `There was nothing to review: ${range} changes no file. Nothing was started and nothing was recorded.`,
    ], which);
    nothing.untouched(which);
    assert.deepEqual([wrote(root), loggedRun(root)], [false, false], which);
  }
  // What stops a run before its plan still does: uncommitted changes are refused as they were, exit 1.
  fs.writeFileSync(path.join(root, 'f.txt'), 'not committed', 'utf8');
  const nothing = startsNothing(root);
  const dirty = await run(['--base', 'HEAD', ...nothing.home, '--cwd', root], nothing.deps);
  assert.deepEqual([dirty.code, dirty.out], [1, '']);
  assert.match(dirty.err, /^Tracked files have uncommitted changes/);
  nothing.untouched('a dirty tree');
});

/** `makeRepo`, as a clone whose remote's default branch is at `base`, and with a third commit, `back`, that
 * puts `f.txt` back to what it was: the commit `head` and its revert, which `check --push` both counts as
 * code commits of the branch, and which change no file between them. */
function makeRevertedRepo() {
  const { root, base, head } = makeRepo();
  git(root, 'remote', 'add', 'origin', 'https://example.invalid/js-harness-test.git');
  git(root, 'update-ref', 'refs/remotes/origin/main', base);
  fs.writeFileSync(path.join(root, 'f.txt'), 'one', 'utf8');
  git(root, 'commit', '-am', 'back to one');
  return { root, base, head, back: git(root, 'rev-parse', 'HEAD') };
}

test('a range whose commits cancel out has nothing to review: the run starts nothing and records that, and the push check then counts its commits as covered', async () => {
  const { root, base, head, back } = makeRevertedRepo();
  const range = `${base.slice(0, 7)}..${back.slice(0, 7)}`;
  // The finding: both commits need a record, and the command the check names is the one that follows.
  const before = checkCodexReviews(root, 'HEAD');
  assert.equal(before.pass, false);
  assert.match(before.detail, /^2 of 2 code commits since origin\/main have no Codex review record/);
  assert.equal(before.lines.at(-1), `make the record with: js-harness codex-review --base ${head.slice(0, 7)}^`);
  const nothingRecord = { schema: 'js-harness.codex-review/v1', base, head: back, reviewedAt: '2026-09-29T12:00:00.000Z', outcome: 'nothing-to-review', reason: 'the range changes no file' };
  // The second is asked for with `--again`: its two commits have a record by then, the one the first wrote.
  const runs = [['--base', `${head.slice(0, 7)}^`], ['--base', 'HEAD~2', '--again', '--session', 'lean', '--prompt', 'own', '--keep-home', '--max-parts', '1']];
  for (const [at, flags] of runs.entries()) {
    const which = flags.join(' ');
    const nothing = startsNothing(root);
    const result = await run([...flags, ...nothing.home, '--cwd', root], nothing.deps);
    assert.equal(result.code, 0, `${which}: ${result.err}`);
    assert.deepEqual([result.err, result.shown], ['', ''], which);
    assert.deepEqual(result.out.split('\n'), [
      `Plan of the Codex review of ${range}: gpt-6.1-sol at high effort, 0 parts, 0 changed lines in 0 files.`,
      'No estimate: the range changes no file, so there is no part to review.',
      `There was nothing to review: ${range} changes no file. Nothing was started, and the range was recorded as having nothing to review in ${codexReviewsPath(root)}.`,
    ], which);
    // No Codex, no home, no session and no run line, as for any range with no part. What there is, is the record.
    nothing.started(which);
    // It says what happened, in an outcome that is neither a review nor a skip, and names no run: there was none.
    assert.deepEqual(readCodexReviews(root), Array.from({ length: at + 1 }, () => nothingRecord), which);
    assert.equal(isValidCodexReview(readCodexReviews(root).at(-1)), true, which);
  }
  // The check counts both commits as covered, and says by what: a line names the range and why no review
  // stands behind its record, as it does for a skip.
  const after = checkCodexReviews(root, 'HEAD');
  assert.equal(after.pass, true, `${after.detail}\n${(after.lines ?? []).join('\n')}`);
  assert.match(after.detail, /^2 code commits since origin\/main, all covered by a Codex review record/);
  const line = `nothing to review ${range}: the range changes no file`;
  assert.deepEqual(after.lines, [line, line]);
  // A run that is not asked to go again finds both commits covered, by records that are no review, and
  // appends no third: a skip of the range is not recorded either.
  const covered =
    `Nothing to review: ${range} holds 2 code commits, and a Codex review record already covers all of them (2 of the records that do are a skip or a range with nothing to review, not a review: \`js-harness check --push\` lists them). ` +
    'Nothing was started and nothing was recorded; `--again` takes the range as it was given.';
  for (const flags of [[], ['--unavailable', 'model rejected']]) {
    const nothing = startsNothing(root);
    const result = await run(['--base', 'HEAD~2', ...flags, ...nothing.home, '--cwd', root], nothing.deps);
    assert.deepEqual([result.code, result.err, result.out], [0, '', covered], flags.join(' '));
    nothing.started(flags.join(' '));
    assert.equal(readCodexReviews(root).length, 2, flags.join(' '));
  }
  // Beside a skip, each is listed as what it is.
  await run(['--base', 'HEAD~2', '--again', '--unavailable', 'model rejected', '--cwd', root], fakeCodex(''));
  assert.deepEqual(checkCodexReviews(root, 'HEAD').lines, [line, line, `unavailable ${range}: model rejected`]);
});

test('a range with nothing to review whose record cannot be written exits 1 and says so, having started nothing', async () => {
  const { root } = makeRevertedRepo();
  blockRecord(root);
  const nothing = startsNothing(root);
  const result = await run(['--base', 'HEAD~2', ...nothing.home, '--cwd', root], nothing.deps);
  assert.equal(result.code, 1);
  assert.match(result.err, /^Could not write the record: /);
  assert.doesNotMatch(result.out, /recorded/);
  nothing.untouched('a record that cannot be written');
  assert.equal(checkCodexReviews(root, 'HEAD').pass, false);
});

// --- only code is reviewed: documents and what the project marks are left out (`./lib/codex-review-scope.mjs`) ---

// A document whose name git writes in quotes and escapes, in the header of its section of a patch.
const DOC = 'caf\u00e9.md';
const MARKS = { '.gitattributes': '*.json -codex-review\n' };
const LEFT_BEFORE = { [DOC]: 'n1\n', 'data.json': 'd1\nd2\n' };
const LEFT_AFTER = { [DOC]: 'N1 changed\n', 'data.json': 'D1 changed\nD2 changed\n' };

/** `makeTwoFileRepo`, whose second commit also changes a document (two changed lines) and a file the project
 * marks with `-codex-review` (four): a review reads the four changed lines of `a.txt` and `b.txt`. */
function makeMixedRepo() {
  return makeRepoWith(
    { ...MARKS, 'a.txt': 'a1\na2\na3\n', 'b.txt': 'b1\nb2\nb3\n', ...LEFT_BEFORE },
    { 'a.txt': 'a1\nA2 changed\na3\n', 'b.txt': 'b1\nB2 changed\nb3\n', ...LEFT_AFTER },
  );
}

const LEFT_OUT_LINE = 'Left out of the review: 2 files, 6 changed lines (1 Markdown document, 2 changed lines; 1 file the project marks `-codex-review`, 4 changed lines).';
// The same, as a record holds it: the documents apart from what the project marks, which `check --push` reads.
const LEFT_OUT = { files: 2, changedLines: 6, documents: { files: 1, changedLines: 2 }, marked: { files: 1, changedLines: 4 } };
const BY_ITS_FILES = 'The review is asked with this command\'s own prompt, by its files: the sentence Codex writes for `--base` cannot be limited to some files.';

test('a range that also changes a document and a file the project marks is asked by the files it reads, held to their changed lines alone, and says what it left out', async () => {
  const { root, base, head } = makeMixedRepo();
  const short = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  const sole = { index: 1, of: 1, files: ['a.txt', 'b.txt'] };
  // The session ran the command of its prompt, which shows the two files a review reads and no other.
  for (const flags of [[], ['--prompt', 'codex'], ['--prompt', 'own']]) {
    const which = flags.join(' ') || 'no flag';
    const fake = fakeCodex(partShown(root, base, head, 'a.txt', 'b.txt'));
    const result = await run(['--base', 'HEAD~1', '--again', ...flags, '--cwd', root], fake);
    assert.equal(result.code, 0, `${which}: ${result.err}`);
    const lines = result.out.split('\n');
    // The plan is of what the review reads, and says what it leaves out, how much of it and why.
    assert.deepEqual(lines.slice(0, 4), [
      `Plan of the Codex review of ${short}: gpt-6.1-sol at high effort, 1 part, 4 changed lines in 2 files.`,
      lines[1],
      LEFT_OUT_LINE,
      lines[3],
    ], which);
    assert.match(lines[1], /^ {2}part 1 of 1: 2 files, 4 changed lines/, which);
    // Codex's own review of a range reads every file of it, so the range is asked the way a part is: with
    // this command's prompt on stdin, naming its files, and no `--base`. The files left out are in no prompt.
    assert.equal(fake.calls.length, 1, which);
    assert.deepEqual(fake.calls[0].args, ownArgv(), which);
    assert.equal(fake.calls[0].child.received.text, reviewPrompt({ from: base, head, part: sole, leftOut: 2 }), which);
    assert.doesNotMatch(fake.calls[0].child.received.text, /\.md|\.json|\bparts?\b/, which);
    // That is said when the prompt is not the one that was asked for, and not when it is.
    assert.equal(afterPlan(result.out)[0] === BY_ITS_FILES, flags.at(-1) !== 'own', which);
    assert.ok(lines.includes(`Codex is reviewing 2 files of ${short} (4 changed lines) with the lean session (gpt-6.1-sol, high) and this command's own prompt; this can take several minutes.`), result.out);
    // It is one session, so what it answered is shown as it ends, as for any range reviewed whole.
    assert.ok(result.shown.includes(FINDINGS), which);
    assert.ok(lines.some((line) => line.startsWith('Codex\'s verdict: ')), which);
    // The run line says what the session covered, so the estimate of a later plan can rest on it.
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual(
      [logged.outcome, logged.part, logged.coverage, logged.prompt, logged.promptVersion],
      ['reviewed', { index: 1, of: 1, files: 2, changedLines: 4 }, { seen: 4, total: 4 }, 'own', REVIEW_PART_PROMPT_VERSION],
      which,
    );
    // One record, which `check --push` reads as any other, with what the review did not read; it is not one made in parts.
    const record = readCodexReviews(root).at(-1);
    assert.deepEqual(record, { ...reviewedRecord(base, head), leftOut: LEFT_OUT }, which);
    assert.equal(isValidCodexReview(record), true, which);
    assert.match(lines.at(-1), new RegExp(`^Recorded the Codex review of ${short} in .*codex-reviews\\.jsonl\\.$`), which);
  }
  // `--doc` goes into that prompt as into any other of this command's.
  const withDoc = fakeCodex(partShown(root, base, head, 'a.txt', 'b.txt'));
  assert.equal((await run(['--base', 'HEAD~1', '--again', '--prompt', 'own', '--doc', featureDoc(), '--cwd', root], withDoc)).code, 0);
  assert.equal(withDoc.calls[0].child.received.text, reviewPrompt({ from: base, head, part: sole, leftOut: 2, intent: { goal: GOAL, doneWhen: DONE_WHEN } }));
  // The evidence rule is held for the files a review reads: a session that showed one of the two did not
  // inspect them, whatever it showed of the files that are left out.
  const records = readCodexReviews(root).length;
  const half = fakeCodex(partShown(root, base, head, 'a.txt', DOC, 'data.json'));
  const refused = await run(['--base', 'HEAD~1', '--again', '--cwd', root], half);
  assert.equal(refused.code, 1);
  assert.match(refused.err, /showed 2 of 4 changed lines of the files under review of [0-9a-f]{7}\.\.HEAD; nothing was recorded/);
  assert.match(refused.err, /not read in full: b\.txt \(2 of 2 changed lines missing\)/);
  assert.equal(readCodexReviews(root).length, records);
});

test('in parts, the files left out are in no part and in no prompt, and the parts still add up to what the review reads', async () => {
  const { root, base, head } = makeMixedRepo();
  const short = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  const fake = fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt') }, { stdout: partShown(root, base, head, 'b.txt') });
  const result = await run(['--base', 'HEAD~1', '--part-lines', '2', '--cwd', root], { ...fake, randomUUID: runIds() });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(result.out.split('\n').slice(0, 4), [
    `Plan of the Codex review of ${short}: gpt-6.1-sol at high effort, 2 parts, 4 changed lines in 2 files.`,
    '  part 1 of 2: 1 file, 2 changed lines',
    '  part 2 of 2: 1 file, 2 changed lines',
    LEFT_OUT_LINE,
  ]);
  assert.equal(afterPlan(result.out)[0], `The range ${short} changes 4 lines in 2 files that a review reads, more than the 2 a part holds, so it is reviewed in 2 parts, one after another.`);
  // Each part says the other files are in the other part or left out, and names none of them.
  ['a.txt', 'b.txt'].forEach((name, at) => {
    const asked = fake.calls[at].child.received.text;
    assert.equal(asked, reviewPrompt({ from: base, head, part: { index: at + 1, of: 2, files: [name] }, leftOut: 2 }));
    assert.match(asked, /reviewed in the other parts, or left out of the review/);
    assert.doesNotMatch(asked, /\.md|\.json/);
  });
  assert.deepEqual(readCodexReviewRuns(root).map((line) => [line.part, line.coverage]), [1, 2].map((index) => [{ index, of: 2, files: 1, changedLines: 2 }, { seen: 2, total: 2 }]));
  assert.deepEqual(readCodexReviews(root), [{ ...reviewedRecord(base, head), run: idOf(2), runs: [idOf(1), idOf(2)], leftOut: LEFT_OUT }]);
  // The check that the parts leave nothing out is made against the patch without the sections of the files
  // left out, told apart by their place. A patch that is not one section a file refuses the run.
  const cut = (command, args, opts) => {
    const answer = fake.spawn(command, args, opts);
    const whole = command === 'git' && args.includes('--no-renames') && !args.includes('--numstat') && !args.includes('--');
    return whole ? { ...answer, stdout: answer.stdout.slice(0, answer.stdout.lastIndexOf('diff --git ')) } : answer;
  };
  const none = fakeCodexInParts();
  const refused = await run(['--base', 'HEAD~1', '--part-lines', '2', '--cwd', root], { ...none, spawn: cut });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /^Could not check the parts against the range\. The patch of the range holds 3 sections for its 4 files, .*\nThe review was not started and nothing was recorded\.$/);
  assert.deepEqual([none.calls.length, none.probes.length, readCodexReviews(root).length], [0, 0, 1]);
});

/** A repo whose second commit moves a submodule (`sub`, from one commit to another, neither of them here),
 * changes `a.txt` (two changed lines) and changes a document. The folder of the submodule is there and
 * empty, as that of one that was never fetched, so the tree is clean. */
function makeSubmoduleRepo() {
  const root = tmp('js-harness-codex-review-');
  git(root, 'init');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  fs.mkdirSync(path.join(root, 'sub'));
  const committed = (pointer, files, message) => {
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(root, name), content, 'utf8');
    git(root, 'add', ...Object.keys(files));
    git(root, 'update-index', '--add', '--cacheinfo', `160000,${pointer.repeat(40)},sub`);
    git(root, 'commit', '-m', message);
    return git(root, 'rev-parse', 'HEAD');
  };
  const base = committed('1', { 'a.txt': 'a1\n', 'README.md': 'one\n' }, 'one');
  const head = committed('2', { 'a.txt': 'A1 changed\n', 'README.md': 'two\n' }, 'two');
  assert.equal(git(root, 'status', '--porcelain'), '');
  return { root, base, head };
}

test('a range that moves a submodule beside a file left out is checked and reviewed whatever `diff.submodule` the repository sets', async () => {
  // The finding this is the test of. Under `log` and `diff` git writes one line of summary for a submodule
  // where the patch of a range has a section, so the patch held a section fewer than the range has files,
  // and the run was refused before it started.
  const { root, base, head } = makeSubmoduleRepo();
  const short = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  const pointers = ['-Subproject commit 1111111111111111111111111111111111111111', '+Subproject commit 2222222222222222222222222222222222222222'];
  for (const format of ['log', 'diff', 'short', null]) {
    const which = `diff.submodule ${format ?? 'not set'}`;
    if (format === null) git(root, 'config', '--unset', 'diff.submodule');
    else git(root, 'config', 'diff.submodule', format);
    // What the session's own `git diff` prints of its files, under that configuration.
    const asShown = partDiff(root, base, head, 'a.txt', 'sub');
    const summarized = format === 'log' || format === 'diff';
    assert.equal(asShown.includes('Submodule sub 1111111...2222222'), summarized, which);
    assert.equal(pointers.every((line) => asShown.includes(line)), !summarized, which);
    const fake = fakeCodex(partShown(root, base, head, 'a.txt', 'sub'));
    const result = await run(['--base', 'HEAD~1', '--again', '--cwd', root], fake);
    assert.equal(result.code, 0, `${which}: ${result.err}`);
    assert.deepEqual(result.out.split('\n').slice(0, 3), [
      `Plan of the Codex review of ${short}: gpt-6.1-sol at high effort, 1 part, 4 changed lines in 2 files.`,
      '  part 1 of 1: 2 files, 4 changed lines',
      'Left out of the review: 1 Markdown document, 2 changed lines.',
    ], which);
    assert.equal(fake.calls.length, 1, which);
    // A session is held to the changed lines its own git prints: those of `a.txt`, and the two of the
    // submodule where git writes them as a patch.
    const total = summarized ? 2 : 4;
    assert.deepEqual(readCodexReviewRuns(root).at(-1).coverage, { seen: total, total }, which);
    assert.equal(readCodexReviews(root).at(-1).outcome, 'reviewed', which);
  }
  // In parts too, and the check that they leave no changed line of the range out still holds them to it:
  // a part whose files do not show the submodule refuses the run, under the configuration that summarizes it.
  git(root, 'config', 'diff.submodule', 'log');
  const parts = fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt') }, { stdout: partShown(root, base, head, 'sub') });
  const inParts = await run(['--base', 'HEAD~1', '--again', '--part-lines', '2', '--cwd', root], { ...parts, randomUUID: runIds() });
  assert.equal(inParts.code, 0, inParts.err);
  assert.deepEqual(readCodexReviewRuns(root).slice(-2).map((line) => [line.part, line.coverage]), [
    [{ index: 1, of: 2, files: 1, changedLines: 2 }, { seen: 2, total: 2 }],
    [{ index: 2, of: 2, files: 1, changedLines: 2 }, { seen: 0, total: 0 }],
  ]);
  const none = fakeCodexInParts();
  const missing = (command, args, opts) => {
    const answer = none.spawn(command, args, opts);
    const ofTheSubmodule = command === 'git' && args.includes('--') && args.at(-1) === 'sub';
    return ofTheSubmodule ? { ...answer, stdout: '' } : answer;
  };
  const refused = await run(['--base', 'HEAD~1', '--again', '--part-lines', '2', '--cwd', root], { ...none, spawn: missing });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /^The 2 parts the range would be reviewed in do not show 2 of the changed lines of the range between them \(the first: sub: -Subproject commit 1{40}\)/);
  assert.equal(none.calls.length, 0);
});

test('a range that changes only what a review leaves out has no part: the run starts nothing, and records that when the range holds a commit', async () => {
  const { root, base, head } = makeRepoWith({ ...MARKS, ...LEFT_BEFORE }, LEFT_AFTER);
  const short = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  const plan = [
    `Plan of the Codex review of ${short}: gpt-6.1-sol at high effort, 0 parts, 0 changed lines in 0 files.`,
    LEFT_OUT_LINE,
    'No estimate: every file the range changes is left out of the review, so there is no part to review.',
  ];
  // The range is taken as it was given (`--again`): left to the records it holds no code commit, and a run
  // then says so and records nothing. The plan alone, also over a tree whose marks nobody committed: those
  // are not the marks of the range.
  fs.writeFileSync(path.join(root, '.gitattributes'), '', 'utf8');
  const planned = startsNothing(root);
  const shown = await run(['--base', 'HEAD~1', '--again', '--plan', ...planned.home, '--cwd', root], planned.deps);
  assert.deepEqual([shown.code, shown.err, shown.out.split('\n')], [0, '', plan]);
  planned.untouched('--plan');
  git(root, 'checkout', '--', '.gitattributes');
  const nothing = startsNothing(root);
  const result = await run(['--base', 'HEAD~1', '--again', ...nothing.home, '--cwd', root], nothing.deps);
  assert.equal(result.code, 0, result.err);
  assert.deepEqual([result.err, result.shown], ['', '']);
  assert.deepEqual(result.out.split('\n'), [
    ...plan,
    `There was nothing to review: ${short} changes no file a review reads. Nothing was started, and the range was recorded as having nothing to review in ${codexReviewsPath(root)}.`,
  ]);
  nothing.started('a range of files left out');
  // The outcome that exists for a range with nothing to review, with a reason that says which kind it is.
  const [record] = readCodexReviews(root);
  assert.deepEqual(record, {
    schema: 'js-harness.codex-review/v1',
    base,
    head,
    reviewedAt: '2026-09-29T12:00:00.000Z',
    outcome: 'nothing-to-review',
    reason: 'the range changes no file a review reads: it leaves out 2 files, 6 changed lines (1 Markdown document, 2 changed lines; 1 file the project marks `-codex-review`, 4 changed lines)',
    leftOut: LEFT_OUT,
  });
  assert.equal(isValidCodexReview(record), true);
});

test('a review that left out a file which a later commit of its range marks does not cover the commit before the mark, where that file is code', async () => {
  // The finding this is the test of: one commit changes `app.js`, the next marks it. The marks are read at
  // the head of the range, so the review through the second leaves `app.js` out, and says so in its record.
  const { root, head: main } = makeRepo();
  git(root, 'remote', 'add', 'origin', 'https://example.invalid/js-harness-test.git');
  git(root, 'update-ref', 'refs/remotes/origin/main', main);
  const committed = (name, content, message) => {
    fs.writeFileSync(path.join(root, name), content, 'utf8');
    git(root, 'add', '.');
    git(root, 'commit', '-m', message);
    return git(root, 'rev-parse', 'HEAD');
  };
  const app = committed('app.js', 'code\n', 'feat: the application');
  const marks = committed('.gitattributes', 'app.js -codex-review\n', 'chore: mark the application as left out');
  // The range as it was given: a run left to the records would start at the commit that marks, the only
  // one of the two that is code at this head, and would have the application in no range to leave out.
  const result = await run(['--base', 'origin/main', '--again', '--cwd', root], fakeCodex(partShown(root, main, marks, '.gitattributes')));
  assert.equal(result.code, 0, result.err);
  assert.ok(result.out.split('\n').includes('Left out of the review: 1 file the project marks `-codex-review`, 1 changed line.'), result.out);
  assert.deepEqual(readCodexReviews(root), [{
    ...reviewedRecord(main, marks),
    leftOut: { files: 1, changedLines: 1, documents: { files: 0, changedLines: 0 }, marked: { files: 1, changedLines: 1 } },
  }]);
  // Pushed up to the commit that marks it, the application is left out and the record covers the rest.
  const both = checkCodexReviews(root, marks);
  assert.equal(both.pass, true, both.detail);
  assert.equal(both.detail, '1 code commit since origin/main, all covered by a Codex review record');
  // Pushed alone, the application is code that no review read: that record does not cover it.
  const alone = checkCodexReviews(root, app);
  assert.equal(alone.pass, false, alone.detail);
  assert.match(alone.detail, /^1 of 1 code commit since origin\/main have no Codex review record/);
});

test('when git cannot say what the project marks, nothing is planned or started: a file is never left out, nor read, by guess', async () => {
  const { root, base, head } = makeMixedRepo();
  const nothing = startsNothing(root);
  const old = (command, args, opts) => (command === 'git' && args[0] === 'check-attr' ? { status: 129, stdout: '', stderr: 'error: unknown option `source\'' } : nothing.deps.spawn(command, args, opts));
  const why = 'Could not ask git which files of the range the project leaves out of a review \\(`git check-attr --source [0-9a-f]{7}` failed; it needs git 2\\.40 or later\\)';
  // Nor can the records be read against the range without it: that is said first, and the range is taken as given.
  const unread = `Could not tell which commits of ${rangeOf(base, head)} a Codex review record already covers (git could not say which of their files a review leaves out), so the range is taken as it was given.`;
  const plan = await run(['--base', 'HEAD~1', '--plan', ...nothing.home, '--cwd', root], { ...nothing.deps, spawn: old });
  assert.deepEqual([plan.code, plan.out], [1, unread]);
  assert.match(plan.err, new RegExp(`^${why}, so there is no plan of its review\\.$`));
  const result = await run(['--base', 'HEAD~1', ...nothing.home, '--cwd', root], { ...nothing.deps, spawn: old });
  assert.deepEqual([result.code, result.out], [1, unread]);
  assert.match(result.err, new RegExp(`^${why}\\.\\nThe review was not started and nothing was recorded\\.$`));
  nothing.untouched('a git that cannot say what is marked');
});

test('an injected `everyFile` makes the run read every file of its range, as every run did: nothing is left out, a range of one part is asked whole, and no flag reaches it', async () => {
  const { root, base, head } = makeMixedRepo();
  const short = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  /** `fake`, with every question to git about what is marked kept in `asked`. */
  const watchingMarks = (fake, asked) => ({ ...fake, spawn: (command, args, opts) => {
    if (command === 'git' && args[0] === 'check-attr') asked.push(args);
    return fake.spawn(command, args, opts);
  } });
  // Under either prompt the review is the one of a whole range: Codex's own with `--base`, or this command's
  // prompt of a range, and it is held to every changed line of the range, the document's and the marked file's too.
  for (const [flags, argv, version] of [[[], leanArgv(base), null], [['--prompt', 'own'], ownArgv(), REVIEW_PROMPT_VERSION]]) {
    const which = flags.join(' ') || 'no flag';
    const asked = [];
    const fake = watchingMarks(fakeCodex(reviewed(root, base)), asked);
    const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], { ...fake, everyFile: true });
    assert.equal(result.code, 0, `${which}: ${result.err}`);
    assert.equal(result.out.split('\n')[0], `Plan of the Codex review of ${short}: gpt-6.1-sol at high effort, 1 part, 10 changed lines in 4 files.`, which);
    assert.doesNotMatch(result.out, /Left out|by its files/, which);
    assert.deepEqual(fake.calls[0].args, argv, which);
    if (version !== null) assert.equal(fake.calls[0].child.received.text, reviewPrompt({ from: base, head }), which);
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual(['part' in logged, logged.coverage, logged.promptVersion], [false, { seen: 10, total: 10 }, version], which);
    assert.deepEqual(readCodexReviews(root).at(-1), reviewedRecord(base, head), which);
    // What the project marks is not asked of git at all: the run needs no git that can answer it. Nor are
    // the records read: the second of these two runs reviews a range the first left a record of, whole.
    assert.deepEqual(asked, [], which);
    assert.equal(fake.calls.length, 1, which);
  }
  // In parts, every file of the range is in a part.
  const all = startsNothing(root);
  const inParts = await run(['--base', 'HEAD~1', '--plan', '--part-lines', '2', ...all.home, '--cwd', root], { ...all.deps, everyFile: true });
  assert.equal(inParts.out.split('\n')[0], `Plan of the Codex review of ${short}: gpt-6.1-sol at high effort, 4 parts, 10 changed lines in 4 files.`);
  // It is injected, for the comparison of the configurations, whose cells stay what they measured. Nothing
  // on the command line is it: the usage names no such flag, and one spelled after it changes nothing.
  assert.doesNotMatch((await run(['--cwd', root])).err, /every.?file/i);
  for (const flag of ['--every-file', '--everyFile', '--read-every-file']) {
    const nothing = startsNothing(root);
    const plan = await run(['--base', 'HEAD~1', '--again', '--plan', flag, ...nothing.home, '--cwd', root], nothing.deps);
    assert.deepEqual([plan.code, plan.out.split('\n')[0], plan.out.split('\n')[2]], [0, `Plan of the Codex review of ${short}: gpt-6.1-sol at high effort, 1 part, 4 changed lines in 2 files.`, LEFT_OUT_LINE], flag);
  }
});

test('a run started in a folder below the top of the repository plans what it plans at the top: git is asked at the top, whatever `diff.relative` says', async () => {
  const { root } = makeMixedRepo();
  fs.mkdirSync(path.join(root, 'below'));
  const planFrom = async (cwd) => {
    const nothing = startsNothing(root);
    const result = await run(['--base', 'HEAD~1', '--plan', ...nothing.home, '--cwd', cwd], nothing.deps);
    assert.equal(result.code, 0, result.err);
    return result.out.split('\n');
  };
  const atTop = await planFrom(root);
  assert.match(atTop[0], /, 1 part, 4 changed lines in 2 files\.$/);
  assert.equal(atTop[2], LEFT_OUT_LINE);
  // The paths of the range are from the top of the repository, and so is the folder every git command of
  // the run is started in: what is marked, and how large the range is, do not depend on where it was called.
  assert.deepEqual(await planFrom(path.join(root, 'below')), atTop);
  // Nor on a configuration that makes git list paths from the folder it runs in and leave out the rest.
  git(root, 'config', 'diff.relative', 'true');
  assert.deepEqual(await planFrom(path.join(root, 'below')), atTop);
  assert.deepEqual(await planFrom(root), atTop);
});

test('a run of more than six parts is refused before anything is started, with its plan and how to go on; `--max-parts` with the count runs it, and `--plan` never refuses', async () => {
  const repoOf = (count) => {
    const names = Array.from({ length: count }, (_, index) => `f${index}.txt`);
    return { names, ...makeRepoWith(Object.fromEntries(names.map((name) => [name, 'one\n'])), Object.fromEntries(names.map((name) => [name, 'two\n']))) };
  };
  // Seven files of two changed lines each, a part a file.
  const SEVEN = ['--part-lines', '2'];
  const { names, root, base, head } = repoOf(7);
  const short = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  const plan = planned(root, base, head, names.map((name) => ({ files: [name], changedLines: 2 })));
  assert.match(plan[0], / 7 parts, 14 changed lines in 7 files\.$/);
  const HOW = 'To run it all the same, pass `--max-parts 7`. The cheaper way is to review each slice when it closes, from the commit before it (`--base`).';
  for (const [flags, bound] of [
    [[], 'the 6 a run starts without `--max-parts`'],
    [['--session', 'lean', '--prompt', 'own', '--keep-home'], 'the 6 a run starts without `--max-parts`'],
    [['--max-parts', '6'], '`--max-parts 6` allows'],
    [['--max-parts', '1'], '`--max-parts 1` allows'],
  ]) {
    const which = flags.join(' ') || 'no flag';
    const nothing = startsNothing(root);
    const result = await run(['--base', 'HEAD~1', ...SEVEN, ...flags, ...nothing.home, '--cwd', root], nothing.deps);
    assert.equal(result.code, 1, which);
    assert.deepEqual(result.out.split('\n'), plan, `${which}: the plan is shown`);
    assert.equal(result.err, `The review of ${short} was not started and nothing was recorded: its 7 parts are more than ${bound}.\n${HOW}`, which);
    nothing.untouched(which);
  }
  // `--plan` never refuses: it says what the run would need, or nothing when the run names its count.
  for (const [flags, said] of [
    [[], ['This is more parts than the 6 a run starts without `--max-parts`: the run would need `--max-parts 7`.']],
    [['--max-parts', '3'], ['This is more parts than `--max-parts 3` allows: the run would need `--max-parts 7`.']],
    [['--max-parts', '7'], []],
  ]) {
    const which = `--plan ${flags.join(' ')}`;
    const nothing = startsNothing(root);
    const result = await run(['--base', 'HEAD~1', '--plan', ...SEVEN, ...flags, ...nothing.home, '--cwd', root], nothing.deps);
    assert.equal(result.code, 0, which);
    assert.equal(result.err, '', which);
    assert.deepEqual(result.out.split('\n'), [...plan, ...said], which);
    nothing.untouched(which);
  }
  // With its count named, the run goes on: seven sessions and one record.
  const seven = fakeCodexInParts(...names.map((name) => ({ stdout: partShown(root, base, head, name) })));
  const allowed = await run(['--base', 'HEAD~1', ...SEVEN, '--max-parts', '7', '--cwd', root], { ...seven, randomUUID: runIds() });
  assert.equal(allowed.code, 0, allowed.err);
  assert.equal(seven.calls.length, 7);
  assert.equal(readCodexReviews(root).length, 1);
  // Six parts are at the bound, and run with no flag.
  const six = repoOf(6);
  const fake = fakeCodexInParts(...six.names.map((name) => ({ stdout: partShown(six.root, six.base, six.head, name) })));
  const atBound = await run(['--base', 'HEAD~1', ...SEVEN, '--cwd', six.root], { ...fake, randomUUID: runIds() });
  assert.equal(atBound.code, 0, atBound.err);
  assert.equal(fake.calls.length, 6);
  assert.doesNotMatch(`${atBound.out}\n${atBound.err}`, /--max-parts/);
});

test('--max-parts takes a positive integer, and --plan does not stand beside --unavailable: each is a usage error, and nothing runs', async () => {
  const { root, base, head } = makeRepo();
  const cases = [
    [['--max-parts', '0'], /^--max-parts must be a positive integer/],
    [['--max-parts', '-3'], /^--max-parts must be a positive integer/],
    [['--max-parts', '1.5'], /^--max-parts must be a positive integer/],
    [['--max-parts', '1e1'], /^--max-parts must be a positive integer/],
    [['--max-parts', 'all'], /^--max-parts must be a positive integer/],
    [['--max-parts', ''], /^--max-parts must be a positive integer/],
    [['--max-parts', '99999999999999999999'], /^--max-parts must be a positive integer/],
    [['--max-parts'], /^--max-parts requires a value/],
    [['--max-parts', '0', '--plan'], /^--max-parts must be a positive integer/],
    [['--max-parts', '0', '--unavailable', 'model rejected'], /^--max-parts must be a positive integer/],
    [['--plan', '--unavailable', 'model rejected'], /^--plan does not go with --unavailable: a plan starts nothing and records nothing, and a skip is a record/],
    [['--unavailable', 'model rejected', '--plan'], /^--plan does not go with --unavailable/],
  ];
  for (const [flags, message] of cases) {
    const which = flags.join(' ');
    const nothing = startsNothing(root);
    const result = await run(['--base', 'HEAD~1', ...flags, ...nothing.home, '--cwd', root], nothing.deps);
    assert.equal(result.code, 2, which);
    assert.match(result.err, message, which);
    assert.match(result.err, /\n\nUsage: js-harness codex-review --base <rev> \[--plan\] .*\[--part-lines <n>\] \[--max-parts <n>\]/, which);
    assert.equal(result.out, '', which);
    nothing.untouched(which);
  }
  // Beside `--unavailable` a count of parts is taken and changes nothing, as the other flags of a run are: a
  // skip launches nothing, so there are no parts to count.
  const skip = await run(['--base', 'HEAD~1', '--max-parts', '3', '--unavailable', 'model rejected', '--cwd', root], fakeCodex(''));
  assert.equal(skip.code, 0, skip.err);
  assert.deepEqual(readCodexReviews(root), [skippedRecord(base, head, 'model rejected')]);
});

// --- nothing twice: a run starts where the Codex review records end (`./lib/codex-review-coverage.mjs`) ---

/** A repository of four commits: `base`, then `one`, `two` and `three`, each of which changes two lines in
 * a file of its own, `a.txt`, `b.txt` and `c.txt`. `HEAD~3` is `base`. */
function makeSlicedRepo() {
  const { root, base, head: one } = makeRepoWith({ 'a.txt': 'a1\n', 'b.txt': 'b1\n', 'c.txt': 'c1\n' }, { 'a.txt': 'A1 changed\n' });
  const change = (name, message) => {
    fs.writeFileSync(path.join(root, name), `${name} changed\n`, 'utf8');
    git(root, 'commit', '-am', message);
    return git(root, 'rev-parse', 'HEAD');
  };
  return { root, base, one, two: change('b.txt', 'three'), three: change('c.txt', 'four') };
}

const rangeOf = (from, to) => `${from.slice(0, 7)}..${to.slice(0, 7)}`;

/** What a run says, before its plan, when it starts later than the range it was given: `given` holds `held`
 * code commits, a record covers `covered` of them, and it starts at `start`. `notReviews`, when given, is
 * what it says in brackets of the covering records that are no review. */
const startsAt = (given, held, covered, start, notReviews = '') =>
  `${given} holds ${held} code commits, and a Codex review record already covers ${covered === 0 ? 'none' : covered} of them${notReviews && ` (${notReviews})`}: ` +
  `this run starts at ${start.slice(0, 7)}, the commit before the oldest one no record covers. \`--again\` takes the range as it was given.`;

// What a run over a range the records leave nothing of ends with.
const NOTHING_DONE = 'Nothing was started and nothing was recorded';
const AGAIN_TAKES_IT = `${NOTHING_DONE}; \`--again\` takes the range as it was given.`;

// The files of `makeSlicedRepo` that `one..three` changes, as one part; and all three, as one part.
const LAST_TWO = [{ files: ['b.txt', 'c.txt'], changedLines: 4 }];
const ALL_THREE = [{ files: ['a.txt', 'b.txt', 'c.txt'], changedLines: 6 }];

test('a run starts where the records end: the plan, what Codex is asked, the lines it must have seen, the run line and the record are those of the range that is left', async () => {
  for (const flags of [[], ['--prompt', 'own']]) {
    const which = flags.join(' ') || 'no flag';
    const { root, base, one, three } = makeSlicedRepo();
    appendCodexReview(root, reviewedRecord(base, one));
    // The session showed the patch of `one..three` and no line of the commit a record covers.
    const fake = fakeCodex(reviewed(root, one));
    const result = await run(['--base', 'HEAD~3', ...flags, '--cwd', root], fake);
    assert.equal(result.code, 0, `${which}: ${result.err}`);
    const lines = result.out.split('\n');
    // Said before the plan: how many code commits the range holds, how many are covered, where the run starts.
    assert.equal(lines[0], startsAt(rangeOf(base, three), 3, 1, one), which);
    assert.deepEqual(lines.slice(1, 4), planned(root, one, three, LAST_TWO), which);
    assert.ok(lines[4].startsWith(`Codex is reviewing ${rangeOf(one, three)} with the lean session`), lines[4]);
    // Codex is asked from there: by `--base`, or by the range this command's own prompt names.
    if (flags.length === 0) assert.deepEqual(fake.calls[0].args, leanArgv(one));
    else assert.equal(fake.calls[0].child.received.text, reviewPrompt({ from: one, head: three, intent: null }));
    const logged = onlyRun(root);
    assert.deepEqual([logged.outcome, logged.base, logged.from, logged.head, logged.coverage], ['reviewed', one, one, three, { seen: 4, total: 4 }], which);
    // The record is of where the review started, so the two records cover the range between them.
    assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, one), reviewedRecord(one, three)], which);
    assert.equal(lines.at(-1), `Recorded the Codex review of ${rangeOf(one, three)} in ${codexReviewsPath(root)}.`, which);
  }
});

test('the parts and the bound of parts are those of the range that is left: a run that would be refused as it was given starts', async () => {
  const { root, base, one, three } = makeSlicedRepo();
  // Given whole, the range is three parts of two changed lines, one more than this run may start.
  const asGiven = startsNothing(root);
  const refused = await run(['--base', 'HEAD~3', '--part-lines', '2', '--max-parts', '2', ...asGiven.home, '--cwd', root], asGiven.deps);
  assert.equal(refused.code, 1);
  assert.match(refused.err, /its 3 parts are more than `--max-parts 2` allows/);
  appendCodexReview(root, reviewedRecord(base, one));
  const fake = fakeCodexInParts({ stdout: partShown(root, one, three, 'b.txt') }, { stdout: partShown(root, one, three, 'c.txt') });
  const result = await run(['--base', 'HEAD~3', '--part-lines', '2', '--max-parts', '2', '--cwd', root], { ...fake, randomUUID: runIds() });
  assert.equal(result.code, 0, result.err);
  const parts = [{ index: 1, of: 2, files: ['b.txt'] }, { index: 2, of: 2, files: ['c.txt'] }];
  fake.calls.forEach((call, at) => assert.equal(call.child.received.text, reviewPrompt({ from: one, head: three, part: parts[at] }), `part ${at + 1}`));
  assert.deepEqual(readCodexReviewRuns(root).map((line) => [line.base, line.from, line.part.of, line.coverage]), [[one, one, 2, { seen: 2, total: 2 }], [one, one, 2, { seen: 2, total: 2 }]]);
  assert.deepEqual(readCodexReviews(root).at(-1), { ...reviewedRecord(one, three), run: idOf(2), runs: [idOf(1), idOf(2)] });
});

test('where starting later is not safe, the range is reviewed as it was given: a commit of a branch that forked before it', async () => {
  const { root, base: first, head: from } = makeRepoWith({ 'a.txt': 'a1\n', 'b.txt': 'b1\n', 's.txt': 's1\n' }, { 'a.txt': 'A1 changed\n' });
  const trunk = git(root, 'rev-parse', '--abbrev-ref', 'HEAD');
  fs.writeFileSync(path.join(root, 'b.txt'), 'B1 changed\n', 'utf8');
  git(root, 'commit', '-am', 'mine');
  const mine = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', '-b', 'side', first);
  fs.writeFileSync(path.join(root, 's.txt'), 'S1 changed\n', 'utf8');
  git(root, 'commit', '-am', 'side work, forked before the range starts');
  git(root, 'checkout', '--quiet', trunk);
  git(root, 'merge', '--no-ff', '-m', 'merge side', 'side');
  const head = git(root, 'rev-parse', 'HEAD');
  appendCodexReview(root, reviewedRecord(from, mine));
  // The one commit no record covers has `first` as its parent: from there the review would read `a.txt`,
  // which the range never held.
  const fake = fakeCodex(reviewed(root, from));
  const result = await run(['--base', from, '--cwd', root], fake);
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(result.out.split('\n').slice(0, 2), planned(root, from, head, [{ files: ['b.txt', 's.txt'], changedLines: 4 }]).slice(0, 2));
  assert.deepEqual(fake.calls[0].args, leanArgv(from));
  assert.deepEqual(readCodexReviews(root).at(-1), reviewedRecord(from, head));
});

test('a merge somebody wrote in is a commit of the range: with a record for every other commit the range is not covered, and is reviewed from the first parent of the merge', async () => {
  const { root, base, head: mine } = makeRepoWith({ 'a.txt': 'a1\n', 's.txt': 's1\n', 'm.txt': 'm1\n' }, { 'a.txt': 'A1 changed\n' });
  const trunk = git(root, 'rev-parse', '--abbrev-ref', 'HEAD');
  git(root, 'checkout', '--quiet', '-b', 'side', base);
  fs.writeFileSync(path.join(root, 's.txt'), 'S1 changed\n', 'utf8');
  git(root, 'commit', '-am', 'side work');
  const side = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '--quiet', trunk);
  // The finding this is the test of: an edit made in the merge is in the patch of neither side, and with
  // a record for each of them the run said "Nothing to review" of a range that holds it.
  git(root, 'merge', '--no-ff', '--no-commit', 'side');
  fs.writeFileSync(path.join(root, 'm.txt'), 'M1 edited in the merge\n', 'utf8');
  git(root, 'commit', '-am', 'merge side, with an edit of its own');
  const head = git(root, 'rev-parse', 'HEAD');
  appendCodexReview(root, reviewedRecord(base, mine));
  appendCodexReview(root, reviewedRecord(base, side));
  const plan = async (which) => {
    const nothing = startsNothing(root);
    const result = await run(['--base', base, '--plan', ...nothing.home, '--cwd', root], nothing.deps);
    assert.deepEqual([result.code, result.err], [0, ''], which);
    nothing.untouched(which);
    return result.out.split('\n');
  };
  // The oldest commit no record covers is the merge: the run starts at its first parent, and reads the edit
  // with what the merge brought in beside it.
  assert.deepEqual(await plan('the merge has no record'), [
    startsAt(rangeOf(base, head), 3, 2, mine),
    ...planned(root, mine, head, [{ files: ['m.txt', 's.txt'], changedLines: 4 }]),
  ]);
  // Covered as any commit is, by a record whose range holds it: then the range is covered whole.
  appendCodexReview(root, reviewedRecord(mine, head));
  assert.deepEqual(await plan('a record covers the merge'), [`Nothing to review: ${rangeOf(base, head)} holds 3 code commits, and a Codex review record already covers all of them. ${AGAIN_TAKES_IT}`]);
});

test('when the records cannot be read against the range, the range is reviewed as it was given, and one line says so', async () => {
  const { root, base, one, three } = makeSlicedRepo();
  appendCodexReview(root, reviewedRecord(base, one));
  const given = rangeOf(base, three);
  const cannotTell = (why) => new RegExp(`^Could not tell which commits of ${given.replace(/\./g, '\\.')} a Codex review record already covers \\(${why}\\), so the range is taken as it was given\\.$`);
  // Each is what git answers the first time it is asked that: the later times, for the plan and the run
  // itself, it answers as it does. The last is an answer the reader of the records throws on: the line then
  // ends with the message of what was thrown, which is the engine's wording of a TypeError and not this
  // command's to keep, so it is held to say that reading failed and to say something after it.
  const failures = [
    ['git could not list them', (args) => (args[0] === 'log' ? { status: 128, stdout: '', stderr: 'fatal' } : null)],
    ['git could not say which of their files a review leaves out', (args) => (args[0] === 'check-attr' ? { status: 129, stdout: '', stderr: 'usage' } : null)],
    ['reading them failed: .+', (args) => (args.includes('--git-common-dir') ? { status: 0, stdout: Buffer.from('.git\n'), stderr: '' } : null)],
  ];
  for (const [why, instead] of failures) {
    const fake = fakeCodex(reviewed(root, base));
    let answered = false;
    const spawn = (command, args, opts) => {
      const answer = command === 'git' && !answered ? instead(args) : null;
      answered ||= answer !== null;
      return answer ?? fake.spawn(command, args, opts);
    };
    const result = await run(['--base', 'HEAD~3', '--cwd', root], { ...fake, spawn });
    assert.equal(result.code, 0, `${why}: ${result.err}`);
    const lines = result.out.split('\n');
    assert.match(lines[0], cannotTell(why));
    assert.deepEqual(lines.slice(1, 3), planned(root, base, three, ALL_THREE).slice(0, 2), why);
    assert.deepEqual(fake.calls[0].args, leanArgv(base), why);
    assert.deepEqual(readCodexReviews(root).at(-1), reviewedRecord(base, three), why);
  }
});

test('a range the records cover whole starts nothing and records nothing: the run says how many code commits it holds, that all are covered and by what, and exits 0', async () => {
  const { root, base, one, two, three } = makeSlicedRepo();
  appendCodexReview(root, reviewedRecord(base, one));
  appendCodexReview(root, skippedRecord(one, two, 'model rejected'));
  appendCodexReview(root, reviewedRecord(two, three));
  // Covered is not reviewed: one of the three records is a skip, and the run says so.
  const covered =
    `Nothing to review: ${rangeOf(base, three)} holds 3 code commits, and a Codex review record already covers all of them ` +
    `(1 of the records that do is a skip or a range with nothing to review, not a review: \`js-harness check --push\` lists them). ${AGAIN_TAKES_IT}`;
  for (const flags of [[], ['--session', 'lean', '--prompt', 'own', '--keep-home', '--max-parts', '1'], ['--unavailable', 'quota']]) {
    const which = flags.join(' ') || 'no flag';
    const nothing = startsNothing(root);
    const result = await run(['--base', 'HEAD~3', ...flags, ...nothing.home, '--cwd', root], nothing.deps);
    assert.equal(result.code, 0, `${which}: ${result.err}`);
    assert.deepEqual([result.err, result.shown, result.out], ['', '', covered], which);
    nothing.untouched(which);
  }
  // One commit, covered by a review: said of the one, with nothing in brackets.
  const single = makeRepo();
  appendCodexReview(single.root, reviewedRecord(single.base, single.head));
  const nothing = startsNothing(single.root);
  const result = await run(['--base', 'HEAD~1', ...nothing.home, '--cwd', single.root], nothing.deps);
  assert.deepEqual([result.code, result.out], [0, `Nothing to review: ${rangeOf(single.base, single.head)} holds 1 code commit, and a Codex review record already covers it. ${AGAIN_TAKES_IT}`]);
  nothing.untouched('one commit');
});

test('a range that holds commits and no code commit starts nothing and records nothing: the push check asks a record of code commits alone', async () => {
  const { root, base, head } = makeRepoWith({ 'notes.md': 'n1\n', 'f.txt': 'one' }, { 'notes.md': 'N1 changed\n' });
  for (const flags of [[], ['--plan'], ['--unavailable', 'quota']]) {
    const which = flags.join(' ') || 'no flag';
    const nothing = startsNothing(root);
    const result = await run(['--base', 'HEAD~1', ...flags, ...nothing.home, '--cwd', root], nothing.deps);
    assert.equal(result.code, 0, `${which}: ${result.err}`);
    assert.deepEqual([result.err, result.out], ['', `Nothing to review: ${rangeOf(base, head)} holds no code commit, since none of its commits changes a file a review reads. ${NOTHING_DONE}.`], which);
    nothing.untouched(which);
    assert.equal(wrote(root), false, which);
  }
});

test('--again reviews the range as it was given, whatever the records say, and records it as a run always did', async () => {
  const { root, base, one, three } = makeSlicedRepo();
  appendCodexReview(root, reviewedRecord(base, one));
  // Part of it is covered: the whole of it is reviewed all the same, and nothing is said of the records.
  const partly = fakeCodex(reviewed(root, base));
  const first = await run(['--base', 'HEAD~3', '--again', '--cwd', root], partly);
  assert.equal(first.code, 0, first.err);
  assert.deepEqual(first.out.split('\n').slice(0, 2), planned(root, base, three, ALL_THREE).slice(0, 2));
  assert.deepEqual(partly.calls[0].args, leanArgv(base));
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, one), reviewedRecord(base, three)]);
  // Now all of it is covered, and a run without the flag would start nothing.
  const whole = fakeCodex(reviewed(root, base));
  const second = await run(['--base', 'HEAD~3', '--cwd', root, '--again'], whole);
  assert.equal(second.code, 0, second.err);
  assert.equal(whole.calls.length, 1);
  assert.doesNotMatch(second.out, /Nothing to review|already covers/);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, one), reviewedRecord(base, three), reviewedRecord(base, three)]);
  assert.equal(readCodexReviewRuns(root).at(-1).from, base);
});

test('--unavailable follows the records as a review does: the skip is recorded for the range that is left, and --again records it for the range as it was given', async () => {
  const { root, base, one, three } = makeSlicedRepo();
  appendCodexReview(root, reviewedRecord(base, one));
  const narrowed = await run(['--base', 'HEAD~3', '--unavailable', 'quota', '--cwd', root], fakeCodex(''));
  assert.equal(narrowed.code, 0, narrowed.err);
  assert.deepEqual(narrowed.out.split('\n'), [
    startsAt(rangeOf(base, three), 3, 1, one),
    `Recorded an unavailable Codex review (quota) of ${rangeOf(one, three)} in ${codexReviewsPath(root)}.`,
  ]);
  assert.deepEqual(readCodexReviews(root).at(-1), skippedRecord(one, three, 'quota'));
  const asGiven = await run(['--base', 'HEAD~3', '--unavailable', 'quota', '--again', '--cwd', root], fakeCodex(''));
  assert.equal(asGiven.out, `Recorded an unavailable Codex review (quota) of ${rangeOf(base, three)} in ${codexReviewsPath(root)}.`);
  assert.deepEqual(readCodexReviews(root).at(-1), skippedRecord(base, three, 'quota'));
  assert.equal(readCodexReviews(root).length, 3);
});

test('--plan says what a run would: where it starts and the plan of the range that is left, or that the records cover it whole, and --again plans the range as it was given', async () => {
  const { root, base, one, two, three } = makeSlicedRepo();
  appendCodexReview(root, reviewedRecord(base, one));
  const plan = async (flags, which) => {
    const nothing = startsNothing(root);
    const result = await run(['--base', 'HEAD~3', '--plan', ...flags, ...nothing.home, '--cwd', root], nothing.deps);
    assert.deepEqual([result.code, result.err, result.shown], [0, '', ''], which);
    nothing.untouched(which);
    return result.out.split('\n');
  };
  assert.deepEqual(await plan([], 'partly covered'), [startsAt(rangeOf(base, three), 3, 1, one), ...planned(root, one, three, LAST_TWO)]);
  assert.deepEqual(await plan(['--again'], 'partly covered, --again'), planned(root, base, three, ALL_THREE));
  appendCodexReview(root, reviewedRecord(one, two));
  appendCodexReview(root, reviewedRecord(two, three));
  assert.deepEqual(await plan([], 'covered whole'), [`Nothing to review: ${rangeOf(base, three)} holds 3 code commits, and a Codex review record already covers all of them. ${AGAIN_TAKES_IT}`]);
  assert.deepEqual(await plan(['--again'], 'covered whole, --again'), planned(root, base, three, ALL_THREE));
});

test('a run that starts later says how many of the covering records are no review, as a range covered whole does: a skip covers its commits and reviewed none', async () => {
  const { root, base, one, three } = makeSlicedRepo();
  // The first commit was skipped, never reviewed: every later run leaves it out, and has to say what it leaves.
  appendCodexReview(root, skippedRecord(base, one, 'model rejected'));
  const nothing = startsNothing(root);
  const result = await run(['--base', 'HEAD~3', '--plan', ...nothing.home, '--cwd', root], nothing.deps);
  assert.deepEqual([result.code, result.err], [0, '']);
  assert.deepEqual(result.out.split('\n'), [
    startsAt(rangeOf(base, three), 3, 1, one, '1 of the records that do is a skip or a range with nothing to review, not a review'),
    ...planned(root, one, three, LAST_TWO),
  ]);
  nothing.untouched('a plan past a skip');
});

test('the row of the plain check and the plan of the command size the same review: the same history, the same start, the same count', async () => {
  /** A branch off `origin/main` whose first code commit a record covers and whose other two none does. */
  const sliced = () => {
    const { root, base, one } = makeSlicedRepo();
    git(root, 'remote', 'add', 'origin', 'https://example.invalid/js-harness-test.git');
    git(root, 'update-ref', 'refs/remotes/origin/main', base);
    appendCodexReview(root, reviewedRecord(base, one));
    return root;
  };
  /** A default branch that moved on, and a branch that merged in work which forked before it moved. */
  const merged = () => {
    const { root, base: first, head: moved } = makeRepoWith({ 'a.txt': 'a1\n', 'b.txt': 'b1\n', 's.txt': 's1\n' }, { 'a.txt': 'A1 changed\n' });
    git(root, 'remote', 'add', 'origin', 'https://example.invalid/js-harness-test.git');
    git(root, 'update-ref', 'refs/remotes/origin/main', moved);
    git(root, 'checkout', '--quiet', '-b', 'feature');
    fs.writeFileSync(path.join(root, 'b.txt'), 'B1 changed\n', 'utf8');
    git(root, 'commit', '-am', 'mine');
    appendCodexReview(root, reviewedRecord(moved, git(root, 'rev-parse', 'HEAD')));
    git(root, 'checkout', '--quiet', '-b', 'side', first);
    fs.writeFileSync(path.join(root, 's.txt'), 'S1 changed\n', 'utf8');
    git(root, 'commit', '-am', 'side work');
    git(root, 'checkout', '--quiet', 'feature');
    git(root, 'merge', '--no-ff', '-m', 'merge side', 'side');
    return root;
  };
  for (const [which, make, rowBase] of [['a record covers the first commit', sliced, /^[0-9a-f]+\^$/], ['a merged branch that forked earlier', merged, /^origin\/main$/]]) {
    const root = make();
    const row = checkCodexReviewDebt(root);
    const said = /: the review of (\S+)\.\.HEAD is (\d+ parts?) today, (\d+ changed lines? in \d+ files?)$/.exec(row.detail);
    assert.ok(said, `${which}: ${row.detail}`);
    const [, base, parts, size] = said;
    assert.match(base, rowBase, which);
    // From the default branch, and from the base the row names: the command starts the same review.
    for (const asked of ['origin/main', base]) {
      const nothing = startsNothing(root);
      const plan = await run(['--base', asked, '--plan', ...nothing.home, '--cwd', root], nothing.deps);
      assert.equal(plan.code, 0, `${which}, --base ${asked}: ${plan.err}`);
      const header = plan.out.split('\n').find((line) => line.startsWith('Plan of the Codex review of '));
      assert.ok(header.endsWith(`: gpt-6.1-sol at high effort, ${parts}, ${size}.`), `${which}, --base ${asked}: the row says ${parts}, ${size}; the plan: ${header}`);
      assert.deepEqual(row.lines, [`what it would cost, with nothing spent: js-harness codex-review --base ${base} --plan`], which);
    }
  }
});

// --- what the comparison of the configurations varies: by injection alone, never by a flag ---

const CODEGRAPH_CONFIG = ['mcp_servers.codegraph.command="codegraph"', 'mcp_servers.codegraph.args=["serve", "--mcp"]'];
const asFlags = (settings) => settings.flatMap((setting) => ['-c', setting]);
const atEffort = (argv, effort) => argv.map((token) => (token === 'model_reasoning_effort="high"' ? `model_reasoning_effort="${effort}"` : token));

test('codexArgs: the effort and the extra configuration are options, and without them the argv is unchanged', () => {
  const base = 'a'.repeat(40);
  assert.deepEqual(codexArgs(base, 'linux', 'codex', {}), leanArgv(base));
  // The effort is the one the command passes: the same token, in its place.
  assert.deepEqual(codexArgs(base, 'linux', 'codex', { effort: 'medium' }), atEffort(leanArgv(base), 'medium'));
  assert.equal(atEffort(leanArgv(base), 'medium').includes('model_reasoning_effort="medium"'), true, 'the fixture does change the token');
  // The extra settings come after the session's own and before what is reviewed, where every `-c` is.
  assert.deepEqual(codexArgs(base, 'linux', 'codex', { extraConfig: CODEGRAPH_CONFIG }), [...leanArgv(base).slice(0, -2), ...asFlags(CODEGRAPH_CONFIG), '--base', base]);
  assert.deepEqual(codexArgs(base, 'linux', 'own', { extraConfig: CODEGRAPH_CONFIG }), [...ownArgv().slice(0, -1), ...asFlags(CODEGRAPH_CONFIG), '-']);
  // The session is never ephemeral, whatever is asked: the option that said so went with the session it was for.
  assert.deepEqual(codexArgs(base, 'linux', 'codex', { ephemeral: true }), leanArgv(base));
  // An effort is one word, and a setting is `key=value`: either goes into a TOML value or a command line.
  for (const effort of ['hi"gh', '', 'High', 7]) assert.throws(() => codexArgs(base, 'linux', 'codex', { effort }), /effort/, JSON.stringify(effort));
  for (const extraConfig of [['novalue'], ['=x'], [7], 'a=b']) assert.throws(() => codexArgs(base, 'linux', 'codex', { extraConfig }), /key=value/, JSON.stringify(extraConfig));
});

test('an injected effort is the effort the command passes: in the argv, in the run line and in the line that announces the review', async () => {
  const { root, base, head } = makeRepo();
  const range = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, effort: 'medium' });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(fake.calls[0].args, atEffort(leanArgv(base), 'medium'));
  assert.deepEqual([onlyRun(root).model, onlyRun(root).effort], ['gpt-6.1-sol', 'medium']);
  assert.equal(afterPlan(result.out)[0], `Codex is reviewing ${range} with the lean session (gpt-6.1-sol, medium); this can take several minutes.`);
});

test('an injected effort is what the session is held to: a review that ran at it stands, and one that ran at the command\'s own does not', async () => {
  const mine = fakeHome();
  // The comparison asks a lean session for `medium`, and the session's own file says it ran at `medium`.
  const kept = makeRepo();
  const stands = await leanReviewThatRan(kept.root, kept.base, turnContext('gpt-6.1-sol', 'medium'), mine, { effort: 'medium' });
  assert.deepEqual([stands.code, stands.err], [0, '']);
  assert.deepEqual([onlyRun(kept.root).outcome, onlyRun(kept.root).effort, ...sessionRan(onlyRun(kept.root))], ['reviewed', 'medium', 'gpt-6.1-sol', 'medium']);
  // Asked for `medium` and ran at `high`, the effort of a review nobody varies: not what was asked, so it falls.
  const other = makeRepo();
  const falls = await leanReviewThatRan(other.root, other.base, turnContext('gpt-6.1-sol', 'high'), mine, { effort: 'medium' });
  assert.equal(falls.code, 1);
  assert.equal(falls.err, `Codex's turn completed, but its session ran on gpt-6.1-sol at high effort, and the command passed gpt-6.1-sol at medium effort${RAN_ON_ANOTHER}`);
  assert.equal(wrote(other.root), false);
});

test('injected extra configuration is added to the argv, before what is reviewed', async () => {
  const { root, base } = makeRepo();
  const lean = fakeCodex(reviewed(root, base));
  assert.equal((await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...lean, extraCodexConfig: CODEGRAPH_CONFIG })).code, 0);
  assert.deepEqual(lean.calls[0].args, [...leanArgv(base).slice(0, -2), ...asFlags(CODEGRAPH_CONFIG), '--base', base]);
  // On Windows the settings go through the shell with the rest of the line, quoted.
  const windows = fakeCodex(reviewed(root, base));
  assert.equal((await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...windows, extraCodexConfig: CODEGRAPH_CONFIG, platform: 'win32' })).code, 0);
  assert.equal(windows.calls[0].command, windowsCommandLine('codex', [...leanArgv(base, 'win32').slice(0, -2), ...asFlags(CODEGRAPH_CONFIG), '--base', base]));
});

test('no flag reaches what is injected: the usage names none of the seams, and a flag named after one changes nothing', async () => {
  const { root, base } = makeRepo();
  const usage = await run(['--cwd', root], fakeCodex(''));
  assert.equal(usage.code, 2);
  // The whole usage: the flags, then the line that says what a review loads and what it runs on, then the
  // one that says how its cost is seen first, then the one that says what it leaves out.
  assert.deepEqual(usage.err.split('\n').slice(2), [
    'Usage: js-harness codex-review --base <rev> [--plan] [--again] [--prompt <codex|own>] [--doc <feature document>] [--part-lines <n>] [--max-parts <n>] [--keep-home] ' +
      '[--unavailable <reason>] [--cwd <path>] [--home <path>]',
    'Codex gets the diff, the repository to read and the project\'s AGENTS.md, and none of your Codex configuration; ' +
      'the review runs on gpt-6.1-sol at high effort, which the command fixes.',
    '--plan prints what the run would start and what it is estimated to send, and starts nothing; a run of more than 6 parts is not started without --max-parts <n>.',
    'A review reads code: Markdown files and the paths a .gitattributes marks `-codex-review` are left out of it, and the plan says how many.',
    STARTS_WHERE_RECORDS_END,
  ]);
  const seams = ['--effort', 'low', '--extra-codex-config', 'a=b', '--codex-config', 'a=b', '--measured-current', '--measured', '--on-result', 'x', '--every-file'];
  for (const flags of [[], ['--session', 'lean']]) {
    const lean = fakeCodex(reviewed(root, base));
    assert.equal((await run(['--base', 'HEAD~1', '--again', ...flags, ...seams, '--cwd', root], lean)).code, 0, flags.join(' '));
    assert.deepEqual(lean.calls[0].args, leanArgv(base), flags.join(' '));
    assert.equal(readCodexReviewRuns(root).at(-1).effort, 'high', flags.join(' '));
  }
  // The seam that ran the removed session in a seeded copy of the Codex home is gone with it: a caller that
  // still hands it over gets the one session there is, in a home that holds the login and nothing else.
  const mine = fakeHome();
  const seen = {};
  const never = () => {
    throw new Error('no home is seeded any more');
  };
  const handed = watching(fakeCodex(reviewed(root, base)), (home) => Object.assign(seen, { home, entries: listed(home) }));
  assert.equal((await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...handed, homedir: mine.homedir, measuredCurrent: { seed: never } })).code, 0);
  assert.deepEqual([seen.home, seen.entries], [path.join(mine.homes, RUN_ID), ['auth.json']]);
  assert.deepEqual(handed.calls[0].args, leanArgv(base));
  assert.equal(readCodexReviewRuns(root).at(-1).session, 'lean');
});

test('nothing on the command line selects another model or effort: the usage names no flag for either, and one spelled as Codex spells it is not passed on', async () => {
  const { root, base } = makeRepo();
  const usage = await run(['--cwd', root], fakeCodex(''));
  assert.doesNotMatch(usage.err.split('\n').find((line) => line.startsWith('Usage: ')), /model|effort|-m\b|-c\b/);
  // Every way a person might try, as this command's flags are spelled and as Codex's are.
  const tries = [
    ['--model', 'gpt-6-astra'], ['-m', 'gpt-6-astra'], ['--effort', 'low'], ['--reasoning-effort', 'low'],
    ['-c', 'model="gpt-6-astra"'], ['-c', 'model_reasoning_effort="low"'], ['--config', 'model_reasoning_effort="low"'],
    ['--model=gpt-6-astra'], ['--effort=low'],
  ];
  for (const session of [[], ['--session', 'lean']]) {
    for (const flags of [...tries, tries.flat()]) {
      const fake = fakeCodex(reviewed(root, base));
      const result = await run(['--base', 'HEAD~1', '--again', ...session, ...flags, '--cwd', root], fake);
      const which = [...session, ...flags].join(' ');
      assert.equal(result.code, 0, `${which}: ${result.err}`);
      assert.deepEqual(fake.calls[0].args, leanArgv(base), which);
      assert.deepEqual(modelAndEffort(fake.calls[0].args), { models: ['gpt-6.1-sol'], efforts: ['model_reasoning_effort="high"'] }, which);
      assert.equal(fake.calls[0].args.some((token) => /astra|low/.test(token)), false, which);
      const logged = readCodexReviewRuns(root).at(-1);
      assert.deepEqual([logged.model, logged.effort], ['gpt-6.1-sol', 'high'], which);
    }
  }
});

test('onResult is handed every attempt that launched Codex: its run line, whether it was logged, and the answer as data', async () => {
  const { root, base } = makeRepo();
  const results = [];
  const onResult = (result) => results.push(result);
  // A lean review that stands, with findings: the whole of each finding, body included, which no line printed holds.
  const lean = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base), {}, PROBE_OK, answerWith(root)), onResult, platform: process.platform });
  assert.equal(lean.code, 0, lean.err);
  assert.equal(results.length, 1);
  assert.deepEqual(Object.keys(results[0]), ['run', 'logged', 'review']);
  assert.deepEqual(results[0].run, onlyRun(root));
  assert.equal(results[0].logged, true);
  assert.deepEqual(results[0].review.findings.map(({ file, start, end, severity }) => [file, start, end, severity]), [['f.txt', 1, 1, 'P1'], ['lib/deep.mjs', 3, 9, 'P3'], ['f.txt', 2, 4, null]]);
  assert.equal(results[0].review.findings[0].body, 'The loop stops one short, so the last line is never written.');
  assert.deepEqual([results[0].review.verdict, results[0].review.confidence], ['incorrect', 0.7]);
  // An attempt that failed is handed over too, and so is one whose answer could not be read: `null`, and no review of nothing.
  await run(['--base', 'HEAD~1', '--again', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base), { status: 7 }), onResult });
  await run(['--base', 'HEAD~1', '--again', '--cwd', root], { ...fakeCodex(reviewed(root, base), {}, PROBE_OK, false), onResult });
  assert.deepEqual(results.map(({ run: line, review }) => [line.session, line.outcome, review === null ? null : review.findings.length]), [['lean', 'reviewed', 3], ['lean', 'failed', 0], ['lean', 'failed', null]]);
  assert.deepEqual(results.map(({ run: line }) => line), readCodexReviewRuns(root));
  // What launched nothing has no result: a skip, and a tree with uncommitted changes.
  await run(['--base', 'HEAD~1', '--unavailable', 'quota', '--cwd', root], { ...fakeCodex(''), onResult });
  assert.equal(results.length, 3);
});

test('onResult: a run line that could not be logged is still handed over, and a callback that throws changes nothing of how the review ends', async () => {
  const { root, base } = makeRepo();
  blockRunLog(root);
  const results = [];
  const unlogged = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base)), onResult: (result) => results.push(result) });
  assert.equal(unlogged.code, 0, unlogged.err);
  assert.deepEqual([results[0].logged, results[0].run.outcome, results[0].run.id], [false, 'reviewed', RUN_ID]);
  const other = makeRepo();
  const thrown = await run(['--base', 'HEAD~1', '--cwd', other.root], {
    ...fakeCodex(reviewed(other.root, other.base)),
    onResult: () => {
      throw new Error('the caller broke');
    },
  });
  assert.equal(thrown.code, 0, thrown.err);
  assert.match(thrown.err, /the caller broke/);
  assert.deepEqual(readCodexReviews(other.root), [reviewedRecord(other.base, other.head)]);
});

test('onResult is handed each part of a range reviewed in parts, in order', async () => {
  const { root, base, head } = makeThreeFileRepo();
  const results = [];
  const fake = fakeCodexInParts({ stdout: partShown(root, base, head, 'a.txt', 'b.txt') }, { stdout: partShown(root, base, head, 'c.txt') });
  const result = await run(['--base', 'HEAD~1', ...TWO_PARTS, '--cwd', root], { ...fake, randomUUID: runIds(), onResult: (one) => results.push(one) });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(results.map(({ run: line }) => [line.id, line.part.index, line.part.of]), [[idOf(1), 1, 2], [idOf(2), 2, 2]]);
  assert.deepEqual(results.map(({ run: line }) => line), readCodexReviewRuns(root));
});

// --- the evidence rule ---

/** A minimal diff of `file` whose hunk holds `lines` (each `+...`, `-...` or ` ...`). */
const diffOf = (file, ...lines) => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n${lines.join('\n')}\n`;
const key = (file, line) => `${file}\n${line}`;

test('patchKeys keys the +/- lines of the hunks by file, without the file headers', () => {
  const patch = [
    'diff --git a/x b/x',
    'index 1..2 100644',
    '--- a/x',
    '+++ b/x',
    '@@ -1,3 +1,3 @@',
    ' context',
    '-old',
    '+new',
    '+++ added line that looks like a header',
    '\\ No newline at end of file',
    'diff --git a/y b/y',
    '--- a/y',
    '+++ b/y',
    '@@ -1 +1 @@',
    '-y1',
    '+y2',
  ].join('\n');
  assert.deepEqual(patchKeys(patch), [
    key('x', '-old'), key('x', '+new'), key('x', '+++ added line that looks like a header'), key('y', '-y1'), key('y', '+y2'),
  ]);
});

test('patchKeys normalizes to printable ASCII, drops blank changes and duplicates within a file', () => {
  const patch = diffOf('x', '-it’s  ', '+it’s\r', '+…', '+', '-', '+   ', '+dup', '+dup', '+tab\there');
  // `+   ` keeps its meaning once trimmed to `+`, which carries no evidence.
  assert.deepEqual(patchKeys(patch), [key('x', '-its'), key('x', '+its'), key('x', '+dup'), key('x', '+tabhere')]);
  assert.deepEqual(patchKeys(''), []);
  assert.deepEqual(patchKeys(undefined), []);
});

test('patchKeys keeps the same change in two files apart', () => {
  const patch = diffOf('a.js', '-if (authorized)', '+if (true)') + diffOf('b.js', '-if (authorized)', '+if (true)');
  assert.deepEqual(patchKeys(patch), [
    key('a.js', '-if (authorized)'), key('a.js', '+if (true)'), key('b.js', '-if (authorized)'), key('b.js', '+if (true)'),
  ]);
});

test('patchKeys reads the file from `diff --git`: prefixes, no prefixes, renames and spaces', () => {
  const file = (header) => patchKeys(`${header}\n@@ -1 +1 @@\n+x\n`)[0];
  assert.equal(file('diff --git a/src/f.js b/src/f.js'), key('src/f.js', '+x'));
  assert.equal(file('diff --git src/f.js src/f.js'), key('src/f.js', '+x'), '--no-prefix');
  assert.equal(file('diff --git a/my dir/my file.js b/my dir/my file.js'), key('my dir/my file.js', '+x'));
  assert.equal(file('diff --git my dir/f.js my dir/f.js'), key('my dir/f.js', '+x'));
  assert.equal(file('diff --git a/old.js b/new.js'), key('new.js', '+x'), 'a rename keys the new path');
  assert.equal(file('diff --git old.js new.js'), key('new.js', '+x'));
  assert.equal(file('diff --git a/café.js b/café.js'), key('caf.js', '+x'), 'the path is normalized like a line');
  assert.equal(file('diff --git a/f.js b/f.js\r'), key('f.js', '+x'));
});

test('patchKeys strips ANSI colors before reading', () => {
  const colored = [
    '\x1b[1mdiff --git a/f b/f\x1b[m',
    '\x1b[1mindex 1..2 100644\x1b[m',
    '\x1b[1m--- a/f\x1b[m',
    '\x1b[1m+++ b/f\x1b[m',
    '\x1b[36m@@ -1 +1 @@\x1b[m',
    '\x1b[31m-one\x1b[m',
    '\x1b[32m+two\x1b[m',
    '\x1b[32m+\x1b[41mtrailing \x1b[m',
    '\x1b[?25h\x1b[32m+a\x1bb\x1b[m',
  ].join('\n');
  // A complete sequence goes, and so does a stray ESC.
  assert.deepEqual(patchKeys(colored), [key('f', '-one'), key('f', '+two'), key('f', '+trailing'), key('f', '+ab')]);
});

test('patchKeys reads nothing outside a `diff --git` and a hunk', () => {
  assert.deepEqual(patchKeys('-one\n+two\n'), [], 'bare +/- lines');
  assert.deepEqual(patchKeys('@@ -1 +1 @@\n-one\n+two\n'), [], 'a hunk with no file');
  assert.deepEqual(patchKeys('diff --git a/f b/f\n-one\n+two\n'), [], 'a file with no hunk');
  assert.deepEqual(patchKeys('diff --git a/f b/f\n@@ -1 +1 @@\n+a\ndiff --git a/g b/g\n+b\n'), [key('f', '+a')], 'the hunk ends at the next file');
});

test('reviewEvidence: inspected needs a completed turn, a final message and every changed line in a successful output', () => {
  const expected = [key('f', '-one'), key('f', '+two')];
  const events = [thread, turn, cmd('git diff', 0, diffOf('f', '-one', '+two')), msg(FINDINGS), done];
  const evidence = reviewEvidence(events, expected);
  assert.equal(evidence.inspected, true);
  assert.equal(evidence.completed, true);
  assert.equal(evidence.review, FINDINGS);
  assert.deepEqual(evidence.commands, [{ command: 'git diff', exitCode: 0 }]);
  assert.deepEqual(evidence.coverage, { seen: 2, total: 2 });
  assert.deepEqual(evidence.missing, []);
  assert.deepEqual(evidence.errors, []);
});

test('reviewEvidence: each missing piece of evidence alone means not inspected', () => {
  const expected = [key('f', '+two')];
  const out = diffOf('f', '+two');
  const shown = cmd('git diff', 0, out);
  const cases = {
    'no turn.completed': [thread, turn, shown, msg('ok')],
    'a failed turn': [thread, turn, shown, msg('ok'), done, { type: 'turn.failed', error: { message: 'x' } }],
    'no message': [thread, turn, shown, done],
    'an empty message': [thread, turn, shown, msg('  \n'), done],
    'a failed command': [thread, turn, cmd('git diff', 128, out), msg('ok'), done],
    'no output': [thread, turn, cmd('git diff', 0, ''), msg('ok'), done],
    'a command that only started': [thread, turn, { type: 'item.started', item: { type: 'command_execution', command: 'git diff', aggregated_output: out, exit_code: null, status: 'in_progress' } }, msg('ok'), done],
  };
  for (const [name, events] of Object.entries(cases)) assert.equal(reviewEvidence(events, expected).inspected, false, name);
  assert.equal(reviewEvidence([thread, turn, shown, msg('ok'), done], expected).inspected, true);
  // Without the expected lines it cannot tell what was read.
  assert.equal(reviewEvidence([thread, turn, shown, msg('ok'), done]).inspected, false);
});

test('reviewEvidence: coverage counts the lines seen, and names up to five as `file: line`', () => {
  const expected = ['+a', '+b', '+c', '+d', '+e', '+f', '+g'].map((line) => key('f.js', line));
  const evidence = reviewEvidence([thread, turn, cmd('x', 0, diffOf('f.js', '+a', '+b')), msg('ok'), done], expected);
  assert.equal(evidence.inspected, false);
  assert.deepEqual(evidence.coverage, { seen: 2, total: 7 });
  assert.deepEqual(evidence.missing, ['f.js: +c', 'f.js: +d', 'f.js: +e', 'f.js: +f', 'f.js: +g']);
});

test('reviewEvidence: the files with a changed line that was not seen, in the order of the diff, each with how many it missed of how many', () => {
  const expected = [key('a.js', '+a1'), key('b.js', '+b1'), key('b.js', '-b2'), key('b.js', '+b3'), key('dir/c d.js', '+c1'), key('a.js', '-a2')];
  const shown = diffOf('a.js', '+a1', '-a2') + diffOf('b.js', '-b2');
  const evidence = reviewEvidence([thread, turn, cmd('x', 0, shown), msg('ok'), done], expected);
  assert.equal(evidence.inspected, false);
  assert.deepEqual(evidence.missingFiles, [{ file: 'b.js', missing: 2, total: 3 }, { file: 'dir/c d.js', missing: 1, total: 1 }]);
  // Every file, not the first few: it is the message that bounds what it names.
  const many = Array.from({ length: 30 }, (_, index) => key(`f${index}.js`, '+x'));
  assert.equal(reviewEvidence([thread, turn, cmd('x', 0, ''), msg('ok'), done], many).missingFiles.length, 30);
  // Nothing missing, nothing expected, or no expectation at all: no file is named.
  assert.deepEqual(reviewEvidence([thread, turn, cmd('x', 0, shown + diffOf('b.js', '+b1', '+b3') + diffOf('dir/c d.js', '+c1')), msg('ok'), done], expected).missingFiles, []);
  assert.deepEqual(reviewEvidence([thread, turn, cmd('x', 0, ''), msg('ok'), done], []).missingFiles, []);
  assert.deepEqual(reviewEvidence([thread, turn, msg('ok'), done]).missingFiles, []);
});

test('reviewEvidence: an output line is compared normalized, and only whole lines match', () => {
  const expected = [key('f', '+its')];
  const seen = (...lines) => reviewEvidence([done, cmd('x', 0, diffOf('f', ...lines)), msg('ok')], expected).inspected;
  assert.equal(seen('+itâ€™s\r'), true);
  assert.equal(seen('+its   '), true);
  assert.equal(seen('+itself'), false, 'a longer line is not the line');
  assert.equal(seen(' +its'), false, 'a fragment is not the line');
  assert.equal(seen('its'), false);
});

test('reviewEvidence: the same change in two files is covered only by a diff of both', () => {
  const both = diffOf('a.js', '-if (authorized)', '+if (true)') + diffOf('b.js', '-if (authorized)', '+if (true)');
  const expected = patchKeys(both);
  assert.equal(expected.length, 4);
  const one = reviewEvidence([thread, turn, cmd('git diff a.js', 0, diffOf('a.js', '-if (authorized)', '+if (true)')), msg('ok'), done], expected);
  assert.equal(one.inspected, false);
  assert.deepEqual(one.coverage, { seen: 2, total: 4 });
  assert.deepEqual(one.missing, ['b.js: -if (authorized)', 'b.js: +if (true)']);
  const pooled = reviewEvidence([
    thread, turn,
    cmd('git diff a.js', 0, diffOf('a.js', '-if (authorized)', '+if (true)')),
    cmd('git diff b.js', 0, diffOf('b.js', '-if (authorized)', '+if (true)')),
    msg('ok'), done,
  ], expected);
  assert.equal(pooled.inspected, true);
  assert.equal(reviewEvidence([thread, turn, cmd('git diff', 0, both), msg('ok'), done], expected).inspected, true);
});

test('reviewEvidence: colored output of the whole diff is inspected', () => {
  const colored = [
    '\x1b[1mdiff --git a/f b/f\x1b[m',
    '\x1b[1m--- a/f\x1b[m',
    '\x1b[1m+++ b/f\x1b[m',
    '\x1b[36m@@ -1 +1 @@\x1b[m',
    '\x1b[31m-one\x1b[m',
    '\x1b[32m+two\x1b[m',
  ].join('\n');
  const evidence = reviewEvidence([thread, turn, cmd('git diff --color=always', 0, colored), msg('ok'), done], [key('f', '-one'), key('f', '+two')]);
  assert.equal(evidence.inspected, true);
  assert.deepEqual(evidence.coverage, { seen: 2, total: 2 });
});

test('reviewEvidence: the right +/- lines with no `diff --git` and hunk around them are not a diff', () => {
  const expected = [key('f', '-one'), key('f', '+two')];
  for (const output of ['-one\n+two\n', '@@ -1 +1 @@\n-one\n+two\n', 'diff --git a/f b/f\n-one\n+two\n', 'Get-Content f\n-one\n+two\n']) {
    assert.equal(reviewEvidence([thread, turn, cmd('x', 0, output), msg('ok'), done], expected).inspected, false, output);
  }
});

test('reviewEvidence: a --no-prefix diff, and a path with spaces, are inspected', () => {
  for (const header of ['diff --git f.js f.js', 'diff --git my dir/f.js my dir/f.js', 'diff --git a/my dir/f.js b/my dir/f.js']) {
    const file = header.includes('my dir') ? 'my dir/f.js' : 'f.js';
    const output = `${header}\n@@ -1 +1 @@\n-one\n+two\n`;
    const evidence = reviewEvidence([thread, turn, cmd('git diff', 0, output), msg('ok'), done], [key(file, '-one'), key(file, '+two')]);
    assert.equal(evidence.inspected, true, header);
  }
});

test('reviewEvidence: with nothing to match, one successful command and a message are the evidence', () => {
  const inspected = (...events) => reviewEvidence([done, ...events], []).inspected;
  assert.equal(inspected(cmd('git status'), msg('ok')), true);
  assert.equal(inspected(msg('ok')), false);
  assert.equal(inspected(cmd('git status', 1), msg('ok')), false);
  assert.equal(inspected(cmd('git status'), msg('')), false);
});

test('reviewEvidence: the last message is the review', () => {
  const evidence = reviewEvidence([thread, turn, msg('first'), cmd('git diff', 0, diffOf('f', '+two')), msg('final'), done], [key('f', '+two')]);
  assert.equal(evidence.inspected, true);
  assert.equal(evidence.review, 'final');
});

test('reviewEvidence: error messages come from the failed turn, warnings from error items', () => {
  const evidence = reviewEvidence([
    itemError('unrecognized setting'),
    { type: 'turn.failed', error: { message: 'model rejected' } },
    { type: 'error', message: 'stream closed' },
  ], []);
  assert.deepEqual(evidence.errors, ['model rejected', 'stream closed']);
  assert.deepEqual(evidence.warnings, ['unrecognized setting']);
  assert.equal(evidence.completed, false);
});

test('parseEvents keeps the JSON objects and drops everything else', () => {
  const events = parseEvents('banner\n\n{"type":"turn.started"}\r\n[1]\n"str"\nnull\n{"type":\n{"type":"turn.completed"}');
  assert.deepEqual(events, [{ type: 'turn.started' }, { type: 'turn.completed' }]);
  assert.deepEqual(parseEvents(''), []);
  assert.deepEqual(parseEvents(undefined), []);
});

// --- the Windows launch: PATH and quoting ---

test('childEnv drops every WindowsApps entry on Windows, whatever the case, slash and trailing slash', () => {
  const dirs = [
    'C:\\Windows\\system32',
    'C:\\Users\\Oficina\\AppData\\Local\\Microsoft\\WindowsApps',
    'c:\\users\\oficina\\appdata\\local\\microsoft\\windowsapps\\',
    'C:/Users/x/AppData/Local/Microsoft/WindowsApps/',
    'C:\\Program Files\\WindowsApps\\Foo',
    'D:\\bin',
  ];
  const env = { Path: dirs.join(';'), Other: 'kept' };
  assert.deepEqual(childEnv(env, 'win32'), { Path: 'C:\\Windows\\system32;C:\\Program Files\\WindowsApps\\Foo;D:\\bin', Other: 'kept' });
  assert.equal(env.Path, dirs.join(';'), 'the input is not mutated');
  assert.deepEqual(childEnv({ PATH: 'D:\\Microsoft\\WindowsApps' }, 'win32'), { PATH: '' });
});

test('childEnv leaves other platforms and a missing PATH alone', () => {
  const env = { PATH: '/a/Microsoft/WindowsApps:/b' };
  assert.equal(childEnv(env, 'linux'), env);
  assert.deepEqual(childEnv({ Other: '1' }, 'win32'), { Other: '1' });
});

test('quoteWindowsArg leaves plain words alone and quotes the rest for the C runtime', () => {
  assert.equal(quoteWindowsArg('exec'), 'exec');
  assert.equal(quoteWindowsArg('sandbox_mode=read-only'), 'sandbox_mode=read-only');
  assert.equal(quoteWindowsArg('D:\\my repo'), '"D:\\my repo"');
  assert.equal(quoteWindowsArg(''), '""');
  assert.equal(quoteWindowsArg('plugins."a@b".enabled=false'), '"plugins.\\"a@b\\".enabled=false"');
  // Backslashes before a quote are doubled, and so are trailing ones inside quotes.
  assert.equal(quoteWindowsArg('a\\"b'), '"a\\\\\\"b"');
  assert.equal(quoteWindowsArg('a b\\'), '"a b\\\\"');
});

test('quoteWindowsArg refuses what cmd.exe would act on', () => {
  for (const arg of ['a&b', 'a|b', 'a<b', 'a>b', 'a^b', '%PATH%', 'a\nb']) {
    assert.throws(() => quoteWindowsArg(arg), /cmd\.exe/, JSON.stringify(arg));
  }
});

test('windowsCommandLine joins the command and its quoted arguments', () => {
  assert.equal(windowsCommandLine('codex', ['exec', '--base', 'a b']), 'codex exec --base "a b"');
});
