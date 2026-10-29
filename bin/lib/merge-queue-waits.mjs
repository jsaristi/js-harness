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
  const own = new Set(lineage(self, byPid).map((row) => row.pid));
  const selfRow = byPid.get(self);
  if (selfRow && Number.isFinite(selfRow.createdAt)) for (const pid of selectDescendants(snapshot, { pid: self, createdAt: selfRow.createdAt })) own.add(pid);
  const copy = processes.filter((one) => !own.has(one.pid) && fromCopy(one.commandLine, globalDir)).sort((a, b) => a.pid - b.pid);
  const created = new Map(snapshot.filter((row) => Number.isFinite(row.createdAt)).map((row) => [row.pid, row.createdAt]));
  const waits = [];
  const started = new Set();
  for (const one of copy) {
    if (!isWait(one.commandLine) || !Number.isFinite(one.createdAt) || created.get(one.pid) !== one.createdAt) continue;
    const pids = selectDescendants(snapshot, { pid: one.pid, createdAt: one.createdAt });
    for (const pid of pids) started.add(pid);
    waits.push({ pid: one.pid, createdAt: one.createdAt, commandLine: one.commandLine, targets: pids.filter((pid) => created.has(pid)).map((pid) => ({ pid, createdAt: created.get(pid) })) });
  }
  const blockers = copy.filter((one) => !started.has(one.pid)).map(({ pid, createdAt, commandLine }) => ({ pid, createdAt, verb: verbOf(commandLine), commandLine }));
  return { waits, blockers };
}

// The wait in a command a session typed: the command name or the dispatcher followed by `wait`, or `wait.mjs`, and
// its words up to the end or the next shell operator.
const TYPED_WAIT = /(?:^|[\s/\\"'&;|(])(?:js-harness(?:\.mjs)?["']?\s+wait|wait\.mjs["']?)(?=\s|$)(.*?)(?=\s(?:&&|\|\||[;|<>]|\d?>)|$)/s;

/** The words of a wait's arguments, without quotes: of a running process (`commandLine`, after its verb), or of a
 * command a session typed (`typed`); null when it holds no wait. */
function waitWords({ commandLine, typed }) {
  if (typed !== undefined) {
    const found = TYPED_WAIT.exec(typed);
    return found ? argumentsOf(found[1].trim()) : null;
  }
  const again = waitAgain(commandLine);
  return again === null || !again.startsWith('js-harness wait') ? null : argumentsOf(again).slice(2);
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

/** The wait a command line runs, to run again: `js-harness wait` (or `quiet`) and its arguments, one with a space in
 * quotes; null when it runs no wait. */
export function waitAgain(commandLine) {
  const args = argumentsOf(commandLine ?? '');
  const at = scriptAt(args);
  if (at < 0 || !isWait(commandLine)) return null;
  const rest = DISPATCHER_PATTERN.test(args[at]) ? args.slice(at + 1) : [verbOf(commandLine), ...args.slice(at + 1)];
  return ['js-harness', ...rest.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))].join(' ');
}

/** The note a session gets for the waits `again` the refresh stopped: the sha the copy was refreshed to, whether the
 * refresh ended well (`code` 0), and the waits to run again, cut to a notice's length. */
export function reArmNote({ sha, code, again }) {
  const short = String(sha).slice(0, 7);
  const head = code === 0 ? `The installed copy was refreshed to ${short} by merge-queue --refresh-copy` : `The refresh of the installed copy to ${short} ended with exit ${code} (merge-queue --refresh-copy says why)`;
  const waits = again.length === 1 ? 'the wait you ran from it was stopped for it: run it again' : `the ${again.length} waits you ran from it were stopped for it: run them again`;
  const text = `${head}, and ${waits}: ${again.join('; ')}`;
  return text.length <= NOTICE_TEXT_MAX ? text : `${text.slice(0, NOTICE_TEXT_MAX - 1)}…`;
}
