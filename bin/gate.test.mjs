import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GATE_NOT_RUN, commandLineOf, gateMain } from './gate.mjs';
import { gateDir, readGateHolder, takeGateLock } from './lib/gate-lock.mjs';

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

/** Runs `gateMain` and captures what it said on stderr, which is all it says itself. */
async function runGate(argv, env = {}, deps = {}) {
  const said = [];
  const originalError = console.error;
  console.error = (line) => said.push(String(line));
  try {
    const code = await gateMain(argv, env, deps);
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

const USAGE = 'Usage: js-harness gate [--wait <minutes> | --no-wait] [--home <path>] [--cwd <path>] -- <command> [args...]';

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

// --- the real thing: the dispatcher, a real shell, the real lock and the real clock, in a temporary home ---

/** The environment of this process without what a gate that runs this file gives it: the mark of a sensor,
 * with which `gate` and `check` take no lock and `check` runs no sensor, and the mark of that gate's held
 * lock, with which they take none either. `more` keys are dropped too, whatever their case. */
function outsideAGate(more = []) {
  const dropped = ['js_harness_check_inner', 'js_harness_gate_held', ...more];
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !dropped.includes(key.toLowerCase())));
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
    assert.match(rows, /^INFO {2}gate {2}the sensors ran in the turn of the process that started this gate, which holds the machine's gate lock \(JS_HARNESS_GATE_HELD=1\), so this gate took none$/m);
    const said = JSON.parse(fs.readFileSync(log, 'utf8'));
    assert.deepEqual([said.held, said.inner, said.gate], ['1', '1', ['lock']]);
    // The one holder is the gate, and the check stood in no line.
    assert.equal(said.lock.length, 1);
    assert.ok(said.lock[0].startsWith(`holder-${gate.child.pid}-`), said.lock[0]);
    assert.equal(fs.existsSync(gateDir(home)), false);
  } finally {
    fs.rmSync(checkout, { recursive: true, force: true });
  }
}));
