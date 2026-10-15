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
