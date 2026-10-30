// What runs from the installed copy, for `merge-queue --refresh-copy` run alone (S4, S5 of
// odd/tasks/lead-manual-steps.md). The lead refreshed the copy by hand while sessions held only waits on it: he listed
// the copy's node processes by its folder, stopped the waits, and told each session whose wait he stopped to run it
// again; anything else running from the copy (an eval batch, a Codex or lens review, a gate) meant no refresh. This
// reads the same from one process table and one listing of command lines, so the refresh stops a wait and never other
// work. A wait's session is the one whose transcript holds the same wait still open (wakePlan, ./wake.mjs). Pure: the
// listings are handed in. Zero dependencies.
import path from 'node:path';
import { CLOCK_TOLERANCE_MS, selectDescendants } from './process-tree.mjs';
import { argumentsOf, comparable, DISPATCHER_PATTERN } from './sessions.mjs';
import { NOTICE_TEXT_MAX } from './channel.mjs';
import { shellWords } from './guard.mjs';

/** The index of the script a command line's `args` run (the dispatcher or another `.mjs`), or -1. */
const scriptAt = (args) => args.findIndex((arg, at) => at > 0 && (DISPATCHER_PATTERN.test(arg) || /\.mjs$/i.test(arg)));

/** The command a process runs: the verb after the dispatcher, or the name of the script it runs (`wait` for
 * bin/wait.mjs); null when it runs no script, or the dispatcher with nothing after it. */
export function verbOf(commandLine) {
  const args = argumentsOf(commandLine ?? '');
  const at = scriptAt(args);
  if (at < 0) return null;
  if (DISPATCHER_PATTERN.test(args[at])) return args[at + 1] ?? null;
  return args[at].split(/[\\/]/).pop().replace(/\.mjs$/i, '');
}

/** A path with its `..` and `.` resolved, as Windows or POSIX writes it: pnpm's shim runs the copy as
 * `<PNPM_HOME>\bin/../global/...`. */
const normal = (arg) => (/^[A-Za-z]:/.test(arg) ? path.win32.normalize(arg) : path.posix.normalize(arg));

/** Whether a command line runs a script of a copy under pnpm's global folder `globalDir`. */
function fromCopy(commandLine, globalDir) {
  const root = `${comparable(normal(globalDir))}/`;
  return argumentsOf(commandLine ?? '').some((arg) => {
    const flat = comparable(normal(arg));
    return flat.startsWith(root) && flat.includes('/node_modules/js-harness/');
  });
}

/** Whether a command line runs a wait: `js-harness wait`, or `js-harness quiet --wait`, which the lead stopped by
 * hand with the waits before a refresh (relief file, 2026-10-29T14:58Z: "Killed waits: my quiet, 82's, 86's"). */
function isWait(commandLine) {
  const verb = verbOf(commandLine);
  return verb === 'wait' || (verb === 'quiet' && argumentsOf(commandLine ?? '').includes('--wait'));
}

/** The parent of `row` in `byPid`, only when it was created no later than `row`: Windows keeps a dead parent's pid in
 * its children and reuses pids, so a parent created after its child is another process. */
function parentOf(row, byPid) {
  const parent = byPid.get(row.ppid);
  if (!parent || parent.pid === row.pid || !Number.isFinite(parent.createdAt) || !Number.isFinite(row.createdAt)) return null;
  return parent.createdAt <= row.createdAt + CLOCK_TOLERANCE_MS ? parent : null;
}

/** The rows from `pid` up through its parents, `pid`'s own first. */
function lineage(pid, byPid) {
  const rows = [];
  const seen = new Set();
  for (let row = byPid.get(pid); row && !seen.has(row.pid); row = parentOf(row, byPid)) {
    seen.add(row.pid);
    rows.push(row);
  }
  return rows;
}

/** The copy's processes now: `snapshot` is every process (`[{ pid, ppid, createdAt }]`, takeSnapshot), `processes` the
 * command lines (`[{ pid, createdAt, commandLine }]`, listCommandLines). Left out: `self`, the process that refreshes,
 * with its parents and what it started. `{ waits, blockers }`: each wait is `{ pid, createdAt, commandLine, targets }`,
 * `targets` the wait and what it started, by pid and creation time, as `killProcesses` takes them; every other copy
 * process that no wait started is a blocker, `{ pid, createdAt, verb, commandLine }`, and so is a wait whose creation
 * time is not known, since it cannot be stopped safely. Both sorted by pid. */
export function readCopy({ snapshot, processes, globalDir, self }) {
  const byPid = new Map(snapshot.map((row) => [row.pid, row]));
  const created = new Map(snapshot.filter((row) => Number.isFinite(row.createdAt)).map((row) => [row.pid, row.createdAt]));
  // The table and the listing are two reads, and Windows reuses pids between them: a listed process is one of the
  // table only when its creation time agrees. The refresh's own family is matched leniently, a time not known on
  // either side agreeing, so the refresh never blocks itself; a wait's child strictly, so no unknown passes as one.
  const agrees = (one, lenient) => {
    const known = created.get(one.pid);
    if (!Number.isFinite(known) || !Number.isFinite(one.createdAt)) return lenient && byPid.has(one.pid);
    return Math.abs(known - one.createdAt) <= CLOCK_TOLERANCE_MS;
  };
  const own = new Set(lineage(self, byPid).map((row) => row.pid));
  const selfRow = byPid.get(self);
  if (selfRow && Number.isFinite(selfRow.createdAt)) for (const pid of selectDescendants(snapshot, { pid: self, createdAt: selfRow.createdAt })) own.add(pid);
  const copy = processes.filter((one) => !(own.has(one.pid) && agrees(one, true)) && fromCopy(one.commandLine, globalDir)).sort((a, b) => a.pid - b.pid);
  const waits = [];
  const started = new Set();
  for (const one of copy) {
    if (!isWait(one.commandLine) || !Number.isFinite(one.createdAt) || created.get(one.pid) !== one.createdAt) continue;
    const pids = selectDescendants(snapshot, { pid: one.pid, createdAt: one.createdAt });
    for (const pid of pids) started.add(pid);
    waits.push({ pid: one.pid, createdAt: one.createdAt, commandLine: one.commandLine, targets: pids.filter((pid) => created.has(pid)).map((pid) => ({ pid, createdAt: created.get(pid) })) });
  }
  const blockers = copy.filter((one) => !(started.has(one.pid) && agrees(one, false))).map(({ pid, createdAt, commandLine }) => ({ pid, createdAt, verb: verbOf(commandLine), commandLine }));
  return { waits, blockers };
}

/** The arguments of the wait in a command a session typed, as its shell reads them (`shellWords`): after the command
 * name or the dispatcher followed by `wait`, or after `wait.mjs`, up to the end, the next operator or an output
 * redirection; null when it holds no wait. `shellWords` takes the quotes off and tells no input redirection, so a word
 * that begins with `<` is an argument (`--contains "<html"`, Codex P2 on 183b473..e387c13): a wait typed with `<` after
 * it matches no session and is printed, not told. */
function typedWait(typed) {
  const words = shellWords(typed, { redirections: true });
  const ends = (at) => words.operators.has(at) || words.redirections.has(at);
  for (let at = 0; at < words.length; at += 1) {
    if (ends(at)) continue;
    const verbAt = /(^|[/\\])js-harness(\.mjs)?$/.test(words[at]) && words[at + 1] === 'wait' && !ends(at + 1) ? at + 2 : /(^|[/\\])wait\.mjs$/.test(words[at]) ? at + 1 : -1;
    if (verbAt < 0) continue;
    let end = verbAt;
    while (end < words.length && !ends(end)) end += 1;
    return words.slice(verbAt, end);
  }
  return null;
}

/** The words of a wait's arguments, without quotes: of a running process (`commandLine`, after its verb), or of a
 * command a session typed (`typed`); null when it holds no wait. */
function waitWords({ commandLine, typed }) {
  if (typed !== undefined) return typedWait(typed);
  const words = verbAndArguments(commandLine);
  return words === null || words[0] !== 'wait' ? null : words.slice(1);
}

/** The session that runs the wait `commandLine`, from `plan` (wakePlan at this moment: each open session's `title`,
 * `role` and background `waits` launched and not ended, read from its transcript). A background wait's shell outlives
 * the shell that started it, so its parents do not lead to the session; its arguments do. `{ session }` when exactly
 * one session has a wait with the same arguments open, else `{ session: null, why }`. */
export function sessionOf({ commandLine, plan }) {
  const words = waitWords({ commandLine });
  if (words === null) return { session: null, why: 'no session runs it as js-harness wait' };
  const same = (typed) => {
    const theirs = waitWords({ typed });
    return theirs !== null && theirs.join('\0') === words.join('\0');
  };
  const ran = plan.filter((one) => one.waits.some(same));
  if (ran.length === 1) return { session: ran[0] };
  return { session: null, why: ran.length === 0 ? 'no open session ran it' : `several sessions ran it (${ran.map((one) => one.title ?? one.id).join(', ')})` };
}

/** `arg` as the session's shell (sh, as its Bash tool runs) reads it back unchanged: bare when it holds only characters
 * no shell reads, else in single quotes, each quote in it closed, escaped and reopened. */
const shellArg = (arg) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`);

/** The wait a command line runs, to run again: `js-harness wait` (or `quiet`) and its arguments, quoted for the shell
 * the session runs it in; null when it runs no wait. */
export function waitAgain(commandLine) {
  const words = verbAndArguments(commandLine);
  return words === null ? null : ['js-harness', ...words.map(shellArg)].join(' ');
}

/** The verb of the wait a command line runs and its arguments, unquoted; null when it runs no wait. */
function verbAndArguments(commandLine) {
  const args = argumentsOf(commandLine ?? '');
  const at = scriptAt(args);
  if (at < 0 || !isWait(commandLine)) return null;
  return DISPATCHER_PATTERN.test(args[at]) ? args.slice(at + 1) : [verbOf(commandLine), ...args.slice(at + 1)];
}

/** The note a session gets for the waits `again` the refresh stopped: the sha the copy was refreshed to, whether the
 * refresh ended well (`code` 0), and the waits to run again, cut to a notice's length. With `maybe`, the stop failed
 * partway, so a wait may still run and is run again only if it does not. */
export function reArmNote({ sha, code, again, maybe = false }) {
  const short = String(sha).slice(0, 7);
  const head = code === 0 ? `The installed copy was refreshed to ${short} by merge-queue --refresh-copy` : `The refresh of the installed copy to ${short} ended with exit ${code} (merge-queue --refresh-copy says why)`;
  const one = again.length === 1;
  const waits = maybe
    ? `${one ? 'the wait you ran from it' : `the ${again.length} waits you ran from it`} may have been stopped for it: run ${one ? 'it' : 'each'} again if it no longer runs`
    : one ? 'the wait you ran from it was stopped for it: run it again' : `the ${again.length} waits you ran from it were stopped for it: run them again`;
  const text = `${head}, and ${waits}: ${again.join('; ')}`;
  return text.length <= NOTICE_TEXT_MAX ? text : `${text.slice(0, NOTICE_TEXT_MAX - 1)}…`;
}
