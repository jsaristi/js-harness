// Whether anything still runs on the machine (odd/tasks/quiet-machine.md): what `js-harness quiet` reads of each
// source of work the harness knows, how it tells work from a session that needs the user, and the words it says it
// in. The readers are the board's (./background.mjs, ./sessions.mjs, ./gate-lock.mjs); this file only sorts what they
// give. A source that could not be read is never "nothing runs". Zero dependencies.

import { splitCommandLine } from './machine-busiest.mjs';
import { sameSession } from './sessions.mjs';

/** The pattern of the process listing (./process-list.mjs) on Windows: the processes `workOfProcesses` may count. */
export const QUIET_PROCESSES = String.raw`merge-queue|codex`;

const sessionName = (agent) => `session ${agent.name ?? '(no title)'} (${agent.id ?? String(agent.sessionId ?? '').slice(0, 8)})`;

/** Whether a session of `claude agents --json --all` is at work: busy, or a background one with no status whose
 * state is `working`. A session that waits is not: it needs the user (`needsUser`). */
const isBusy = (agent) => agent?.status === 'busy' || (agent?.status === undefined && agent?.state === 'working');
const needsUser = (agent) => agent?.status === 'waiting';

/** The sessions of a listing sorted: `{ work, needsYou, leftOut }`. `self` is the id of the session that runs the
 * command, whole or its first eight characters or more, matched against both ids a session has; it is left out of
 * both lists, and said in `leftOut` when it is busy or waiting, which is when it would have counted. `recorded` is the ids the record of `js-harness sessions start` holds. */
export function sortSessions(agents, { self = null, recorded = [] } = {}) {
  const ours = new Set(recorded);
  const work = [];
  const needsYou = [];
  const leftOut = [];
  for (const agent of agents) {
    const fields = { source: 'session', id: agent.id ?? null, sessionId: agent.sessionId ?? null, name: agent.name ?? null, kind: agent.kind ?? null, cwd: agent.cwd ?? null };
    if (self !== null && (sameSession(agent.sessionId, self) || sameSession(agent.id, self))) {
      if (isBusy(agent) || needsUser(agent)) leftOut.push({ ...fields, text: `${sessionName(agent)}, the session that runs this command` });
      continue;
    }
    const where = agent.cwd ? ` in ${agent.cwd}` : '';
    const mark = ours.has(agent.id) ? ', started by js-harness sessions start' : '';
    if (needsUser(agent)) {
      needsYou.push({ ...fields, waitingFor: agent.waitingFor ?? null, text: `${sessionName(agent)} waits for ${agent.waitingFor ?? 'something'}${where}${mark}` });
    } else if (isBusy(agent)) {
      work.push({ ...fields, status: agent.status ?? agent.state, text: `${sessionName(agent)} ${agent.status ?? agent.state}${where}${mark}` });
    }
  }
  return { work, needsYou, leftOut };
}

/** The gates of the machine's gate lock as `readGateLock` gives it: the live holder and each gate that waits. A
 * holder that stopped beating is not work: the next gate takes its lock over. */
export function workOfGateLock(lock) {
  const gate = (gate, role) => {
    const what = [gate.command, gate.cwd && `in ${gate.cwd}`].filter(Boolean).join(' ');
    return { source: 'gate', role, pid: gate.pid, cwd: gate.cwd, command: gate.command, text: `gate ${gate.pid === null ? '(pid unknown)' : `pid ${gate.pid}`} ${role === 'holder' ? 'holds' : 'waits for'} the gate lock${what ? `: ${what}` : ''}` };
  };
  return [
    ...(lock.holder && !lock.holder.stale ? [gate(lock.holder, 'holder')] : []),
    ...lock.waiters.filter((waiter) => waiter.pid === null || waiter.pid !== lock.holder?.pid).map((waiter) => gate(waiter, 'waiter')),
  ];
}

/** The name of the program or script an argument names: its file name, in lower case, with no extension. */
const nameOf = (argument) => argument.split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|mjs|cjs|js)$/, '');

/** What the command line of a process runs that is work: `'land'`, `'codex'` or null. It is told by what runs, never
 * by an argument that only names a file: a wait for `bin/codex-review.mjs` on main is not a review (found in review,
 * 2026-10-25). The program is the first argument; for `node`, the first argument that is no flag, its script; for the
 * dispatcher (`js-harness`), the word after it. A land is `merge-queue` with `--land` and no `--dry-run`, which
 * pushes nothing; a review is `codex-review` with no `--unavailable`, which only records a skip, or Codex's `exec`. */
export function workKindOf(commandLine) {
  const args = splitCommandLine(commandLine);
  if (args.length === 0) return null;
  let program = nameOf(args[0]);
  let rest = args.slice(1);
  if (program === 'node') {
    const at = rest.findIndex((argument) => !argument.startsWith('-'));
    if (at === -1) return null;
    program = nameOf(rest[at]);
    rest = rest.slice(at + 1);
  }
  if (program === 'js-harness' && rest.length > 0) {
    program = rest[0];
    rest = rest.slice(1);
  }
  if (program === 'merge-queue') return rest.includes('--land') && !rest.includes('--dry-run') ? 'land' : null;
  if (program === 'codex-review') return rest.includes('--unavailable') ? null : 'codex';
  if (program === 'codex') return rest.includes('exec') ? 'codex' : null;
  return null;
}

/** The lands and Codex reviews among `processes` (`[{ pid, commandLine }]`), in the order listed. */
export function workOfProcesses(processes) {
  const work = [];
  for (const { pid, commandLine } of processes) {
    const kind = typeof commandLine === 'string' ? workKindOf(commandLine) : null;
    if (kind === 'land') work.push({ source: 'land', pid, commandLine, text: `merge-queue land, pid ${pid}: ${commandLine}` });
    else if (kind === 'codex') work.push({ source: 'codex', pid, commandLine, text: `Codex review, pid ${pid}: ${commandLine}` });
  }
  return work;
}

/** One look at the machine: `{ state, at, work, needsYou, unread, leftOut }`. `read` holds one reader per source,
 * each of which throws when it cannot look: `agents()` (`claude agents --json --all`), `recorded()` (the ids of the
 * record of `js-harness sessions start`), `gateLock()` (as `readGateLock` gives it) and `processes()`. `state` is
 * `busy` when anything runs, else `unknown` when a source could not be read, else `quiet`. */
export function lookAtMachine(read, { self = null, now }) {
  const work = [];
  const unread = [];
  let needsYou = [];
  let leftOut = [];
  const attempt = (source, step) => {
    try {
      return step();
    } catch (err) {
      unread.push({ source, reason: err.message, text: `${source}: ${err.message}` });
      return undefined;
    }
  };
  const agents = attempt('Claude sessions', read.agents);
  if (agents !== undefined) {
    // The record only marks a session; one that could not be read marks none.
    let recorded = [];
    try {
      recorded = read.recorded();
    } catch {
      recorded = [];
    }
    const sorted = sortSessions(agents, { self, recorded });
    work.push(...sorted.work);
    ({ needsYou, leftOut } = sorted);
  }
  const lock = attempt('gate lock', () => {
    const lockReading = read.gateLock();
    if (!lockReading.available) throw new Error(lockReading.reason.replace(/^the gate lock: /, ''));
    return lockReading;
  });
  if (lock !== undefined) work.push(...workOfGateLock(lock));
  const processes = attempt('processes', read.processes);
  if (processes !== undefined) work.push(...workOfProcesses(processes));
  const state = work.length > 0 ? 'busy' : unread.length > 0 ? 'unknown' : 'quiet';
  return { state, at: new Date(now()).toISOString(), work, needsYou, unread, leftOut };
}

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What needs the user, as a sentence end: `; 2 sessions need you`, or nothing. */
const needsClause = (look) => (look.needsYou.length === 0 ? '' : `; ${count(look.needsYou.length, 'session')} ${look.needsYou.length === 1 ? 'needs' : 'need'} you`);

/** The first line of a look. */
export function headOf(look) {
  if (look.state === 'busy') return `busy: ${count(look.work.length, 'thing')} ${look.work.length === 1 ? 'runs' : 'run'} on this machine${needsClause(look)}`;
  if (look.state === 'unknown') return `unknown: nothing was seen to run, but ${count(look.unread.length, 'source')} could not be read${needsClause(look)}`;
  return `quiet: nothing runs on this machine${needsClause(look)}`;
}

/** A titled list of `items`, or nothing when there are none. */
const section = (title, items) => (items.length === 0 ? [] : [`${title}:`, ...items.map((item) => `  ${item.text}`)]);

/** The lines of a look: its head, then what runs, what needs the user, what could not be read and who was left out. */
export function lookLines(look) {
  return [headOf(look), ...section('runs', look.work), ...section('needs you', look.needsYou), ...section('not read', look.unread), ...section('left out', look.leftOut)];
}
