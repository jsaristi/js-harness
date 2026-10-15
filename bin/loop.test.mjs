import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loopMain } from './loop.mjs';
import { loopRecordPath } from './lib/loops.mjs';
import { projectSlug } from './lib/sessions.mjs';

// The process table and the kill are fakes, except in the last test, which starts a real loop and stops it. The
// records are real files in a temporary home; git is a fake that fails, so the project is the folder itself.
const ME = 4242;
const ME_AT = 1_000_000;
const OWNER = 'aaaaaaaa-1111-4111-8111-111111111111';
const OTHER = 'bbbbbbbb-2222-4222-8222-222222222222';
const T0 = Date.parse('2026-10-15T04:50:00.000Z');
const noGit = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });

function place() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-test-'));
  const cwd = path.join(root, 'project');
  const home = path.join(root, 'home');
  fs.mkdirSync(cwd);
  const record = (name) => loopRecordPath(home, projectSlug(cwd), name);
  return { root, cwd, home, record };
}

function writeRecord(file, fields) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(fields, null, 2)}\n`);
}

const liveRecord = (name, owner, extra = {}) => ({
  schema: 'js-harness.loop/v1',
  name,
  owner,
  pid: 5000,
  createdAt: 2_000_000,
  child: { pid: 5001, createdAt: 2_000_010 },
  startedAt: '2026-10-15T04:37:00.000Z',
  purpose: 'PR keeper v9',
  until: '5 hours, or stopped by its owner',
  command: ['bash', 'keeper7.sh', '5'],
  cwd: 'D:/js-harness',
  ...extra,
});

/** The seams of one call. `table` is the process table each look returns, one after another, the last again. */
function world({ cwd, home, tables = [[]], killAnswer = (targets) => ({ killed: targets.map((t) => t.pid), gone: [], running: [] }) }) {
  const state = { out: [], err: [], kills: [], looks: 0 };
  const deps = {
    cwd,
    now: () => T0,
    stdout: (line) => state.out.push(line),
    stderr: (line) => state.err.push(line),
    homedir: () => home,
    run: noGit,
    pid: ME,
    snapshot: () => tables[Math.min(state.looks++, tables.length - 1)],
    kill: (targets) => {
      state.kills.push(targets);
      return killAnswer(targets);
    },
    sleep: async () => {},
  };
  return { state, deps };
}

const self = { pid: ME, ppid: 1, createdAt: ME_AT };
const liveTable = [self, { pid: 5000, ppid: 1, createdAt: 2_000_000 }, { pid: 5001, ppid: 5000, createdAt: 2_000_010 }, { pid: 5002, ppid: 5001, createdAt: 2_000_020 }];

test('run refuses without an owner: no --owner and no CLAUDE_CODE_SESSION_ID, and no record is written', async () => {
  const p = place();
  const { state, deps } = world({ ...p, tables: [[self]] });
  const code = await loopMain(['run', 'heartbeat', '--purpose', 'wake the lead', '--until', '30 min quiet', '--', process.execPath, '-e', ''], {}, deps);
  assert.equal(code, 2);
  assert.match(state.err.join('\n'), /owner/);
  assert.equal(fs.existsSync(p.record('heartbeat')), false);
});

test('run writes the owner record while the command runs, passes its exit code through and removes the record', async () => {
  const p = place();
  const seen = path.join(p.root, 'seen.json');
  const { state, deps } = world({ ...p, tables: [[self]] });
  const script = "require('fs').copyFileSync(process.env.LOOP_RECORD, process.env.LOOP_SEEN); process.exit(7)";
  const env = { CLAUDE_CODE_SESSION_ID: OWNER, LOOP_RECORD: p.record('keeper'), LOOP_SEEN: seen, PATH: process.env.PATH };
  const code = await loopMain(['run', 'keeper', '--purpose', 'PR keeper', '--until', '5 hours', '--', process.execPath, '-e', script], env, deps);
  assert.equal(code, 7);
  const record = JSON.parse(fs.readFileSync(seen, 'utf8'));
  assert.equal(record.owner, OWNER);
  assert.equal(record.pid, ME);
  assert.equal(record.createdAt, ME_AT);
  assert.equal(record.purpose, 'PR keeper');
  assert.equal(record.until, '5 hours');
  assert.equal(record.startedAt, new Date(T0).toISOString());
  assert.deepEqual(record.command.slice(1), ['-e', script]);
  assert.equal(typeof record.child.pid, 'number');
  assert.equal(fs.existsSync(p.record('keeper')), false, 'the record is removed when the command ends');
  assert.match(state.out.join('\n'), /keeper/);
});

test('run refuses a loop of that name whose process is alive, and leaves its record as it was', async () => {
  const p = place();
  const existing = liveRecord('keeper', OTHER);
  writeRecord(p.record('keeper'), existing);
  const { state, deps } = world({ ...p, tables: [liveTable] });
  const code = await loopMain(['run', 'keeper', '--purpose', 'PR keeper', '--until', '5 hours', '--owner', OWNER, '--', process.execPath, '-e', 'process.exit(9)'], {}, deps);
  assert.equal(code, 2);
  assert.match(state.err.join('\n'), /keeper runs.*bbbbbbbb.*pid 5000/s);
  assert.deepEqual(JSON.parse(fs.readFileSync(p.record('keeper'), 'utf8')), existing);
  assert.equal(state.kills.length, 0);
});

test('run replaces a stale record (its pid is now another process) and says so', async () => {
  const p = place();
  writeRecord(p.record('heartbeat'), liveRecord('heartbeat', OTHER));
  // pid 5000 lives, but it started at another time: a reused pid, not the loop.
  const reused = [self, { pid: 5000, ppid: 1, createdAt: 9_999_999 }];
  const { state, deps } = world({ ...p, tables: [reused] });
  const code = await loopMain(['run', 'heartbeat', '--purpose', 'wake', '--until', 'quiet', '--owner', OWNER, '--', process.execPath, '-e', 'process.exit(0)'], {}, deps);
  assert.equal(code, 0);
  assert.match(state.out.join('\n'), /stale record of heartbeat.*pid 5000.*bbbbbbbb/s);
  assert.equal(state.kills.length, 0, 'a stale record kills nothing');
});

test('status lists each record with its owner, state, pid, start, purpose and end condition; --json gives the same', async () => {
  const p = place();
  writeRecord(p.record('keeper'), liveRecord('keeper', OWNER));
  writeRecord(p.record('heartbeat'), liveRecord('heartbeat', OTHER, { pid: 6000, child: { pid: 6001, createdAt: 3 }, purpose: 'wake the lead', until: '30 min quiet' }));
  const { state, deps } = world({ ...p, tables: [liveTable] });
  assert.equal(await loopMain(['status'], {}, deps), 0);
  const text = state.out.join('\n');
  assert.match(text, /keeper\s+alive\s+aaaaaaaa\s+pid 5000\s+since \d\d:\d\d\s+PR keeper v9 — until 5 hours, or stopped by its owner/);
  assert.match(text, /heartbeat\s+stale\s+bbbbbbbb\s+pid 6000/);

  const json = world({ ...p, tables: [liveTable] });
  assert.equal(await loopMain(['status', '--json'], {}, json.deps), 0);
  const loops = JSON.parse(json.state.out.join('\n'));
  assert.deepEqual(loops.map((l) => [l.name, l.state, l.owner]), [['heartbeat', 'stale', OTHER], ['keeper', 'alive', OWNER]]);
});

test('stop refuses a live loop another session owns, kills nothing and keeps the record', async () => {
  const p = place();
  writeRecord(p.record('keeper'), liveRecord('keeper', OTHER));
  const { state, deps } = world({ ...p, tables: [liveTable] });
  const code = await loopMain(['stop', 'keeper'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps);
  assert.equal(code, 3);
  assert.match(state.err.join('\n'), /owned by bbbbbbbb.*--take-over/s);
  assert.equal(state.kills.length, 0);
  assert.equal(fs.existsSync(p.record('keeper')), true);
});

test('stop --take-over kills the loop and every descendant by pid and creation time, looks again and removes the record', async () => {
  const p = place();
  writeRecord(p.record('keeper'), liveRecord('keeper', OTHER));
  const after = [self, { pid: 5001, ppid: 1, createdAt: 7_777_777 }]; // 5001 is now another process: not a survivor
  const { state, deps } = world({ ...p, tables: [liveTable, after] });
  const code = await loopMain(['stop', 'keeper', '--take-over'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps);
  assert.equal(code, 0);
  assert.deepEqual(state.kills, [[{ pid: 5000, createdAt: 2_000_000 }, { pid: 5001, createdAt: 2_000_010 }, { pid: 5002, createdAt: 2_000_020 }]]);
  assert.match(state.out.join('\n'), /stopped keeper: 3 processes, none left/);
  assert.equal(fs.existsSync(p.record('keeper')), false);
});

test('stop by its owner exits 1 and keeps the record when a process survives the kill', async () => {
  const p = place();
  writeRecord(p.record('keeper'), liveRecord('keeper', OWNER));
  const { state, deps } = world({ ...p, tables: [liveTable, liveTable], killAnswer: () => ({ killed: [5000, 5001], gone: [], running: [5002] }) });
  const code = await loopMain(['stop', 'keeper'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps);
  assert.equal(code, 1);
  assert.match(state.err.join('\n'), /still alive.*5000.*5001.*5002/s);
  assert.equal(fs.existsSync(p.record('keeper')), true);
});

test('stop of a stale record removes it and kills nothing, whoever owned it', async () => {
  const p = place();
  writeRecord(p.record('heartbeat'), liveRecord('heartbeat', OTHER));
  const { state, deps } = world({ ...p, tables: [[self]] });
  const code = await loopMain(['stop', 'heartbeat'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps);
  assert.equal(code, 0);
  assert.equal(state.kills.length, 0);
  assert.match(state.out.join('\n'), /heartbeat was not running.*stale record removed/s);
  assert.equal(fs.existsSync(p.record('heartbeat')), false);
});

test('run --restart by the owner stops its own live loop first, then runs', async () => {
  const p = place();
  writeRecord(p.record('keeper'), liveRecord('keeper', OWNER));
  const { state, deps } = world({ ...p, tables: [liveTable, [self], [self]] });
  const code = await loopMain(['run', 'keeper', '--restart', '--purpose', 'PR keeper', '--until', '5 hours', '--', process.execPath, '-e', 'process.exit(0)'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps);
  assert.equal(code, 0);
  assert.equal(state.kills.length, 1);
  assert.match(state.out.join('\n'), /stopped keeper/);
});

test('run --restart of a loop another session owns refuses without --take-over', async () => {
  const p = place();
  writeRecord(p.record('keeper'), liveRecord('keeper', OTHER));
  const { state, deps } = world({ ...p, tables: [liveTable] });
  const code = await loopMain(['run', 'keeper', '--restart', '--purpose', 'PR keeper', '--until', '5 hours', '--', process.execPath, '-e', 'process.exit(0)'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps);
  assert.equal(code, 3);
  assert.equal(state.kills.length, 0);
});

test('a real loop: run in the background, status sees it alive, stop leaves no process of it', { timeout: 120000 }, async () => {
  const p = place();
  const bin = fileURLToPath(new URL('./loop.mjs', import.meta.url));
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: OWNER, JS_HARNESS_HOME: p.home };
  const child = spawn(process.execPath, [bin, 'run', 'sleeper', '--cwd', p.cwd, '--purpose', 'test', '--until', 'stopped', '--', process.execPath, '-e', 'setInterval(() => {}, 1000)'], { env, stdio: 'ignore' });
  const deadline = Date.now() + 60000;
  while (!fs.existsSync(p.record('sleeper')) || JSON.parse(fs.readFileSync(p.record('sleeper'), 'utf8')).child === null) {
    assert.ok(Date.now() < deadline, 'the record appears');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const record = JSON.parse(fs.readFileSync(p.record('sleeper'), 'utf8'));
  const status = spawnSync(process.execPath, [bin, 'status', '--cwd', p.cwd], { env, encoding: 'utf8' });
  assert.match(status.stdout, /sleeper\s+alive/);
  const stop = spawnSync(process.execPath, [bin, 'stop', 'sleeper', '--cwd', p.cwd], { env, encoding: 'utf8' });
  assert.equal(stop.status, 0, stop.stderr);
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err.code === 'EPERM';
    }
  };
  assert.equal(alive(record.child.pid), false, 'the command is gone');
  if (child.exitCode === null && child.signalCode === null) await new Promise((resolve) => child.once('exit', resolve));
  assert.equal(fs.existsSync(p.record('sleeper')), false);
});
