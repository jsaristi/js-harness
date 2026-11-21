// The pure parts of the folder load probe (odd/tasks/folder-instructions.md, spec 1): the probe itself starts `claude`
// and runs only by hand, so the tests hold how it reads its arguments, the environment it gives the child, how it sets
// up a fixture and what it counts as evidence in a transcript.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { childEnv, gitFixture, launcher, nestedLoads, parseArgs, removeOwned, verdict } from './folder-load-probe.mjs';

const root = path.resolve(os.tmpdir(), 'fixture');
const read = (id, file) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: path.join(root, ...file.split('/')) } }] } });
const result = (id, isError = false) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content: 'a neighbour' }] } });
const nested = (file) => ({ attachment: { type: 'nested_memory', path: path.join(root, ...file.split('/')) } });
const ran = { status: 0, stdout: '', stderr: '' };

test('nestedLoads gives each nested_memory attachment as a path relative to the fixture, and skips everything else', () => {
  const entries = [
    { type: 'user', message: { content: 'Read bin/neighbour.txt' } },
    { attachment: { type: 'instructions', files: [{ path: path.join(root, 'CLAUDE.md') }] } },
    nested('bin/CLAUDE.md'),
    nested('odd/tasks/CLAUDE.md'),
    { attachment: { type: 'nested_memory' } },
  ];
  assert.deepEqual(nestedLoads(entries, root), ['bin/CLAUDE.md', 'odd/tasks/CLAUDE.md']);
  assert.deepEqual(nestedLoads([], root), []);
});

// Codex on PR 943, "Require transcript evidence of the requested Read".
test('verdict counts a load only with the requested Read and its result in the transcript', () => {
  const text = (entries) => entries.map((entry) => JSON.stringify(entry)).join('\n');
  const full = text([read('t1', 'bin/neighbour.txt'), result('t1'), nested('bin/CLAUDE.md')]);
  assert.equal(verdict({ file: 'bin/CLAUDE.md', run: ran, transcript: full, root }).state, 'LOADED');
  const noRead = text([nested('bin/CLAUDE.md')]);
  assert.equal(verdict({ file: 'bin/CLAUDE.md', run: ran, transcript: noRead, root }).state, 'INCONCLUSIVE');
  const failedRead = text([read('t1', 'bin/neighbour.txt'), result('t1', true), nested('bin/CLAUDE.md')]);
  assert.equal(verdict({ file: 'bin/CLAUDE.md', run: ran, transcript: failedRead, root }).state, 'INCONCLUSIVE');
  const otherRead = text([read('t1', 'docs/neighbour.txt'), result('t1'), nested('bin/CLAUDE.md')]);
  assert.equal(verdict({ file: 'bin/CLAUDE.md', run: ran, transcript: otherRead, root }).state, 'INCONCLUSIVE');
  const notLoaded = text([read('t1', 'bin/neighbour.txt'), result('t1')]);
  assert.equal(verdict({ file: 'bin/CLAUDE.md', run: ran, transcript: notLoaded, root }).state, 'NOT LOADED');
});

// Codex on PR 943, "Decode transcript JSONL in the tested reader" and "Distinguish Claude failures from negative load results".
test('verdict calls a run with no usable transcript, a timeout or a failed exit inconclusive, and says why', () => {
  const truncated = verdict({ file: 'bin/CLAUDE.md', run: ran, transcript: '{"type":"assis', root });
  assert.equal(truncated.state, 'INCONCLUSIVE');
  assert.match(truncated.reason, /no usable transcript entry \(1 line skipped\)/);
  assert.match(verdict({ file: 'bin/CLAUDE.md', run: ran, transcript: null, root }).reason, /no transcript/);
  const timeout = verdict({ file: 'bin/CLAUDE.md', run: { status: null, error: new Error('spawnSync claude ETIMEDOUT') }, transcript: null, root });
  assert.match(timeout.reason, /could not run: spawnSync claude ETIMEDOUT/);
  const auth = verdict({ file: 'bin/CLAUDE.md', run: { status: 1, stdout: '', stderr: 'Invalid API key\nmore' }, transcript: null, root });
  assert.match(auth.reason, /exited 1: Invalid API key$/);
});

// Codex on PR 943, "Validate arguments before starting paid runs", "Resolve --root before deriving transcript paths" and
// the relative `--claude` half of "Resolve the Claude launcher before entering the fixture".
test('parseArgs handles help, rejects unknown options and missing values, and resolves paths from the caller', () => {
  assert.deepEqual(parseArgs(['--help']), { help: true });
  assert.match(parseArgs(['--rot', 'x']).error, /unknown argument: --rot/);
  assert.match(parseArgs(['--root']).error, /--root needs a value/);
  assert.match(parseArgs(['--claude', '--root', 'x']).error, /--claude needs a value/);
  const caller = path.resolve(os.tmpdir(), 'caller');
  const parsed = parseArgs(['--root', 'work', '--claude', './bin/claude'], { cwd: caller });
  assert.equal(parsed.root, path.join(caller, 'work'));
  assert.equal(parsed.claude, path.join(caller, 'bin', 'claude'));
  assert.equal(parseArgs([], { cwd: caller }).claude, null);
  assert.equal(parseArgs([], { cwd: caller }).root, null);
});

test('launcher resolves a Windows .cmd shim to a shell launch, from PATH or from --claude', () => {
  const env = { Path: 'C:\\npm' };
  const exists = (file) => file === 'C:\\npm\\claude.cmd';
  assert.deepEqual(launcher(null, { env, platform: 'win32', exists }), { path: 'C:\\npm\\claude.cmd', shell: true });
  assert.deepEqual(launcher('C:\\x\\claude.cmd', { env, platform: 'win32', exists }), { path: 'C:\\x\\claude.cmd', shell: true });
  assert.deepEqual(launcher('/opt/claude', { env: { PATH: '' }, platform: 'linux', exists }), { path: '/opt/claude', shell: false });
  assert.equal(launcher(null, { env: { PATH: '' }, platform: 'linux', exists }), null);
});

// Codex on PR 943, "Strip the parent Claude marker that disables transcripts" and "Run the probe with a disposable Claude config".
test('childEnv drops the markers of a parent session, git variables included, and points at the disposable config', () => {
  const env = childEnv({ PATH: 'p', CLAUDECODE: '1', CLAUDE_CODE_CHILD_SESSION: '1', CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_CODE_SSE_PORT: '9', CLAUDE_CODE_SESSION_ID: 's', CLAUDE_CONFIG_DIR: 'real', CLAUDE_CODE_OAUTH_TOKEN: 't' }, 'C:\\run\\config');
  assert.deepEqual(env, { PATH: 'p', CLAUDE_CODE_OAUTH_TOKEN: 't', CLAUDE_CONFIG_DIR: 'C:\\run\\config' });
});

// Codex on PR 943, "Isolate git init from the caller's repository" and "Stop before starting Claude when git init fails".
test('gitFixture runs git without the caller\'s git variables and throws when git init fails', () => {
  const calls = [];
  const spawn = (command, args, options) => { calls.push({ command, args, options }); return { status: 0 }; };
  gitFixture('C:\\fx', { spawn, env: { PATH: 'p', GIT_DIR: 'C:\\caller\\.git', GIT_INDEX_FILE: 'i' } });
  assert.equal(calls[0].options.cwd, 'C:\\fx');
  assert.equal(calls[0].options.env.GIT_DIR, undefined);
  assert.equal(calls[0].options.env.GIT_INDEX_FILE, undefined);
  assert.throws(() => gitFixture('C:\\fx', { spawn: () => ({ status: 128, stderr: 'fatal: no' }), env: {} }), /git init failed in C:\\fx: exited 128: fatal: no/);
  assert.throws(() => gitFixture('C:\\fx', { spawn: () => ({ status: null, error: new Error('spawnSync git ENOENT') }), env: {} }), /git init failed in C:\\fx: spawnSync git ENOENT/);
});

// Codex on PR 943, "Preserve the caller's --root directory".
test('removeOwned removes the run folder and the root only when the probe made the root and it is empty', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'jh-folder-probe-test-'));
  try {
    const kept = path.join(base, 'kept');
    fs.mkdirSync(path.join(kept, 'run'), { recursive: true });
    removeOwned({ root: kept, run: path.join(kept, 'run'), madeRoot: false });
    assert.equal(fs.existsSync(path.join(kept, 'run')), false);
    assert.equal(fs.existsSync(kept), true);
    const made = path.join(base, 'made');
    fs.mkdirSync(path.join(made, 'run'), { recursive: true });
    fs.writeFileSync(path.join(made, 'late.txt'), 'someone else\'s');
    removeOwned({ root: made, run: path.join(made, 'run'), madeRoot: true });
    assert.equal(fs.existsSync(path.join(made, 'late.txt')), true);
    fs.rmSync(path.join(made, 'late.txt'));
    fs.mkdirSync(path.join(made, 'run'));
    removeOwned({ root: made, run: path.join(made, 'run'), madeRoot: true });
    assert.equal(fs.existsSync(made), false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
