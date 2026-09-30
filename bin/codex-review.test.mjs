import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { childEnv, codexArgs, codexReviewMain, parseEvents, quoteWindowsArg, readsDiff, reviewEvidence, windowsCommandLine } from './codex-review.mjs';
import { codexReviewsPath, readCodexReviews } from './lib/codex-reviews.mjs';

// Real git and a fake `codex` (an injected spawn): no test ever calls a real Codex.
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

/** A repo with two commits; `base` is the first, `head` the second. */
function makeRepo() {
  const root = tmp('js-harness-codex-review-');
  git(root, 'init');
  git(root, 'config', 'user.email', 'js-harness-test@example.invalid');
  git(root, 'config', 'user.name', 'js-harness test');
  fs.writeFileSync(path.join(root, 'f.txt'), 'one', 'utf8');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'one');
  const base = git(root, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(root, 'f.txt'), 'two', 'utf8');
  git(root, 'commit', '-am', 'two');
  return { root, base, head: git(root, 'rev-parse', 'HEAD') };
}

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

const BASE = '438364a38653063b9f7a705452da569482dbecfc';
/** The command as the review really ran it: through the Windows PowerShell 5.1 launcher. */
const diffCmd = (base) =>
  `"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content x; git diff ${base}; git ls-files"`;
const FINDINGS = '- [P2] Drops a record — bin/x.mjs:3\n  The last line is lost.';
/** A review over `base` that read the diff and found something. */
const reviewed = (base) => jsonl(thread, turn, cmd(diffCmd(base)), msg(FINDINGS), done);

const PROBE_OK = { status: 0, stdout: 'codex-cli 0.159.1\n' };

/** A spawn that runs real git, answers the `codex --version` probe with `probe` and the review
 * call with `answer`, logging each. */
function fakeCodex(stdout, answer = {}, probe = PROBE_OK) {
  const calls = [];
  const probes = [];
  const spawn = (command, args, opts) => {
    if (command === 'git') return spawnSync(command, args, opts);
    if (args[0] === '--version' || / --version$/.test(command)) {
      probes.push({ command, args, opts });
      return probe;
    }
    calls.push({ command, args, opts });
    return { status: 0, stdout, ...answer };
  };
  return { spawn, calls, probes };
}

/** Runs the command with output captured; `now` is fixed so the record is comparable, and the
 * platform is fixed to linux unless a test says otherwise. `shown` is what the review passed
 * through to the user, `out` what the command itself logged. */
async function run(argv, extra = {}, env = {}) {
  const out = [];
  const err = [];
  const shown = [];
  const code = await codexReviewMain(argv, env, {
    now: () => new Date('2026-09-29T12:00:00.000Z'),
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
});

// --- the run ---

test('a review that read the diff appends a reviewed record with full commit ids and exits 0', async () => {
  const { root, base, head } = makeRepo();
  const { spawn } = fakeCodex(reviewed(base));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 0);
  assert.match(base, /^[0-9a-f]{40}$/);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
  assert.match(result.out, /recorded/i);
  assert.ok(result.out.includes('codex-reviews.jsonl'));
});

test('the review text is shown, and the commands Codex ran are listed with their exit codes', async () => {
  const { root, base } = makeRepo();
  const long = `git diff ${base} --unified=${'9'.repeat(300)}`;
  const { spawn } = fakeCodex(jsonl(thread, turn, cmd(long), cmd('git status', 128), msg(FINDINGS), done));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 0);
  assert.ok(result.shown.includes(FINDINGS));
  assert.match(result.out, /reviewing|ran 2 commands/i);
  assert.match(result.out, /exit 0.*git diff [0-9a-f]{40} --unified=9+/);
  assert.match(result.out, /exit 128.*git status/);
  assert.ok(!result.out.includes('9'.repeat(200)), 'a long command is truncated');
});

test('Codex is spawned as `codex exec review` with the resolved base, a read-only sandbox and the desktop plugins off', async () => {
  const { root, base } = makeRepo();
  const { spawn, calls } = fakeCodex(reviewed(base));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'codex');
  // The resolved id, not the raw `HEAD~1`: the record and the review cover the same range.
  assert.deepEqual(calls[0].args, [
    'exec', 'review', '--json', '--ephemeral', '--base', base,
    '-c', 'sandbox_mode=read-only',
    '-c', 'approval_policy=never',
    '-c', 'plugins."unified-computer-use@openai-bundled".enabled=false',
    '-c', 'plugins."computer-use@openai-bundled".enabled=false',
  ]);
  assert.deepEqual(calls[0].args, codexArgs(base));
  assert.equal(fs.realpathSync(calls[0].opts.cwd), fs.realpathSync(root));
  assert.equal(calls[0].opts.stdio[0], 'ignore', 'Codex would wait on an open stdin');
  assert.equal(calls[0].opts.stdio[1], 'pipe');
  assert.equal(calls[0].opts.stdio[2], 'inherit');
  assert.equal(calls[0].opts.encoding, 'utf8');
  assert.ok(!calls[0].opts.shell, 'no shell off Windows');
});

test('Codex runs from the repository root even when --cwd is a subdirectory', async () => {
  const { root, base } = makeRepo();
  fs.mkdirSync(path.join(root, 'sub'));
  const { spawn, calls } = fakeCodex(reviewed(base));
  const result = await run(['--base', 'HEAD~1', '--cwd', path.join(root, 'sub')], { spawn });
  assert.equal(result.code, 0);
  assert.equal(fs.realpathSync(calls[0].opts.cwd), fs.realpathSync(root));
});

test('on Windows the .cmd shim runs through a shell as one quoted command line', async () => {
  const { root, base } = makeRepo();
  const { spawn, calls } = fakeCodex(reviewed(base));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn, platform: 'win32' });
  assert.equal(result.code, 0);
  assert.equal(calls[0].opts.shell, true);
  assert.deepEqual(calls[0].args, []);
  assert.equal(calls[0].command, windowsCommandLine('codex', codexArgs(base)));
  assert.ok(calls[0].command.startsWith(`codex exec review --json --ephemeral --base ${base} `), calls[0].command);
  assert.ok(calls[0].command.includes('"plugins.\\"unified-computer-use@openai-bundled\\".enabled=false"'), calls[0].command);
});

test('on Windows the child PATH drops the WindowsApps entries and keeps the rest of the environment', async () => {
  const { root, base } = makeRepo();
  const { spawn, calls } = fakeCodex(reviewed(base));
  const env = { Path: 'C:\\Windows;C:\\Users\\x\\AppData\\Local\\Microsoft\\WindowsApps\\;D:\\bin', SystemRoot: 'C:\\Windows' };
  await run(['--base', 'HEAD~1', '--cwd', root], { spawn, platform: 'win32' }, env);
  assert.deepEqual(calls[0].opts.env, { Path: 'C:\\Windows;D:\\bin', SystemRoot: 'C:\\Windows' });
  assert.equal(env.Path.includes('WindowsApps'), true, 'the caller\'s environment is not mutated');
});

test('off Windows the environment is passed through untouched', async () => {
  const { root, base } = makeRepo();
  const { spawn, calls } = fakeCodex(reviewed(base));
  const env = { PATH: '/usr/bin:/x/Microsoft/WindowsApps' };
  await run(['--base', 'HEAD~1', '--cwd', root], { spawn }, env);
  assert.deepEqual(calls[0].opts.env, env);
});

test('a completed turn whose commands all failed writes nothing, lists what ran and names the ways on', async () => {
  const { root } = makeRepo();
  const { spawn } = fakeCodex(jsonl(thread, turn, cmd('git diff abc', -1), cmd('git show abc', 1), msg('I could not read the patch.'), done));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 1);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.match(result.err, /no successful git command that reads the diff/i);
  assert.match(result.err, /exit -1.*git diff abc/);
  assert.match(result.err, /--unavailable <reason>/);
  assert.ok(result.shown.includes('I could not read the patch.'), 'the review text is still shown');
});

test('a completed turn whose successful commands never read the diff writes nothing', async () => {
  const { root } = makeRepo();
  const { spawn } = fakeCodex(jsonl(thread, turn, cmd('git status'), cmd('git log --oneline'), cmd('Get-Content f.txt'), msg('Looks fine.'), done));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 1);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.match(result.err, /no successful git command that reads the diff/i);
});

test('a completed turn with no command at all writes nothing', async () => {
  const { root } = makeRepo();
  const { spawn } = fakeCodex(jsonl(thread, turn, msg('No actionable regression was found.'), done));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 1);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
});

test('a failed turn shows its error, writes nothing and exits 1 even when Codex exited 0', async () => {
  const { root, base } = makeRepo();
  const failed = jsonl(thread, turn, cmd(diffCmd(base)), { type: 'turn.failed', error: { message: 'The model is not supported with a ChatGPT account.' } });
  for (const status of [0, 1]) {
    const { spawn } = fakeCodex(failed, { status });
    const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
    assert.equal(result.code, 1);
    assert.equal(fs.existsSync(codexReviewsPath(root)), false);
    assert.match(result.err, /did not complete/i);
    assert.match(result.err, /model is not supported/);
    assert.match(result.err, /--unavailable <reason>/);
  }
});

test('a non-zero Codex exit is returned as is, even after a turn that read the diff', async () => {
  const { root, base } = makeRepo();
  const { spawn } = fakeCodex(reviewed(base), { status: 7 });
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 7);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.match(result.err, /did not complete.*exited 7/is);
});

test('no turn.completed means the review did not complete', async () => {
  const { root, base } = makeRepo();
  const { spawn } = fakeCodex(jsonl(thread, turn, cmd(diffCmd(base)), msg(FINDINGS)));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 1);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.match(result.err, /did not complete/i);
});

test('a signal or a spawn error writes nothing and returns 1', async () => {
  const { root } = makeRepo();
  for (const answer of [{ status: null, signal: 'SIGTERM' }, { status: null, error: new Error('boom') }]) {
    const { spawn } = fakeCodex('', answer);
    const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
    assert.equal(result.code, 1);
    assert.equal(fs.existsSync(codexReviewsPath(root)), false);
    assert.match(result.err, /did not complete/i);
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
    const { spawn, calls } = fakeCodex(reviewed(base), {}, probe);
    const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn, platform });
    assert.equal(result.code, 1, `${platform} ${probe.status}`);
    assert.match(result.err, /npm i -g @openai\/codex/);
    assert.match(result.err, /codex login/);
    assert.match(result.err, /--unavailable <reason>/);
    assert.equal(fs.existsSync(codexReviewsPath(root)), false);
    assert.equal(calls.length, 0, 'the review is not spawned');
  }
});

test('the `codex --version` probe goes through the same launch path and environment as the review', async () => {
  const { root, base } = makeRepo();
  const linux = fakeCodex(reviewed(base));
  await run(['--base', 'HEAD~1', '--cwd', root], { spawn: linux.spawn }, { PATH: '/x' });
  assert.equal(linux.probes.length, 1);
  assert.equal(linux.probes[0].command, 'codex');
  assert.deepEqual(linux.probes[0].args, ['--version']);
  assert.deepEqual(linux.probes[0].opts.env, { PATH: '/x' });
  assert.deepEqual(linux.probes[0].opts.stdio, ['ignore', 'pipe', 'pipe']);
  assert.equal(linux.probes[0].opts.timeout, 15000);
  assert.ok(!linux.probes[0].opts.shell);

  const win = fakeCodex(reviewed(base));
  const env = { Path: 'C:\\Windows;C:\\Users\\x\\AppData\\Local\\Microsoft\\WindowsApps' };
  await run(['--base', 'HEAD~1', '--cwd', root], { spawn: win.spawn, platform: 'win32' }, env);
  assert.equal(win.probes[0].command, windowsCommandLine('codex', ['--version']));
  assert.deepEqual(win.probes[0].args, []);
  assert.equal(win.probes[0].opts.shell, true);
  assert.deepEqual(win.probes[0].opts.env, { Path: 'C:\\Windows' });
});

test('no probe is run for --unavailable, or when the tree is dirty', async () => {
  const { root } = makeRepo();
  const skipped = fakeCodex('');
  await run(['--base', 'HEAD~1', '--unavailable', 'x', '--cwd', root], { spawn: skipped.spawn });
  assert.equal(skipped.probes.length, 0);
  fs.writeFileSync(path.join(root, 'f.txt'), 'dirty', 'utf8');
  const dirty = fakeCodex('');
  await run(['--base', 'HEAD~1', '--cwd', root], { spawn: dirty.spawn });
  assert.equal(dirty.probes.length, 0);
});

test('an exit 1 with no events after a good probe is a failed review, not a missing CLI', async () => {
  const { root } = makeRepo();
  for (const platform of ['linux', 'win32']) {
    const { spawn } = fakeCodex('', { status: 1 });
    const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn, platform });
    assert.equal(result.code, 1);
    assert.doesNotMatch(result.err, /npm i -g/);
    assert.match(result.err, /did not complete.*exited 1/is);
  }
});

test('the base id reaches the evidence rule: a diff of another base is not the review of this one', async () => {
  const { root } = makeRepo();
  const { spawn } = fakeCodex(reviewed(BASE));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 1);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.match(result.err, /no successful git command that reads the diff/i);
});

test('Codex\'s configuration warnings are passed on as warnings and do not fail the review', async () => {
  const { root, base, head } = makeRepo();
  const { spawn } = fakeCodex(jsonl(thread, turn, itemError('Codex is ignoring 1 unrecognized configuration setting'), cmd(diffCmd(base)), msg(FINDINGS), done));
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 0);
  assert.match(result.err, /ignoring 1 unrecognized configuration setting/);
  assert.deepEqual(readCodexReviews(root), [reviewedRecord(base, head)]);
});

test('junk lines in the JSONL are ignored', async () => {
  const { root, base } = makeRepo();
  const { spawn } = fakeCodex(`Reading prompt from stdin...\n\n${reviewed(base)}{"truncated":\n`);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 0);
});

test('the review output may exceed 1 MiB, and an overflow is named as such, not as a failed start', async () => {
  const { root } = makeRepo();
  const overflow = Object.assign(new Error('spawnSync codex ENOBUFS'), { code: 'ENOBUFS' });
  const { spawn, calls } = fakeCodex('partial', { status: null, signal: 'SIGTERM', error: overflow });
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.ok(calls[0].opts.maxBuffer > 1024 * 1024, `maxBuffer ${calls[0].opts.maxBuffer}`);
  assert.equal(result.code, 1);
  assert.match(result.err, /output exceeded/);
  assert.doesNotMatch(result.err, /could not start/);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
});

test('a stalled review is stopped by a timeout and reported as such, not recorded', async () => {
  const { root } = makeRepo();
  const stalled = Object.assign(new Error('spawnSync codex ETIMEDOUT'), { code: 'ETIMEDOUT' });
  const { spawn, calls } = fakeCodex('', { status: null, signal: 'SIGTERM', error: stalled });
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.ok(calls[0].opts.timeout >= 20 * 60 * 1000, `timeout ${calls[0].opts.timeout}`);
  assert.equal(result.code, 1);
  assert.match(result.err, /ran past \d+ minutes/);
  assert.doesNotMatch(result.err, /could not start/);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
});

// --- what the run refuses or skips ---

test('uncommitted changes to tracked files refuse the review: nothing written, Codex not spawned', async () => {
  const { root, base } = makeRepo();
  const { spawn, calls } = fakeCodex(reviewed(base));
  fs.writeFileSync(path.join(root, 'f.txt'), 'edited but not committed', 'utf8');
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 1);
  assert.match(result.err, /base\.\.HEAD/);
  assert.match(result.err, /commit or stash/i);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.equal(calls.length, 0);
});

test('staged but uncommitted changes refuse the review too', async () => {
  const { root, base } = makeRepo();
  const { spawn, calls } = fakeCodex(reviewed(base));
  fs.writeFileSync(path.join(root, 'f.txt'), 'staged only', 'utf8');
  git(root, 'add', 'f.txt');
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 1);
  assert.equal(calls.length, 0);
});

test('an untracked file does not block the review', async () => {
  const { root, base } = makeRepo();
  const { spawn } = fakeCodex(reviewed(base));
  fs.writeFileSync(path.join(root, 'scratch.txt'), 'not tracked', 'utf8');
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 0);
});

test('a failed git status refuses the review instead of reading as a clean tree', async () => {
  const { root, base } = makeRepo();
  const { calls } = fakeCodex(reviewed(base));
  const spawn = (command, args, opts) =>
    command === 'git' && args[0] === 'status' ? { status: 128, stdout: '', stderr: 'fatal: broken index' } : spawnSync(command, args, opts);
  const result = await run(['--base', 'HEAD~1', '--cwd', root], { spawn });
  assert.equal(result.code, 1);
  assert.match(result.err, /git status/);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.equal(calls.length, 0);
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
  const result = await run(['--base', 'HEAD~1', '--unavailable', '  model rejected  ', '--cwd', root], { spawn });
  assert.equal(result.code, 0);
  assert.ok(spawned.length > 0 && spawned.every((command) => command === 'git'));
  assert.deepEqual(readCodexReviews(root), [{ ...reviewedRecord(base, head), outcome: 'unavailable', reason: 'model rejected' }]);
  assert.match(result.out, /unavailable/i);
});

test('records accumulate, one line each', async () => {
  const { root, base } = makeRepo();
  const { spawn } = fakeCodex(reviewed(base));
  assert.equal((await run(['--base', 'HEAD~1', '--cwd', root], { spawn })).code, 0);
  assert.equal((await run(['--base', 'HEAD~1', '--unavailable', 'later', '--cwd', root], { spawn })).code, 0);
  assert.deepEqual(readCodexReviews(root).map((r) => r.outcome), ['reviewed', 'unavailable']);
});

test('an unknown base is an error, and nothing is written or spawned', async () => {
  const { root, base } = makeRepo();
  const { spawn, calls } = fakeCodex(reviewed(base));
  const result = await run(['--base', 'no-such-rev', '--cwd', root], { spawn });
  assert.equal(result.code, 1);
  assert.match(result.err, /no-such-rev/);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.equal(calls.length, 0);
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
  ]) {
    const result = await run(argv);
    assert.equal(result.code, 2, argv.join(' '));
    assert.match(result.err, /Usage: js-harness codex-review/);
  }
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
});

test('--base is required, and an empty --unavailable reason is a usage error', async () => {
  const { root } = makeRepo();
  const missing = await run(['--cwd', root]);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /--base/);
  const empty = await run(['--base', 'HEAD~1', '--unavailable', '   ', '--cwd', root]);
  assert.equal(empty.code, 2);
  assert.match(empty.err, /reason/);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
});

test('--home is still accepted, though nothing reads it any more', async () => {
  const { root, base } = makeRepo();
  const { spawn } = fakeCodex(reviewed(base));
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', tmp('js-harness-codex-review-home-')], { spawn });
  assert.equal(result.code, 0);
});

// --- the evidence rule ---

test('reviewEvidence: inspected needs turn.completed, a final message and a successful diff of the base', () => {
  const evidence = reviewEvidence(parseEvents(reviewed(BASE)), BASE);
  assert.equal(evidence.inspected, true);
  assert.equal(evidence.completed, true);
  assert.equal(evidence.review, FINDINGS);
  assert.deepEqual(evidence.commands, [{ command: diffCmd(BASE), exitCode: 0 }]);
  assert.deepEqual(evidence.errors, []);
  // Without the base it cannot tell whose diff was read.
  assert.equal(reviewEvidence(parseEvents(reviewed(BASE))).inspected, false);
});

test('reviewEvidence: each missing piece of evidence alone means not inspected', () => {
  const diff = diffCmd(BASE);
  const cases = {
    'no turn.completed': [thread, turn, cmd(diff), msg('ok')],
    'a failed turn': [thread, turn, cmd(diff), msg('ok'), done, { type: 'turn.failed', error: { message: 'x' } }],
    'no message': [thread, turn, cmd(diff), done],
    'an empty message': [thread, turn, cmd(diff), msg('  \n'), done],
    'a failed diff': [thread, turn, cmd(diff, 128), msg('ok'), done],
    'no diff command': [thread, turn, cmd('git status'), msg('ok'), done],
    'a diff that only started': [thread, turn, { type: 'item.started', item: { type: 'command_execution', command: diff, exit_code: null, status: 'in_progress' } }, msg('ok'), done],
  };
  for (const [name, events] of Object.entries(cases)) assert.equal(reviewEvidence(events, BASE).inspected, false, name);
});

test('reviewEvidence: the last message is the review, and one successful diff among failures is enough', () => {
  const events = [thread, turn, cmd(`git diff ${BASE}`, -1), msg('first'), cmd(`git diff ${BASE}`), msg('final'), done];
  const evidence = reviewEvidence(events, BASE);
  assert.equal(evidence.inspected, true);
  assert.equal(evidence.review, 'final');
  assert.deepEqual(evidence.commands.map((c) => c.exitCode), [-1, 0]);
});

test('readsDiff: commands that print the patch of the base range', () => {
  const reads = [
    '"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "Get-Content x; git diff 438364a38653063b9f7a705452da569482dbecfc; git ls-files"',
    '/bin/bash -lc "cd repo && git diff 438364a | head"',
    'bash -lc "cd repo && git diff 438364a38653063b9f7a705452da569482dbecfc"',
    '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoProfile -ExecutionPolicy Bypass -Command "git diff 438364a"',
    'cmd.exe /c "git diff 438364a"',
    'git diff 438364a',
    'git diff 438364a38653063b9f7a705452da569482dbecfc',
    'git diff 438364a HEAD',
    'git diff -U5 438364a..HEAD',
    'git --no-pager diff 438364a..HEAD',
    'git.exe diff 438364a...HEAD',
    'git -C D:\\repo diff 438364a3865',
    'git -c core.pager=cat diff 438364a',
    'git log -p 438364a..HEAD',
    'git log --patch 438364a3865...HEAD',
    'git log -3 -p 438364a..HEAD',
    'git diff --stat 438364a; git diff 438364a',
    'git status && git diff 438364a | cat',
  ];
  const not = [
    'rg -n "git diff" bin',
    "Select-String -Pattern 'git diff 438364a' bin/x.mjs",
    'echo "git diff 438364a"',
    'git diff',
    'git diff HEAD~1',
    'git diff abc1234',
    'git diff 438364',
    'git diff --stat 438364a',
    'git diff --check 438364a',
    'git diff 438364a -- bin/x.mjs',
    'git diff 438364a..HEAD -- bin docs',
    'git diff --name-only 438364a',
    'git diff --numstat 438364a',
    'git diff --shortstat 438364a',
    'git diff --quiet 438364a',
    'git diff --summary 438364a',
    'git diff --raw 438364a',
    'git diff --stat 438364a; git status',
    'git show 438364a',
    'git show -p 438364a',
    'git show 438364a:bin/x.mjs',
    'git diff 438364a:bin/x.mjs HEAD:bin/x.mjs',
    'git log 438364a..HEAD',
    'git log --oneline 438364a..HEAD',
    'git log -p HEAD~3..HEAD',
    'git log -p --stat 438364a..HEAD',
    'git difftool 438364a',
    'git diff-tree 438364a',
    'git status',
    'Get-Content bin/x.mjs',
    'echo diff',
  ];
  for (const command of reads) assert.equal(readsDiff(command, BASE), true, command);
  for (const command of not) assert.equal(readsDiff(command, BASE), false, command);
  assert.equal(readsDiff('git diff 438364a', undefined), false);
});

test('reviewEvidence: error messages come from the failed turn, warnings from error items', () => {
  const evidence = reviewEvidence([
    itemError('unrecognized setting'),
    { type: 'turn.failed', error: { message: 'model rejected' } },
    { type: 'error', message: 'stream closed' },
  ]);
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
