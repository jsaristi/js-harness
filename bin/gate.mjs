// `gate`: runs any command under the machine's gate lock (bin/lib/gate-lock.mjs), waiting for its turn the
// way a commit's gate does. For the heavy runs that are not a commit's gate, such as a batch of evals or a
// whole `node --test` by hand: beside a gate they share its cores, and both miss their time bounds with
// every test green. See odd/tasks/gate-lock.md ("Anything else heavy").
//
// The whole rule for what runs beside a gate. Free, with no turn: a quote, and one test file that runs in
// under half a minute. Not free, so through `gate`: a whole run of the suite, a measure, and a read of the
// board. A Codex review runs beside a gate as well, since the `node --test` runs it would make are refused
// outside a turn and it is left with reading (odd/tasks/faster-check.md, part 2). And so that a run that
// was slow anyway can be explained after it, a gate keeps who spent the processor over its run in
// `busiest.jsonl`, beside its log (odd/tasks/gate-wait.md, T19).
//
// It reports nothing of its own on stdout: what the command prints goes to the caller as it is printed,
// and the exit code is the command's. What `gate` itself has to say (whose gate it waits for, that it ran
// nothing, that it ran without the lock, or in the turn of the process that started it, and the load of a
// machine that is loaded when the command starts, with what loads it) goes to stderr, each line starting
// with `gate:`.
//
// Every such run leaves its record in the machine's gate log (bin/lib/gate-log.mjs), as a commit's gate
// does: when it started and under what, and how its command ended. `js-harness gate log` prints the last
// gates of that log, and is the one form of `gate` that runs no command and prints on stdout.
//
// The command is one argument after `--`, a command line the shell is handed as it is written, or several,
// a command and its arguments. On Windows several arguments cannot hold everything: `commandLineOf` says
// what `cmd.exe` cannot be handed whole, and such a command goes as one argument.
import os from 'node:os';
import path from 'node:path';
import { GATE_HELD_ENV, GATE_WAIT_SAID_MS, GATE_WAIT_USAGE, claimOf, parseGateWait, runSensor, takeGateTurn, watchRun } from './check.mjs';
import { isLoaded, loadDetail, loadLines, loadSwitchedOff, readLoad } from './lib/machine-load.mjs';
import { formatGates, gateLogSwitchedOff, gateRecord, gatesOf, readGateBusiest, readGateLog } from './lib/gate-log.mjs';
import { GATE_FIRST_MAX_MINUTES, GATE_FIRST_OPEN, GateFirstError, TICKET_ID, cancelTicket, issueTicket, logTicket, readTickets } from './lib/gate-first.mjs';
import { launchersAlive, startLaunchers } from './lib/launcher.mjs';
import { isPushOrMerge, pushWaiting } from './lib/push-waits.mjs';
import { ruleValue } from './lib/rules.mjs';

/** The minutes a command may run when `--max` does not say. A turn holds the lock for every session on the
 * machine, and on 2026-10-14 a measure that waited for its own sampler held it 24 minutes after its work had
 * ended (odd/tasks/gate-turn-guards.md, S2). The longest turn in the gate log of the two days before took
 * 974 s, so 30 minutes stops a hung command and no turn that works. The figure is the declared rule
 * `gate-max` (bin/lib/rules-data.mjs). */
export const GATE_MAX_MINUTES = ruleValue('gate-max', 'minutes');

/** How often a gate that waits for the machine's lock asks again whether a push has become due (C-b-29). Each ask runs
 * git, and gh when commits wait to be pushed, so it is not asked at every poll of the lock. */
export const PUSH_RECHECK_MS = 30_000;

// The last line says what the two flags of a wait mean, in the words of `check`, which takes them alike:
// `--wait` is not a bound on the whole of a wait.
export const USAGE = [
  'Usage: js-harness gate [--wait <minutes> | --no-wait] [--max <minutes>] [--ready <command>] [--home <path>] [--cwd <path>] -- <command> [args...]',
  '       js-harness gate log [--last <n>] [--home <path>]',
  '       js-harness gate first [--session <id> --reason <why> [--tree <path>] [--minutes <n>] | --cancel <id>] [--home <path>]',
  GATE_WAIT_USAGE,
  `       --max <minutes>: how long the command may run before it is stopped with every process it started (${GATE_MAX_MINUTES} when not given)`,
  `       --ready <command>: a quick check, one shell command line, run before the wait and again as the turn comes after one; when it fails, nothing runs (exit 75), so a command that would refuse at once does not wait for a turn`,
  "       --home <path>: the home that holds the gate lock, the gate log and the tickets (JS_HARNESS_HOME, else this user's home)",
  "       --cwd <path>: the folder the command runs in, the current one when not given; the push check reads the branch of that folder",
  "       log --last <n>: how many of the last runs are printed",
  `       first --session <id> --reason <why>: a ticket that puts that session's next whole check before every gate that waits; ${GATE_FIRST_OPEN} are open at most, each for ${GATE_FIRST_MAX_MINUTES} minutes at most (--minutes <n> sets fewer); --tree <path>: only a check of that tree spends it; --cancel <id> withdraws one`,
].join('\n');

/** How many gates `gate log` prints when `--last` does not say. */
const GATE_LOG_LAST = 20;

/** The exit code of a `gate` that ran nothing because the lock was not its to take: with `--no-wait`, held
 * or with a gate ahead of it in the line, past the bound of its wait, or with its `--ready` check failing before
 * the wait or after it. It is the "try again later" of
 * sysexits.h (EX_TEMPFAIL), a code a test runner does not give, so
 * a caller can tell "did not run" from "ran and failed". A usage error is 2, as everywhere here. */
export const GATE_NOT_RUN = 75;

/** How long the check of `--ready` may run before it is stopped and taken as failed: it is declared quick,
 * a `git status` or a `git diff --quiet`, and one that hangs must not hold a turn. */
const GATE_READY_MS = 60_000;

// The parent this process had when it started, read as the module loads: on Linux an orphan is adopted, and
// `process.ppid` read later would name its adopter (./lib/launcher.mjs).
const STARTED_BY = process.ppid;

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
    if (!['--no-wait', '--wait', '--max', '--home', '--cwd', '--ready'].includes(token)) throw new GateArgError(`unknown argument: ${token}`);
    if (given.has(token)) throw new GateArgError(`${token} given twice`);
    given.add(token);
    if (token === '--no-wait') continue;
    const value = own[i + 1];
    if (value === undefined || value.startsWith('--')) throw new GateArgError(`${token} requires a value`);
    if (token === '--max' && !(/^\d+(\.\d+)?$/.test(value) && Number(value) > 0)) throw new GateArgError(`--max takes a number of minutes above zero, not "${value}"`);
    if (token !== '--wait') paths[token.slice(2)] = value;
    i += 1; // consume the value too, so it is never re-read as its own token
  }
  const { noWait, waitMinutes } = parseGateWait(own);
  const command = argv.slice(split + 1);
  if (command.length === 0) throw new GateArgError('no command after --');
  const maxMinutes = paths.max === undefined ? GATE_MAX_MINUTES : Number(paths.max);
  return { cwd: paths.cwd ?? defaultCwd, home: paths.home ?? env.JS_HARNESS_HOME ?? os.homedir(), noWait, waitMinutes, maxMinutes, ready: paths.ready ?? null, command };
}

/** What comes after `gate log`, walked as `parseArgs` walks what comes before `--`: `{ home, last }`. */
function parseLogArgs(argv, env) {
  const given = {};
  for (let i = 0; i < argv.length; i += 2) {
    const token = argv[i];
    if (!['--last', '--home'].includes(token)) throw new GateArgError(`unknown argument: ${token}`);
    if (token in given) throw new GateArgError(`${token} given twice`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new GateArgError(`${token} requires a value`);
    given[token] = value;
  }
  const last = given['--last'] ?? String(GATE_LOG_LAST);
  if (!/^[1-9]\d*$/.test(last)) throw new GateArgError(`--last takes a number of gates from 1, not "${last}"`);
  return { home: given['--home'] ?? env.JS_HARNESS_HOME ?? os.homedir(), last: Number(last) };
}

/** `js-harness gate log`: prints the last gates of the machine's gate log on stdout, one a line and the
 * newest last (`formatGates`), twenty or as many as `--last` says, and returns the exit code. It only
 * reads: no lock is taken and nothing runs, so it answers while a gate runs, and that gate is in its
 * answer as a start with no end. A gate of `check` that stopped before its sensors, because a row it knew
 * before them had failed, is a line of its own that says so and for which rows: it ran nothing, and is
 * shown neither as a gate that ran nor as one that was refused or killed. A home with no log is said in
 * one line and is no error. Lines of the
 * file that are no lines of this log are left out and counted on stderr, and so is a file that could not
 * be read, which is then exit 1: "could not look" is not "no gates". So that one line is said only of a log
 * that was read whole; the gates of a file that could be read are printed all the same. A gate that kept
 * who spent the processor over its run (`busiest.jsonl`, `readGateBusiest`) has its line end with the
 * three heaviest; one that kept nobody, or whose line there cannot be read, prints as it always did. */
function gateLogMain(argv, env) {
  let parsed;
  try {
    parsed = parseLogArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { dir, events, skipped, unavailable } = readGateLog(parsed.home);
  const gates = gatesOf(events);
  if (gates.length === 0 && !unavailable) console.log(`no gate in the log of ${dir}`);
  for (const line of formatGates(gates.slice(-parsed.last), readGateBusiest(parsed.home))) console.log(line);
  if (skipped > 0) console.error(`gate log: ${skipped} unreadable line${skipped === 1 ? '' : 's'} left out (${dir})`);
  if (unavailable) console.error(`gate log: could not read ${unavailable.join(', ')} (${dir})`);
  return unavailable ? 1 : 0;
}

/** What comes after `gate first`, walked as `parseLogArgs` walks what comes after `gate log`: `{ home,
 * cancel }` for a cancellation, `{ home, session, reason, tree, minutes }` for an issue, and `{ home, list }`
 * for the list. A value the ticket refuses (no reason, minutes out of range) is a usage error too, said in
 * the ticket's words (`issueTicket`, `cancelTicket`). */
function parseFirstArgs(argv, env) {
  const given = {};
  for (let i = 0; i < argv.length; i += 2) {
    const token = argv[i];
    if (!['--session', '--reason', '--tree', '--minutes', '--cancel', '--home'].includes(token)) throw new GateArgError(`unknown argument: ${token}`);
    if (token in given) throw new GateArgError(`${token} given twice`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new GateArgError(`${token} requires a value`);
    given[token] = value;
  }
  const home = given['--home'] ?? env.JS_HARNESS_HOME ?? os.homedir();
  const others = Object.keys(given).filter((flag) => flag !== '--home');
  if ('--cancel' in given) {
    if (others.length > 1) throw new GateArgError('--cancel takes no other flag but --home');
    if (!TICKET_ID.test(given['--cancel'])) throw new GateArgError(`a ticket id is eight hex characters, not "${given['--cancel']}"`);
    return { home, cancel: given['--cancel'] };
  }
  if (others.length === 0) return { home, list: true };
  const minutes = given['--minutes'];
  return {
    home,
    session: given['--session'],
    reason: given['--reason'],
    tree: given['--tree'] ?? null,
    minutes: minutes === undefined ? undefined : /^\d+(\.\d+)?$/.test(minutes) ? Number(minutes) : minutes,
  };
}

/** `js-harness gate first`: the tickets that put one session's next whole check first in the line of the
 * machine's gate lock (./lib/gate-first.mjs). With `--session` and `--reason` it issues one for the next
 * check of that session (of the tree `--tree` where given, which a `js-harness gate` run in that tree claims
 * too: the merge queue's land, odd/tasks/land-unattended.md), for `--minutes` at most 60; with `--cancel` it
 * removes one; with neither it lists the open ones on stdout. The issuer is the session that runs this
 * (`CLAUDE_CODE_SESSION_ID`), written in the ticket for the board to name. The orchestrator issues them; a
 * work session only on its word, quoted in `--reason`. Each issue, expiry and cancellation is a line of the
 * gate log, unless the log is switched off. Exit 0, 1 for a third ticket or an id that is not open, 2 for a
 * usage error; it takes no lock and runs nothing. */
function gateFirstMain(argv, env) {
  let parsed;
  try {
    parsed = parseFirstArgs(argv, env);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const logged = (kind, ticket) => {
    if (!gateLogSwitchedOff(env)) logTicket(parsed.home, kind, ticket);
  };
  if (parsed.cancel !== undefined) {
    const ticket = cancelTicket({ home: parsed.home, id: parsed.cancel });
    if (ticket === null) {
      console.error(`gate first: no open ticket ${parsed.cancel}`);
      return 1;
    }
    logged('first-cancelled', ticket);
    console.log(`ticket ${ticket.id} cancelled: session ${ticket.session}, ${ticket.reason}`);
    return 0;
  }
  if (parsed.list) {
    const { open } = readTickets(parsed.home);
    if (open.length === 0) console.log('no ticket is open');
    for (const ticket of open) {
      console.log([ticket.id, `session ${ticket.session}`, `until ${ticket.until}`, `by ${ticket.by ?? 'a session it does not name'}`, ticket.reason, ticket.tree && `tree ${ticket.tree}`].filter(Boolean).join('  '));
    }
    return 0;
  }
  let issued;
  try {
    issued = issueTicket({ home: parsed.home, session: parsed.session, reason: parsed.reason, tree: parsed.tree, by: env.CLAUDE_CODE_SESSION_ID || null, ...(parsed.minutes !== undefined && { minutes: parsed.minutes }) });
  } catch (err) {
    if (!(err instanceof GateFirstError)) throw err;
    // A third ticket is refused for what is open, not for how it was asked: no usage after it.
    if (err.message.startsWith('two tickets')) {
      console.error(`gate first: ${err.message}`);
      return 1;
    }
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  for (const gone of issued.expired) logged('first-expired', gone);
  const { ticket } = issued;
  logged('first-issued', ticket);
  console.log(`ticket ${ticket.id}: the next check of session ${ticket.session}${ticket.tree ? ` in ${ticket.tree}` : ''} goes first, until ${ticket.until}: ${ticket.reason} (cancel: js-harness gate first --cancel ${ticket.id})`);
  return 0;
}

/** Runs the command of `argv` while this process holds the machine's gate lock, and returns the exit code:
 * the command's own, 2 for a usage error, `GATE_NOT_RUN` when the lock was held and nothing ran.
 *
 * The lock is taken as a gate takes it (`takeGateTurn` of `check`), in its turn: the lock is a line, and
 * this gate takes it after the gates that arrived before it. Held by another, it is waited for, and the
 * wait is said on stderr, as is a wait behind a gate that only waits ahead. The wait is given up once the
 * lock has gone as many minutes as `--wait` says without changing hands (the rule `gate-wait` when not given): that is no bound on
 * the whole of a wait, which behind a line that moves is as long as the line. `--no-wait` refuses at once,
 * for a lock that is held and for a gate that waits ahead of this one. A lock that cannot be taken at all
 * does not stop the command: it runs without it, and stderr says so. The holder's file says
 * `gate -- <command line>`, the folder the command runs in, which is what `Gates` of `js-harness sessions`
 * shows for it, and the session of the host that started this gate, where the environment names one
 * (`CLAUDE_CODE_SESSION_ID`).
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
 * The run is written in the machine's gate log (`./lib/gate-log.mjs`), in the home the lock is taken in:
 * a line before the command, after the sample, that says the state of the lock (its own, the turn of the
 * process that started it, none), whom this gate waited for and the load it read, and a line after it, on
 * every way out, with how the command ended: `exit <code>`, `killed`, or `error` for a command that could
 * not run and for an error thrown here. A gate that ran nothing because the lock was held writes one
 * line. The command is in those lines as the holder's file says it, cut short, since it can hold a
 * secret. A line that could not be written is said once on stderr and changes nothing else. Nothing is
 * written inside a gate, whose own record this run is part of, for a usage error, or with the switch
 * `JS_HARNESS_GATE_LOG=off`.
 *
 * A run whose start is in the log also keeps who spent the processor over it, in `busiest.jsonl` beside
 * the log, as `check` does (`watchRun`): every process's processor time is read as the command starts,
 * without being waited for, and again after it ends, after its end line. Nothing is said of it, it
 * changes no exit code, and nothing is read with `JS_HARNESS_GATE_LOAD=off`.
 *
 * `js-harness gate log` runs no command: see `gateLogMain`.
 *
 * The lock is released on every way out of the command, a throw included. Killed, this process leaves
 * its holder's file, which the next gate takes over a minute after its last beat, as with `check`.
 * `deps.takeGateLock`, `deps.spawn` (for `runSensor`), `deps.sampleLoad` (for the sampler of the load),
 * `deps.busiest` (for the look for what loads the machine), `deps.watchBusiest` (for the watch of who spends
 * the processor over the command), `deps.launchers` (`{ read, alive }`, for the look
 * at what started this gate, ./lib/launcher.mjs), `deps.gateLog` (for what the record is
 * written with: `{ append, now, id }`, each optional), `deps.now` (the clock of the re-check of a push while a gate waits)
 * and `deps.cwd` are replaceable, and so is
 * `deps.platform`, the system whose shell the command line is written for: a test asks for the command
 * line of another system and stands in for what would run it. */
export async function gateMain(argv, env = process.env, deps = {}) {
  // No command comes before `--`, so a first word `log` was a usage error before it was this.
  if (argv[0] === 'log') return gateLogMain(argv.slice(1), env);
  if (argv[0] === 'first') return gateFirstMain(argv.slice(1), env);
  let parsed;
  let commandLine;
  try {
    parsed = parseArgs(argv, env, deps.cwd ?? process.cwd());
    commandLine = commandLineOf(parsed.command, deps.platform ?? process.platform);
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    return 2;
  }
  const { cwd, home, noWait, waitMinutes, maxMinutes, ready } = parsed;
  /** The check of `--ready`, run as the command is, with its output passed through: `null` when it passed or
   * none was given, else how it ended, in words for the refusal. A check that runs past `GATE_READY_MS` is
   * stopped and fails: it was declared quick. */
  const notReady = async () => {
    if (ready === null) return null;
    const result = await (deps.spawn ?? runSensor)(ready, { cwd, env, timeout: GATE_READY_MS, inherit: true });
    if (result.error?.code === 'ETIMEDOUT') return `ran past ${GATE_READY_MS / 1000} s and was stopped`;
    if (result.error) return `could not run (${result.error.message})`;
    if (result.status === null) return `was killed by ${result.signal}`;
    return result.status === 0 ? null : `exited ${result.status}`;
  };
  const refusedBefore = (why) => `gate: nothing ran: its check before the line, ${ready}, ${why}, so the command would be refused; nothing waited for a turn`;
  /** Runs the command: `{ code, result }`, the exit code of this gate and how the command ended, as the
   * log says it. */
  const run = async (given) => {
    const result = await (deps.spawn ?? runSensor)(commandLine, { cwd, env: given, timeout: maxMinutes * 60_000, inherit: true });
    if (result.error?.code === 'ETIMEDOUT') {
      console.error(`gate: ${commandLine} ran past its bound of ${maxMinutes} minutes and was stopped with every process it started; --max <minutes> sets another bound`);
      return { code: 1, result: 'timed out' };
    }
    if (result.error) {
      console.error(`gate: ${commandLine} could not run: ${result.error.message}`);
      return { code: 1, result: 'error' };
    }
    if (result.status === null) {
      console.error(`gate: ${commandLine} was killed by ${result.signal}`);
      return { code: 1, result: 'killed' };
    }
    return { code: result.status, result: `exit ${result.status}` };
  };
  // The load the command starts under, sampled once and said only on a loaded machine. `afterGate` is
  // whether this gate waited for another, which ran until a moment ago. Returns the load as it was read,
  // for the log, or nothing when the sample is switched off.
  const sayLoad = async (afterGate = false) => {
    if (loadSwitchedOff(env)) return undefined;
    const load = await readLoad(deps.sampleLoad, deps.busiest);
    if (isLoaded(load)) {
      console.error(`gate: ${loadDetail(load, { before: 'the command', afterGate })}`);
      // What loads it, where the look found it: under the figure, as `check` prints it under its row.
      for (const line of loadLines(load)) console.error(`gate:   ${line}`);
    }
    return load;
  };
  // Inside a gate there is no sample and no record: the command is one of that gate's sensors or started
  // by one, the gate read the load before them and wrote its own start, and a second here would be a
  // second of every such command.
  if (env.JS_HARNESS_CHECK_INNER === '1') {
    const why = await notReady();
    if (why !== null) {
      console.error(refusedBefore(why));
      return GATE_NOT_RUN;
    }
    return (await run(env)).code;
  }
  const command = `gate -- ${commandLine}`;
  const record = gateLogSwitchedOff(env)
    ? null
    : gateRecord({ home, cwd: path.resolve(cwd), command, session: env.CLAUDE_CODE_SESSION_ID || null, ...deps.gateLog, onFailure: (why) => console.error(`gate: the gate log ${why}`) });
  // The looks of the lock this gate made (`stillWanted` below counts them), declared before `logged`, which
  // reads it on every path, the held one and the one without a lock included.
  let looks = 0;
  /** The command between the two lines of its record: the load is read, the start written, and the end
   * on every way out. `turn` is the state of the lock, and whom this gate waited for. */
  // `goneAtTurn`, after a wait: the last look at what started this gate, made after the sample of the load
  // (a second, and a look at the busiest processes) and just before the command starts (Codex, 2026-10-14).
  const logged = async (turn, given, afterGate = false, goneAtTurn = () => false) => {
    const load = await sayLoad(afterGate);
    if (goneAtTurn()) {
      console.error('gate: nothing ran: the process that started this gate ended while it waited, so it gave up its turn as it came');
      record?.refused({ reason: 'launcher gone', waitedMs: turn.waitedMs, waitedFor: turn.waitedFor });
      return GATE_NOT_RUN;
    }
    // A wait is time in which the tree or the branch could change: the check is asked again before the
    // command, as the push and the launcher are. A wait is a turn not taken at the first look (`looks`):
    // a wait behind a gate in the line that left before it held the lock names no gate waited for (Codex,
    // 2026-10-16). A turn taken at the first look had the check asked a moment ago.
    const why = looks > 1 ? await notReady() : null;
    if (why !== null) {
      console.error(`gate: nothing ran: its check before the turn, ${ready}, ${why} after the wait, so the command would be refused; the turn goes to the next gate`);
      record?.refused({ reason: 'not ready', waitedMs: turn.waitedMs, waitedFor: turn.waitedFor });
      return GATE_NOT_RUN;
    }
    record?.start({ ...turn, load });
    // Who spends the processor over the command, as `check` keeps it over its sensors (`watchRun`): not
    // waited for before the command, and nothing read with the sample of the load switched off.
    const keepBusiest = loadSwitchedOff(env) ? null : watchRun(record, deps.watchBusiest);
    let result = 'error';
    let code;
    try {
      const ran = await run(given);
      result = ran.result;
      code = ran.code;
    } finally {
      record?.end({ result });
    }
    // After the end is written, so that the seconds of the log stay the command's.
    await keepBusiest?.();
    return code;
  };
  // What the command declared would refuse it, asked before any turn is waited for (odd/tasks/gate-wait.md,
  // T20): a Codex review waited about 40 minutes for the lock and then started nothing, its tree dirty.
  const unready = await notReady();
  if (unready !== null) {
    console.error(refusedBefore(unready));
    record?.refused({ reason: 'not ready', waitedMs: 0, waitedFor: [] });
    return GATE_NOT_RUN;
  }
  if (env[GATE_HELD_ENV] === '1') {
    console.error(`gate: the command runs in the turn of the process that started this gate, which holds the machine's gate lock (${GATE_HELD_ENV}=1), so this gate takes none`);
    // Sampled here as well, as `check` does in the turn of the process that started it: this is a gate
    // of its own, started once by a person or a script and not once per test, and its command starts
    // now. The figure holds what that process itself is doing, which is the load this command meets.
    return logged({ lock: 'parent', waitedMs: 0, waitedFor: [] }, env);
  }

  // The refusal of a turn for a push that waits: nothing ran, and the push goes first. Said on arrival, and when a push
  // becomes due while this gate waits (C-b-29).
  const pushFirst = (waiting, waitedMs, waitedFor) => {
    const { branch, count, pullRequest } = waiting;
    console.error(`gate: nothing ran: ${branch} has ${count} commit${count === 1 ? '' : 's'} that a push takes now (${count === 1 ? 'its gate' : 'their gate'} passed and the pre-push check of the Codex records accepts the head), and pull request #${pullRequest} is open: push in the same step the last check passed, then ask for a turn`);
    console.error(`gate: ${waiting.command}`);
    record?.refused({ reason: 'push waits', waitedMs, waitedFor });
  };
  // A push that waits goes first: it needs no turn, and a merge waits for it (S1). Asked only here, where a
  // turn would be taken: inside a gate or in the turn of its starter no turn is waited for.
  const waiting = isPushOrMerge(commandLine) ? null : (deps.pushWaiting ?? pushWaiting)(path.resolve(cwd), { gh: deps.gh });
  if (waiting) {
    pushFirst(waiting, 0, []);
    return GATE_NOT_RUN;
  }

  // What started this gate, asked at every look of its wait (odd/tasks/orphan-gate.md): a gate whose launcher
  // ended is an orphan, and its turn would run a script nobody waits for. The launchers are read as the gate
  // starts, from the parent this process had then: read later, a chain ends at a Linux adopter and hides the
  // one that ended (Codex, 2026-10-14), and on Windows it takes the wrapper above the Bash tool's shell, gone
  // within a second, for a launcher that ended while the gate waited (2026-10-15). On Windows the table comes
  // in beside the gate; until it does there is no chain to ask, and the gate keeps its place. The first look
  // is not asked, the launcher having started this gate a moment ago.
  const launcher = deps.launchers ?? { ...startLaunchers({ ppid: STARTED_BY }), alive: launchersAlive, eager: true };
  let launchers = launcher.eager ? launcher.read() : null;
  // A push that becomes due while this gate waits goes first as well (C-b-29): the gate gives up its place, as when its
  // launcher ends, and `pushDue` names the push for the refusal. Asked again every PUSH_RECHECK_MS, counted from the arrival.
  const clock = deps.now ?? Date.now;
  const recheck = isPushOrMerge(commandLine) ? null : { next: clock() + PUSH_RECHECK_MS };
  let pushDue = null;
  const stillWanted = () => {
    looks += 1;
    if (looks === 1) return true;
    if (recheck && clock() >= recheck.next) {
      recheck.next = clock() + PUSH_RECHECK_MS;
      pushDue = (deps.pushWaiting ?? pushWaiting)(path.resolve(cwd), { gh: deps.gh });
      if (pushDue) return false;
    }
    launchers ??= launcher.read();
    return launchers === null || launcher.alive(launchers);
  };
  // A ticket its session issued for this folder puts this gate first (odd/tasks/land-unattended.md): the
  // merge queue's land asks one for the candidate's folder. Only a ticket that names the folder: one that
  // names none is left to the session's next whole check, which `gate -- node --test x` is not.
  const session = env.CLAUDE_CODE_SESSION_ID || null;
  const ticket = claimOf({ home, session, log: !gateLogSwitchedOff(env) }, cwd, deps, { named: true });
  const turn = await takeGateTurn({ name: 'gate', home, cwd, command, wait: !noWait, waitMinutes, session, stillWanted, first: ticket && { id: ticket.id, reason: ticket.reason } }, deps.takeGateLock);
  // A turn that came after a wait has its last look before the command: a table not in yet is waited for
  // (Codex, 2026-10-15), never stopped, since an orphan would otherwise run with no look at all.
  if (looks > 1) launchers ??= launcher.settle ? await launcher.settle() : launcher.read();
  launcher.stop?.();
  const { waitedMs, waitedFor } = turn;
  if (turn.refused) {
    if (pushDue) {
      pushFirst(pushDue, waitedMs, waitedFor);
      return GATE_NOT_RUN;
    }
    console.error(`gate: nothing ran: ${turn.refused}`);
    record?.refused({ reason: turn.reason, waitedMs, waitedFor });
    return GATE_NOT_RUN;
  }
  if (turn.without) {
    console.error(`gate: running without ${turn.without}, so a gate may run at the same time`);
    return logged({ lock: 'none', waitedMs, waitedFor }, env);
  }
  const { lock } = turn;
  let lost = false;
  try {
    return await logged({ lock: 'own', waitedMs, waitedFor }, { ...env, [GATE_HELD_ENV]: '1' }, waitedMs >= GATE_WAIT_SAID_MS, () => launchers !== null && !launcher.alive(launchers, { full: true }));
  } finally {
    // Asked before the release, after which there is no lock to have lost.
    lost = lock.lost();
    lock.release();
    if (lost) console.error("gate: the machine's gate lock was lost while the command ran: this process was silent for over a minute and a gate took its lock, so the two may have run at once");
  }
}
