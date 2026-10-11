import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GATE_NOT_RUN, commandLineOf, gateMain } from './gate.mjs';
import { gateDir, readGateHolder, takeGateLock } from './lib/gate-lock.mjs';
import { appendGateEvent, gateLogDir, gatesOf, readGateLog } from './lib/gate-log.mjs';

// `js-harness gate -- <command>` runs any command under the machine's gate lock, for the heavy runs that
// are not a commit's gate. The lock itself is tested in lib/gate-lock.test.mjs and what `check` does with
// it in check.test.mjs; here, what `gate` does with it. Every test has a temporary home, so none can take
// the lock of this machine's real gates, nor wait for one.

const dispatcher = path.join(path.dirname(fileURLToPath(import.meta.url)), 'js-harness.mjs');

/** A temporary folder by its real path: where the temporary folder sits behind a symlink (macOS, `/var`
 * to `/private/var`), a process started in it says the real one for its folder. */
function makeTmpDir() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-gate-')));
}

/** A home for the lock and a folder to run in, and their removal. */
function withHome(run) {
  return async () => {
    const home = makeTmpDir();
    const dir = makeTmpDir();
    try {
      await run(home, dir);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

/** A stand-in for the runner of the command: it keeps what it was asked, and answers `status`. */
function ranWith(status = 0, during = () => {}) {
  const spawned = async (commandLine, options) => {
    spawned.asked.push({ commandLine, ...options });
    await during();
    return { status, signal: null, stdout: '', stderr: '' };
  };
  spawned.asked = [];
  return spawned;
}

/** What the sampler of `runGate` reads: a machine with under one logical processor busy, of which a gate
 * says nothing. */
const QUIET_LOAD = { busy: 0.4, processors: 8, share: 0.05, sampleMs: 1000 };

/** Runs `gateMain` and captures what it said on stderr, which is all it says itself. A run that hands it
 * no sampler of the load (`deps.sampleLoad`) is given one that answers `QUIET_LOAD` at once, so no test
 * here waits a second for a sample or reads this machine. And one that hands it no look for the busiest
 * processes (`deps.busiest`) is given one that finds nobody at once, so no test starts PowerShell for it,
 * whatever its sampler says. */
async function runGate(argv, env = {}, deps = {}) {
  const said = [];
  const originalError = console.error;
  console.error = (line) => said.push(String(line));
  try {
    const code = await gateMain(argv, env, { sampleLoad: async () => QUIET_LOAD, busiest: async () => [], ...deps });
    return { code, said };
  } finally {
    console.error = originalError;
  }
}

/** A clock a test moves, and the real lock on it: `sleep` moves the clock and waits for nothing. */
function gateClock() {
  let at = Math.floor(Date.now() / 1000) * 1000;
  const clock = {
    onSleep: undefined,
    now: () => at,
    sleep: async (ms) => {
      at += ms;
      await clock.onSleep?.();
    },
    take: (options) => takeGateLock({ ...options, now: clock.now, sleep: clock.sleep, beatMs: 0 }),
  };
  return clock;
}

const USAGE = 'Usage: js-harness gate [--wait <minutes> | --no-wait] [--home <path>] [--cwd <path>] -- <command> [args...]\n       js-harness gate log [--last <n>] [--home <path>]';

/** What a `gate` started with the mark of a held gate lock says, as `check` says it in a row. */
const IN_TURN = "gate: the command runs in the turn of the process that started this gate, which holds the machine's gate lock (JS_HARNESS_GATE_HELD=1), so this gate takes none";

/** Why `gate` refuses, on Windows, the argument at `position` among several: `what` is what it holds. */
const cannotHand = (position, what) => `cmd.exe cannot be handed argument ${position} after -- whole: it holds ${what}; give the whole command as one argument after --, written as cmd.exe reads it`;
const QUOTE = 'a double quote, which ends the quotes around it';
const PERCENT = 'a percent sign, which is expanded as a variable even inside quotes';

test('gate runs the command in its folder, in the environment it was given, and its exit code is the command\'s', withHome(async (home, dir) => {
  for (const status of [0, 7]) {
    const spawned = ranWith(status);
    const env = { PATH: 'made-up', MINE: 'yes' };
    const { code, said } = await runGate(['--home', home, '--cwd', dir, '--', 'node', '--test'], env, { spawn: spawned });
    assert.equal(code, status);
    assert.deepEqual(said, []);
    assert.equal(spawned.asked.length, 1);
    const [{ commandLine, cwd, env: given, timeout, inherit }] = spawned.asked;
    assert.deepEqual([commandLine, cwd, timeout, inherit], ['node --test', dir, 0, true]);
    // Not a sensor: no throwaway home, and nothing that says "inside a gate" to what it runs. One thing is
    // added, the mark of the lock this process holds while the command runs.
    assert.deepEqual(given, { ...env, JS_HARNESS_GATE_HELD: '1' });
  }
}));

test('gate gives its command the mark of a held gate lock only when it holds the lock: not when it runs without it, nor inside a gate', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  const given = async (env, deps = {}) => {
    const spawned = ranWith(0);
    await runGate(argv, env, { spawn: spawned, ...deps });
    return spawned.asked[0].env;
  };
  assert.deepEqual(await given({ MINE: 'yes' }), { MINE: 'yes', JS_HARNESS_GATE_HELD: '1' });
  // A value that is no mark is replaced by the mark, once the lock is held.
  assert.deepEqual(await given({ JS_HARNESS_GATE_HELD: '0' }), { JS_HARNESS_GATE_HELD: '1' });
  const refuses = async () => {
    throw Object.assign(new Error("EPERM: operation not permitted, mkdir 'somewhere'"), { code: 'EPERM' });
  };
  assert.deepEqual(await given({ MINE: 'yes' }, { takeGateLock: refuses }), { MINE: 'yes' });
  // Inside a gate the environment is the one that gate gave: with its mark if it holds the lock, without.
  assert.deepEqual(await given({ JS_HARNESS_CHECK_INNER: '1' }), { JS_HARNESS_CHECK_INNER: '1' });
  assert.deepEqual(await given({ JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_GATE_HELD: '1' }), { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_GATE_HELD: '1' });
}));

// The line on stderr is the trace of a mark left in a shell by mistake, which turns the lock off for every
// `gate` started from it: `check` leaves the same trace in a row of its report.
test('gate started with the mark of a held gate lock takes no lock, says so in one line, and runs the command at once beside the gate that holds the lock in its home', withHome(async (home, dir) => {
  const outer = await takeGateLock({ home, cwd: 'C:\\work\\outer', command: 'gate -- npm run all', pid: 4321, beatMs: 0 });
  try {
    let asked = 0;
    const take = async () => {
      asked += 1;
      throw new Error('not to be asked');
    };
    let during;
    const spawned = ranWith(4, () => {
      during = [readGateHolder(home)?.pid, fs.readdirSync(gateDir(home))];
    });
    const env = { JS_HARNESS_GATE_HELD: '1', MINE: 'yes' };
    // `--no-wait` would refuse at once against the held lock, were the lock asked for.
    const { code, said } = await runGate(['--no-wait', '--home', home, '--cwd', dir, '--', 'node', '--test'], env, { spawn: spawned, takeGateLock: take });
    assert.deepEqual([code, said, asked], [4, [IN_TURN], 0]);
    assert.deepEqual(during, [4321, ['lock']]);
    // What it runs is in the same turn, and is told so.
    assert.deepEqual(spawned.asked[0].env, env);
    assert.equal(readGateHolder(home).pid, 4321);
  } finally {
    outer.release();
  }
  // Only `1` is the mark.
  const took = [];
  const take = async (options) => {
    took.push(options.command);
    return { release: () => {}, beat: () => {}, lost: () => false, waitedMs: 0 };
  };
  for (const value of ['', '0', 'true']) await runGate(['--home', home, '--cwd', dir, '--', 'x'], { JS_HARNESS_GATE_HELD: value }, { spawn: ranWith(0), takeGateLock: take });
  assert.deepEqual(took, ['gate -- x', 'gate -- x', 'gate -- x']);
}));

test('gate holds the machine\'s gate lock while the command runs, saying what it runs and where, and leaves nothing behind', withHome(async (home, dir) => {
  let during;
  const spawned = ranWith(0, () => {
    during = readGateHolder(home);
  });
  const { code } = await runGate(['--home', home, '--cwd', dir, '--', 'node', 'evals/runner.mjs', '--name', 'two words'], {}, { spawn: spawned });
  assert.equal(code, 0);
  assert.deepEqual([during?.pid, during?.cwd, during?.stale], [process.pid, path.resolve(dir), false]);
  assert.equal(during.command, `gate -- ${spawned.asked[0].commandLine}`);
  assert.match(during.command, /^gate -- node evals\/runner\.mjs --name ["']two words["']$/);
  assert.equal(readGateHolder(home), null);
  assert.equal(fs.existsSync(gateDir(home)), false);
}));

test('gate resolves its home as check does: --home, then JS_HARNESS_HOME', withHome(async (home, dir) => {
  const other = makeTmpDir();
  try {
    const seen = [];
    const spawned = ranWith(0, () => seen.push([readGateHolder(home)?.pid ?? null, readGateHolder(other)?.pid ?? null]));
    await runGate(['--cwd', dir, '--', 'x'], { JS_HARNESS_HOME: home }, { spawn: spawned });
    await runGate(['--home', other, '--cwd', dir, '--', 'x'], { JS_HARNESS_HOME: home }, { spawn: spawned });
    assert.deepEqual(seen, [[process.pid, null], [null, process.pid]]);
  } finally {
    fs.rmSync(other, { recursive: true, force: true });
  }
}));

test('gate releases the lock after a command that fails, and after one that could not be run', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  assert.equal((await runGate(argv, {}, { spawn: ranWith(3) })).code, 3);
  assert.equal(readGateHolder(home), null);

  const threw = async () => {
    throw new Error('the runner blew up');
  };
  await assert.rejects(runGate(argv, {}, { spawn: threw }), /the runner blew up/);
  assert.equal(readGateHolder(home), null);
  assert.equal(fs.existsSync(gateDir(home)), false);

  // A command the shell could not start, or one a signal ended, has no exit code of its own.
  const noShell = async () => ({ status: null, signal: null, stdout: '', stderr: '', error: new Error('spawn ENOENT') });
  assert.deepEqual(await runGate(argv, {}, { spawn: noShell }), { code: 1, said: ['gate: node --test could not run: spawn ENOENT'] });
  const killed = async () => ({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' });
  assert.deepEqual(await runGate(argv, {}, { spawn: killed }), { code: 1, said: ['gate: node --test was killed by SIGKILL'] });
  assert.equal(readGateHolder(home), null);
}));

test('gate waits for the gate that holds the lock, says whose it is on stderr as check does, and then runs', withHome(async (home, dir) => {
  const clock = gateClock();
  const other = await clock.take({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321 });
  const { startedAt } = readGateHolder(home, { now: clock.now });
  let sleeps = 0;
  clock.onSleep = () => {
    sleeps += 1;
    other.beat();
    if (sleeps === 3) other.release();
  };
  const spawned = ranWith(5);
  const { code, said } = await runGate(['--home', home, '--cwd', dir, '--', 'node', '--test'], {}, { spawn: spawned, takeGateLock: clock.take });
  assert.equal(code, 5);
  assert.deepEqual(said, [`gate: waiting for the gate of C:\\work\\other (pid 4321, started ${startedAt}) to finish, for 60 minutes at most`]);
  assert.equal(spawned.asked.length, 1);
  assert.equal(readGateHolder(home, { now: clock.now }), null);
}));

test('gate --no-wait runs nothing against a held lock, says so in one line and exits non-zero', withHome(async (home, dir) => {
  const other = await takeGateLock({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321, beatMs: 0 });
  try {
    const { startedAt } = readGateHolder(home);
    const spawned = ranWith(0);
    const { code, said } = await runGate(['--no-wait', '--home', home, '--cwd', dir, '--', 'node', '--test'], {}, { spawn: spawned });
    assert.equal(code, GATE_NOT_RUN);
    assert.notEqual(code, 0);
    assert.equal(spawned.asked.length, 0);
    assert.deepEqual(said, [`gate: nothing ran: the gate of C:\\work\\other (pid 4321, started ${startedAt}) holds the machine's gate lock, and --no-wait was given`]);
    assert.equal(readGateHolder(home).pid, 4321);
  } finally {
    other.release();
  }
}));

test('gate gives up when its wait is over: it runs nothing, says so and exits non-zero, and the holder keeps the lock', withHome(async (home, dir) => {
  const clock = gateClock();
  const other = await clock.take({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321 });
  const { startedAt } = readGateHolder(home, { now: clock.now });
  clock.onSleep = () => other.beat();
  const spawned = ranWith(0);
  const { code, said } = await runGate(['--wait', '0.5', '--home', home, '--cwd', dir, '--', 'node', '--test'], {}, { spawn: spawned, takeGateLock: clock.take });
  assert.equal(code, GATE_NOT_RUN);
  assert.equal(spawned.asked.length, 0);
  const holder = `the gate of C:\\work\\other (pid 4321, started ${startedAt})`;
  assert.deepEqual(said, [
    `gate: waiting for ${holder} to finish, for 0.5 minutes at most`,
    `gate: nothing ran: ${holder} still held the machine's gate lock after 30 s (--wait bounds the wait at 0.5 minutes)`,
  ]);
  assert.equal(other.lost(), false);
  other.release();
}));

test('gate takes the lock for an hour at most, and --wait and --no-wait change how it waits', withHome(async (home, dir) => {
  const asked = [];
  const take = async (options) => {
    asked.push({ home: options.home, cwd: options.cwd, command: options.command, wait: options.wait, waitMs: options.waitMs });
    return { release: () => {}, beat: () => {}, lost: () => false, waitedMs: 0 };
  };
  const run = (...flags) => runGate([...flags, '--home', home, '--cwd', dir, '--', 'x'], {}, { spawn: ranWith(0), takeGateLock: take });
  assert.deepEqual([(await run()).code, (await run('--wait', '2.5')).code, (await run('--no-wait')).code], [0, 0, 0]);
  const gate = { home, cwd: path.resolve(dir), command: 'gate -- x' };
  assert.deepEqual(asked, [
    { ...gate, wait: true, waitMs: 60 * 60_000 },
    { ...gate, wait: true, waitMs: 150_000 },
    { ...gate, wait: false, waitMs: 60 * 60_000 },
  ]);
}));

test('gate inside a gate takes no lock and just runs the command: the gate that runs it holds the lock', withHome(async (home, dir) => {
  const other = await takeGateLock({ home, cwd: 'C:\\work\\outer', command: 'check', pid: 4321, beatMs: 0 });
  try {
    let asked = 0;
    const take = async () => {
      asked += 1;
      throw new Error('not to be asked');
    };
    const spawned = ranWith(4);
    const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
    const { code, said } = await runGate(argv, { JS_HARNESS_CHECK_INNER: '1' }, { spawn: spawned, takeGateLock: take });
    assert.deepEqual([code, said, asked], [4, [], 0]);
    assert.equal(spawned.asked[0].commandLine, 'node --test');
    assert.equal(readGateHolder(home).pid, 4321);
    // And it says nothing, as the `check` a sensor runs prints no row of the lock: with the mark of a held
    // lock as well, which every sensor of a gate that holds the lock carries.
    const marked = await runGate(argv, { JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_GATE_HELD: '1' }, { spawn: spawned, takeGateLock: take });
    assert.deepEqual([marked.code, marked.said, asked], [4, [], 0]);
  } finally {
    other.release();
  }
}));

test('gate runs the command without the lock when it cannot be taken at all, and says so', withHome(async (home, dir) => {
  const refuses = async () => {
    throw Object.assign(new Error("EPERM: operation not permitted, mkdir 'somewhere'"), { code: 'EPERM' });
  };
  const spawned = ranWith(6);
  const { code, said } = await runGate(['--home', home, '--cwd', dir, '--', 'node', '--test'], {}, { spawn: spawned, takeGateLock: refuses });
  assert.equal(code, 6);
  assert.equal(spawned.asked.length, 1);
  assert.deepEqual(said, ["gate: running without the machine's gate lock, which could not be taken (EPERM: operation not permitted, mkdir 'somewhere'), so a gate may run at the same time"]);
}));

test('gate says when its lock was lost while the command ran, and still gives the command\'s exit code', withHome(async (home, dir) => {
  let released = 0;
  const take = async () => ({ release: () => { released += 1; }, beat: () => {}, lost: () => released === 0, waitedMs: 0 });
  const { code, said } = await runGate(['--home', home, '--cwd', dir, '--', 'node', '--test'], {}, { spawn: ranWith(2), takeGateLock: take });
  assert.deepEqual([code, released], [2, 1]);
  assert.deepEqual(said, ["gate: the machine's gate lock was lost while the command ran: this process was silent for over a minute and a gate took its lock, so the two may have run at once"]);
}));

test('gate errors with usage on stderr, exits 2 and runs nothing for arguments it cannot take', withHome(async (home, dir) => {
  const refusals = [
    [[], 'the command to run goes after --'],
    [['node', '--test'], 'the command to run goes after --'],
    [['--no-wait'], 'the command to run goes after --'],
    [['--'], 'no command after --'],
    [['--wait', '5', '--'], 'no command after --'],
    [['--wait', '--', 'x'], '--wait requires a value'],
    [['--wait', 'soon', '--', 'x'], '--wait takes a number of minutes above zero, not "soon"'],
    [['--wait', '0', '--', 'x'], '--wait takes a number of minutes above zero, not "0"'],
    [['--wait', '5', '--no-wait', '--', 'x'], '--wait and --no-wait cannot be given together'],
    [['--home', '--', 'x'], '--home requires a value'],
    [['--cwd', '--', 'x'], '--cwd requires a value'],
    [['--push', '--', 'x'], 'unknown argument: --push'],
    [['node', '--', 'x'], 'unknown argument: node'],
    // A flag given twice says two things, and which of them counts is not for `gate` to choose.
    [['--wait', '1', '--wait', '2', '--', 'x'], '--wait given twice'],
    [['--no-wait', '--no-wait', '--', 'x'], '--no-wait given twice'],
    [['--home', home, '--home', home, '--', 'x'], '--home given twice'],
    [['--cwd', dir, '--wait', '1', '--cwd', dir, '--', 'x'], '--cwd given twice'],
  ];
  for (const [argv, why] of refusals) {
    const spawned = ranWith(0);
    const { code, said } = await runGate(argv, { JS_HARNESS_HOME: home }, { spawn: spawned, cwd: dir });
    assert.equal(code, 2, argv.join(' '));
    assert.deepEqual(said, [`${why}\n\n${USAGE}`], argv.join(' '));
    assert.equal(spawned.asked.length, 0, argv.join(' '));
  }
  assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'nothing of the lock was written');
  // What comes after -- is the command's, whatever it looks like.
  const spawned = ranWith(0);
  assert.equal((await runGate(['--home', home, '--cwd', dir, '--', 'node', '--wait', '--no-wait', '--'], {}, { spawn: spawned })).code, 0);
  assert.equal(spawned.asked[0].commandLine, 'node --wait --no-wait --');
}));

test('commandLineOf: one argument is a command line as it stands, several are a command and its arguments, quoted for the shell where they need it', () => {
  assert.equal(commandLineOf(['npm test && echo done'], 'linux'), 'npm test && echo done');
  assert.equal(commandLineOf(['npm test && echo done'], 'win32'), 'npm test && echo done');
  assert.equal(commandLineOf(['node', '--test', 'bin/a.test.mjs', 'C:\\x\\y.mjs', '--wait=5'], 'win32'), 'node --test bin/a.test.mjs C:\\x\\y.mjs --wait=5');
  assert.equal(commandLineOf(['node', '-e', "console.log('a b')", 'it\'s', ''], 'linux'), "node -e 'console.log('\\''a b'\\'')' 'it'\\''s' ''");
  // A backslash is part of a path for `cmd.exe` and an escape for `sh`.
  assert.equal(commandLineOf(['echo', 'a\\b', '/usr/bin:x=1'], 'linux'), "echo 'a\\b' /usr/bin:x=1");
  // Inside double quotes a space and `& | < > ^ ( )` are what they are for `cmd.exe`; a backslash at the
  // end is doubled, or the C runtime of the program would read the closing quote as escaped.
  assert.equal(
    commandLineOf(['node', '-e', "console.log('a b')", 'C:\\Program Files\\x\\', 'a&b', 'a|b<c>d^e(f)', ''], 'win32'),
    'node -e "console.log(\'a b\')" "C:\\Program Files\\x\\\\" "a&b" "a|b<c>d^e(f)" ""',
  );
});

// Found in review, 2026-10-10: every argument was escaped as the C runtime of the program reads it, and
// `cmd.exe` reads the line first. A backslash escapes no quote for it and `%NAME%` is expanded inside
// quotes too, so `gate -- node -e 'console.log("a&b")'` failed, and an argument holding
// `a"&echo UNEXPECTED&rem "` ran a second command.
test('commandLineOf on Windows refuses, among several arguments, one that cmd.exe cannot be handed whole, and says to give the command as one argument', () => {
  const refused = [
    ['console.log("a&b")', QUOTE],
    ['a"&echo UNEXPECTED&rem "', QUOTE],
    ['%PATH%', PERCENT],
    ['100%', PERCENT],
    ['a\rb', 'a carriage return, which ends the command line'],
    ['a\nb', 'a line feed, which ends the command line'],
  ];
  for (const [argument, what] of refused) {
    assert.throws(() => commandLineOf(['node', '-e', argument], 'win32'), { message: cannotHand(3, what) }, JSON.stringify(argument));
    // One argument is the caller's own command line, whatever it holds.
    assert.equal(commandLineOf([argument], 'win32'), argument);
    // And `sh` takes each of them whole in single quotes.
    for (const platform of ['linux', 'darwin']) assert.equal(commandLineOf(['node', '-e', argument], platform), `node -e '${argument}'`);
  }
  // The first argument that cannot be handed is the one named, the command itself included.
  assert.throws(() => commandLineOf(['my "tool"', '%A%'], 'win32'), { message: cannotHand(1, QUOTE) });
});

// Found with a real `cmd.exe`, 2026-10-10: it splits a bare command word at `=` and at a comma, so a
// program in a folder named `a=b` was looked for as `a`. An argument after the command is not split there.
test('commandLineOf on Windows quotes a command word that holds = or a comma, and leaves the same text bare as a later argument', () => {
  for (const mark of ['=', ',']) {
    const word = `C:\\tools\\a${mark}b\\run.cmd`;
    assert.equal(commandLineOf([word, word, `--wait${mark}5`], 'win32'), `"${word}" ${word} --wait${mark}5`, mark);
    // `sh` splits at neither, in any position.
    for (const platform of ['linux', 'darwin']) {
      assert.equal(commandLineOf([`/tools/a${mark}b/run`, `/tools/a${mark}b/run`, `--wait${mark}5`], platform), `/tools/a${mark}b/run /tools/a${mark}b/run --wait${mark}5`, `${platform} ${mark}`);
    }
  }
});

test('gate on Windows refuses arguments cmd.exe cannot be handed whole: exit 2 with usage, nothing runs and no lock is taken', withHome(async (home, dir) => {
  let asked = 0;
  const take = async () => {
    asked += 1;
    throw new Error('not to be asked');
  };
  const gate = (command, platform, spawned, env = {}) => runGate(['--home', home, '--cwd', dir, '--', ...command], env, { spawn: spawned, takeGateLock: take, platform });
  const refusals = [
    [['node', '-e', 'console.log("a&b")'], cannotHand(3, QUOTE)],
    [['echo', 'a"&echo UNEXPECTED&rem "'], cannotHand(2, QUOTE)],
    [['echo', '%PATH%'], cannotHand(2, PERCENT)],
    [['echo', 'a\nb'], cannotHand(2, 'a line feed, which ends the command line')],
  ];
  for (const [command, why] of refusals) {
    // Inside a gate and under the mark as well: it is refused before `gate` looks at either.
    for (const env of [{}, { JS_HARNESS_CHECK_INNER: '1' }, { JS_HARNESS_GATE_HELD: '1' }]) {
      const spawned = ranWith(0);
      const { code, said } = await gate(command, 'win32', spawned, env);
      assert.deepEqual([code, said, spawned.asked.length, asked], [2, [`${why}\n\n${USAGE}`], 0, 0], JSON.stringify(command));
    }
  }
  assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'nothing of the lock was written');

  // The way out the message names: the whole command as one argument, handed to the shell as it is.
  const whole = ranWith(0);
  const lock = { release: () => {}, beat: () => {}, lost: () => false, waitedMs: 0 };
  const one = await runGate(['--home', home, '--cwd', dir, '--', 'node -e "console.log(\'a&b\')" %PATH%'], {}, { spawn: whole, takeGateLock: async () => lock, platform: 'win32' });
  assert.deepEqual([one.code, one.said, whole.asked[0].commandLine], [0, [], 'node -e "console.log(\'a&b\')" %PATH%']);
  // And `sh` is handed the same arguments, each in single quotes.
  const posix = ranWith(0);
  const other = await runGate(['--home', home, '--cwd', dir, '--', 'node', '-e', 'console.log("a&b")'], {}, { spawn: posix, takeGateLock: async () => lock, platform: 'linux' });
  assert.deepEqual([other.code, other.said, posix.asked[0].commandLine], [0, [], 'node -e \'console.log("a&b")\'']);
}));

// --- the load a gate starts under: sampled before the command, said only on a loaded machine ---
// `gate` prints nothing of its own on a machine at rest, so the load is one more `gate:` line only from
// one busy logical processor on. The sample itself is tested in lib/machine-load.test.mjs.

const LOADED = { busy: 1.5, processors: 4, share: 0.375, sampleMs: 1000 };
const LOAD_SAID = 'gate: 1.5 of 4 logical processors busy before the command (38%, 1 s sample)';
const WITHOUT_LOCK = "gate: running without the machine's gate lock, which could not be taken (EPERM: operation not permitted, mkdir 'somewhere'), so a gate may run at the same time";
const lockRefuses = async () => {
  throw Object.assign(new Error("EPERM: operation not permitted, mkdir 'somewhere'"), { code: 'EPERM' });
};

/** A sampler that answers `load` at once and a runner of the command that answers `status`: each writes
 * into `events` when it was called, the sampler with the holder of the lock in `home` at that moment. */
function sampledGate(home, load, status = 0) {
  const events = [];
  const sampleLoad = async () => {
    events.push(['sample', readGateHolder(home)?.pid]);
    return load;
  };
  return { events, sampleLoad, spawn: ranWith(status, () => events.push('command')) };
}

test('gate samples the load once before the command, inside its turn, and says nothing of it below one busy logical processor or when it could not be read', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  const unsaid = [
    { busy: 0.99, processors: 4, share: 0.2475, sampleMs: 1000 },
    { busy: 0, processors: 64, share: 0, sampleMs: 1000 },
    { notRead: 'os.cpus() gave no processor', sampleMs: 1000 },
  ];
  for (const load of unsaid) {
    const { events, sampleLoad, spawn } = sampledGate(home, load, 3);
    const { code, said } = await runGate(argv, {}, { spawn, sampleLoad });
    assert.deepEqual([code, said, events], [3, [], [['sample', process.pid], 'command']], JSON.stringify(load));
  }
  // A sampler that throws stops no command either, and the lock is released as ever.
  const spawned = ranWith(3);
  const threw = async () => {
    throw new Error('the sampler blew up');
  };
  assert.deepEqual(await runGate(argv, {}, { spawn: spawned, sampleLoad: threw }), { code: 3, said: [] });
  assert.equal(spawned.asked.length, 1);
  assert.equal(readGateHolder(home), null);
}));

test('gate says the load in one line on stderr from one busy logical processor on, in each state of the lock, and the exit code stays the command\'s', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  const states = [
    { state: 'its own lock', env: {}, deps: {}, before: [], holder: process.pid },
    { state: 'the turn of the process that started it', env: { JS_HARNESS_GATE_HELD: '1' }, deps: {}, before: [IN_TURN], holder: undefined },
    { state: 'no lock, since none could be taken', env: {}, deps: { takeGateLock: lockRefuses }, before: [WITHOUT_LOCK], holder: undefined },
  ];
  for (const { state, env, deps, before, holder } of states) {
    const { events, sampleLoad, spawn } = sampledGate(home, LOADED, 7);
    const { code, said } = await runGate(argv, env, { spawn, sampleLoad, ...deps });
    assert.deepEqual([code, said, events], [7, [...before, LOAD_SAID], [['sample', holder], 'command']], state);
  }
  // One busy processor is loaded, whatever share of the machine it is.
  const one = sampledGate(home, { busy: 1, processors: 32, share: 0.03125, sampleMs: 1000 });
  assert.deepEqual((await runGate(argv, {}, one)).said, ['gate: 1.0 of 32 logical processors busy before the command (3%, 1 s sample)']);
}));

// As in `check`: a gate that waited has the lock a moment after the gate before it, whose last rows still run.
test('gate that waited a second or more for the lock says that its load was read right after another gate', withHome(async (home, dir) => {
  const said = async (waitedMs) => {
    const take = async () => ({ release: () => {}, beat: () => {}, lost: () => false, waitedMs });
    return (await runGate(['--home', home, '--cwd', dir, '--', 'x'], {}, { spawn: ranWith(0), takeGateLock: take, sampleLoad: async () => LOADED })).said;
  };
  assert.deepEqual(await said(1000), [`${LOAD_SAID}, right after another gate`]);
  assert.deepEqual(await said(999), [LOAD_SAID]);
  assert.deepEqual(await said(0), [LOAD_SAID]);

  // With the real lock on a clock the test moves: the wait is said, and then the load after it.
  const clock = gateClock();
  const other = await clock.take({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321 });
  clock.onSleep = () => other.release();
  const waited = await runGate(['--home', home, '--cwd', dir, '--', 'x'], {}, { spawn: ranWith(0), takeGateLock: clock.take, sampleLoad: async () => LOADED });
  assert.equal(waited.said.length, 2);
  assert.match(waited.said[0], /^gate: waiting for the gate of C:\\work\\other \(pid 4321, started /);
  assert.equal(waited.said[1], `${LOAD_SAID}, right after another gate`);
}));

test('gate takes no sample inside a gate, with JS_HARNESS_GATE_LOAD=off, or when it runs nothing', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  let sampled = 0;
  const sampleLoad = async () => {
    sampled += 1;
    return LOADED;
  };
  const run = (env, deps = {}, flags = []) => runGate([...flags, ...argv], env, { spawn: ranWith(0), sampleLoad, ...deps });
  // Inside a gate the command is one of that gate's sensors, or started by one: the gate sampled already.
  assert.deepEqual((await run({ JS_HARNESS_CHECK_INNER: '1' })).said, []);
  assert.deepEqual((await run({ JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_GATE_HELD: '1' })).said, []);
  // The switch, in each state of the lock.
  const off = { JS_HARNESS_GATE_LOAD: 'off' };
  assert.deepEqual((await run(off)).said, []);
  assert.deepEqual((await run({ ...off, JS_HARNESS_GATE_HELD: '1' })).said, [IN_TURN]);
  assert.deepEqual((await run(off, { takeGateLock: lockRefuses })).said, [WITHOUT_LOCK]);
  // A gate that ran nothing: refused against a held lock, or given arguments it cannot take.
  const other = await takeGateLock({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321, beatMs: 0 });
  try {
    assert.equal((await run({}, {}, ['--no-wait'])).code, GATE_NOT_RUN);
  } finally {
    other.release();
  }
  assert.equal((await run({}, {}, ['--bogus'])).code, 2);
  assert.equal(sampled, 0);

  // Only `off` is the switch, and the same stand-in is asked once a gate runs its command.
  for (const value of ['', '0', 'on', 'OFF']) assert.deepEqual((await run({ JS_HARNESS_GATE_LOAD: value })).said, [LOAD_SAID], JSON.stringify(value));
  assert.equal(sampled, 4);
}));

// --- what loads a loaded machine: the busiest processes, each in a line after the line of the load ---
// The look itself is tested in lib/machine-busiest.test.mjs. Every look here is a stand-in.

const BUSIEST = [
  { name: 'node', script: 'tsserver.js', pid: 12044, cpuSeconds: 3.2 },
  { name: 'chrome', script: null, pid: 9000, cpuSeconds: 1.6 },
  { name: 'Memory Compression', script: null, pid: 3064, cpuSeconds: 0.9 },
];
const BUSIEST_SAID = [
  'gate:   3.2 s of CPU in 2 s  node tsserver.js (pid 12044)',
  'gate:   1.6 s of CPU in 2 s  chrome (pid 9000)',
  'gate:   0.9 s of CPU in 2 s  Memory Compression (pid 3064)',
];

test('gate on a loaded machine names what loads it on stderr after the line of the load: looked for once, inside its turn, before the command', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  const states = [
    { state: 'its own lock', env: {}, deps: {}, before: [], holder: process.pid },
    { state: 'the turn of the process that started it', env: { JS_HARNESS_GATE_HELD: '1' }, deps: {}, before: [IN_TURN], holder: undefined },
    { state: 'no lock, since none could be taken', env: {}, deps: { takeGateLock: lockRefuses }, before: [WITHOUT_LOCK], holder: undefined },
  ];
  for (const { state, env, deps, before, holder } of states) {
    const { events, sampleLoad, spawn } = sampledGate(home, LOADED, 7);
    const busiest = async () => {
      events.push(['look', readGateHolder(home)?.pid]);
      return BUSIEST;
    };
    const { code, said } = await runGate(argv, env, { spawn, sampleLoad, busiest, ...deps });
    assert.deepEqual([code, said, events], [7, [...before, LOAD_SAID, ...BUSIEST_SAID], [['sample', holder], ['look', holder], 'command']], state);
  }
  assert.equal(readGateHolder(home), null);
}));

test('a look that finds nobody, gives no list or throws leaves the line of the load alone, and the command runs', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  const threw = async () => {
    throw new Error('the look blew up');
  };
  for (const busiest of [async () => [], async () => undefined, threw]) {
    const spawned = ranWith(3);
    assert.deepEqual(await runGate(argv, {}, { spawn: spawned, sampleLoad: async () => LOADED, busiest }), { code: 3, said: [LOAD_SAID] });
    assert.equal(spawned.asked.length, 1);
    assert.equal(readGateHolder(home), null);
  }
}));

test('gate looks for nothing below one busy logical processor, for a load that was not read, with JS_HARNESS_GATE_LOAD=off, inside a gate, or when it runs nothing', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  let looked = 0;
  const busiest = async () => {
    looked += 1;
    return BUSIEST;
  };
  const said = async (sampleLoad, env = {}, flags = []) => (await runGate([...flags, ...argv], env, { spawn: ranWith(0), sampleLoad, busiest })).said;
  const loaded = async () => LOADED;
  assert.deepEqual(await said(async () => ({ ...LOADED, busy: 0.99 })), []);
  assert.deepEqual(await said(async () => ({ notRead: 'os.cpus() gave no processor', sampleMs: 1000 })), []);
  // A sampler that gives no figure at all is a load that was not read: nothing is said, and the command runs.
  assert.deepEqual(await said(async () => undefined), []);
  assert.deepEqual(await said(async () => ({ processors: 4 })), []);
  assert.deepEqual(await said(loaded, { JS_HARNESS_GATE_LOAD: 'off' }), []);
  assert.deepEqual(await said(loaded, { JS_HARNESS_CHECK_INNER: '1' }), []);
  assert.deepEqual((await said(loaded, {}, ['--bogus'])).length, 1);
  assert.equal(looked, 0);
  // The same stand-ins look once the machine is loaded.
  assert.deepEqual(await said(loaded), [LOAD_SAID, ...BUSIEST_SAID]);
  assert.equal(looked, 1);
}));

// --- the gate log: a start and an end around the command, a line for a gate that ran nothing ---
// The file itself is tested in lib/gate-log.test.mjs. Most gates of this part are handed a writer that keeps
// the events and writes no file (`deps.gateLog`); the others write the log of their temporary home.

/** A stand-in for the writer of the gate log, in `deps`, which is what a gate is handed: it keeps the
 * `events` it is handed, and answers what `during` does, which is called as each event comes, or that the
 * line was written. */
function capturedLog(during = () => {}) {
  const events = [];
  const append = (home, event) => {
    events.push({ ...event, home });
    return during(event) ?? { ok: true };
  };
  return { events, deps: { gateLog: { append } } };
}

const OTHER_GATE = { cwd: 'C:\\work\\other', pid: 4321, command: 'check' };
const isIsoTime = (text) => typeof text === 'string' && new Date(text).toISOString() === text;
const fieldsOf = (events) => events.map((event) => Object.keys(event).join(' '));

test('gate writes a start after the sample and before the command, and an end after it with its exit code, in each state of the lock', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  const states = [
    { lock: 'own', env: {}, deps: {}, holder: process.pid },
    { lock: 'parent', env: { JS_HARNESS_GATE_HELD: '1' }, deps: {}, holder: undefined },
    { lock: 'none', env: {}, deps: { takeGateLock: lockRefuses }, holder: undefined },
  ];
  for (const { lock, env, deps, holder } of states) {
    const { events: order, sampleLoad, spawn } = sampledGate(home, QUIET_LOAD, 7);
    const log = capturedLog((event) => void order.push([event.event, readGateHolder(home)?.pid]));
    const { code } = await runGate(argv, env, { spawn, sampleLoad, ...deps, ...log.deps });
    // The end is written with the lock still in hand, where the gate has one.
    assert.deepEqual([code, order], [7, [['sample', holder], ['start', holder], 'command', ['end', holder]]], lock);
    const [start, end] = log.events;
    assert.deepEqual(fieldsOf(log.events), ['v event id at cwd command pid lock waitedSeconds waitedFor load home', 'v event id at seconds result home'], lock);
    assert.deepEqual({ ...start, id: '', at: '', waitedSeconds: Math.floor(start.waitedSeconds) }, { v: 1, event: 'start', id: '', at: '', cwd: path.resolve(dir), command: 'gate -- node --test', pid: process.pid, lock, waitedSeconds: 0, waitedFor: [], load: QUIET_LOAD, home }, lock);
    assert.deepEqual([end.v, end.event, end.id, end.result, end.home], [1, 'end', start.id, 'exit 7', home], lock);
    assert.ok(isIsoTime(start.at) && isIsoTime(end.at) && start.at <= end.at && end.seconds >= 0 && end.seconds < 60, JSON.stringify(end));
  }
  assert.equal(fs.existsSync(gateLogDir(home)), false, 'a gate that is handed a writer writes no file');

  // With the sample of the load switched off there is no load to write.
  const unsampled = capturedLog();
  await runGate(argv, { JS_HARNESS_GATE_LOAD: 'off' }, { spawn: ranWith(0), ...unsampled.deps });
  assert.deepEqual(fieldsOf(unsampled.events), ['v event id at cwd command pid lock waitedSeconds waitedFor home', 'v event id at seconds result home']);
}));

test('the end of a gate says how its command ended: its exit code, killed, or an error of the gate itself, a thrown one included', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  const ended = async (spawn) => {
    const log = capturedLog();
    const code = (await runGate(argv, {}, { spawn, ...log.deps })).code;
    assert.deepEqual(log.events.map(({ event }) => event), ['start', 'end']);
    return [code, log.events[1].result];
  };
  assert.deepEqual(await ended(ranWith(0)), [0, 'exit 0']);
  assert.deepEqual(await ended(ranWith(3)), [3, 'exit 3']);
  assert.deepEqual(await ended(async () => ({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' })), [1, 'killed']);
  assert.deepEqual(await ended(async () => ({ status: null, signal: null, stdout: '', stderr: '', error: new Error('spawn ENOENT') })), [1, 'error']);

  const log = capturedLog();
  const threw = async () => {
    throw new Error('the runner blew up');
  };
  await assert.rejects(runGate(argv, {}, { spawn: threw, ...log.deps }), /the runner blew up/);
  assert.deepEqual(log.events.map(({ event, id, result }) => [event, id === log.events[0].id, result]), [['start', true, undefined], ['end', true, 'error']]);
  assert.equal(readGateHolder(home), null);
}));

// What comes after `--` can hold a secret, and the log is a file that stays.
test('gate writes its command cut at 120 characters', withHome(async (home, dir) => {
  const log = capturedLog();
  const secret = `--token=${'s'.repeat(200)}`;
  await runGate(['--home', home, '--cwd', dir, '--', 'node', 'deploy.mjs', secret], {}, { spawn: ranWith(0), ...log.deps });
  assert.equal(log.events[0].command, `gate -- node deploy.mjs ${secret}`.slice(0, 120));
  assert.equal(log.events[0].command.length, 120);
}));

test('gate that waited for another writes in its start whose gate that was and for how long, and one that ran nothing writes one line that says why', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  const waiting = gateClock();
  const first = await waiting.take({ home, ...OTHER_GATE });
  let sleeps = 0;
  waiting.onSleep = () => {
    sleeps += 1;
    first.beat();
    if (sleeps === 3) first.release();
  };
  const waited = capturedLog();
  await runGate(argv, {}, { spawn: ranWith(0), takeGateLock: waiting.take, ...waited.deps });
  assert.deepEqual([waited.events[0].lock, waited.events[0].waitedSeconds, waited.events[0].waitedFor], ['own', 6, [OTHER_GATE]]);

  const refusal = { v: 1, event: 'refused', id: '', at: '', cwd: path.resolve(dir), command: 'gate -- node --test', pid: process.pid, home };
  const other = await takeGateLock({ home, ...OTHER_GATE, beatMs: 0 });
  try {
    const log = capturedLog();
    const { code, said } = await runGate(['--no-wait', ...argv], {}, { spawn: ranWith(0), ...log.deps });
    assert.deepEqual([code, said.length], [GATE_NOT_RUN, 1]);
    // Refused at the first look, which on the real clock took some milliseconds.
    assert.deepEqual(log.events.map((event) => ({ ...event, id: '', at: '', waitedSeconds: Math.floor(event.waitedSeconds) })), [{ ...refusal, reason: 'held', waitedSeconds: 0, waitedFor: [OTHER_GATE] }]);
    assert.ok(isIsoTime(log.events[0].at));
  } finally {
    other.release();
  }

  const clock = gateClock();
  const holder = await clock.take({ home, ...OTHER_GATE });
  clock.onSleep = () => holder.beat();
  const log = capturedLog();
  const { code } = await runGate(['--wait', '0.5', ...argv], {}, { spawn: ranWith(0), takeGateLock: clock.take, ...log.deps });
  assert.equal(code, GATE_NOT_RUN);
  assert.deepEqual(log.events.map((event) => ({ ...event, id: '', at: '' })), [{ ...refusal, reason: 'timeout', waitedSeconds: 30, waitedFor: [OTHER_GATE] }]);
  holder.release();
}));

test('gate writes nothing to the log inside a gate, for arguments it cannot take, or with JS_HARNESS_GATE_LOG=off, and only off is the switch', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  const log = capturedLog();
  const run = (env, deps = {}, flags = []) => runGate([...flags, ...argv], env, { spawn: ranWith(0), ...log.deps, ...deps });
  await run({ JS_HARNESS_CHECK_INNER: '1' });
  await run({ JS_HARNESS_CHECK_INNER: '1', JS_HARNESS_GATE_HELD: '1' });
  assert.equal((await run({}, {}, ['--bogus'])).code, 2);
  // The switch, in each state of the lock and for a gate that is refused: nothing written, and nothing said.
  const off = { JS_HARNESS_GATE_LOG: 'off' };
  assert.deepEqual((await run(off)).said, []);
  assert.deepEqual((await run({ ...off, JS_HARNESS_GATE_HELD: '1' })).said, [IN_TURN]);
  assert.deepEqual((await run(off, { takeGateLock: lockRefuses })).said, [WITHOUT_LOCK]);
  const other = await takeGateLock({ home, ...OTHER_GATE, beatMs: 0 });
  try {
    assert.equal((await run(off, {}, ['--no-wait'])).code, GATE_NOT_RUN);
  } finally {
    other.release();
  }
  assert.deepEqual(log.events, []);
  // With the real writer the home is left as a gate left it before there was a log.
  const { gateLog, ...real } = log.deps;
  await run(off, real);
  await run({ JS_HARNESS_CHECK_INNER: '1' }, real);
  assert.deepEqual(fs.readdirSync(path.join(home, '.js-harness')), []);

  for (const value of ['', '0', 'on', 'OFF']) await run({ JS_HARNESS_GATE_LOG: value });
  assert.deepEqual(log.events.map(({ event }) => event), ['start', 'end', 'start', 'end', 'start', 'end', 'start', 'end']);
}));

test('gate that is handed no writer writes the log of its home, in a folder beside the lock\'s, which is gone', withHome(async (home, dir) => {
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  assert.deepEqual(await runGate(argv, {}, { spawn: ranWith(0) }), { code: 0, said: [] });
  assert.deepEqual(await runGate(argv, { JS_HARNESS_GATE_HELD: '1' }, { spawn: ranWith(3) }), { code: 3, said: [IN_TURN] });
  assert.deepEqual(fs.readdirSync(path.join(home, '.js-harness')), ['gate-log']);
  const { events, skipped } = readGateLog(home);
  assert.deepEqual([events.length, skipped], [4, 0]);
  assert.deepEqual(gatesOf(events).map(({ start, end }) => [start.cwd, start.command, start.lock, start.load, end.id === start.id, end.result, 'sensors' in end]), [
    [path.resolve(dir), 'gate -- node --test', 'own', QUIET_LOAD, true, 'exit 0', false],
    [path.resolve(dir), 'gate -- node --test', 'parent', QUIET_LOAD, true, 'exit 3', false],
  ]);
}));

// Never in the way: the lock guards the machine's time and the log only tells of it.
test('a gate log that cannot be written is said in one line on stderr, and the command runs and gives its exit code all the same', withHome(async (home, dir) => {
  // The folder's path is taken by a file.
  fs.mkdirSync(path.join(home, '.js-harness'));
  fs.writeFileSync(gateLogDir(home), 'not a folder');
  const argv = ['--home', home, '--cwd', dir, '--', 'node', '--test'];
  const NOT_WRITTEN = /^gate: the gate log could not be written \(E[A-Z]+: [^\n]*\), so this gate is not in it$/;
  for (const [env, before] of [[{}, []], [{ JS_HARNESS_GATE_HELD: '1' }, [IN_TURN]]]) {
    const spawned = ranWith(7);
    const { code, said } = await runGate(argv, env, { spawn: spawned });
    // One line for the gate, not one for each of its two lines.
    assert.deepEqual([code, spawned.asked.length, said.slice(0, -1), said.length], [7, 1, before, before.length + 1], said.join('\n'));
    assert.match(said.at(-1), NOT_WRITTEN);
  }
  assert.equal(readGateHolder(home), null);

  // A gate that ran nothing says it after the line that says so, and its exit code is the same.
  const other = await takeGateLock({ home, ...OTHER_GATE, beatMs: 0 });
  try {
    const { code, said } = await runGate(['--no-wait', ...argv], {}, { spawn: ranWith(0) });
    assert.deepEqual([code, said.length], [GATE_NOT_RUN, 2]);
    assert.match(said[0], /^gate: nothing ran: /);
    assert.match(said[1], /^gate: the gate log could not be written \(E[A-Z]+: [^\n]*\), so this refusal is not in it$/);
  } finally {
    other.release();
  }

  // An end that could not be written, after a start that could.
  const lost = capturedLog((event) => (event.event === 'end' ? { error: 'EBUSY: resource busy or locked' } : undefined));
  assert.deepEqual(await runGate(argv, {}, { spawn: ranWith(2), ...lost.deps }), { code: 2, said: ['gate: the gate log could not be written (EBUSY: resource busy or locked), so the end of this gate is not in it'] });
  assert.equal(fs.readFileSync(gateLogDir(home), 'utf8'), 'not a folder');
}));

// --- `gate log`: the last gates of the log, one a line ---

/** Runs `gateMain` and captures what it printed, on stdout and on stderr. */
async function runGateLog(argv, env = {}) {
  const out = { printed: [], said: [] };
  const [originalLog, originalError] = [console.log, console.error];
  console.log = (line) => out.printed.push(String(line));
  console.error = (line) => out.said.push(String(line));
  try {
    const take = async () => {
      throw new Error('not to be asked');
    };
    const code = await gateMain(argv, env, { takeGateLock: take, spawn: take, sampleLoad: take });
    return { code, ...out };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

/** `iso` as a line of `gate log` says it: the local month, day and time. */
function when(iso) {
  const at = new Date(iso);
  const two = (number) => String(number).padStart(2, '0');
  return `${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}:${two(at.getSeconds())}`;
}

test('gate log prints the last gates of the log, one a line and the newest last, and takes no lock and runs nothing', withHome(async (home) => {
  const empty = await runGateLog(['log', '--home', home]);
  assert.deepEqual(empty, { code: 0, printed: [`no gate in the log of ${gateLogDir(home)}`], said: [] });
  assert.equal(fs.existsSync(path.join(home, '.js-harness')), false, 'reading made no folder');

  const at = (minute) => `2026-10-11T07:${String(minute).padStart(2, '0')}:00.000Z`;
  const load = { busy: 1.42, processors: 8, share: 0.1775, sampleMs: 1000, busiest: [{ name: 'node', script: 'tsserver.js', pid: 41012, cpuSeconds: 1.1 }] };
  const start = (id, minute, more = {}) => ({ v: 1, event: 'start', id, at: at(minute), cwd: `C:\\work\\${id}`, command: 'check', pid: 100, lock: 'own', waitedSeconds: 0, waitedFor: [], ...more });
  const events = [
    start('one', 1, { load }),
    { v: 1, event: 'end', id: 'one', at: at(19), seconds: 1075.2, result: 'pass', sensors: [{ name: 'tests', seconds: 1075, pass: true, timedOut: false }] },
    { v: 1, event: 'refused', id: 'two', at: at(20), cwd: 'C:\\work\\two', command: 'check', pid: 101, reason: 'held', waitedSeconds: 0, waitedFor: [{ cwd: 'C:\\work\\three', pid: 102, command: 'gate -- node --test' }] },
    start('three', 21, { command: 'gate -- node --test', waitedSeconds: 268.4, waitedFor: [{ cwd: 'C:\\work\\one', pid: 100, command: 'check' }] }),
    { v: 1, event: 'end', id: 'three', at: at(22), seconds: 41, result: 'exit 3' },
    start('four', 23, { lock: 'none' }),
  ];
  for (const event of events) assert.deepEqual(appendGateEvent(home, event), { ok: true });
  fs.appendFileSync(path.join(gateLogDir(home), 'log.jsonl'), 'a torn li');
  const lines = [
    `${when(at(1))}  1075 s  pass  load 1.4 of 8 (node tsserver.js)  C:\\work\\one`,
    `${when(at(20))}  refused (held)  waited 0 s for C:\\work\\three  C:\\work\\two`,
    `${when(at(21))}  41 s  exit 3  waited 268 s for C:\\work\\one  C:\\work\\three`,
    `${when(at(23))}  no end (killed, or still running)  without the lock  C:\\work\\four`,
  ];
  const skippedOne = [`gate log: 1 unreadable line left out (${gateLogDir(home)})`];
  assert.deepEqual(await runGateLog(['log', '--home', home]), { code: 0, printed: lines, said: skippedOne });
  // The home as `gate` resolves it, and the last of them alone.
  assert.deepEqual(await runGateLog(['log'], { JS_HARNESS_HOME: home }), { code: 0, printed: lines, said: skippedOne });
  assert.deepEqual((await runGateLog(['log', '--last', '2', '--home', home])).printed, lines.slice(2));
  assert.deepEqual((await runGateLog(['log', '--home', home, '--last', '50'])).printed, lines);
  assert.deepEqual(fs.readdirSync(path.join(home, '.js-harness')), ['gate-log'], 'it took no lock');

  // Twenty by default.
  for (let n = 0; n < 30; n++) appendGateEvent(home, start(`more-${n}`, 30));
  const twenty = (await runGateLog(['log', '--home', home])).printed;
  assert.deepEqual([twenty.length, twenty.at(-1)], [20, `${when(at(30))}  no end (killed, or still running)  C:\\work\\more-29`]);
}));

// Found in review, 2026-10-11: nothing proved the exit code of a log that is there and cannot be read, and on
// that path the command printed "no gate in the log" as well, the one thing it must not say of a log it
// could not look at.
test('gate log exits 1 for a log that is there and cannot be read, names the file on stderr, and does not say that the log holds no gate', withHome(async (home) => {
  // A folder standing where the log's file would be: the system refuses to read it as a file.
  fs.mkdirSync(path.join(gateLogDir(home), 'log.jsonl'), { recursive: true });
  const notRead = [`gate log: could not read log.jsonl: EISDIR (${gateLogDir(home)})`];
  assert.deepEqual(await runGateLog(['log', '--home', home]), { code: 1, printed: [], said: notRead });

  // The older file can still be read: its gates are printed, and the answer is still not the whole log.
  const began = { v: 1, event: 'start', id: 'one', at: '2026-10-11T07:01:00.000Z', cwd: 'C:\\work\\one', command: 'check', pid: 100, lock: 'own', waitedSeconds: 0, waitedFor: [] };
  fs.writeFileSync(path.join(gateLogDir(home), 'log.1.jsonl'), `${JSON.stringify(began)}\n`);
  assert.deepEqual(await runGateLog(['log', '--home', home]), { code: 1, printed: [`${when(began.at)}  no end (killed, or still running)  C:\\work\\one`], said: notRead });

  // A log that was read and holds no gate is still said in one line, and is no error.
  fs.rmSync(gateLogDir(home), { recursive: true });
  fs.mkdirSync(gateLogDir(home));
  assert.deepEqual(await runGateLog(['log', '--home', home]), { code: 0, printed: [`no gate in the log of ${gateLogDir(home)}`], said: [] });
}));

// Found in the same review: a line that is an event by its head and not by its body made the formatter
// throw, and with it every `gate log` until the file rotated. It is left out and counted, as a torn line is.
test('gate log leaves out a line whose body is not that of an event, counts it on stderr, and prints the rest', withHome(async (home) => {
  const began = (id, more = {}) => ({ v: 1, event: 'start', id, at: '2026-10-11T07:01:00.000Z', cwd: `C:\\work\\${id}`, command: 'check', pid: 100, lock: 'own', waitedSeconds: 0, waitedFor: [], ...more });
  const lines = [began('one'), began('two', { waitedFor: [null] }), began('three', { load: { busy: 1.4, processors: 8, busiest: [null] } }), began('four')];
  for (const line of lines) assert.deepEqual(appendGateEvent(home, line), { ok: true });
  const at = when('2026-10-11T07:01:00.000Z');
  assert.deepEqual(await runGateLog(['log', '--home', home]), {
    code: 0,
    printed: [`${at}  no end (killed, or still running)  C:\\work\\one`, `${at}  no end (killed, or still running)  C:\\work\\four`],
    said: [`gate log: 2 unreadable lines left out (${gateLogDir(home)})`],
  });
}));

// Found in review (Codex), 2026-10-11: what a line is printed from was not asked, and a folder that is an
// object no text can be made of (`{"toString":null}`) made the command end with a TypeError and no gate.
test('gate log leaves out a line with a field it cannot print, counts it on stderr, and prints the rest', withHome(async (home) => {
  const began = (id, more = {}) => ({ v: 1, event: 'start', id, at: '2026-10-11T07:01:00.000Z', cwd: `C:\\work\\${id}`, command: 'check', pid: 100, lock: 'own', waitedSeconds: 0, waitedFor: [], ...more });
  const odd = { toString: null };
  const lines = [
    began('one'),
    began('two', { cwd: odd }),
    began('three', { waitedFor: [{ cwd: odd, pid: 7, command: 'check' }] }),
    began('four', { load: { busy: 1.4, processors: 8, busiest: [{ name: odd, script: null, pid: 7, cpuSeconds: 1 }] } }),
    { v: 1, event: 'end', id: 'one', at: '2026-10-11T07:01:00.000Z', seconds: 2, result: odd },
    began('five'),
  ];
  fs.mkdirSync(gateLogDir(home), { recursive: true });
  fs.writeFileSync(path.join(gateLogDir(home), 'log.jsonl'), `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);
  const at = when('2026-10-11T07:01:00.000Z');
  assert.deepEqual(await runGateLog(['log', '--home', home]), {
    code: 0,
    printed: [`${at}  no end (killed, or still running)  C:\\work\\one`, `${at}  no end (killed, or still running)  C:\\work\\five`],
    said: [`gate log: 4 unreadable lines left out (${gateLogDir(home)})`],
  });
}));

// A gate of a newer harness writes into the same file of the machine. What it writes that this version does
// not know is no damaged line: nothing is printed for it and nothing is said of it.
test('gate log prints nothing and says nothing for a line of a kind of event this version does not know', withHome(async (home) => {
  const at = '2026-10-11T07:01:00.000Z';
  const began = { v: 1, event: 'start', id: 'one', at, cwd: 'C:\\work\\one', command: 'check', pid: 100, lock: 'own', waitedSeconds: 0, waitedFor: [] };
  const stopped = (id) => ({ v: 1, event: 'stopped', id, at, cwd: `C:\\work\\${id}`, command: 'check', pid: 100, reason: 'no sensor declared' });
  fs.mkdirSync(gateLogDir(home), { recursive: true });
  const write = (lines) => fs.writeFileSync(path.join(gateLogDir(home), 'log.jsonl'), `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);

  write([stopped('two'), began, stopped('one'), stopped('three')]);
  assert.deepEqual(await runGateLog(['log', '--home', home]), { code: 0, printed: [`${when(at)}  no end (killed, or still running)  C:\\work\\one`], said: [] });
  // A log that holds nothing else holds no gate this version can say.
  write([stopped('two')]);
  assert.deepEqual(await runGateLog(['log', '--home', home]), { code: 0, printed: [`no gate in the log of ${gateLogDir(home)}`], said: [] });
}));

test('gate log errors with usage on stderr and exits 2 for arguments it cannot take, and reads nothing', withHome(async (home) => {
  const refusals = [
    [['log', '--last'], '--last requires a value'],
    [['log', '--last', '0'], '--last takes a number of gates from 1, not "0"'],
    [['log', '--last', 'few'], '--last takes a number of gates from 1, not "few"'],
    [['log', '--last', '1.5'], '--last takes a number of gates from 1, not "1.5"'],
    [['log', '--home'], '--home requires a value'],
    [['log', '--wait', '5'], 'unknown argument: --wait'],
    [['log', '--', 'node', '--test'], 'unknown argument: --'],
    [['log', '--last', '1', '--last', '2'], '--last given twice'],
  ];
  for (const [argv, why] of refusals) {
    assert.deepEqual(await runGateLog(argv, { JS_HARNESS_HOME: home }), { code: 2, printed: [], said: [`${why}\n\n${USAGE}`] }, argv.join(' '));
  }
}));

// --- the real thing: the dispatcher, a real shell, the real lock and the real clock, in a temporary home ---

/** The environment of this process without what a gate that runs this file gives it: the mark of a sensor,
 * with which `gate` and `check` take no lock and `check` runs no sensor, and the mark of that gate's held
 * lock, with which they take none either. `more` keys are dropped too, whatever their case.
 *
 * And with the sample of the load switched off (`JS_HARNESS_GATE_LOAD=off`), for these gates and for what
 * they start: no stand-in reaches a process of its own, each would wait a second for its sample, and on a
 * machine this suite keeps busy each would say the load on the stderr these tests read whole.
 *
 * The switch of the gate log is dropped and not set: a gate that runs this file with its log switched off
 * (`JS_HARNESS_GATE_LOG=off`) would hand that on, and the gates below would not write the log these tests
 * read in a home of their own. */
function outsideAGate(more = []) {
  const dropped = ['js_harness_check_inner', 'js_harness_gate_held', 'js_harness_gate_load', 'js_harness_gate_log', ...more];
  return { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !dropped.includes(key.toLowerCase()))), JS_HARNESS_GATE_LOAD: 'off' };
}

/** Starts `js-harness gate` as its own process, from `script`, the dispatcher. `done` resolves to
 * `{ status, stdout, stderr }`. */
function startGate(args, { cwd, env = outsideAGate(), script = dispatcher }) {
  const child = spawn(process.execPath, [script, 'gate', ...args], { cwd, env, windowsHide: true });
  const out = { stdout: '', stderr: '' };
  for (const stream of ['stdout', 'stderr']) {
    child[stream].setEncoding('utf8');
    child[stream].on('data', (chunk) => {
      out[stream] += chunk;
    });
  }
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, ...out }));
  });
  return { child, out, done };
}

const UNTIL_MS = 60_000;
async function until(condition, what, ms = UNTIL_MS) {
  const giveUpAt = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > giveUpAt) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test('a real gate streams what the command prints while it runs, holds the lock meanwhile, and exits with its code', withHome(async (home, dir) => {
  // The command prints, then waits for a file the test writes once it has read the print.
  const go = path.join(dir, 'go');
  fs.writeFileSync(path.join(dir, 'slow.cjs'), [
    "const fs = require('fs');",
    "console.log('first line');",
    "console.error('on stderr');",
    `const giveUpAt = Date.now() + ${5 * UNTIL_MS};`,
    'const timer = setInterval(() => {',
    `  if (!fs.existsSync(${JSON.stringify(go)}) && Date.now() < giveUpAt) return;`,
    '  clearInterval(timer);',
    "  console.log('last line');",
    '  process.exitCode = 7;',
    '}, 20);',
  ].join('\n'));
  const gate = startGate(['--home', home, '--', 'node', 'slow.cjs'], { cwd: dir });
  try {
    await until(() => gate.out.stdout.includes('first line') && gate.out.stderr.includes('on stderr'), 'the first lines of the command');
    assert.doesNotMatch(gate.out.stdout, /last line/);
    const holder = readGateHolder(home);
    assert.deepEqual([holder?.pid, holder?.cwd, holder?.command], [gate.child.pid, dir, 'gate -- node slow.cjs']);
  } finally {
    fs.writeFileSync(go, '');
  }
  const { status, stdout, stderr } = await gate.done;
  assert.equal(status, 7);
  assert.deepEqual(stdout.split(/\r?\n/), ['first line', 'last line', '']);
  assert.deepEqual(stderr.split(/\r?\n/), ['on stderr', '']);
  assert.equal(readGateHolder(home), null);
  assert.equal(fs.existsSync(gateDir(home)), false);
}));

// The one real `gate` whose log is read back from the real file, by the reader and by `gate log`, a
// process of its own as well. The home is temporary, as for every gate of this file.
test('a real gate leaves its two lines in the log of its home, and a real gate log prints them as one', withHome(async (home, dir) => {
  fs.writeFileSync(path.join(dir, 'three.cjs'), 'process.exit(3);\n');
  const ran = await startGate(['--home', home, '--', 'node', 'three.cjs'], { cwd: dir }).done;
  assert.deepEqual([ran.status, ran.stdout, ran.stderr], [3, '', '']);
  assert.deepEqual(fs.readdirSync(gateLogDir(home)), ['log.jsonl']);
  const text = fs.readFileSync(path.join(gateLogDir(home), 'log.jsonl'), 'utf8');
  const [start, end, ...rest] = text.split('\n');
  assert.deepEqual(rest, ['']);
  const began = JSON.parse(start);
  // No load: these gates are started with the sample switched off.
  assert.deepEqual({ ...began, id: '', at: '', pid: 0, waitedSeconds: Math.floor(began.waitedSeconds) }, { v: 1, event: 'start', id: '', at: '', cwd: dir, command: 'gate -- node three.cjs', pid: 0, lock: 'own', waitedSeconds: 0, waitedFor: [] });
  assert.ok(Number.isInteger(began.pid) && began.pid !== process.pid, String(began.pid));
  const ended = JSON.parse(end);
  assert.deepEqual({ ...ended, at: '', seconds: 0 }, { v: 1, event: 'end', id: began.id, at: '', seconds: 0, result: 'exit 3' });
  assert.ok(ended.seconds >= 0 && ended.seconds < 300, String(ended.seconds));

  const log = await startGate(['log', '--home', home], { cwd: dir }).done;
  assert.deepEqual([log.status, log.stderr], [0, '']);
  assert.match(log.stdout, /^\d\d-\d\d \d\d:\d\d:\d\d {2}\d+ s {2}exit 3 {2}\S.*\r?\n$/);
  assert.equal(log.stdout.trimEnd().split('  ').at(-1), dir);
  // Reading it took no lock and added no line.
  assert.equal(fs.readFileSync(path.join(gateLogDir(home), 'log.jsonl'), 'utf8'), text);
  assert.equal(fs.existsSync(gateDir(home)), false);
}));

const notWindows = process.platform !== 'win32' && 'cmd.exe is the shell on Windows only';
test('a real gate on Windows hands its command the arguments unchanged through cmd.exe: spaces, the marks cmd.exe reads outside quotes, a backslash at the end, an empty one', { skip: notWindows }, withHome(async (home, dir) => {
  const given = ['a & b', 'a|b<c>d^e (f)', 'C:\\some folder\\', ''];
  const gate = startGate(['--home', home, '--', 'node', '-e', 'console.log(JSON.stringify(process.argv.slice(1)))', ...given], { cwd: dir });
  const { status, stdout, stderr } = await gate.done;
  assert.equal(status, 0, stderr);
  assert.deepEqual(JSON.parse(stdout), given);
}));

/** A batch file in `folder`, which is made, that passes the arguments it was given on to `node` (`%*`), as
 * `npm.cmd` does, and prints what `node` got of them as JSON. Returns its path. `cmd.exe` reads the
 * arguments a second time there, inside the batch file, after reading the line that started it. */
function batchShim(folder) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'show.cjs'), 'console.log(JSON.stringify(process.argv.slice(2)));\n');
  const shim = path.join(folder, 'show.cmd');
  fs.writeFileSync(shim, ['@echo off', `"${process.execPath}" "%~dp0show.cjs" %*`, ''].join('\r\n'));
  return shim;
}

// The test above proves the quoting of what comes after a bare `node`. These two prove the shapes it left
// to a comparison of strings (found in review, 2026-10-10): a command that needs quotes itself, in the
// first position, and a command that is a batch file.
test('a real gate on Windows runs a command whose own path has a space, among several arguments', { skip: notWindows }, withHome(async (home, dir) => {
  const shim = batchShim(path.join(dir, 'some folder'));
  const given = ['second', 'a b'];
  const gate = startGate(['--home', home, '--', shim, ...given], { cwd: dir });
  const { status, stdout, stderr } = await gate.done;
  assert.equal(status, 0, stderr);
  assert.deepEqual(JSON.parse(stdout), given);
}));

test('a real gate on Windows hands a batch file that passes its arguments on, as npm.cmd does, each of them unchanged', { skip: notWindows }, withHome(async (home, dir) => {
  const given = ['a & b', '(x)^y', 'a|b<c>d^e (f)', 'C:\\some folder\\', ''];
  // By its path as it is, and behind a space as well, where both the command and its arguments are quoted.
  for (const folder of [dir, path.join(dir, 'some folder')]) {
    const gate = startGate(['--home', home, '--', batchShim(folder), ...given], { cwd: dir });
    const { status, stdout, stderr } = await gate.done;
    assert.equal(status, 0, `${folder}: ${stderr}`);
    assert.deepEqual(JSON.parse(stdout), given, folder);
  }
}));

test('a real gate on Windows runs a command whose own path holds = or a comma, where cmd.exe splits a bare command word', { skip: notWindows }, withHome(async (home, dir) => {
  const given = ['second', 'a b'];
  for (const name of ['a=b', 'a,b']) {
    const gate = startGate(['--home', home, '--', batchShim(path.join(dir, name)), ...given], { cwd: dir });
    const { status, stdout, stderr } = await gate.done;
    assert.equal(status, 0, `${name}: ${stderr}`);
    assert.deepEqual(JSON.parse(stdout), given, name);
  }
}));

test('a real gate waits for a lock another process\'s gate holds, says so, and runs once it is released', withHome(async (home, dir) => {
  const other = await takeGateLock({ home, cwd: 'C:\\work\\other', command: 'check', pid: 4321 });
  let released = false;
  try {
    const gate = startGate(['--home', home, '--wait', '5', '--', 'node', '-e', "console.log('ran')"], { cwd: dir });
    await until(() => gate.out.stderr.includes('gate: waiting for the gate of C:\\work\\other (pid 4321, started '), 'the wait to be said');
    assert.equal(gate.out.stdout, '');
    other.release();
    released = true;
    const { status, stdout, stderr } = await gate.done;
    assert.equal(status, 0, stderr);
    assert.equal(stdout.trim(), 'ran');
    assert.match(stderr, /to finish, for 5 minutes at most\r?\n$/);
  } finally {
    if (!released) other.release();
  }
  assert.equal(fs.existsSync(gateDir(home)), false);
}));

// The trap this closes: `js-harness gate -- npm run check` started a gate that waited for the lock of the
// process that had started it, for the whole of its wait, and then ran nothing.
test('a real check started by a real gate, in the same home, runs its sensors in that gate\'s turn instead of waiting for the lock it holds', withHome(async (home, dir) => {
  const slashes = (file) => file.replace(/\\/g, '/');
  const log = path.join(dir, 'sensor.log');
  // The sensor says what it was told and what stands in the folder of the lock while it runs.
  fs.writeFileSync(path.join(dir, 'sensor.cjs'), [
    "const fs = require('fs');",
    "const path = require('path');",
    'const [log, gate] = process.argv.slice(2);',
    'const said = { held: process.env.JS_HARNESS_GATE_HELD, inner: process.env.JS_HARNESS_CHECK_INNER, gate: fs.readdirSync(gate), lock: fs.readdirSync(path.join(gate, \'lock\')) };',
    'fs.writeFileSync(log, JSON.stringify(said));',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'a'.repeat(400));
  // The sensor names node by its path, since these processes are given a PATH with no program on it.
  const sensors = { tests: `"${process.execPath}" sensor.cjs "${slashes(log)}" "${slashes(gateDir(home))}"` };
  fs.writeFileSync(path.join(dir, 'harness.json'), JSON.stringify({ sensors }));
  // A copy of `bin/` in a temporary folder, as in check.test.mjs: started from this checkout's own
  // scripts, these processes would read on the session board as gates of this worktree.
  const checkout = makeTmpDir();
  try {
    fs.cpSync(path.dirname(dispatcher), path.join(checkout, 'bin'), { recursive: true, filter: (source) => !source.endsWith('.test.mjs') });
    // No gentle-ai and no git: an empty PATH leaves both rows of `check` saying they found none.
    const noPrograms = path.join(checkout, 'no-programs');
    fs.mkdirSync(noPrograms);
    const env = { ...outsideAGate(['node_test_context', 'path']), PATH: noPrograms };
    // The check's own wait is 3 s: without the mark it would wait that long for its parent and fail.
    const check = [process.execPath, path.join(checkout, 'bin', 'check.mjs'), '--cwd', dir, '--home', home, '--wait', '0.05'];
    const gate = startGate(['--home', home, '--no-wait', '--', ...check], { cwd: dir, env, script: path.join(checkout, 'bin', 'js-harness.mjs') });
    const { status, stdout, stderr } = await gate.done;
    const rows = stdout.replace(/\r\n/g, '\n');
    assert.equal(status, 0, `${stdout}${stderr}`);
    // Nobody waited: a gate that waits says so on stderr.
    assert.equal(stderr, '');
    assert.match(rows, /^PASS {2}tests {2}/m);
    // The switch these processes were started with reached the check as well: it sampled no load.
    assert.doesNotMatch(rows, /^\w+ {2}load {2}/m);
    assert.match(rows, /^INFO {2}gate {2}the sensors ran in the turn of the process that started this gate, which holds the machine's gate lock \(JS_HARNESS_GATE_HELD=1\), so this gate took none$/m);
    const said = JSON.parse(fs.readFileSync(log, 'utf8'));
    assert.deepEqual([said.held, said.inner, said.gate], ['1', '1', ['lock']]);
    // The one holder is the gate, and the check stood in no line.
    assert.equal(said.lock.length, 1);
    assert.ok(said.lock[0].startsWith(`holder-${gate.child.pid}-`), said.lock[0]);
    assert.equal(fs.existsSync(gateDir(home)), false);
    // The log of their home tells the two apart: the gate with its own lock, and the check that ran
    // inside its turn, from start to end.
    const [outer, inner, ...more] = gatesOf(readGateLog(home).events);
    assert.deepEqual(more, []);
    assert.deepEqual([outer.start.lock, outer.start.pid, outer.start.command.slice(0, 8), outer.end.result], ['own', gate.child.pid, 'gate -- ', 'exit 0']);
    assert.deepEqual([inner.start.lock, inner.start.command, inner.start.cwd, inner.end.result], ['parent', 'check', path.resolve(dir), 'pass']);
    assert.ok(outer.start.at <= inner.start.at && inner.end.at <= outer.end.at, JSON.stringify([outer, inner]));
  } finally {
    fs.rmSync(checkout, { recursive: true, force: true });
  }
}));
