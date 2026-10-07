import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import {
  childEnv, codexArgs, codexReviewMain, LEAN_EFFORT, LEAN_MODEL, parseEvents, patchKeys, quoteWindowsArg, reviewEvidence, windowsCommandLine,
} from './codex-review.mjs';
import { createLeanHome, leanHomesDir } from './lib/codex-review-home.mjs';
import { REVIEW_PROMPT_VERSION, reviewPrompt } from './lib/codex-review-prompt.mjs';
import { codexReviewRunsPath, readCodexReviewRuns, runFindings, runPrompt } from './lib/codex-review-runs.mjs';
import { codexReviewsPath, readCodexReviews } from './lib/codex-reviews.mjs';

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

/** The deps for a run: real git and a fake `codex --version` probe through `spawn`, a fake async
 * review through `spawnAsync`, and a `killTree` that only records. `calls`, `probes` and `killed`
 * log what happened; each call holds its `child`, for what it was sent on stdin.
 *
 * As a real Codex does, the fake leaves the rollout file of the review's sub-agent in its home when the
 * session is not ephemeral and has a home of its own, which is the lean session: `said` is the answer in
 * it (see `reviewSession`), a review that found nothing unless a test says otherwise, and `false` writes
 * no such file at all. */
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
    const ephemeral = `${command} ${args.join(' ')}`.includes('--ephemeral');
    // A Codex that never started wrote nothing.
    if (said !== false && !answer.error && !ephemeral && typeof home === 'string' && fs.existsSync(home)) {
      fs.mkdirSync(path.join(home, ...ANSWER_FILE.slice(0, -1)), { recursive: true });
      fs.writeFileSync(path.join(home, ...ANSWER_FILE), jsonl(...reviewSession(said)), 'utf8');
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

test('Codex is spawned as `codex exec review` with the resolved base, a read-only sandbox and the desktop plugins off', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 0);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].command, 'codex');
  // The resolved id, not the raw `HEAD~1`: the record and the review cover the same range.
  assert.deepEqual(fake.calls[0].args, [
    'exec', 'review', '--json', '--ephemeral', '--base', base,
    '-c', 'sandbox_mode=read-only',
    '-c', 'approval_policy=never',
    '-c', 'plugins."unified-computer-use@openai-bundled".enabled=false',
    '-c', 'plugins."computer-use@openai-bundled".enabled=false',
  ]);
  assert.deepEqual(fake.calls[0].args, codexArgs(base));
  const { opts } = fake.calls[0];
  assert.equal(fs.realpathSync(opts.cwd), fs.realpathSync(root));
  assert.deepEqual(opts.stdio, ['ignore', 'pipe', 'inherit'], 'Codex would wait on an open stdin');
  assert.equal(opts.detached, true, 'its own process group, so the whole tree can be killed');
  assert.ok(!opts.shell, 'no shell off Windows');
});

test('Codex runs from the repository root even when --cwd is a subdirectory', async () => {
  const { root, base } = makeRepo();
  fs.mkdirSync(path.join(root, 'sub'));
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', '--cwd', path.join(root, 'sub')], fake);
  assert.equal(result.code, 0);
  assert.equal(fs.realpathSync(fake.calls[0].opts.cwd), fs.realpathSync(root));
});

test('on Windows the .cmd shim runs through a shell as one quoted command line, not detached', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, platform: 'win32' });
  assert.equal(result.code, 0);
  const { command, args, opts } = fake.calls[0];
  assert.equal(opts.shell, true);
  assert.ok(!opts.detached);
  assert.deepEqual(args, []);
  assert.equal(command, windowsCommandLine('codex', codexArgs(base)));
  assert.ok(command.startsWith(`codex exec review --json --ephemeral --base ${base} `), command);
  assert.ok(command.includes('"plugins.\\"unified-computer-use@openai-bundled\\".enabled=false"'), command);
});

test('on Windows the child PATH drops the WindowsApps entries and keeps the rest of the environment', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const env = { Path: 'C:\\Windows;C:\\Users\\x\\AppData\\Local\\Microsoft\\WindowsApps\\;D:\\bin', SystemRoot: 'C:\\Windows' };
  await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, platform: 'win32' }, env);
  assert.deepEqual(fake.calls[0].opts.env, { Path: 'C:\\Windows;D:\\bin', SystemRoot: 'C:\\Windows' });
  assert.equal(env.Path.includes('WindowsApps'), true, 'the caller\'s environment is not mutated');
});

test('off Windows the environment is passed through untouched', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const env = { PATH: '/usr/bin:/x/Microsoft/WindowsApps' };
  await run(['--base', 'HEAD~1', '--cwd', root], fake, env);
  assert.deepEqual(fake.calls[0].opts.env, env);
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
    const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewedWith(...commands)));
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
  await run(['--base', 'HEAD~1', '--cwd', root], { ...win, platform: 'win32' }, env);
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
  assert.equal((await run(['--base', 'HEAD~1', '--unavailable', 'later', '--cwd', root], fake)).code, 0);
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

test('--home is accepted under the current session, which keeps nothing there', async () => {
  const { root, base } = makeRepo();
  const home = tmp('js-harness-codex-review-home-');
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home], fakeCodex(reviewed(root, base)));
  assert.equal(result.code, 0);
  assert.deepEqual(listed(home), []);
});

// --- the session: today's configuration, or the lean one beside it ---

/** The lean argv, token by token: what `--session lean` hands Codex for a review from `base`. It is not
 * `--ephemeral`, and on Windows alone it names the sandbox its commands run in. */
const leanArgv = (base, platform = 'linux') => [
  'exec', 'review', '--json',
  '--ignore-user-config', '--ignore-rules',
  '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
  '-m', 'gpt-6.1-sol',
  '-c', 'model_reasoning_effort="medium"',
  '-c', 'sandbox_mode=read-only',
  '-c', 'approval_policy=never',
  ...(platform === 'win32' ? ['-c', 'windows.sandbox="unelevated"'] : []),
  '-c', 'skills.include_instructions=false',
  '--base', base,
];

/** Today's argv, token by token: the default, which `--session` must not change. */
const currentArgv = (base) => [
  'exec', 'review', '--json', '--ephemeral', '--base', base,
  '-c', 'sandbox_mode=read-only',
  '-c', 'approval_policy=never',
  '-c', 'plugins."unified-computer-use@openai-bundled".enabled=false',
  '-c', 'plugins."computer-use@openai-bundled".enabled=false',
];

test('the model and the effort of the lean session are named in one place', () => {
  assert.equal(LEAN_MODEL, 'gpt-6.1-sol');
  assert.equal(LEAN_EFFORT, 'medium');
});

test('codexArgs: `current` is the default and today\'s argv to the token; `lean` is its own list', () => {
  const base = 'a'.repeat(40);
  assert.deepEqual(codexArgs(base), currentArgv(base));
  assert.deepEqual(codexArgs(base, 'current'), currentArgv(base));
  for (const platform of ['win32', 'linux', 'darwin']) assert.deepEqual(codexArgs(base, 'current', platform), currentArgv(base), platform);
  assert.deepEqual(codexArgs(base, 'lean', 'linux'), leanArgv(base));
  assert.ok(!codexArgs(base, 'lean', 'linux').some((token) => token.includes('openai-bundled')), 'plugins are off wholesale, not one by one');
  assert.throws(() => codexArgs(base, 'other'), /session/);
});

test('codexArgs: the lean argv, token by token, on Windows and elsewhere', () => {
  const base = 'a'.repeat(40);
  const lean = [
    'exec', 'review', '--json',
    '--ignore-user-config', '--ignore-rules',
    '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
    '-m', 'gpt-6.1-sol',
    '-c', 'model_reasoning_effort="medium"',
    '-c', 'sandbox_mode=read-only',
    '-c', 'approval_policy=never',
    '-c', 'skills.include_instructions=false',
    '--base', base,
  ];
  assert.deepEqual(codexArgs(base, 'lean', 'linux'), lean);
  assert.deepEqual(codexArgs(base, 'lean', 'darwin'), lean);
  // On Windows a read-only session that asks nobody refuses every shell command unless it has a sandbox
  // to run them in, and the lean session ignores the config file that names the user's.
  assert.deepEqual(codexArgs(base, 'lean', 'win32'), [
    'exec', 'review', '--json',
    '--ignore-user-config', '--ignore-rules',
    '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
    '-m', 'gpt-6.1-sol',
    '-c', 'model_reasoning_effort="medium"',
    '-c', 'sandbox_mode=read-only',
    '-c', 'approval_policy=never',
    '-c', 'windows.sandbox="unelevated"',
    '-c', 'skills.include_instructions=false',
    '--base', base,
  ]);
  // Its home is thrown away after the run, and only a session that is not ephemeral writes its tokens there.
  for (const platform of ['win32', 'linux']) assert.equal(codexArgs(base, 'lean', platform).includes('--ephemeral'), false, platform);
  assert.equal(codexArgs(base, 'current', 'win32').includes('--ephemeral'), true, 'the current session is as it was');
  assert.equal(codexArgs(base, 'current', 'win32').some((token) => token.includes('windows.sandbox')), false);
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

test('without --session, and with --session current, the argv is today\'s', async () => {
  const { root, base } = makeRepo();
  for (const flags of [[], ['--session', 'current']]) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], fake);
    assert.equal(result.code, 0, result.err);
    assert.deepEqual(fake.calls[0].args, currentArgv(base));
  }
});

test('a session that is neither `current` nor `lean` exits 2 with usage and does nothing', async () => {
  const { root, base } = makeRepo();
  for (const session of ['fast', 'LEAN', 'lean ', '']) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', '--session', session, '--cwd', root], fake);
    assert.equal(result.code, 2, JSON.stringify(session));
    assert.match(result.err, /--session must be `current` or `lean`/);
    assert.match(result.err, /Usage: js-harness codex-review .*\[--session <current\|lean>\]/);
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.probes.length, 0);
  }
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
      '-m gpt-6.1-sol -c "model_reasoning_effort=\\"medium\\"" -c sandbox_mode=read-only -c approval_policy=never ' +
      `-c "windows.sandbox=\\"unelevated\\"" -c skills.include_instructions=false --base ${base}`,
  );
});

test('off Windows the lean argv names no Windows sandbox, whatever the host the tests run on', async () => {
  const { root, base } = makeRepo();
  for (const platform of ['linux', 'darwin']) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, platform });
    assert.equal(result.code, 0, result.err);
    assert.deepEqual(fake.calls[0].args, leanArgv(base, platform), platform);
    assert.equal(fake.calls[0].args.some((token) => token.includes('windows')), false, platform);
  }
});

test('the run line says which session ran: `lean` with its model and effort, `current` with neither', async () => {
  const { root, base } = makeRepo();
  await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base)));
  await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base)));
  await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base), { status: 7 }));
  const runs = readCodexReviewRuns(root);
  assert.deepEqual(runs.map((line) => [line.outcome, line.session, line.model, line.effort]), [
    ['reviewed', 'current', null, null],
    ['reviewed', 'lean', 'gpt-6.1-sol', 'medium'],
    ['failed', 'lean', 'gpt-6.1-sol', 'medium'],
  ]);
  assert.deepEqual(Object.keys(runs[1]), Object.keys(runs[0]), 'the same fields in the same order under either session');
  // The record of the review does not change with the session.
  assert.deepEqual(readCodexReviews(root).map((record) => Object.keys(record)), [
    ['schema', 'base', 'head', 'reviewedAt', 'outcome', 'run'],
    ['schema', 'base', 'head', 'reviewedAt', 'outcome', 'run'],
  ]);
});

test('the line that announces the review names the lean session, and stays as it was for the current one', async () => {
  const { root, base, head } = makeRepo();
  const range = `${base.slice(0, 7)}..${head.slice(0, 7)}`;
  const current = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(current.out.split('\n')[0], `Codex is reviewing ${range}; this can take several minutes.`);
  const lean = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(lean.out.split('\n')[0], `Codex is reviewing ${range} with the lean session (gpt-6.1-sol, medium); this can take several minutes.`);
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

test('the current session is as it was: no CODEX_HOME, no folder made, and no home even asked for', async () => {
  const { root, base } = makeRepo();
  const state = tmp('js-harness-codex-review-state-');
  const never = () => {
    throw new Error('the current session must not ask where the home is');
  };
  for (const flags of [[], ['--session', 'current']]) {
    const fake = fakeCodex(reviewed(root, base));
    const env = { PATH: '/x', JS_HARNESS_HOME: state };
    const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], { ...fake, homedir: never, createLeanHome: never }, env);
    assert.equal(result.code, 0, result.err);
    assert.deepEqual(fake.calls[0].args, currentArgv(base));
    assert.deepEqual(fake.calls[0].opts.env, env);
    assert.equal('CODEX_HOME' in fake.calls[0].opts.env, false);
  }
  assert.deepEqual(listed(state), [], 'no lean home, and no state dir either');
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
  const { mine, elsewhere, other } = twoLogins();
  let links;
  const fake = watching(fakeCodex(reviewed(root, base)), () => {
    links = { named: fs.statSync(other).nlink, default: fs.statSync(mine.auth).nlink };
  });
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, homedir: mine.homedir }, { Codex_Home: elsewhere });
  assert.equal(result.code, 0, result.err);
  assert.deepEqual(links, { named: 1, default: 2 });
  assert.deepEqual(fake.calls[0].opts.env, { Codex_Home: elsewhere, CODEX_HOME: path.join(mine.homes, RUN_ID) });
  assert.equal(fs.statSync(mine.auth).nlink, 1);
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
    const result = await run(['--base', 'HEAD~1', '--session', 'lean', ...flags, '--cwd', root], { ...fake, homedir: mine.homedir }, env);
    assert.equal(result.code, 0, result.err);
    assert.equal(fake.calls[0].opts.env.CODEX_HOME, path.join(leanHomesDir(expected), RUN_ID));
    assert.equal(links, 2, 'the login of the real Codex home, wherever the state dir is');
    assert.deepEqual(listed(leanHomesDir(expected)), []);
  }
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
      const result = await run(['--base', 'HEAD~1', '--session', 'lean', ...flags, '--cwd', root], { ...fake, homedir: mine.homedir }, env);
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
    const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...watched, ...extra, homedir: mine.homedir });
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
  const thrown = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fakeCodex(''), spawnAsync: spawnThrows, homedir: mine.homedir });
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

  const failed = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base), { status: 7 }), homedir: mine.homedir, createLeanHome: stuck });
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
  const second = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fakeCodex(reviewed(root, base)), homedir: mine.homedir, timeoutMs: 10 * minute });
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

test('--keep-home without --session lean is a usage error: exit 2, and nothing runs', async () => {
  const { root, base } = makeRepo();
  for (const flags of [['--keep-home'], ['--session', 'current', '--keep-home'], ['--keep-home', '--unavailable', 'model rejected']]) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], fake);
    assert.equal(result.code, 2, flags.join(' '));
    assert.match(result.err, /--keep-home needs --session lean/);
    assert.match(result.err, /Usage: js-harness codex-review .*\[--keep-home\]/);
    assert.equal(fake.calls.length, 0);
    assert.equal(fake.probes.length, 0);
  }
  assert.equal(wrote(root), false);
  assert.equal(loggedRun(root), false);
});

// --- the prompt: the sentence Codex writes for `--base`, or this command's own, read from stdin ---

/** The lean argv of a review asked with this command's own prompt, token by token: the lean flags, no
 * `--base`, and `-` as the prompt, which makes Codex read it from stdin. */
const ownArgv = (platform = 'linux') => [
  'exec', 'review', '--json',
  '--ignore-user-config', '--ignore-rules',
  '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
  '-m', 'gpt-6.1-sol',
  '-c', 'model_reasoning_effort="medium"',
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
  assert.deepEqual(codexArgs(base, 'lean', 'linux', 'own'), [
    'exec', 'review', '--json',
    '--ignore-user-config', '--ignore-rules',
    '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
    '-m', 'gpt-6.1-sol',
    '-c', 'model_reasoning_effort="medium"',
    '-c', 'sandbox_mode=read-only',
    '-c', 'approval_policy=never',
    '-c', 'skills.include_instructions=false',
    '-',
  ]);
  for (const platform of ['win32', 'linux', 'darwin']) {
    const argv = codexArgs(base, 'lean', platform, 'own');
    assert.deepEqual(argv, ownArgv(platform), platform);
    // `--base` and a prompt exclude each other on Codex's command line: the range is in the prompt.
    assert.equal(argv.some((token) => token === '--base' || token.includes(base)), false, platform);
    assert.equal(argv.includes('--ephemeral'), false, platform);
  }
  // The default prompt is the argv as it was.
  assert.deepEqual(codexArgs(base, 'lean', 'linux', 'codex'), leanArgv(base));
  assert.deepEqual(codexArgs(base, 'current', 'linux', 'codex'), currentArgv(base));
  assert.throws(() => codexArgs(base, 'current', 'linux', 'own'), /lean/);
  assert.throws(() => codexArgs(base, 'lean', 'linux', 'mine'), /prompt/);
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
  for (const flags of [['--session', 'lean'], ['--session', 'lean', '--prompt', 'codex'], ['--prompt', 'codex'], []]) {
    const fake = fakeCodex(reviewed(root, base));
    const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], fake);
    assert.equal(result.code, 0, `${flags.join(' ')}: ${result.err}`);
    assert.deepEqual(fake.calls[0].args, flags.includes('lean') ? leanArgv(base) : currentArgv(base), flags.join(' '));
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
    const result = await run(['--base', 'HEAD~1', ...OWN, '--doc', doc, '--cwd', root], fake);
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
  await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base)));
  await run(['--base', 'HEAD~1', ...OWN, '--cwd', root], fakeCodex(reviewed(root, base)));
  await run(['--base', 'HEAD~1', ...OWN, '--cwd', root], fakeCodex(reviewed(root, base), { status: 7 }));
  const runs = readCodexReviewRuns(root);
  assert.equal(REVIEW_PROMPT_VERSION, 'js-harness.codex-review-prompt/v1');
  assert.deepEqual(runs.map((line) => [line.outcome, line.session, line.prompt, line.promptVersion]), [
    ['reviewed', 'current', 'codex', null],
    ['reviewed', 'lean', 'codex', null],
    ['reviewed', 'lean', 'own', REVIEW_PROMPT_VERSION],
    ['failed', 'lean', 'own', REVIEW_PROMPT_VERSION],
  ]);
  assert.deepEqual(runs.map(runPrompt), ['codex', 'codex', 'own', 'own']);
  for (const line of runs) assert.deepEqual(Object.keys(line).filter((name) => name !== 'reason'), Object.keys(runs[0]), 'the same fields in the same order under either prompt');
  // The record of the review does not change with the prompt.
  assert.deepEqual(readCodexReviews(root).map((record) => Object.keys(record)), Array.from({ length: 3 }, () => ['schema', 'base', 'head', 'reviewedAt', 'outcome', 'run']));
});

test('the line that announces the review names this command\'s own prompt when it is the one sent', async () => {
  const { root, base, head } = makeRepo();
  const result = await run(['--base', 'HEAD~1', ...OWN, '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(
    result.out.split('\n')[0],
    `Codex is reviewing ${base.slice(0, 7)}..${head.slice(0, 7)} with the lean session (gpt-6.1-sol, medium) and this command's own prompt; this can take several minutes.`,
  );
});

test('--prompt and --doc: a prompt that is not one, the own prompt outside the lean session, and a document with no own prompt are usage errors', async () => {
  const { root, base } = makeRepo();
  const doc = featureDoc();
  const cases = [
    [['--session', 'lean', '--prompt', 'mine'], /--prompt must be `codex` or `own`/],
    [['--session', 'lean', '--prompt', 'OWN'], /--prompt must be `codex` or `own`/],
    [['--session', 'lean', '--prompt'], /--prompt requires a value/],
    [['--prompt', 'own'], /--prompt own needs --session lean/],
    [['--session', 'current', '--prompt', 'own'], /--prompt own needs --session lean/],
    [['--prompt', 'own', '--unavailable', 'model rejected'], /--prompt own needs --session lean/],
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
  const unseen = await run(['--base', 'HEAD~1', ...OWN, '--cwd', root], fakeCodex(reviewedWith(cmd('git status'))));
  assert.equal(unseen.code, 1);
  assert.match(unseen.err, /showed 0 of 2 changed lines/);
  const logged = readCodexReviewRuns(root).at(-1);
  assert.equal(logged.outcome, 'not-inspected');
  assert.equal(logged.answerSource, 'rollout');
  assert.equal(readCodexReviews(root).length, 1, 'no second record');
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
    const result = await run(['--base', 'HEAD~1', ...flags, '--cwd', root], { ...fake, platform: process.platform });
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

test('the current session reads no answer: nothing is printed of one and its run line holds none, whatever the home the user named holds', async () => {
  const { root, base, head } = makeRepo();
  const mine = fakeHome();
  const named = path.join(mine.home, 'named-codex-home');
  // A review session with findings, as a real home may hold of a review that is not this one.
  writeRollouts(mine.codexHome, reviewSession(answerWith(root)));
  writeRollouts(named, reviewSession(answerWith(root)));
  for (const env of [{}, { CODEX_HOME: named }]) {
    const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), homedir: mine.homedir }, env);
    assert.equal(result.code, 0, result.err);
    assert.equal(result.out.includes('Codex\'s verdict'), false);
    assert.equal(result.out.split('\n').some((line) => FINDING_LINE.test(line)), false, result.out);
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual([logged.prompt, logged.promptVersion, logged.findings, logged.verdict, logged.answerSource], ['codex', null, null, null, null]);
    assert.equal(runFindings(logged), null);
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

test('a reviewed attempt leaves one run line: the range, the outcome, the CLI, what it spent and how long it took', async () => {
  const { root, base, head } = makeRepo();
  // The wall clock is read when the review starts and when the record is written; the time between
  // comes from the monotonic clock, in milliseconds with a fraction.
  const now = clock('2026-09-29T12:00:00.000Z', '2026-09-29T12:02:00.000Z');
  const monotonicNow = ticking(5000.4, 112000.2);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), now, monotonicNow });
  assert.equal(result.code, 0);
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
    session: 'current',
    model: null,
    effort: null,
    // The `--base` review, asked with the sentence Codex writes itself.
    prompt: 'codex',
    promptVersion: null,
    // An ephemeral session in the user's own home: what it spent is written nowhere this command reads.
    usage: UNKNOWN_USAGE,
    usageSource: null,
    requests: null,
    firstRequestInputTokens: null,
    threads: null,
    turns: 1,
    items: { agent_message: 1, command_execution: 1 },
    commands: { total: 1, failed: 0 },
    coverage: { seen: 2, total: 2 },
    // Nor is its answer: the rollout file that holds it as data is never written.
    findings: null,
    verdict: null,
    answerSource: null,
  };
  const logged = onlyRun(root);
  assert.deepEqual(logged, expected);
  assert.deepEqual(Object.keys(logged), Object.keys(expected), 'the fields come in a fixed order');
  // The record is written after the run ended, and names the run by its id.
  assert.deepEqual(readCodexReviews(root), [{ ...reviewedRecord(base, head), reviewedAt: '2026-09-29T12:02:00.000Z' }]);
});

test('a lean attempt\'s run line holds what its rollout files say it spent: the tokens, the requests, the first request and the threads', async () => {
  const { root, base, head } = makeRepo();
  const mine = fakeHome();
  // Codex's own events report zeros for a review, and they are not what is kept.
  const fake = spending(fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), zeros)), parentThread, reviewThread);
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
    effort: 'medium',
    prompt: 'codex',
    promptVersion: null,
    usage: REVIEW_SPENT,
    usageSource: 'rollout',
    requests: 7,
    firstRequestInputTokens: 18200,
    threads: 1,
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
  await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...spending(fakeCodex(reviewed(root, base)), reviewThread, second), homedir: mine.homedir });
  const summed = onlyRun(root);
  assert.deepEqual(summed.usage, { inputTokens: 300000, cachedInputTokens: 242000, outputTokens: 2500, reasoningOutputTokens: 800 });
  assert.deepEqual([summed.usageSource, summed.requests, summed.firstRequestInputTokens, summed.threads], ['rollout', 9, 18200, 2]);

  // Codex wrote no rollout file (an older CLI, another layout): unknown, said as `null`, and never zeros.
  // With no file there is no answer to read either, which is what fails the attempt, not the tokens.
  const noFile = fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), zeros), {}, PROBE_OK, false);
  await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...noFile, homedir: mine.homedir });
  const unknown = readCodexReviewRuns(root)[1];
  assert.deepEqual(unknown.usage, UNKNOWN_USAGE);
  assert.deepEqual([unknown.usageSource, unknown.requests, unknown.firstRequestInputTokens, unknown.threads], [null, null, null, null]);
  assert.equal(unknown.outcome, 'failed');
  assert.match(unknown.reason, /no session of the review sub-agent/);

  // Rollout files with no count in them: the files were read, so no request and no thread, and still no
  // token. What was not measured does not change how the review ends.
  await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...spending(fakeCodex(reviewed(root, base)), parentThread), homedir: mine.homedir });
  const empty = readCodexReviewRuns(root)[2];
  assert.deepEqual(empty.usage, UNKNOWN_USAGE);
  assert.deepEqual([empty.usageSource, empty.requests, empty.firstRequestInputTokens, empty.threads], [null, 0, null, 0]);
  assert.equal(empty.outcome, 'reviewed');
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
    await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...spending(fake, parentThread, reviewThread), ...extra, homedir: mine.homedir });
    const logged = readCodexReviewRuns(root).at(-1);
    assert.equal(logged.outcome, outcome);
    assert.deepEqual(logged.usage, REVIEW_SPENT, outcome);
    assert.deepEqual([logged.usageSource, logged.requests, logged.firstRequestInputTokens, logged.threads], ['rollout', 7, 18200, 1], outcome);
    assert.deepEqual(listed(mine.homes), [], outcome);
  }
  assert.equal(readCodexReviewRuns(root).length, endings.length);
  assert.equal(fs.statSync(mine.auth).nlink, 1);
});

test('the current session reads no rollout file: not of the home the user named, nor of the one under the OS home', async () => {
  const { root, base } = makeRepo();
  const mine = fakeHome();
  const named = path.join(mine.home, 'named-codex-home');
  // Both hold rollout files with counts, as a real home does, of sessions that are not this review.
  writeRollouts(mine.codexHome, reviewThread);
  writeRollouts(named, reviewThread);
  for (const env of [{}, { CODEX_HOME: named }]) {
    const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), spent)), homedir: mine.homedir }, env);
    assert.equal(result.code, 0, result.err);
    const logged = readCodexReviewRuns(root).at(-1);
    assert.deepEqual(logged.usage, UNKNOWN_USAGE);
    assert.deepEqual([logged.usageSource, logged.requests, logged.firstRequestInputTokens, logged.threads], [null, null, null, null]);
  }
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
  await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, randomUUID: undefined });
  const ids = readCodexReviewRuns(root).map((line) => line.id);
  assert.equal(ids.length, 2);
  for (const id of ids) assert.match(id, UUID);
  assert.notEqual(ids[0], ids[1]);
  assert.deepEqual(readCodexReviews(root).map((record) => record.run), ids);
});

test('the run line holds the turns and every item by type, known or not; the usage of Codex\'s events is not kept, under either session', async () => {
  const { root, base } = makeRepo();
  const other = { type: 'item.completed', item: { id: 'x', type: 'mcp_tool_call', server: 's', tool: 't' } };
  const reasoning = { type: 'item.completed', item: { id: 'r', type: 'reasoning', text: 'thinking' } };
  const events = jsonl(thread, turn, reasoning, cmd('git status', 128), spent, turn, other, cmd(diffCmd(base), 0, patchOf(root, base)), reasoning, msg(FINDINGS), spent);
  // Under `lean` too, with no rollout file to read: a `usage` in the events is never taken instead.
  const lean = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(events));
  assert.equal(lean.code, 0, lean.err);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(events));
  assert.equal(result.code, 0);
  const [leanRun, logged] = readCodexReviewRuns(root);
  for (const line of [leanRun, logged]) {
    assert.deepEqual(line.usage, UNKNOWN_USAGE);
    assert.equal(line.usageSource, null);
  }
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
  for (const session of ['current', 'lean']) {
    await run(['--base', 'HEAD~1', '--session', session, '--cwd', root], fakeCodex('', { error: new Error('boom') }));
    const logged = readCodexReviewRuns(root).at(-1);
    assert.equal(logged.session, session);
    assert.deepEqual(logged.usage, UNKNOWN_USAGE, session);
    assert.deepEqual([logged.usageSource, logged.requests, logged.firstRequestInputTokens, logged.threads], [null, null, null, null], session);
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

  const missing = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base), {}, { status: 1, stdout: '' }));
  assert.match(missing.err, /npm i -g @openai\/codex/);

  const fake = fakeCodex(reviewed(root, base));
  const noDiff = (command, args, opts) =>
    command === 'git' && args[0] === 'diff' ? { status: 128, stdout: '', stderr: 'fatal: bad object' } : fake.spawn(command, args, opts);
  assert.equal((await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, spawn: noDiff })).code, 1);

  fs.writeFileSync(path.join(root, 'f.txt'), 'dirty', 'utf8');
  const dirty = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.match(dirty.err, /commit or stash/i);

  assert.equal(loggedRun(root), false);
  assert.doesNotMatch([skipped, unknown, missing, dirty].map((result) => result.out).join('\n'), /Codex used|Codex ran/);
});

test('the wall time is measured on the monotonic clock: a wall clock that steps during the review changes nothing', async () => {
  const { root, base } = makeRepo();
  // The wall clock is set back an hour while Codex runs; `startedAt` is still its first reading.
  const now = clock('2026-09-29T12:00:00.000Z', '2026-09-29T11:00:00.000Z');
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
    const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), monotonicNow });
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
  const failed = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base), { status: 7 }), monotonicNow: noClock });
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

/** An id source that fails: the run line cannot even be built. */
const noId = () => {
  throw new Error('no entropy');
};

test('a run line that cannot be built is the same warning: the reviewed attempt still writes its record, naming no run', async () => {
  const { root, base, head } = makeRepo();
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), randomUUID: noId });
  assert.equal(result.code, 0);
  assert.match(result.err, /Could not write the run log.*no entropy/);
  const { run: _run, ...withoutRun } = reviewedRecord(base, head);
  assert.deepEqual(readCodexReviews(root), [withoutRun]);
  assert.match(result.out, /Recorded the Codex review/);
  assert.equal(loggedRun(root), false);
});

test('a run line that cannot be built does not change how a failed attempt ends', async () => {
  const { root, base } = makeRepo();
  const failed = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base), { status: 7 }), randomUUID: noId });
  assert.equal(failed.code, 7);
  assert.match(failed.err, /Could not write the run log.*no entropy/);
  assert.match(failed.err, /did not complete.*exited 7/is);
  const unseen = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewedWith(cmd('git status'))), randomUUID: noId });
  assert.equal(unseen.code, 1);
  assert.match(unseen.err, /Could not write the run log.*no entropy/);
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
  const fake = spending(fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), ...statuses, msg(FINDINGS), zeros)), parentThread, reviewThread);
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
  const partial = spending(fakeCodex(jsonl(thread, turn, reasoning, cmd(diffCmd(base), 0, patchOf(root, base)), reasoning, msg(FINDINGS), zeros)), [tokenCount({ input_tokens: 1200, output_tokens: 0 })]);
  const reviewedRun = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], partial);
  assert.ok(reviewedRun.out.includes('Codex used 1,200 input tokens (unknown cached) and 0 output (unknown reasoning) in 0 s over 1 request: 2 reasoning, 1 agent_message, 1 command_execution.'), reviewedRun.out);
  // A wall time that was not measured is said in this line as in the other.
  const untimed = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...spending(fakeCodex(reviewed(root, base)), reviewThread), monotonicNow: () => Number.NaN });
  assert.match(untimed.out, /\(703 reasoning\) in unknown s over 7 requests: /);
});

test('when the tokens are not known the summary says so plainly, with no zeros and no row of `unknown`', async () => {
  const { root, base } = makeRepo();
  // The current session: ephemeral, so Codex writes its tokens nowhere, whatever its events carry.
  for (const completed of [zeros, spent, done]) {
    const current = await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), completed)), monotonicNow: ticking(0, 18000) });
    assert.equal(current.code, 0);
    const lines = current.out.split('\n');
    const at = lines.indexOf('Codex ran for 18 s; its tokens are not known for this session (an ephemeral review reports none): 1 agent_message, 1 command_execution.');
    assert.notEqual(at, -1, current.out);
    assert.ok(at > lines.findIndex((line) => /exit 0 {2}/.test(line)), 'after the commands');
    assert.ok(at < lines.findIndex((line) => /^Recorded/.test(line)), 'before the record');
    assert.doesNotMatch(current.out, /Codex used|unknown| 0 input| 0 output/);
  }
  // It is printed for a failed attempt too.
  const failed = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex('', { error: new Error('boom') }));
  assert.equal(failed.code, 1);
  assert.ok(failed.out.includes('Codex ran for 0 s; its tokens are not known for this session (an ephemeral review reports none): no items.'), failed.out);
  // The lean session is not ephemeral, so its reason is another: its home held nothing to read.
  const lean = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fakeCodex(reviewed(root, base)));
  assert.equal(lean.code, 0, lean.err);
  assert.ok(lean.out.includes('Codex ran for 0 s; its tokens are not known for this session (its Codex home held no token count): 1 agent_message, 1 command_execution.'), lean.out);
  assert.doesNotMatch(lean.out, /Codex used|ephemeral/);
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
