import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { codexReviewMain } from './codex-review.mjs';
import { codexReviewsPath, readCodexReviews } from './lib/codex-reviews.mjs';

// Real git and a fake companion script: no test ever calls a real Codex.
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

/** A home whose plugin record points at a fake companion that logs its argv and cwd next to
 * itself and exits with `exitCode`. Returns the home and where the call is logged. */
function makeHome(exitCode = 0) {
  const home = tmp('js-harness-codex-review-home-');
  const installPath = path.join(home, 'plugin-cache', 'codex');
  fs.mkdirSync(path.join(installPath, 'scripts'), { recursive: true });
  const callLog = path.join(installPath, 'call.json');
  fs.writeFileSync(
    path.join(installPath, 'scripts', 'codex-companion.mjs'),
    `import fs from 'node:fs';\n` +
      `fs.writeFileSync(${JSON.stringify(callLog)}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));\n` +
      `process.exit(${exitCode});\n`,
    'utf8',
  );
  fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.claude', 'plugins', 'installed_plugins.json'),
    JSON.stringify({ version: 2, plugins: { 'codex@openai-codex': [{ scope: 'user', installPath, version: '1.0.6' }] } }),
    'utf8',
  );
  return { home, callLog };
}

/** Runs the command with output captured; `now` is fixed so the record is comparable. */
async function run(argv, extra = {}) {
  const out = [];
  const err = [];
  const code = await codexReviewMain(argv, {}, {
    now: () => new Date('2026-09-29T12:00:00.000Z'),
    log: (line) => out.push(line),
    error: (line) => err.push(line),
    ...extra,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('a completed review appends a reviewed record with full commit ids and exits 0', async () => {
  const { root, base, head } = makeRepo();
  const { home, callLog } = makeHome(0);
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home]);
  assert.equal(result.code, 0);
  assert.match(base, /^[0-9a-f]{40}$/);
  assert.deepEqual(readCodexReviews(root), [
    { schema: 'js-harness.codex-review/v1', base, head, reviewedAt: '2026-09-29T12:00:00.000Z', outcome: 'reviewed' },
  ]);
  assert.match(result.out, /recorded/i);
  assert.ok(result.out.includes('codex-reviews.jsonl'));
  const call = JSON.parse(fs.readFileSync(callLog, 'utf8'));
  // The resolved id, not the raw `HEAD~1`: the record and the review cover the same range.
  assert.deepEqual(call.args, ['review', '--wait', '--base', base]);
  assert.equal(fs.realpathSync(call.cwd), fs.realpathSync(root));
});

test('the companion runs from the repository root even when --cwd is a subdirectory', async () => {
  const { root } = makeRepo();
  fs.mkdirSync(path.join(root, 'sub'));
  const { home, callLog } = makeHome(0);
  const result = await run(['--base', 'HEAD~1', '--cwd', path.join(root, 'sub'), '--home', home]);
  assert.equal(result.code, 0);
  assert.equal(fs.realpathSync(JSON.parse(fs.readFileSync(callLog, 'utf8')).cwd), fs.realpathSync(root));
});

test('a failed companion writes nothing, returns its code and names the two ways on', async () => {
  const { root } = makeRepo();
  const { home } = makeHome(1);
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home]);
  assert.equal(result.code, 1);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.match(result.err, /no record was written/i);
  assert.match(result.err, /--unavailable <reason>/);
});

test('uncommitted changes to tracked files refuse the review: nothing written, companion not spawned', async () => {
  const { root } = makeRepo();
  const { home, callLog } = makeHome(0);
  fs.writeFileSync(path.join(root, 'f.txt'), 'edited but not committed', 'utf8');
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home]);
  assert.equal(result.code, 1);
  assert.match(result.err, /base\.\.HEAD/);
  assert.match(result.err, /commit or stash/i);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.equal(fs.existsSync(callLog), false);
});

test('staged but uncommitted changes refuse the review too', async () => {
  const { root } = makeRepo();
  const { home, callLog } = makeHome(0);
  fs.writeFileSync(path.join(root, 'f.txt'), 'staged only', 'utf8');
  git(root, 'add', 'f.txt');
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home]);
  assert.equal(result.code, 1);
  assert.equal(fs.existsSync(callLog), false);
});

test('an untracked file does not block the review', async () => {
  const { root } = makeRepo();
  const { home } = makeHome(0);
  fs.writeFileSync(path.join(root, 'scratch.txt'), 'not tracked', 'utf8');
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home]);
  assert.equal(result.code, 0);
});

test('--unavailable is recorded even with uncommitted changes, since it reviews nothing', async () => {
  const { root } = makeRepo();
  const home = tmp('js-harness-codex-review-emptyhome-');
  fs.writeFileSync(path.join(root, 'f.txt'), 'edited but not committed', 'utf8');
  const result = await run(['--base', 'HEAD~1', '--unavailable', 'model rejected', '--cwd', root, '--home', home]);
  assert.equal(result.code, 0);
  assert.equal(readCodexReviews(root).length, 1);
});

test('any other non-zero companion code is returned as is', async () => {
  const { root } = makeRepo();
  const { home } = makeHome(7);
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home]);
  assert.equal(result.code, 7);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
});

test('a companion killed by a signal or a spawn error writes nothing and returns 1', async () => {
  const { root } = makeRepo();
  const { home } = makeHome(0);
  for (const fake of [{ status: null, signal: 'SIGTERM' }, { status: null, error: new Error('boom') }]) {
    const spawn = (cmd, args, opts) => (cmd === 'git' ? spawnSync(cmd, args, opts) : fake);
    const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home], { spawn });
    assert.equal(result.code, 1);
    assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  }
});

test('a missing plugin names the fix and the explicit skip, writes nothing, exits 1', async () => {
  const { root } = makeRepo();
  const home = tmp('js-harness-codex-review-emptyhome-');
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home]);
  assert.equal(result.code, 1);
  assert.match(result.err, /claude plugin install codex@openai-codex/);
  assert.match(result.err, /--unavailable <reason>/);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
});

test('a plugin record whose companion file is gone is treated as a missing plugin', async () => {
  const { root } = makeRepo();
  const { home, callLog } = makeHome(0);
  fs.rmSync(path.join(path.dirname(callLog), 'scripts'), { recursive: true });
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home]);
  assert.equal(result.code, 1);
  assert.match(result.err, /codex-companion\.mjs/);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
});

test('--unavailable records the skip with its reason and spawns no companion', async () => {
  const { root, base, head } = makeRepo();
  const home = tmp('js-harness-codex-review-emptyhome-');
  const spawned = [];
  const spawn = (cmd, args, opts) => {
    spawned.push(cmd);
    return spawnSync(cmd, args, opts);
  };
  const result = await run(['--base', 'HEAD~1', '--unavailable', '  model rejected  ', '--cwd', root, '--home', home], { spawn });
  assert.equal(result.code, 0);
  assert.ok(spawned.length > 0 && spawned.every((cmd) => cmd === 'git'));
  assert.deepEqual(readCodexReviews(root), [
    { schema: 'js-harness.codex-review/v1', base, head, reviewedAt: '2026-09-29T12:00:00.000Z', outcome: 'unavailable', reason: 'model rejected' },
  ]);
  assert.match(result.out, /unavailable/i);
});

test('records accumulate, one line each', async () => {
  const { root } = makeRepo();
  const { home } = makeHome(0);
  assert.equal((await run(['--base', 'HEAD~1', '--cwd', root, '--home', home])).code, 0);
  assert.equal((await run(['--base', 'HEAD~1', '--unavailable', 'later', '--cwd', root, '--home', home])).code, 0);
  assert.deepEqual(readCodexReviews(root).map((r) => r.outcome), ['reviewed', 'unavailable']);
});

test('an unknown base is an error, and nothing is written or spawned', async () => {
  const { root } = makeRepo();
  const { home, callLog } = makeHome(0);
  const result = await run(['--base', 'no-such-rev', '--cwd', root, '--home', home]);
  assert.equal(result.code, 1);
  assert.match(result.err, /no-such-rev/);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.equal(fs.existsSync(callLog), false);
});

test('outside a git repository it is a clear error, exit 1', async () => {
  const dir = tmp('js-harness-codex-review-nongit-');
  const { home } = makeHome(0);
  const result = await run(['--base', 'main', '--cwd', dir, '--home', home]);
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

test('--home falls back to JS_HARNESS_HOME', async () => {
  const { root } = makeRepo();
  const { home } = makeHome(0);
  const code = await codexReviewMain(['--base', 'HEAD~1', '--cwd', root], { JS_HARNESS_HOME: home }, {
    now: () => new Date('2026-09-29T12:00:00.000Z'),
    log: () => {},
    error: () => {},
  });
  assert.equal(code, 0);
  assert.equal(readCodexReviews(root).length, 1);
});

test('a failed git status refuses the review instead of reading as a clean tree', async () => {
  const { root } = makeRepo();
  const { home, callLog } = makeHome(0);
  const spawn = (cmd, args, opts) =>
    cmd === 'git' && args[0] === 'status' ? { status: 128, stdout: '', stderr: 'fatal: broken index' } : spawnSync(cmd, args, opts);
  const result = await run(['--base', 'HEAD~1', '--cwd', root, '--home', home], { spawn });
  assert.equal(result.code, 1);
  assert.match(result.err, /git status/);
  assert.equal(fs.existsSync(codexReviewsPath(root)), false);
  assert.equal(fs.existsSync(callLog), false);
});
