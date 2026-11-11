import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loopMain } from './loop.mjs';
import { gateLogDir } from './lib/gate-log.mjs';
import { NOTICE_SCHEMA, recordPath } from './lib/channel.mjs';
import { projectSlug } from './lib/sessions.mjs';
import { loopsFolder, readRecords } from './lib/loops.mjs';
import { RECORD_SCHEMA as STRETCH_SCHEMA, stretchFile } from './lib/stretch.mjs';

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
    // The daily Windows run is read only where a test asks for it: no other body here reaches GitHub.
    windowsDaily: async () => null,
    // So is the throughput tick: no body here writes a snapshot.
    throughputTick: async () => null,
    // And the host watch's reading: no body here reads the app's versions.
    hostWatch: async () => null,
    readdir: (dir) => Object.keys(state.files).filter((file) => path.dirname(file) === dir).map((file) => path.basename(file)),
    mtime: (file) => {
      if (state.files[file] === undefined) throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
      return state.files[file];
    },
    readFile: (file) => {
      if (state.marks?.[file] !== undefined) return state.marks[file];
      if (file !== CHANNEL || state.channel === '') throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
      return state.channel;
    },
    // The cut's mark (F8 S7): kept in memory, read back by readFile.
    writeFile: (file, text) => {
      state.marks = { ...state.marks, [file]: text };
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

// odd/tasks/workshop-product-split.md, slice 1+2: the three ticks serve only the harness's own repository, so they
// are the workshop's, and the product's heartbeat given none runs none of them.
test('heartbeat given no tick runs none: the product has no default for the Windows, throughput and host ticks', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 - 3600000, [CHANNEL]: T0 - 7200000 } });
  const { windowsDaily, throughputTick, hostWatch, ...product } = deps;
  assert.deepEqual([typeof windowsDaily, typeof throughputTick, typeof hostWatch], ['function', 'function', 'function']);
  const code = await loopMain(['heartbeat', '--quiet', '30', '--every', '120', '--windows', '60'], {}, product);
  assert.equal(code, 0);
  assert.equal(state.out.at(-1), `STALL: no gate-log or channel write since ${hour(T0)}`);
  assert.deepEqual(state.out.filter((line) => /windows-daily|host-watch|throughput/.test(line)), [], 'no tick said anything, nor failed');
});

test('heartbeat given --windows and no Windows tick says once that the option reads nothing here, and ends as before', async () => {
  // The product's loop shares its usage with the workshop's, so the option is still taken; one given in vain is said, not
  // dropped in silence (the lens review of 6c1bc8e..f78479a).
  for (const [argv, said] of [[['--windows', '60'], 1], [[], 0], [['--windows', '0'], 0]]) {
    const { state, deps } = world({ files: { [GATE_LOG]: T0 - 3600000, [CHANNEL]: T0 - 7200000 } });
    const { windowsDaily, throughputTick, hostWatch, ...product } = deps;
    assert.equal(await loopMain(['heartbeat', '--quiet', '30', '--every', '120', ...argv], {}, product), 0, argv.join(' '));
    const lines = state.out.filter((line) => /^--windows /.test(line));
    assert.equal(lines.length, said, argv.join(' '));
    if (said) assert.equal(lines[0], '--windows reads nothing here: the daily Windows run is read by the workshop\'s loop (node workshop/js-harness-workshop.mjs loop heartbeat), not the product\'s');
    assert.equal(state.out.at(-1), `STALL: no gate-log or channel write since ${hour(T0)}`);
  }
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

// odd/tasks/commit-gates-first.md, S5: the heartbeat reads the daily Windows run, and a red one told now ends it.
test('heartbeat ends with the WINDOWS line when the daily Windows run is told red, after what the reader found', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, onSleep: busy });
  const asked = [];
  deps.windowsDaily = async (options) => {
    asked.push(options);
    return asked.length < 3 ? { lines: ['windows-daily: the newest run, u, passed (ended 2 h ago)'], told: null, failed: null } : { lines: ['windows-daily: the newest run, v, failed'], told: 'WINDOWS: v failure, 2 failing: a; b', failed: null };
  };
  assert.equal(await loopMain(['heartbeat', '--every', '120', '--windows', '30'], {}, deps), 0);
  assert.equal(state.out.at(-1), 'WINDOWS: v failure, 2 failing: a; b');
  assert.equal(state.out.at(-2), 'windows-daily: the newest run, v, failed');
  assert.equal(state.out.filter((line) => line.includes(', u, passed')).length, 1, 'a line already said is not said again');
  assert.equal(asked[0].home, HOME);
  assert.equal(asked[0].cwd, CWD);
  assert.equal(asked[0].slug, projectSlug(CWD));
  assert.equal(asked[0].everyMs, 30 * 60000);
  assert.equal(state.clock, T0 + 2 * 120000, 'it asks at the first tick and at each one after');
  assert.match(state.out[0], /every 30 minutes, the daily Windows run/);
});

test('heartbeat: --windows 0 never reads the daily Windows run, and a value that is no whole number is a usage error', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 - 3600000 } });
  let asked = 0;
  deps.windowsDaily = async () => {
    asked += 1;
    return null;
  };
  assert.equal(await loopMain(['heartbeat', '--windows', '0'], {}, deps), 0);
  assert.equal(asked, 0);
  assert.match(state.out.at(-1), /^STALL: /);
  assert.doesNotMatch(state.out[0], /Windows/);
  for (const bad of ['soon', '-1', '1.5']) {
    const { state: other, deps: otherDeps } = world();
    assert.equal(await loopMain(['heartbeat', '--windows', bad], {}, otherDeps), 2, bad);
    assert.match(other.err.join('\n'), /--windows/);
  }
});

test('heartbeat: a reader that throws is said once and ends nothing', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, onSleep: busy });
  deps.windowsDaily = async () => {
    throw new Error('gh vanished');
  };
  assert.equal(await loopMain(['heartbeat', '--max', '1', '--every', '600'], {}, deps), 1);
  assert.equal(state.out.filter((line) => line.includes('gh vanished')).length, 1);
});

// odd/tasks/f8-s9-host-watch.md, S4: the heartbeat reads the host every hour, and names the session an update needs.
test('heartbeat ends with the HOST line when an update has no host watch session, and says a reading that throws once', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, onSleep: busy });
  const asked = [];
  deps.hostWatch = async (options) => {
    asked.push(options);
    if (asked.length === 1) throw new Error('the app folder vanished');
    return asked.length < 3 ? { lines: ['host-watch: Claude Desktop 4.1.0 → 4.2.0 is held by "JH 7 · host watch 4.2.0"'], told: null } : { lines: [], told: 'HOST: Claude Desktop 4.2.0 → 4.3.0 since the last review, and no host watch session holds it: open "JH 8 · host watch 4.3.0"' };
  };
  assert.equal(await loopMain(['heartbeat', '--every', '120'], {}, deps), 0);
  assert.match(state.out.at(-1), /^HOST: Claude Desktop 4.2.0 → 4.3.0 /);
  assert.equal(state.out.filter((line) => line.includes('the app folder vanished')).length, 1);
  assert.equal(state.out.filter((line) => line.includes('is held by')).length, 1);
  assert.deepEqual([asked[0].home, asked[0].slug, asked[0].cwd, asked[0].everyMs], [HOME, projectSlug(CWD), CWD, 60 * 60000]);
  assert.match(state.out[0], /every hour, the host's versions are read/);
});

const DUE_AT = T0 + 10 * 60000;
const DUE = { id: 'review 2026-10-14', at: new Date(DUE_AT).toISOString(), line: 'DUE: throughput review of 2026-10-14: js-harness throughput --since 2026-10-14' };

test('heartbeat ends with the DUE line when a throughput review falls due, and a relaunch is woken again only as the wait doubles', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, onSleep: busy });
  const asked = [];
  deps.throughputTick = async (options) => {
    asked.push(options);
    return { lines: [], dues: options.now >= DUE_AT ? [DUE] : [] };
  };
  assert.equal(await loopMain(['heartbeat', '--every', '120'], {}, deps), 0);
  assert.equal(state.out.at(-1), DUE.line);
  assert.equal(state.clock, T0 + 10 * 60000, 'it ends at the first tick the review is due');
  assert.equal(asked[0].home, HOME);
  assert.equal(asked[0].cwd, CWD);
  assert.equal(asked[0].slug, projectSlug(CWD));
  assert.equal(asked[0].now, T0);
  assert.equal(asked.at(-1).skip, asked[0].skip, 'the days the gate log does not hold are remembered across ticks');

  // Relaunched 20 minutes later: named at the start, and ended again at one hour due (then three, then seven).
  state.clock = DUE_AT + 20 * 60000;
  state.out = [];
  assert.equal(await loopMain(['heartbeat', '--every', '120'], {}, deps), 0);
  assert.equal(state.out.filter((line) => /^already due: throughput review of 2026-10-14, since \d\d:\d\d$/.test(line)).length, 1);
  assert.equal(state.out.at(-1), DUE.line);
  assert.equal(state.clock, DUE_AT + 60 * 60000);
  state.out = [];
  assert.equal(await loopMain(['heartbeat', '--every', '600'], {}, deps), 0);
  assert.equal(state.clock, DUE_AT + 3 * 60 * 60000);
});

test('heartbeat: every line that ends it is followed by the open DUE lines', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 - 3600000 } });
  deps.throughputTick = async () => ({ lines: [], dues: [{ ...DUE, at: new Date(T0 - 2 * 3600000).toISOString() }] });
  assert.equal(await loopMain(['heartbeat', '--quiet', '30', '--every', '120'], {}, deps), 0);
  assert.equal(state.out.at(-2), `STALL: no gate-log or channel write since ${hour(T0)}`);
  assert.equal(state.out.at(-1), DUE.line);
});

test('heartbeat says once each what the throughput tick said or could not do, and a tick that throws never ends it', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, onSleep: busy });
  let ticks = 0;
  deps.throughputTick = async () => {
    ticks += 1;
    if (ticks % 2 === 0) throw new Error('disk gone');
    return { lines: ['throughput: kept 2026-10-14'], dues: [] };
  };
  assert.equal(await loopMain(['heartbeat', '--max', '1', '--every', '600'], {}, deps), 1);
  assert.equal(state.out.filter((line) => line === 'throughput: kept 2026-10-14').length, 1);
  assert.equal(state.out.filter((line) => line === 'throughput: the tick failed (disk gone)').length, 1);
  assert.ok(ticks > 3);
});

// F8 S7 (odd/tasks/f8-s7-topology.md, spec 1): the lead is cut after its second compaction. The heartbeat reads the
// transcript of the session that runs it, from where it last read, and ends with a CUT line when a compaction brings
// the count to two or more. A cut already due at its start ends it once, with a mark in a folder under the loop records, and a
// relaunch after that names it and waits for another compaction, so a lead that restarts its loops never spins.
const TRANSCRIPT = path.join(HOME, '.claude', 'projects', projectSlug(CWD), `${OWNER}.jsonl`);
const boundary = (sidechain = false) => `${JSON.stringify({ type: 'system', subtype: 'compact_boundary', isSidechain: sidechain, compactMetadata: { trigger: 'auto', preTokens: 467000, postTokens: 9000 } })}\n`;
const CUT_MARK = path.join(loopsFolder(HOME, projectSlug(CWD)), 'cuts', `${OWNER}.json`);
const turn = `${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'compact_boundary is a word here' }] } })}\n`;

/** A fake of the transcript's tail reader over `state.transcript`: whole lines only, from the byte `start`. */
function tailOf(state, at = TRANSCRIPT) {
  return (file, start) => {
    state.tails = (state.tails ?? 0) + 1;
    if (file !== at || state.transcript === undefined) throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    const rest = state.transcript.slice(start);
    const whole = rest.slice(0, rest.lastIndexOf('\n') + 1);
    return { text: whole, end: start + whole.length };
  };
}

test('heartbeat ends with the CUT line when a compaction brings the session it runs in to two', async () => {
  let added = false;
  const { state, deps } = world({
    files: { [GATE_LOG]: T0 },
    onSleep: (s) => {
      busy(s);
      if (!added && s.clock >= T0 + 10 * 60000) {
        s.transcript += boundary();
        added = true;
      }
    },
  });
  state.transcript = turn + boundary() + boundary(true) + turn;
  deps.readTail = tailOf(state);
  assert.equal(await loopMain(['heartbeat', '--every', '120'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps), 0);
  assert.match(state.out.at(-1), /^CUT: this session has been compacted 2 times since it started: /);
  assert.match(state.out.at(-1), /js-harness-orchestrator/);
  assert.match(state.out[0], /the lead's cut after 2 compactions/);
  assert.equal(state.out.filter((line) => line.startsWith('already due: the lead')).length, 0);
});

test('heartbeat: a cut already due at its start ends it once; a relaunch names it and waits for another compaction', async () => {
  let grow = false;
  const { state, deps } = world({
    files: { [GATE_LOG]: T0 },
    onSleep: (s) => {
      busy(s);
      if (grow && s.clock >= T0 + 30 * 60000 && !s.transcript.endsWith(boundary())) s.transcript += boundary();
    },
  });
  state.transcript = boundary() + boundary() + boundary() + turn;
  deps.readTail = tailOf(state);
  const env = { CLAUDE_CODE_SESSION_ID: OWNER };
  assert.equal(await loopMain(['heartbeat', '--every', '120'], env, deps), 0);
  assert.equal(state.clock, T0, 'the cut due at the start ends the first heartbeat at once');
  assert.match(state.out.at(-1), /^CUT: this session has been compacted 3 times since it started: /);

  state.out = [];
  grow = true;
  assert.equal(await loopMain(['heartbeat', '--every', '120'], env, deps), 0);
  assert.deepEqual(state.out.filter((line) => line.startsWith('already due: the lead')), ["already due: the lead's cut, 3 compactions in this session, told before"]);
  assert.match(state.out.at(-1), /^CUT: this session has been compacted 4 times since it started: /);
  assert.ok(state.clock >= T0 + 30 * 60000, 'the relaunch was not woken by the cut it was already told');
  // The mark is not a loop record: loop status reads every .json entry of the loops folder as one.
  const marks = Object.keys(state.marks);
  assert.deepEqual(marks, [CUT_MARK]);
  const loops = loopsFolder(HOME, projectSlug(CWD));
  const entries = marks.filter((mark) => path.dirname(mark) === loops).map((mark) => path.basename(mark));
  assert.deepEqual(readRecords(loops, { readdir: () => entries, readFile: (mark) => state.marks[mark] }), [], 'loop status lists no cut mark');
});

test('heartbeat: a transcript unreadable at its start and readable later does not tell again a cut already told', async () => {
  let readable = false;
  const { state, deps } = world({
    files: { [GATE_LOG]: T0 },
    onSleep: (s) => {
      busy(s);
      readable = s.clock >= T0 + 10 * 60000;
    },
  });
  state.marks = { [CUT_MARK]: `${JSON.stringify({ told: 3 })}\n` };
  state.transcript = boundary() + boundary() + boundary() + turn;
  const tail = tailOf(state);
  deps.readTail = (file, start) => {
    if (!readable) throw Object.assign(new Error('EBUSY: the transcript is held'), { code: 'EBUSY' });
    return tail(file, start);
  };
  assert.equal(await loopMain(['heartbeat', '--max', '1', '--every', '600'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps), 1);
  assert.equal(state.out.filter((line) => line.startsWith('CUT:')).length, 0, 'the cut told at 3 is not told again');
  assert.ok(state.tails > 3);
});

test('heartbeat finds the transcript of a session opened in a worktree under that worktree\'s folder', async () => {
  const main = path.resolve('loop-bodies-main');
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, onSleep: busy });
  deps.run = (command, args) => (args.includes('--git-common-dir') ? { status: 0, stdout: `${path.join(main, '.git')}\n`, stderr: '' } : noGit());
  // The main checkout's folder holds no transcript of this session; the worktree's does.
  deps.mtime = (file) => {
    if (file === TRANSCRIPT) return T0;
    if (state.files[file] === undefined) throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    return state.files[file];
  };
  state.transcript = boundary() + boundary();
  deps.readTail = tailOf(state);
  assert.notEqual(projectSlug(main), projectSlug(CWD));
  assert.equal(await loopMain(['heartbeat', '--every', '120'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps), 0);
  assert.match(state.out.at(-1), /^CUT: this session has been compacted 2 times/);
});

test('heartbeat says once that it could not read the transcript for the cut, and never ends on it', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, onSleep: busy });
  deps.readTail = tailOf(state);
  assert.equal(await loopMain(['heartbeat', '--max', '1', '--every', '600'], { CLAUDE_CODE_SESSION_ID: OWNER }, deps), 1);
  assert.equal(state.out.filter((line) => line.startsWith("the lead's cut could not read")).length, 1);
  assert.ok(state.tails > 3, 'it keeps trying each tick');
});

test('heartbeat run outside a session reads no transcript for the cut', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 - 3600000, [CHANNEL]: T0 - 7200000 } });
  deps.readTail = tailOf(state);
  assert.equal(await loopMain(['heartbeat', '--quiet', '30', '--every', '120'], {}, deps), 0);
  assert.equal(state.tails, undefined);
  assert.doesNotMatch(state.out[0], /cut/);
  assert.doesNotMatch(state.out[0], /last wrote/);
});

// odd/tasks/departure-control.md, specs 1 and 3: `stretch-not-opened` was turned back at his return, after the time
// away it is about. The heartbeat is alive while he is away and its end wakes the lead, so each tick reads when he last
// wrote to the session it runs in, and ends with an AWAY line once that is longer ago than the return check's absence
// (two hours) with no stretch covering the time since. Told once an absence, its mark kept beside the cut's.
const ENV = { CLAUDE_CODE_SESSION_ID: OWNER };
const HOUR = 3600000;
const AWAY_MARK = path.join(loopsFolder(HOME, projectSlug(CWD)), 'away', `${OWNER}.json`);
const STRETCHES = stretchFile(HOME, projectSlug(CWD));
const iso = (ms) => new Date(ms).toISOString();
const his = (at) => `${JSON.stringify({ type: 'user', timestamp: iso(at), origin: { kind: 'human' }, message: { role: 'user', content: 'sigue' } })}\n`;
const question = (at) => `${JSON.stringify({ type: 'assistant', timestamp: iso(at), message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_q', name: 'AskUserQuestion', input: { questions: [{ question: 'Pregunta 255: ¿uno el PR 812?', options: [{ label: 'Sí' }, { label: 'No' }] }] } }] } })}\n`;
const stretchOpened = (at) => `${JSON.stringify({ schema: STRETCH_SCHEMA, event: 'open', id: iso(at), at: iso(at), plan: { hours: 4 } })}\n`;
const awayLines = (state) => state.out.filter((line) => line.startsWith('AWAY:'));
// Who the lead is, is the return check's rule: the newest notice the session sent carries the lead's title.
const LEADS = notice({ at: T0 - 4 * HOUR, id: OWNER, title: 'JH ORQ · lead' });

test('heartbeat ends with the AWAY line when he last wrote to its session two hours ago and no stretch covers the time since', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, channel: LEADS, onSleep: busy });
  state.transcript = turn + his(T0 - HOUR);
  deps.readTail = tailOf(state);
  assert.equal(await loopMain(['heartbeat', '--every', '120'], ENV, deps), 0);
  assert.equal(state.clock, T0 + HOUR + 120000, 'the first tick after the gap is longer than two hours');
  assert.match(state.out.at(-1), /^AWAY: the user last wrote to this session at \d\d:\d\d, local time \(UTC[+-]\d\d:\d\d\), 2\.0 hours ago, and no stretch covers the time since/);
  assert.ok(state.out.at(-1).includes('js-harness stretch open --plan <file> --html <file>'));
  assert.match(state.out[0], /each tick reads when the user last wrote to this session, and 2 hours with no message and no stretch covering them end it/);
  assert.deepEqual(JSON.parse(state.marks[AWAY_MARK]), { told: iso(T0 - HOUR), at: iso(T0 + HOUR + 120000), heldSince: null });
});

test('heartbeat: an absence in course at its start ends it once; a relaunch names it and goes on, and his next absence is told again', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, channel: LEADS, onSleep: busy });
  state.transcript = his(T0 - 3 * HOUR);
  deps.readTail = tailOf(state);
  assert.equal(await loopMain(['heartbeat', '--every', '120'], ENV, deps), 0);
  assert.equal(state.clock, T0, 'the absence in course ends the first heartbeat at once');
  assert.equal(awayLines(state).length, 1);

  state.out = [];
  assert.equal(await loopMain(['heartbeat', '--max', '1', '--every', '600'], ENV, deps), 1);
  assert.deepEqual(awayLines(state), [], 'the relaunch is not woken by the absence it was told');
  assert.equal(state.out.filter((line) => /^already told: the user's absence since \d\d:\d\d, with no stretch covering it$/.test(line)).length, 1);

  state.out = [];
  const again = state.clock;
  state.transcript += his(again);
  assert.equal(await loopMain(['heartbeat', '--every', '600'], ENV, deps), 0);
  assert.equal(awayLines(state).length, 1);
  assert.equal(state.clock, again + 2 * HOUR + 600000);
  assert.equal(JSON.parse(state.marks[AWAY_MARK]).told, iso(again));
  // The mark is not a loop record: loop status reads every .json entry of the loops folder as one.
  const loops = loopsFolder(HOME, projectSlug(CWD));
  assert.deepEqual(Object.keys(state.marks).filter((mark) => path.dirname(mark) === loops), []);
});

test('heartbeat tells nothing while a stretch covers his absence, and says once a stretch record it cannot read', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, channel: LEADS, onSleep: busy });
  state.transcript = his(T0 - 3 * HOUR);
  state.marks = { [STRETCHES]: stretchOpened(T0 - HOUR) };
  deps.readTail = tailOf(state);
  assert.equal(await loopMain(['heartbeat', '--max', '1', '--every', '600'], ENV, deps), 1);
  assert.deepEqual(awayLines(state), []);
  assert.equal(state.marks[AWAY_MARK], undefined, 'nothing told, nothing marked');

  state.out = [];
  const read = deps.readFile;
  deps.readFile = (file) => {
    if (file === STRETCHES) throw Object.assign(new Error('EACCES: the record is held'), { code: 'EACCES' });
    return read(file);
  };
  assert.equal(await loopMain(['heartbeat', '--max', '1', '--every', '600'], ENV, deps), 1);
  assert.deepEqual(awayLines(state), [], 'an absence it cannot check is not told');
  assert.equal(state.out.filter((line) => line.startsWith('the user\'s absence could not be read: the stretch record')).length, 1);
});

test('heartbeat: a question on his screen is said in the AWAY line, since the session it holds can open no stretch', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, channel: LEADS, onSleep: busy });
  state.transcript = his(T0 - 3 * HOUR) + question(T0 - 3 * HOUR + 60000);
  deps.readTail = tailOf(state);
  assert.equal(await loopMain(['heartbeat', '--every', '120'], ENV, deps), 0);
  assert.match(state.out.at(-1), /^AWAY: .*The question tool has held this session since \d\d:\d\d/);
  assert.equal(JSON.parse(state.marks[AWAY_MARK]).heldSince, iso(T0 - 3 * HOUR + 60000));
});

test('heartbeat: an absence that starts in the tick of a STALL is told with it, in one ending', async () => {
  // Nothing writes: the STALL falls due at T0 + 30 minutes, the tick his silence becomes longer than two hours.
  const { state, deps } = world({ files: { [GATE_LOG]: T0 - HOUR }, channel: LEADS });
  state.transcript = his(T0 - 2 * HOUR + 30 * 60000 - 1);
  deps.readTail = tailOf(state);
  assert.equal(await loopMain(['heartbeat', '--quiet', '30', '--every', '120'], ENV, deps), 0);
  assert.equal(state.clock, T0 + 30 * 60000);
  assert.match(state.out.at(-2), /^AWAY: /);
  assert.equal(state.out.at(-1), `STALL: no gate-log or channel write since ${hour(T0)}`);
});


test('heartbeat tells no work session, nor a session whose notices cannot be read: only the lead is asked for a stretch', async () => {
  const { state, deps } = world({ files: { [GATE_LOG]: T0 }, channel: notice({ at: T0 - 4 * HOUR, id: OWNER, title: 'JH 5 · canal' }), onSleep: busy });
  state.transcript = his(T0 - 3 * HOUR);
  deps.readTail = tailOf(state);
  assert.equal(await loopMain(['heartbeat', '--max', '1', '--every', '600'], ENV, deps), 1);
  assert.deepEqual(awayLines(state), []);
  assert.equal(state.marks?.[AWAY_MARK], undefined);

  state.out = [];
  state.channel = '';
  assert.equal(await loopMain(['heartbeat', '--max', '1', '--every', '600'], ENV, deps), 1);
  assert.deepEqual(awayLines(state), [], 'a session that sent no notice is no lead');
});
