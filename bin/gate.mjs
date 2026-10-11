// `gate`: runs any command under the machine's gate lock (bin/lib/gate-lock.mjs), waiting for its turn the
// way a commit's gate does. For the heavy runs that are not a commit's gate, such as a batch of evals or a
// whole `node --test` by hand: beside a gate they share its cores, and both miss their time bounds with
// every test green. One test file run alone during a task stays free; this is for what takes minutes.
// See odd/tasks/gate-lock.md ("Anything else heavy").
//
// It reports nothing of its own on stdout: what the command prints goes to the caller as it is printed,
// and the exit code is the command's. What `gate` itself has to say (whose gate it waits for, that it ran
// nothing, that it ran without the lock, or in the turn of the process that started it, and the load of a
// machine that is loaded when the command starts, with what loads it) goes to stderr, each line starting
// with `gate:`.
//
// The command is one argument after `--`, a command line the shell is handed as it is written, or several,
// a command and its arguments. On Windows several arguments cannot hold everything: `commandLineOf` says
// what `cmd.exe` cannot be handed whole, and such a command goes as one argument.
import os from 'node:os';
import { GATE_HELD_ENV, GATE_WAIT_SAID_MS, parseGateWait, runSensor, takeGateTurn } from './check.mjs';
import { isLoaded, loadDetail, loadLines, loadSwitchedOff, readLoad } from './lib/machine-load.mjs';

const USAGE = 'Usage: js-harness gate [--wait <minutes> | --no-wait] [--home <path>] [--cwd <path>] -- <command> [args...]';

/** The exit code of a `gate` that ran nothing because the lock was held: with `--no-wait`, or past its
 * wait. It is the "try again later" of sysexits.h (EX_TEMPFAIL), a code a test runner does not give, so
 * a caller can tell "did not run" from "ran and failed". A usage error is 2, as everywhere here. */
export const GATE_NOT_RUN = 75;

class GateArgError extends Error {}

/** One argument as the shell reads it back whole. What is only letters, digits and the usual marks of a
 * path or a flag goes as it is; anything else is quoted: in single quotes for `sh`, where a backslash is
 * one of the marks that need it, and in double quotes for `cmd.exe`, inside which a space and
 * `& | < > ^ ( )` are what they are. A backslash at the end is doubled there, or the C runtime of the
 * program would read the closing quote as escaped. What double quotes do not keep from `cmd.exe` never
 * comes here (`CMD_READS`).
 *
 * The command word (`isCommand`, the first argument) is quoted on Windows for `=` and a comma as well,
 * since `cmd.exe` splits a bare command word at them: a program in a folder named `a=b` was looked for
 * as `a` (seen with a real `cmd.exe`, 2026-10-10). It splits no later argument there, so `--wait=5` goes
 * as it is. */
function quoted(argument, platform, isCommand = false) {
  const windows = platform === 'win32';
  const bare = !windows ? /^[A-Za-z0-9_\/:=.,@+-]+$/ : isCommand ? /^[A-Za-z0-9_\/\\:.@+-]+$/ : /^[A-Za-z0-9_\/\\:=.,@+-]+$/;
  if (bare.test(argument)) return argument;
  if (!windows) return `'${argument.replace(/'/g, "'\\''")}'`;
  return `"${argument.replace(/(\\+)$/, '$1$1')}"`;
}

// What `cmd.exe` reads in an argument whatever quotes are around it, so that no quoting hands it over
// whole. A backslash before a double quote escapes it for the C runtime of the program and not for
// `cmd.exe`, which reads the line first: an argument holding `a"&echo UNEXPECTED&rem "` ran a second
// command (found in review, 2026-10-10).
const CMD_READS = [
  ['"', 'a double quote, which ends the quotes around it'],
  ['%', 'a percent sign, which is expanded as a variable even inside quotes'],
  ['\r', 'a carriage return, which ends the command line'],
  ['\n', 'a line feed, which ends the command line'],
];

/** The command line the shell is given for what came after `--`. One argument is a command line as it
 * stands, pipes and all (`js-harness gate -- "npm test && npm run lint"`), on every system. Several are a
 * command and its arguments, as the caller's shell split them, and each is quoted again where the shell
 * that runs them would split or read it otherwise (`quoted`, which is stricter with the command word on
 * Windows).
 *
 * On Windows that cannot be done for an argument that holds a double quote, a percent sign, a carriage
 * return or a line feed (`CMD_READS`): among several arguments it throws a `GateArgError` that says which
 * argument, what it holds and the way out, which is the whole command as one argument, written as
 * `cmd.exe` reads it. Refused, and not passed on as well as it can be, because the caller would get
 * another command than the one it wrote. `sh` takes every argument whole in single quotes. */
export function commandLineOf(args, platform = process.platform) {
  if (args.length === 1) return args[0];
  return args.map((argument, index) => {
    const holds = platform === 'win32' && CMD_READS.find(([mark]) => argument.includes(mark))?.[1];
    if (holds) {
      throw new GateArgError(`cmd.exe cannot be handed argument ${index + 1} after -- whole: it holds ${holds}; give the whole command as one argument after --, written as cmd.exe reads it`);
    }
    return quoted(argument, platform, index === 0);
  }).join(' ');
}

/** Walks what comes before `--` token by token, like `sessions`: anything that is not a known flag is a
 * usage error, never a token that is silently ignored, and so is a flag given twice, which says two
 * things with nothing to tell which is meant. The home is resolved as `check` resolves it
 * (`--home`, then `JS_HARNESS_HOME`, then the user's home), since the two must take the same lock. */
function parseArgs(argv, env, defaultCwd) {
  const split = argv.indexOf('--');
  if (split === -1) throw new GateArgError('the command to run goes after --');
  const own = argv.slice(0, split);
  const paths = {};
  const given = new Set();
  for (let i = 0; i < own.length; i++) {
    const token = own[i];
    if (!['--no-wait', '--wait', '--home', '--cwd'].includes(token)) throw new GateArgError(`unknown argument: ${token}`);
    if (given.has(token)) throw new GateArgError(`${token} given twice`);
    given.add(token);
    if (token === '--no-wait') continue;
    const value = own[i + 1];
    if (value === undefined || value.startsWith('--')) throw new GateArgError(`${token} requires a value`);
    if (token !== '--wait') paths[token.slice(2)] = value;
    i += 1; // consume the value too, so it is never re-read as its own token
  }
  const { noWait, waitMinutes } = parseGateWait(own);
  const command = argv.slice(split + 1);
  if (command.length === 0) throw new GateArgError('no command after --');
  return { cwd: paths.cwd ?? defaultCwd, home: paths.home ?? env.JS_HARNESS_HOME ?? os.homedir(), noWait, waitMinutes, command };
}

/** Runs the command of `argv` while this process holds the machine's gate lock, and returns the exit code:
 * the command's own, 2 for a usage error, `GATE_NOT_RUN` when the lock was held and nothing ran.
 *
 * The lock is taken as a gate takes it (`takeGateTurn` of `check`): held by another, it is waited for, an
 * hour at most or as `--wait` says, and the wait is said on stderr; `--no-wait` refuses at once. A lock
 * that cannot be taken at all does not stop the command: it runs without it, and stderr says so. The
 * holder's file says `gate -- <command line>` and the folder the command runs in, which is what `Gates`
 * of `js-harness sessions` shows for it.
 *
 * The command runs through the shell in `cwd`, in the environment this process was given and with its
 * input and output, with no time bound. It is run by what runs a sensor (`runSensor`, with `inherit`), so
 * a signal that ends this process on macOS or Linux stops the command's whole process tree first. Not as
 * a sensor in the rest: no throwaway home, and nothing tells it that it is inside a gate.
 *
 * Inside a gate (`JS_HARNESS_CHECK_INNER=1`, which a sensor's process and all it starts carry) no lock is
 * taken: the gate that runs this already holds it, and waiting for it would be waiting for itself. Nor
 * is one taken by a `gate` that a holder of the lock started, which says so with the mark of a held lock
 * (`JS_HARNESS_GATE_HELD=1`, `GATE_HELD_ENV` of `check`, where it is told why the mark is trusted and
 * what it cannot protect against). In both cases the command runs with no wait for the lock, in the
 * environment as given.
 * Under the mark alone, stderr says that the command runs in the turn of the process that started this
 * gate, as `check` says it in a row of its report: a mark left in a shell by mistake turns the lock off
 * for every `gate` started there, and that line is its trace. Inside a gate nothing is said, as the
 * `check` a sensor runs prints no row of the lock.
 *
 * With the lock in hand the command is given that mark in turn, so a gate it starts
 * (`js-harness gate -- npm run check`) runs in this turn instead of waiting for it. A command that runs
 * without the lock, which could not be taken, is not given it.
 *
 * A usage error is said on stderr with the usage, before a lock is taken or anything runs: a flag `gate`
 * cannot take (`parseArgs`), or arguments it cannot make a command line of (`commandLineOf`).
 *
 * Before the command the machine's load is read for a second (`./lib/machine-load.mjs`), with the lock
 * in hand where there is one, as `check` reads it before its sensors. It is said in one line on stderr
 * only on a loaded machine, from one busy logical processor on (`LOAD_SAID_PROCESSORS`): a `gate` on a
 * machine at rest still says nothing of its own. The line says when this gate waited for another, whose
 * tail the figure then is. On such a machine the processes that load it are looked for as well, for some
 * seconds more, and the three busiest at most are named in the lines after it
 * (`./lib/machine-busiest.mjs`); a look that finds nobody or fails adds no line. A load that could not be
 * read is not said, and stops nothing. The switch `JS_HARNESS_GATE_LOAD=off` takes the sample and the
 * look away, and inside a gate there is neither: see `sayLoad`.
 *
 * The lock is released on every way out of the command, a throw included. Killed, this process leaves
 * its holder's file, which the next gate takes over a minute after its last beat, as with `check`.
 * `deps.takeGateLock`, `deps.spawn` (for `runSensor`), `deps.sampleLoad` (for the sampler of the load),
 * `deps.busiest` (for the look for what loads the machine) and `deps.cwd` are replaceable, and so is
 * `deps.platform`, the system whose shell the command line is written for: a test asks for the command
 * line of another system and stands in for what would run it. */
export async function gateMain(argv, env = process.env, deps = {}) {
  let parsed;
  let commandLine;
  try {
    parsed = parseArgs(argv, env, deps.cwd ?? process.cwd());
    commandLine = commandLineOf(parsed.command, deps.platform ?? process.platform);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { cwd, home, noWait, waitMinutes } = parsed;
  const run = async (given) => {
    const result = await (deps.spawn ?? runSensor)(commandLine, { cwd, env: given, timeout: 0, inherit: true });
    if (result.error) console.error(`gate: ${commandLine} could not run: ${result.error.message}`);
    else if (result.status === null) console.error(`gate: ${commandLine} was killed by ${result.signal}`);
    return result.error || result.status === null ? 1 : result.status;
  };
  // The load the command starts under, sampled once and said only on a loaded machine. `afterGate` is
  // whether this gate waited for another, which ran until a moment ago.
  const sayLoad = async (afterGate = false) => {
    if (loadSwitchedOff(env)) return;
    const load = await readLoad(deps.sampleLoad, deps.busiest);
    if (!isLoaded(load)) return;
    console.error(`gate: ${loadDetail(load, { before: 'the command', afterGate })}`);
    // What loads it, where the look found it: under the figure, as `check` prints it under its row.
    for (const line of loadLines(load)) console.error(`gate:   ${line}`);
  };
  // Inside a gate there is no sample: the command is one of that gate's sensors or started by one, the
  // gate read the load before them, and a second here would be a second of every such command.
  if (env.JS_HARNESS_CHECK_INNER === '1') return run(env);
  if (env[GATE_HELD_ENV] === '1') {
    console.error(`gate: the command runs in the turn of the process that started this gate, which holds the machine's gate lock (${GATE_HELD_ENV}=1), so this gate takes none`);
    // Sampled here as well, as `check` does in the turn of the process that started it: this is a gate
    // of its own, started once by a person or a script and not once per test, and its command starts
    // now. The figure holds what that process itself is doing, which is the load this command meets.
    await sayLoad();
    return run(env);
  }

  const turn = await takeGateTurn({ name: 'gate', home, cwd, command: `gate -- ${commandLine}`, wait: !noWait, waitMinutes }, deps.takeGateLock);
  if (turn.refused) {
    console.error(`gate: nothing ran: ${turn.refused}`);
    return GATE_NOT_RUN;
  }
  if (turn.without) {
    console.error(`gate: running without ${turn.without}, so a gate may run at the same time`);
    await sayLoad();
    return run(env);
  }
  const { lock } = turn;
  let lost = false;
  try {
    await sayLoad(lock.waitedMs >= GATE_WAIT_SAID_MS);
    return await run({ ...env, [GATE_HELD_ENV]: '1' });
  } finally {
    // Asked before the release, after which there is no lock to have lost.
    lost = lock.lost();
    lock.release();
    if (lost) console.error("gate: the machine's gate lock was lost while the command ran: this process was silent for over a minute and a gate took its lock, so the two may have run at once");
  }
}
