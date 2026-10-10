// `gate`: runs any command under the machine's gate lock (bin/lib/gate-lock.mjs), waiting for its turn the
// way a commit's gate does. For the heavy runs that are not a commit's gate, such as a batch of evals or a
// whole `node --test` by hand: beside a gate they share its cores, and both miss their time bounds with
// every test green. One test file run alone during a task stays free; this is for what takes minutes.
// See odd/tasks/gate-lock.md ("Anything else heavy").
//
// It reports nothing of its own on stdout: what the command prints goes to the caller as it is printed,
// and the exit code is the command's. What `gate` itself has to say (whose gate it waits for, that it ran
// nothing, that it ran without the lock) goes to stderr, each line starting with `gate:`.
import os from 'node:os';
import { GATE_HELD_ENV, parseGateWait, runSensor, takeGateTurn } from './check.mjs';

const USAGE = 'Usage: js-harness gate [--wait <minutes> | --no-wait] [--home <path>] [--cwd <path>] -- <command> [args...]';

/** The exit code of a `gate` that ran nothing because the lock was held: with `--no-wait`, or past its
 * wait. It is the "try again later" of sysexits.h (EX_TEMPFAIL), a code a test runner does not give, so
 * a caller can tell "did not run" from "ran and failed". A usage error is 2, as everywhere here. */
export const GATE_NOT_RUN = 75;

class GateArgError extends Error {}

/** One argument as the shell reads it back whole. What is only letters, digits and the usual marks of a
 * path or a flag goes as it is; anything else is quoted: in single quotes for `sh`, where a backslash is
 * one of the marks that need it, and in double quotes for `cmd.exe`, with the backslashes before a quote
 * doubled as the C runtime of the program expects. */
function quoted(argument, platform) {
  const windows = platform === 'win32';
  if ((windows ? /^[A-Za-z0-9_\/\\:=.,@+-]+$/ : /^[A-Za-z0-9_\/:=.,@+-]+$/).test(argument)) return argument;
  if (!windows) return `'${argument.replace(/'/g, "'\\''")}'`;
  return `"${argument.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`;
}

/** The command line the shell is given for what came after `--`. One argument is a command line as it
 * stands, pipes and all (`js-harness gate -- "npm test && npm run lint"`). Several are a command and its
 * arguments, as the caller's shell split them, and each is quoted again where the shell that runs them
 * would split or read it otherwise. */
export function commandLineOf(args, platform = process.platform) {
  return args.length === 1 ? args[0] : args.map((argument) => quoted(argument, platform)).join(' ');
}

/** Walks what comes before `--` token by token, like `sessions`: anything that is not a known flag is a
 * usage error, never a token that is silently ignored. The home is resolved as `check` resolves it
 * (`--home`, then `JS_HARNESS_HOME`, then the user's home), since the two must take the same lock. */
function parseArgs(argv, env, defaultCwd) {
  const split = argv.indexOf('--');
  if (split === -1) throw new GateArgError('the command to run goes after --');
  const own = argv.slice(0, split);
  const paths = {};
  for (let i = 0; i < own.length; i++) {
    const token = own[i];
    if (token === '--no-wait') continue;
    if (!['--wait', '--home', '--cwd'].includes(token)) throw new GateArgError(`unknown argument: ${token}`);
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
 * what it cannot protect against). In both cases the command runs at once, in the environment as given.
 *
 * With the lock in hand the command is given that mark in turn, so a gate it starts
 * (`js-harness gate -- npm run check`) runs in this turn instead of waiting for it. A command that runs
 * without the lock, which could not be taken, is not given it.
 *
 * The lock is released on every way out of the command, a throw included. Killed, this process leaves
 * its holder's file, which the next gate takes over a minute after its last beat, as with `check`.
 * `deps.takeGateLock`, `deps.spawn` (for `runSensor`) and `deps.cwd` are replaceable. */
export async function gateMain(argv, env = process.env, deps = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv, env, deps.cwd ?? process.cwd());
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { cwd, home, noWait, waitMinutes, command } = parsed;
  const commandLine = commandLineOf(command);
  const run = async (given) => {
    const result = await (deps.spawn ?? runSensor)(commandLine, { cwd, env: given, timeout: 0, inherit: true });
    if (result.error) console.error(`gate: ${commandLine} could not run: ${result.error.message}`);
    else if (result.status === null) console.error(`gate: ${commandLine} was killed by ${result.signal}`);
    return result.error || result.status === null ? 1 : result.status;
  };
  if (env.JS_HARNESS_CHECK_INNER === '1' || env[GATE_HELD_ENV] === '1') return run(env);

  const turn = await takeGateTurn({ name: 'gate', home, cwd, command: `gate -- ${commandLine}`, wait: !noWait, waitMinutes }, deps.takeGateLock);
  if (turn.refused) {
    console.error(`gate: nothing ran: ${turn.refused}`);
    return GATE_NOT_RUN;
  }
  if (turn.without) {
    console.error(`gate: running without ${turn.without}, so a gate may run at the same time`);
    return run(env);
  }
  const { lock } = turn;
  let lost = false;
  try {
    return await run({ ...env, [GATE_HELD_ENV]: '1' });
  } finally {
    // Asked before the release, after which there is no lock to have lost.
    lost = lock.lost();
    lock.release();
    if (lost) console.error("gate: the machine's gate lock was lost while the command ran: this process was silent for over a minute and a gate took its lock, so the two may have run at once");
  }
}
