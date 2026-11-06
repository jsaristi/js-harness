import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { quietMain } from './quiet.mjs';
import { mainCheckout, projectSlug } from './lib/sessions.mjs';
import { RECORD_SCHEMA as STRETCH_SCHEMA, stretchFile } from './lib/stretch.mjs';

// `js-harness quiet` and `quiet --wait` (odd/tasks/quiet-machine.md), through the command's main, against a fake
// `claude` on PATH, a gate lock in a temp harness home and a process listing the test gives. The fake answers
// `agents` from a JSON file: `agents`, or `sequence`, one listing per call and the last one again after it.

const BIN = fileURLToPath(new URL('./js-harness.mjs', import.meta.url));

const FAKE = String.raw`
import fs from 'node:fs';
const file = process.env.FAKE_CLAUDE_STATE;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const argv = process.argv.slice(2);
state.calls = (state.calls ?? 0) + 1;
fs.writeFileSync(file, JSON.stringify(state));
if (argv.join(' ') !== 'agents --json --all') { process.stderr.write('fake claude: unexpected ' + argv.join(' ') + '\n'); process.exit(3); }
if (state.agentsFail) { process.stderr.write(state.agentsFail + '\n'); process.exit(1); }
const agents = state.sequence ? state.sequence[Math.min(state.calls - 1, state.sequence.length - 1)] : state.agents;
process.stdout.write(JSON.stringify(agents) + '\n');
`;

/** A temp machine: a harness home and a fake `claude` on PATH, with no session listed. */
function makeWorld() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-quiet-'));
  const world = { dir, home: path.join(dir, 'home'), shim: path.join(dir, 'shim'), state: path.join(dir, 'claude-state.json') };
  for (const folder of [world.home, world.shim]) fs.mkdirSync(folder, { recursive: true });
  const fake = path.join(world.shim, 'fake-claude.mjs');
  fs.writeFileSync(fake, FAKE);
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(world.shim, 'claude.cmd'), `@"${process.execPath}" "${fake}" %*\r\n`);
  } else {
    fs.writeFileSync(path.join(world.shim, 'claude'), `#!/bin/sh\nexec '${process.execPath}' '${fake}' "$@"\n`);
    fs.chmodSync(path.join(world.shim, 'claude'), 0o755);
  }
  setAgents(world, []);
  // A stretch open for this project, as `quiet --wait` asks one while he is away (odd/tasks/departure-stretch.md, spec 7).
  world.stretches = stretchFile(world.home, projectSlug(mainCheckout((command, args, options) => spawnSync(command, args, { ...options, encoding: 'utf8', windowsHide: true }), process.cwd())));
  fs.mkdirSync(path.dirname(world.stretches), { recursive: true });
  fs.writeFileSync(world.stretches, `${JSON.stringify({ schema: STRETCH_SCHEMA, event: 'open', id: 's1', at: '2026-10-25T11:00:00.000Z', plan: { hours: 4 } })}\n`);
  return world;
}

const writeState = (world, state) => fs.writeFileSync(world.state, JSON.stringify(state));
const setAgents = (world, agents) => writeState(world, { agents });

/** The environment of a run: this one's, with the shim first on PATH, the world's home and no session of the host. */
function envOf(world, extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^path$/i.test(key) && key !== 'JS_HARNESS_HOME' && key !== 'CLAUDE_CODE_SESSION_ID'));
  const pathValue = process.env.PATH ?? process.env.Path ?? '';
  return { ...env, PATH: `${world.shim}${path.delimiter}${pathValue}`, JS_HARNESS_HOME: world.home, FAKE_CLAUDE_STATE: world.state, ...extra };
}

/** Runs `quiet` with `argv`; `processes` is what the process listing gives (a function that throws to fail it). A
 * clock starts at `start` and moves only by the sleeps of a wait, which are recorded. */
async function quiet(world, argv, { processes = [], env = {}, start = Date.parse('2026-10-25T12:00:00Z') } = {}) {
  const out = [];
  const err = [];
  let clock = start;
  const slept = [];
  const code = await quietMain(argv, {
    env: envOf(world, env),
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
    listProcesses: typeof processes === 'function' ? processes : () => processes,
  });
  return { code, stdout: out.join('\n'), stderr: err.join('\n'), slept };
}

function withWorld(body) {
  return async () => {
    const world = makeWorld();
    try {
      await body(world);
    } finally {
      fs.rmSync(world.dir, { recursive: true, force: true });
    }
  };
}

const session = (fields) => ({ id: fields.sessionId.slice(0, 8), cwd: 'D:\\proj', kind: 'interactive', startedAt: 0, ...fields });

/** The gate lock's holder file, beaten `ageMs` before `at`, as `takeGateLock` leaves it. */
function holdLock(world, { pid = 4321, cwd = 'D:\\proj', command = 'npm run check', at = Date.now(), ageMs = 0 } = {}) {
  const dir = path.join(world.home, '.js-harness', 'gate', 'lock');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `holder-${pid}-abcdef.json`);
  fs.writeFileSync(file, `${JSON.stringify({ token: `${pid}-abcdef`, pid, cwd, command, startedAt: new Date(at - ageMs).toISOString() })}\n`);
  const beat = new Date(at - ageMs);
  fs.utimesSync(file, beat, beat);
}

/** A gate that waits for the lock, its folder touched now. */
function waitForLock(world, { pid = 5555, cwd = 'D:\\other', command = 'npm run check' } = {}) {
  const dir = path.join(world.home, '.js-harness', 'gate', `wait-${pid}-123456`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `holder-${pid}-123456.json`), `${JSON.stringify({ pid, cwd, command, waitingSince: new Date().toISOString() })}\n`);
}

const proc = (pid, commandLine) => ({ pid, createdAt: null, commandLine });

// S2: one look.

test('quiet: nothing listed, no lock, no process is quiet, exit 0', withWorld(async (world) => {
  setAgents(world, [session({ sessionId: 'aaaa1111-0', name: 'JH 3 · done', status: 'idle' }), { id: 'bbbb2222', kind: 'background', sessionId: 'bbbb2222-0', name: 'old', state: 'failed', cwd: 'D:\\proj' }]);
  const run = await quiet(world, []);
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout.split('\n')[0], /^quiet: nothing runs on this machine/);
  assert.doesNotMatch(run.stdout, /JH 3/);
}));

test('quiet: a busy session is work and is named, exit 1', withWorld(async (world) => {
  setAgents(world, [session({ sessionId: 'aaaa1111-0', name: 'JH 3 · thing', status: 'busy', cwd: 'D:\\work' })]);
  const run = await quiet(world, []);
  assert.equal(run.code, 1);
  assert.match(run.stdout.split('\n')[0], /^busy: 1 thing runs on this machine/);
  assert.match(run.stdout, /runs:\n {2}session JH 3 · thing \(aaaa1111\) busy in D:\\work/);
}));

test('quiet: a background session with no status and state working is work', withWorld(async (world) => {
  setAgents(world, [{ id: 'cccc3333', kind: 'background', sessionId: 'cccc3333-0', name: 'JH 7 · bg', state: 'working', cwd: 'D:\\proj' }]);
  const run = await quiet(world, []);
  assert.equal(run.code, 1);
  assert.match(run.stdout, /session JH 7 · bg \(cccc3333\) working in D:\\proj/);
}));

test('quiet: a waiting session needs him and is not work, exit 0', withWorld(async (world) => {
  setAgents(world, [session({ sessionId: 'dddd4444-0', name: 'JH 4 · asks', status: 'waiting', waitingFor: 'permission prompt' })]);
  const run = await quiet(world, []);
  assert.equal(run.code, 0, run.stdout);
  assert.match(run.stdout.split('\n')[0], /^quiet: nothing runs on this machine; 1 session needs you/);
  assert.match(run.stdout, /needs you:\n {2}session JH 4 · asks \(dddd4444\) waits for permission prompt in D:\\proj/);
  assert.doesNotMatch(run.stdout, /runs:/);
}));

test('quiet: --self leaves the session out, by its id or its first eight characters, and says so', withWorld(async (world) => {
  setAgents(world, [session({ sessionId: 'eeee5555-1234-4000-8000-000000000000', name: 'JH ORQ · lead', status: 'busy' })]);
  const named = await quiet(world, ['--self', 'eeee5555']);
  assert.equal(named.code, 0, named.stdout);
  assert.match(named.stdout, /left out:\n {2}session JH ORQ · lead \(eeee5555\), the session that runs this command/);
  const fromEnv = await quiet(world, [], { env: { CLAUDE_CODE_SESSION_ID: 'eeee5555-1234-4000-8000-000000000000' } });
  assert.equal(fromEnv.code, 0, fromEnv.stdout);
  const other = await quiet(world, ['--self', 'ffff6666']);
  assert.equal(other.code, 1);
}));

test('quiet: a background session started by js-harness sessions start is marked so', withWorld(async (world) => {
  const record = path.join(world.home, '.js-harness', 'background');
  fs.mkdirSync(record, { recursive: true });
  fs.writeFileSync(path.join(record, 'sessions.jsonl'), `${JSON.stringify({ schema: 'js-harness.background-session/v1', event: 'started', id: '0db8bc5e', title: 'JH 9 · bg', cwd: 'D:\\proj', root: 'D:\\proj' })}\n`);
  setAgents(world, [{ id: '0db8bc5e', kind: 'background', sessionId: '0db8bc5e-0', name: 'JH 9 · bg', status: 'busy', state: 'working', cwd: 'D:\\proj' }]);
  const run = await quiet(world, []);
  assert.equal(run.code, 1);
  assert.match(run.stdout, /session JH 9 · bg \(0db8bc5e\) busy in D:\\proj, started by js-harness sessions start/);
}));

test('quiet: the gate lock\'s live holder and a gate that waits are work; a holder that stopped beating is not', withWorld(async (world) => {
  holdLock(world, { pid: 4321, cwd: 'D:\\proj', command: 'npm run check' });
  waitForLock(world, { pid: 5555, cwd: 'D:\\other' });
  const run = await quiet(world, [], { start: Date.now() });
  assert.equal(run.code, 1);
  assert.match(run.stdout, /^busy: 2 things run/);
  assert.match(run.stdout, /gate pid 4321 holds the gate lock: npm run check in D:\\proj/);
  assert.match(run.stdout, /gate pid 5555 waits for the gate lock: npm run check in D:\\other/);
  fs.rmSync(path.join(world.home, '.js-harness', 'gate'), { recursive: true, force: true });
  holdLock(world, { ageMs: 5 * 60_000 });
  const stale = await quiet(world, [], { start: Date.now() });
  assert.equal(stale.code, 0, stale.stdout);
}));

test('quiet: a merge-queue land and a Codex review are work; a dry run and other processes are not', withWorld(async (world) => {
  const processes = [
    proc(11, '"C:\\node.exe" "D:\\js\\bin\\js-harness.mjs" merge-queue --land --refresh-copy'),
    proc(12, 'node D:\\js\\bin\\merge-queue.mjs --dry-run'),
    proc(13, '"C:\\Users\\me\\codex.exe" exec review --json --base main'),
    proc(14, 'node D:\\js\\bin\\js-harness.mjs codex-review --base abc123'),
    proc(15, 'node D:\\js\\bin\\codex-meter.mjs'),
  ];
  const run = await quiet(world, [], { processes });
  assert.equal(run.code, 1);
  assert.match(run.stdout, /^busy: 3 things run/);
  assert.match(run.stdout, /merge-queue land, pid 11: .*merge-queue --land --refresh-copy/);
  assert.match(run.stdout, /Codex review, pid 13: .*codex\.exe" exec review/);
  assert.match(run.stdout, /Codex review, pid 14: .*codex-review --base abc123/);
  assert.doesNotMatch(run.stdout, /pid 12|pid 15/);
}));

test('quiet: a process is work by what it runs, never by an argument that only names a file', withWorld(async (world) => {
  const processes = [
    proc(21, 'node D:\\js\\bin\\wait.mjs --main-file bin/codex-review.mjs --contains marker --for 720'),
    proc(22, 'node D:\\js\\bin\\wait.mjs --main-file bin/merge-queue.mjs --contains "--land" --for 60'),
    proc(23, 'node D:\\js\\bin\\js-harness.mjs merge-queue --land --dry-run'),
    proc(24, 'node D:\\js\\bin\\js-harness.mjs codex-review --base main --unavailable "codex is down"'),
    proc(25, 'git log --grep "codex exec"'),
    proc(26, '"C:\\Program Files\\nodejs\\node.exe" "C:\\Users\\me\\npm\\node_modules\\@openai\\codex\\bin\\codex.js" exec review --json'),
  ];
  const run = await quiet(world, [], { processes });
  assert.equal(run.code, 1, run.stdout);
  assert.match(run.stdout, /^busy: 1 thing runs/);
  assert.match(run.stdout, /Codex review, pid 26: /);
  assert.doesNotMatch(run.stdout, /pid 2[1-5]/);
}));

test('quiet: a listing claude could not give is unknown, never quiet, exit 3', withWorld(async (world) => {
  writeState(world, { agentsFail: 'boom' });
  const run = await quiet(world, []);
  assert.equal(run.code, 3, run.stdout);
  assert.match(run.stdout.split('\n')[0], /^unknown: nothing was seen to run, but 1 source could not be read/);
  assert.match(run.stdout, /not read:\n {2}Claude sessions: claude agents --json --all exited 1: boom/);
  const withWork = await quiet(world, [], { processes: [proc(11, 'node merge-queue.mjs --land')] });
  assert.equal(withWork.code, 1);
}));

test('quiet: no claude on PATH and a process listing that fails are unknown', withWorld(async (world) => {
  const empty = path.join(world.dir, 'empty');
  fs.mkdirSync(empty);
  const run = await quiet(world, [], { env: { PATH: empty }, processes: () => { throw new Error('powershell gave up'); } });
  assert.equal(run.code, 3);
  assert.match(run.stdout, /Claude sessions: claude is not on PATH/);
  assert.match(run.stdout, /processes: powershell gave up/);
}));

test('quiet --json gives the same look as data', withWorld(async (world) => {
  setAgents(world, [
    session({ sessionId: 'aaaa1111-0', name: 'JH 3 · thing', status: 'busy' }),
    session({ sessionId: 'dddd4444-0', name: 'JH 4 · asks', status: 'waiting', waitingFor: 'permission prompt' }),
  ]);
  const run = await quiet(world, ['--json']);
  assert.equal(run.code, 1);
  const look = JSON.parse(run.stdout);
  assert.equal(look.state, 'busy');
  assert.deepEqual(look.work.map((item) => [item.source, item.sessionId]), [['session', 'aaaa1111-0']]);
  assert.deepEqual(look.needsYou.map((item) => [item.sessionId, item.waitingFor]), [['dddd4444-0', 'permission prompt']]);
  assert.deepEqual(look.unread, []);
  assert.equal(look.at, '2026-10-25T12:00:00.000Z');
}));

// S3: the wait.

const busyOne = [session({ sessionId: 'aaaa1111-0', name: 'JH 3 · thing', status: 'busy' })];
const asking = [session({ sessionId: 'dddd4444-0', name: 'JH 4 · asks', status: 'waiting', waitingFor: 'permission prompt' })];

// 1a of odd/tasks/departure-stretch.md: the wait runs only while he is away, so it asks the stretch of his absence.
// On 2026-10-31 at 03:25Z the lead started it with no stretch open (its relief file, line 2050).

test('quiet --wait with no stretch open refuses, exit 4, naming stretch open and --no-stretch, and looks at nothing', withWorld(async (world) => {
  fs.rmSync(world.stretches);
  const run = await quiet(world, ['--wait', '--settle', '0']);
  assert.equal(run.code, 4, run.stdout);
  assert.match(run.stderr, /no stretch is open/);
  assert.ok(run.stderr.includes('js-harness stretch open --plan <file> --html <file>'), run.stderr);
  assert.match(run.stderr, /--no-stretch <reason>/);
  assert.match(run.stderr, /rule:away-autonomy/);
  assert.deepEqual(run.slept, []);
  assert.equal(JSON.parse(fs.readFileSync(world.state, 'utf8')).calls ?? 0, 0, 'claude was not asked');
  // A record whose last stretch was closed holds none open.
  fs.writeFileSync(world.stretches, [
    JSON.stringify({ schema: STRETCH_SCHEMA, event: 'open', id: 's1', at: '2026-10-25T08:00:00.000Z', plan: { hours: 2 } }),
    JSON.stringify({ schema: STRETCH_SCHEMA, event: 'close', id: 's1', at: '2026-10-25T10:00:00.000Z' }),
  ].join('\n'));
  assert.equal((await quiet(world, ['--wait', '--settle', '0'])).code, 4);
}));

test('quiet --wait --no-stretch <reason> waits with none open and says the reason; one look needs no stretch', withWorld(async (world) => {
  fs.rmSync(world.stretches);
  const run = await quiet(world, ['--wait', '--settle', '0', '--no-stretch', 'he only went for lunch']);
  assert.equal(run.code, 0, run.stderr);
  assert.match(run.stdout, /no stretch open: he only went for lunch/);
  assert.equal((await quiet(world, [])).code, 0, 'one look is no wait');
  assert.equal((await quiet(world, ['--no-stretch', 'x'])).code, 2, '--no-stretch goes with --wait');
}));

test('quiet --wait with a stretch record it cannot read refuses and says why', withWorld(async (world) => {
  fs.rmSync(world.stretches);
  fs.mkdirSync(world.stretches);
  const run = await quiet(world, ['--wait', '--settle', '0']);
  assert.equal(run.code, 4);
  assert.match(run.stderr, /stretch record .* cannot be read/);
}));

test('quiet --wait ends once the machine stayed quiet for the settle time, and says what it saw', withWorld(async (world) => {
  writeState(world, { sequence: [busyOne, asking] });
  const run = await quiet(world, ['--wait', '--settle', '2', '--every', '60']);
  assert.equal(run.code, 0, run.stdout);
  // Busy at 0 s, quiet from 60 s, settled at 180 s: three sleeps of a minute.
  assert.deepEqual(run.slept, [60000, 60000, 60000]);
  const lines = run.stdout.split('\n');
  assert.match(lines[0], /^js-harness quiet --wait: waits until nothing has run on this machine for 2 minutes, looking every 60 seconds; ends then, or after 720 minutes; stop it with TaskStop/);
  // Quiet from the look at 60 s to the one at 180 s: the two minutes measured, not the settle given.
  assert.match(run.stdout, /js-harness quiet --wait: nothing has run on this machine since \d\d:\d\d, 2 minutes \(4 looks\); the PC can be turned off/);
  assert.match(run.stdout, /last work seen: session JH 3 · thing \(aaaa1111\) busy in D:\\proj/);
  assert.match(run.stdout, /needs you:\n {2}session JH 4 · asks \(dddd4444\) waits for permission prompt/);
}));

test('quiet --wait counts the settle again after a look that could not read a source', withWorld(async (world) => {
  let looks = 0;
  const processes = () => {
    looks += 1;
    if (looks === 2) throw new Error('listing failed');
    return [];
  };
  const run = await quiet(world, ['--wait', '--settle', '1', '--every', '60'], { processes });
  assert.equal(run.code, 0, run.stdout);
  // Quiet at 0 s, unknown at 60 s, quiet from 120 s, settled at 180 s.
  assert.deepEqual(run.slept, [60000, 60000, 60000]);
  assert.match(run.stdout, /no work was seen since the wait began/);
}));

test('quiet --wait --settle 0 ends at the first quiet look', withWorld(async (world) => {
  const run = await quiet(world, ['--wait', '--settle', '0']);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.slept, []);
  assert.match(run.stdout, /needs you: nothing/);
}));

test('quiet --wait ends with exit 1 after --for minutes with no settle, with the last look', withWorld(async (world) => {
  setAgents(world, busyOne);
  const run = await quiet(world, ['--wait', '--for', '3', '--every', '60', '--json']);
  assert.equal(run.code, 1);
  assert.deepEqual(run.slept, [60000, 60000, 60000]);
  // With --json the whole of stdout is the JSON; the line that says what it waits for goes to stderr.
  const result = JSON.parse(run.stdout);
  assert.match(run.stderr, /^js-harness quiet --wait: waits until nothing has run/);
  assert.equal(result.settled, false);
  assert.equal(result.looks, 4);
  assert.equal(result.look.state, 'busy');
}));

test('quiet: usage errors exit 2 and print the usage', withWorld(async (world) => {
  for (const argv of [['--nope'], ['--settle', '3'], ['--wait', '--for', 'abc'], ['--wait', '--every', '0'], ['--self', 'abc']]) {
    const run = await quiet(world, argv);
    assert.equal(run.code, 2, argv.join(' '));
    assert.match(run.stderr, /Usage: js-harness quiet/);
  }
}));

test('js-harness quiet --help prints the usage and runs nothing', () => {
  const result = spawnSync(process.execPath, [BIN, 'quiet', '--help'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: js-harness quiet \[--json\]/);
  assert.match(result.stdout, /--wait/);
});
