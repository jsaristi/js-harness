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
import { codexReviewRunsPath, readCodexReviewRuns } from './lib/codex-review-runs.mjs';
import { codexReviewsPath, readCodexReviews } from './lib/codex-reviews.mjs';

// Real git and a fake `codex` (injected spawns): no test ever calls a real Codex.
let configDir;
const made = [];
before(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key];
  }
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-codex-review-gitconfig-'));
  process.env.GIT_CONFIG_GLOBAL = path.join(configDir, 'empty.gitconfig');
  fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
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
 * `status`/`signal`; `error` is emitted instead as a failed start; `hang` never ends. */
function fakeChild({ stdout = '', status = 0, signal = null, error, hang = false }) {
  const child = new EventEmitter();
  child.pid = 4242;
  child.stdout = new PassThrough();
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

/** The deps for a run: real git and a fake `codex --version` probe through `spawn`, a fake async
 * review through `spawnAsync`, and a `killTree` that only records. `calls`, `probes` and `killed`
 * log what happened. */
function fakeCodex(stdout, answer = {}, probe = PROBE_OK) {
  const calls = [];
  const probes = [];
  const killed = [];
  const spawn = (command, args, opts) => {
    if (command === 'git') return spawnSync(command, args, opts);
    probes.push({ command, args, opts });
    return probe;
  };
  const spawnAsync = (command, args, opts) => {
    calls.push({ command, args, opts });
    return fakeChild({ stdout, ...answer });
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
 * the record is comparable, and the platform is fixed to linux unless a test says otherwise. `shown`
 * is what the review passed through to the user, `out` what the command itself logged. */
async function run(argv, extra = {}, env = {}) {
  const out = [];
  const err = [];
  const shown = [];
  const code = await codexReviewMain(argv, env, {
    now: () => new Date('2026-09-29T12:00:00.000Z'),
    monotonicNow: () => 0,
    randomUUID: () => RUN_ID,
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

test('--home is still accepted, though nothing reads it any more', async () => {
  const { root, base } = makeRepo();
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', tmp('js-harness-codex-review-home-')], fakeCodex(reviewed(root, base)));
  assert.equal(result.code, 0);
});

// --- the session: today's configuration, or the lean one beside it ---

/** The lean argv, token by token: what `--session lean` hands Codex for a review from `base`. */
const leanArgv = (base) => [
  'exec', 'review', '--json', '--ephemeral',
  '--ignore-user-config', '--ignore-rules',
  '--disable', 'plugins', '--disable', 'apps', '--disable', 'hooks',
  '-m', 'gpt-6.1-sol',
  '-c', 'model_reasoning_effort="medium"',
  '-c', 'sandbox_mode=read-only',
  '-c', 'approval_policy=never',
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
  assert.deepEqual(codexArgs(base, 'lean'), leanArgv(base));
  assert.ok(!codexArgs(base, 'lean').some((token) => token.includes('openai-bundled')), 'plugins are off wholesale, not one by one');
  assert.throws(() => codexArgs(base, 'other'), /session/);
});

test('--session lean spawns Codex with the lean argv, from the repository root, in the same environment', async () => {
  const { root, base } = makeRepo();
  const fake = fakeCodex(reviewed(root, base));
  const env = { PATH: '/x', HOME: '/home/x' };
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], fake, env);
  assert.equal(result.code, 0, result.err);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].command, 'codex');
  assert.deepEqual(fake.calls[0].args, leanArgv(base));
  assert.equal(fs.realpathSync(fake.calls[0].opts.cwd), fs.realpathSync(root));
  // No home of its own yet: nothing about CODEX_HOME is set, so the real one is used.
  assert.deepEqual(fake.calls[0].opts.env, env);
  assert.deepEqual(fake.probes[0].args, ['--version']);
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
  assert.doesNotThrow(() => leanArgv(base).map(quoteWindowsArg));
  const fake = fakeCodex(reviewed(root, base));
  const result = await run(['--base', 'HEAD~1', '--session', 'lean', '--cwd', root], { ...fake, platform: 'win32' });
  assert.equal(result.code, 0, result.err);
  const { command, args, opts } = fake.calls[0];
  assert.equal(opts.shell, true);
  assert.deepEqual(args, []);
  assert.equal(command, windowsCommandLine('codex', leanArgv(base)));
  assert.equal(
    command,
    'codex exec review --json --ephemeral --ignore-user-config --ignore-rules --disable plugins --disable apps --disable hooks ' +
      '-m gpt-6.1-sol -c "model_reasoning_effort=\\"medium\\"" -c sandbox_mode=read-only -c approval_policy=never ' +
      `-c skills.include_instructions=false --base ${base}`,
  );
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

// --- the run log: every attempt that launched Codex leaves one measured line ---

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// The usage of the one review of this repository that was measured in full (2026-09-30).
const spent = { type: 'turn.completed', usage: { input_tokens: 297479, cached_input_tokens: 240640, output_tokens: 2396, reasoning_output_tokens: 703 } };

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
    usage: { inputTokens: 1, cachedInputTokens: null, outputTokens: 1, reasoningOutputTokens: null },
    turns: 1,
    items: { agent_message: 1, command_execution: 1 },
    commands: { total: 1, failed: 0 },
    coverage: { seen: 2, total: 2 },
  };
  const logged = onlyRun(root);
  assert.deepEqual(logged, expected);
  assert.deepEqual(Object.keys(logged), Object.keys(expected), 'the fields come in a fixed order');
  // The record is written after the run ended, and names the run by its id.
  assert.deepEqual(readCodexReviews(root), [{ ...reviewedRecord(base, head), reviewedAt: '2026-09-29T12:02:00.000Z' }]);
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

test('the run line holds the usage summed over the turns and every item by type, known or not', async () => {
  const { root, base } = makeRepo();
  const other = { type: 'item.completed', item: { id: 'x', type: 'mcp_tool_call', server: 's', tool: 't' } };
  const reasoning = { type: 'item.completed', item: { id: 'r', type: 'reasoning', text: 'thinking' } };
  const fake = fakeCodex(jsonl(thread, turn, reasoning, cmd('git status', 128), spent, turn, other, cmd(diffCmd(base), 0, patchOf(root, base)), reasoning, msg(FINDINGS), spent));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], fake);
  assert.equal(result.code, 0);
  const logged = onlyRun(root);
  assert.deepEqual(logged.usage, { inputTokens: 594958, cachedInputTokens: 481280, outputTokens: 4792, reasoningOutputTokens: 1406 });
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
  const fake = fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), msg(FINDINGS), spent), { status: 7 });
  await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, monotonicNow: ticking(100, 9600) });
  const logged = onlyRun(root);
  assert.equal(logged.usage.inputTokens, 297479);
  assert.equal(logged.usage.reasoningOutputTokens, 703);
  assert.deepEqual(logged.items, { agent_message: 1, command_execution: 1 });
  assert.deepEqual(logged.coverage, { seen: 2, total: 2 });
  assert.equal(logged.durationMs, 9500);
  assert.deepEqual([logged.base, logged.from, logged.head, logged.cli], [base, base, head, '0.159.1']);
});

test('an attempt that never started has a run line with nothing measured: null counts, not zeros', async () => {
  const { root } = makeRepo();
  await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex('', { error: new Error('boom') }));
  const logged = onlyRun(root);
  assert.deepEqual(logged.usage, { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningOutputTokens: null });
  assert.equal(logged.turns, 0);
  assert.deepEqual(logged.items, {});
  assert.deepEqual(logged.commands, { total: 0, failed: 0 });
  assert.deepEqual(logged.coverage, { seen: 0, total: 2 });
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
  assert.doesNotMatch([skipped, unknown, missing, dirty].map((result) => result.out).join('\n'), /Codex used/);
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
  assert.match(result.out, / in 3 s: /);
});

test('the wall time is never below zero', async () => {
  const { root, base } = makeRepo();
  await run(['--base', 'HEAD~1', '--cwd', root], { ...fakeCodex(reviewed(root, base)), monotonicNow: ticking(10, 4) });
  assert.equal(onlyRun(root).durationMs, 0);
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

test('after the run one line says what Codex spent: tokens, wall time and the items, most frequent first', async () => {
  const { root, base } = makeRepo();
  const statuses = Array.from({ length: 5 }, () => cmd('git status'));
  const fake = fakeCodex(jsonl(thread, turn, cmd(diffCmd(base), 0, patchOf(root, base)), ...statuses, msg(FINDINGS), spent));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { ...fake, monotonicNow: ticking(0, 107000) });
  assert.equal(result.code, 0);
  const lines = result.out.split('\n');
  const at = lines.indexOf('Codex used 297,479 input tokens (240,640 cached) and 2,396 output (703 reasoning) in 107 s: 6 command_execution, 1 agent_message.');
  assert.notEqual(at, -1, result.out);
  assert.ok(at > lines.findIndex((line) => /exit 0 {2}/.test(line)), 'after the commands');
  assert.ok(at < lines.findIndex((line) => /^Recorded/.test(line)), 'before the record');
});

test('the summary says `unknown` for a count Codex did not report, and is printed for a failed attempt too', async () => {
  const { root, base } = makeRepo();
  const reasoning = { type: 'item.completed', item: { id: 'r', type: 'reasoning', text: 'thinking' } };
  const partial = fakeCodex(jsonl(thread, turn, reasoning, cmd(diffCmd(base), 0, patchOf(root, base)), reasoning, msg(FINDINGS), { type: 'turn.completed', usage: { input_tokens: 1200, output_tokens: 0 } }));
  const reviewedRun = await run(['--base', 'HEAD~1', '--cwd', root], partial);
  assert.ok(reviewedRun.out.includes('Codex used 1,200 input tokens (unknown cached) and 0 output (unknown reasoning) in 0 s: 2 reasoning, 1 agent_message, 1 command_execution.'), reviewedRun.out);

  const failed = await run(['--base', 'HEAD~1', '--cwd', root], fakeCodex('', { error: new Error('boom') }));
  assert.equal(failed.code, 1);
  assert.ok(failed.out.includes('Codex used unknown input tokens (unknown cached) and unknown output (unknown reasoning) in 0 s: no items.'), failed.out);
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
