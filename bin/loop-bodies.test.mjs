import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loopMain } from './loop.mjs';
import { gateLogDir } from './lib/gate-log.mjs';
import { NOTICE_SCHEMA, recordPath } from './lib/channel.mjs';
import { projectSlug } from './lib/sessions.mjs';

// The bodies a loop runs. Every seam is fake: the clock, the sleep, the files' times and the channel's text.
const T0 = Date.parse('2026-10-15T05:00:00.000Z');
const CWD = path.resolve('loop-bodies-project');
const HOME = path.resolve('loop-bodies-home');
const GATE_LOG = path.join(gateLogDir(HOME), 'log.jsonl');
const CHANNEL = recordPath(HOME, projectSlug(CWD));
const OWNER = 'aaaaaaaa-1111-4111-8111-111111111111';
const OTHER = 'cccccccc-3333-4333-8333-333333333333';
const noGit = () => ({ status: 128, stdout: '', stderr: 'fatal: not a git repository' });
const hour = (ms) => new Date(ms).toTimeString().slice(0, 5);

/** `files` maps a path to its modification time in ms; `onSleep(state)` runs after each sleep. */
function world({ files = {}, channel = '', onSleep = () => {} } = {}) {
  const state = { clock: T0, out: [], err: [], files: { ...files }, channel, sleeps: 0 };
  const deps = {
    cwd: CWD,
    now: () => state.clock,
    sleep: async (ms) => {
      state.sleeps += 1;
      state.clock += ms;
      onSleep(state);
    },
    stdout: (line) => state.out.push(line),
    stderr: (line) => state.err.push(line),
    homedir: () => HOME,
    run: noGit,
    readdir: (dir) => Object.keys(state.files).filter((file) => path.dirname(file) === dir).map((file) => path.basename(file)),
    mtime: (file) => {
      if (state.files[file] === undefined) throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
      return state.files[file];
    },
    readFile: (file) => {
      if (file !== CHANNEL || state.channel === '') throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
      return state.channel;
    },
  };
  return { state, deps };
}

function notice({ at, id, title = 'JH 5 · canal', kind = 'note', text = 'a note' }) {
  const line = {
    schema: NOTICE_SCHEMA,
    at: new Date(at).toISOString(),
    from: { host: 'claude-code', id, source: 'environment', title, permissionMode: 'bypassPermissions', context: null },
    to: { role: 'orchestrator', number: null },
    kind,
    text,
    cwd: CWD,
    worktree: CWD,
    branch: 'feat/x',
  };
  return `${JSON.stringify(line)}\n`;
}

test('heartbeat ends with one STALL line when neither the gate log nor the channel was written for --quiet minutes', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 - 3600000, [CHANNEL]: T0 - 7200000 } });
  const code = await loopMain(['heartbeat', '--quiet', '30', '--every', '120'], {}, deps);
  assert.equal(code, 0);
  assert.equal(state.clock, T0 + 30 * 60000, 'the quiet is counted from the start, not from the older writes');
  assert.equal(state.out.at(-1), `STALL: no gate-log or channel write since ${hour(T0)}`);
});

test('heartbeat: a write to the gate log or the channel starts the quiet again', async () => {
  const { state, deps } = world({
    files: { [GATE_LOG]: T0 - 60000 },
    onSleep: (s) => {
      if (s.clock === T0 + 20 * 60000) s.files[CHANNEL] = s.clock;
    },
  });
  const code = await loopMain(['heartbeat', '--quiet', '30', '--every', '120'], {}, deps);
  assert.equal(code, 0);
  assert.equal(state.clock, T0 + 50 * 60000);
  assert.equal(state.out.at(-1), `STALL: no gate-log or channel write since ${hour(T0 + 20 * 60000)}`);
});

test('heartbeat ends with exit 1 at --max hours while the writes go on', async () => {
  const { state, deps } = world({
    files: { [GATE_LOG]: T0 },
    onSleep: (s) => {
      s.files[GATE_LOG] = s.clock;
    },
  });
  const code = await loopMain(['heartbeat', '--quiet', '30', '--max', '1', '--every', '600'], {}, deps);
  assert.equal(code, 1);
  assert.equal(state.clock, T0 + 3600000);
  assert.match(state.out.at(-1), /heartbeat: 1 hour cap reached/);
});

test('channel-watch ends with the first notice written after it started by a session other than its owner', async () => {
  const before = notice({ at: T0 - 1000, id: OTHER, text: 'old news' });
  const { state, deps } = world({
    channel: before,
    onSleep: (s) => {
      if (s.sleeps === 1) s.channel += notice({ at: s.clock, id: OWNER, text: 'my own notice' });
      if (s.sleeps === 2) s.channel += notice({ at: s.clock, id: OTHER, kind: 'waiting', title: 'JH 8 · tests exactos', text: 'gate turn queued' });
    },
  });
  const code = await loopMain(['channel-watch', '--for', '30', '--every', '5'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps);
  assert.equal(code, 0);
  assert.equal(state.sleeps, 2);
  assert.equal(state.out.at(-1), 'waiting from JH 8 · tests exactos to orchestrator: gate turn queued');
});

test('channel-watch ends with exit 1 after --for minutes with no notice of another session', async () => {
  const { state, deps } = world();
  const code = await loopMain(['channel-watch', '--for', '1', '--every', '30'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps);
  assert.equal(code, 1);
  assert.equal(state.clock, T0 + 60000);
  assert.match(state.out.at(-1), /no notice of another session in 1 minute/);
});

// odd/tasks/stalled-sessions.md S5: the heartbeat also ends on a work session that holds handed work and went quiet.
const LEAD = { host: 'claude-code', id: 'e152c9d8-0000-4000-8000-000000000000', source: 'environment', title: 'JH ORQ · lead', permissionMode: 'bypassPermissions' };
const handedTo = (number, at, text = 'T3 is yours') => `${JSON.stringify({ schema: NOTICE_SCHEMA, at: new Date(at).toISOString(), from: LEAD, to: { role: 'work', number }, kind: 'note', text, cwd: CWD })}\n`;
// The gate log is written at every tick, so the machine never goes quiet and only a stalled session can end the loop.
const busy = (s) => {
  s.files[GATE_LOG] = s.clock;
};

test('heartbeat ends with a STALLED line when a work session crosses the hour with no commit, notice or gate since its handed work', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, channel: handedTo(19, T0 - 50 * 60000), onSleep: busy });
  const code = await loopMain(['heartbeat', '--every', '120'], {}, deps);
  assert.equal(code, 0);
  assert.equal(state.clock, T0 + 10 * 60000, 'it ends at the tick the quiet reaches the hour');
  assert.equal(state.out.at(-1), `STALLED: work session 19 — no commit, notice or gate since ${hour(T0 - 50 * 60000)}, holding a note from JH ORQ · lead of ${hour(T0 - 50 * 60000)}: T3 is yours`);
  assert.match(state.out[0], /or a work session holds handed work with no commit, notice or gate for 60 minutes/);
});

test('heartbeat: a session already stalled when it starts is named at the start and ends it only when its quiet doubles', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, channel: handedTo(19, T0 - 90 * 60000), onSleep: busy });
  const code = await loopMain(['heartbeat', '--every', '120'], {}, deps);
  assert.equal(code, 0);
  assert.equal(state.out[1], 'already stalled: work session 19, quiet 1h 30m');
  assert.equal(state.clock, T0 + 30 * 60000, 'two hours of quiet, not the next tick');
  assert.match(state.out.at(-1), /^STALLED: work session 19 /);
});

test('heartbeat: --stall sets the minutes, and a value that is no whole number above zero is a usage error', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, channel: handedTo(19, T0 - 5 * 60000), onSleep: busy });
  assert.equal(await loopMain(['heartbeat', '--stall', '10', '--every', '60'], {}, deps), 0);
  assert.equal(state.clock, T0 + 5 * 60000);
  for (const bad of ['0', 'soon', '1.5']) {
    const { state: other, deps: otherDeps } = world();
    assert.equal(await loopMain(['heartbeat', '--stall', bad], {}, otherDeps), 2, bad);
    assert.match(other.err.join('\n'), /--stall/);
  }
});

test('heartbeat: the git read of a quiet session is bounded by a timeout, so a stuck git cannot hold the loop', async () => {
  const worker = { ...LEAD, id: '19000000-0000-4000-8000-000000000000', title: 'JH 19 · w' };
  const own = `${JSON.stringify({ schema: NOTICE_SCHEMA, at: new Date(T0 - 200 * 60000).toISOString(), from: worker, to: { role: 'orchestrator', number: null }, kind: 'note', text: 'on it', cwd: CWD, worktree: CWD, branch: 'feat/x' })}\n`;
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, channel: own + handedTo(19, T0 - 50 * 60000), onSleep: busy });
  const options = [];
  deps.run = (command, args, given) => {
    if (args.includes('log')) options.push(given);
    return noGit();
  };
  assert.equal(await loopMain(['heartbeat', '--every', '120'], {}, deps), 0);
  assert.ok(options.length > 0, 'the commit was read');
  assert.ok(options.every((given) => Number.isFinite(given?.timeout) && given.timeout > 0), 'each read has a timeout');
  assert.match(state.out.at(-1), /^STALLED: JH 19 · w /);
});

test('heartbeat says once what it could not read for stall detection, so a missing STALLED line is not read as nobody', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, onSleep: busy });
  deps.readFile = (file) => {
    throw Object.assign(new Error(`EACCES: ${file}`), { code: 'EACCES' });
  };
  assert.equal(await loopMain(['heartbeat', '--max', '1', '--every', '600'], {}, deps), 1);
  // The channel and the gate log both refuse here: each is said once, not at every tick.
  const said = state.out.filter((line) => line.startsWith('stall detection could not read: '));
  assert.equal(said.filter((line) => line.includes("the channel's record")).length, 1);
  assert.equal(said.filter((line) => line.includes('the gate log')).length, 1);
  assert.equal(said.length, 2);
});
