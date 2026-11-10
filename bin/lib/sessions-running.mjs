// The work that runs on the machine, for the live board (odd/tasks/visual-pages.md, spec 4, T5): the gates, and the
// lands, Codex and lens reviews and eval batches, read from the process listing at a check of the board and held until
// the next, so the board shows "en curso" while a paid batch runs and no session writes. It reads nothing itself:
// `readRunning` calls the `listProcesses` it is handed.
//
// A gate is matched as `findGates` matches one; every other kind by `workOf` of ./quiet.mjs, the one list `quiet`
// reads too (audit M34): by what runs, the program, the script or the dispatcher's verb, so a test file whose name
// holds the same words is none.

import { QUIET_PROCESSES, workOf } from './quiet.mjs';
import { comparable, findGates } from './sessions.mjs';

/** The listing's filter, as `listCommandLines` takes it: the gates `findGates` reads, and every process the one list
 * of work of ./quiet.mjs may count. */
export const RUNNING_PROCESSES = String.raw`check\.mjs|js-harness(\.mjs)?"?\s+"?check|${QUIET_PROCESSES}`;

/** The one of `worktrees` that holds `file`, or `null`. */
function worktreeOf(file, worktrees) {
  const flat = comparable(file);
  return worktrees.filter((tree) => flat.startsWith(`${comparable(tree)}/`)).sort((a, b) => b.length - a.length)[0] ?? null;
}

const sinceOf = (createdAt) => (Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : null);

/** The running work among `processes` (`{ pid, createdAt, commandLine }`): `[{ kind, pid, since, where }]`, the gates
 * first as `findGates` reads them, `since` the process's start or `null` where the listing gives none, `where` the
 * worktree of the script it runs or `null` (an installed dispatcher names none). */
export function findRunning(processes, worktrees = []) {
  const gates = findGates(processes, worktrees).map((gate) => ({
    kind: 'gate',
    pid: gate.pid,
    since: typeof gate.startedAt === 'string' ? gate.startedAt : null,
    where: typeof gate.worktree === 'string' ? gate.worktree : null,
  }));
  const others = [];
  for (const { pid, createdAt, commandLine } of processes) {
    const work = typeof commandLine === 'string' ? workOf(commandLine) : null;
    if (work === null) continue;
    others.push({ kind: work.kind, pid, since: sinceOf(createdAt), where: work.script === null ? null : worktreeOf(work.script, worktrees) });
  }
  return [...gates, ...others];
}

/** The running work at the time `at` (ms), held until `until` (ms): `{ at, until, items }`, or `{ at, until, unavailable }`
 * when `listProcesses()` throws. */
export function readRunning(listProcesses, worktrees, at, until) {
  const stamp = { at: new Date(at).toISOString(), until: new Date(until).toISOString() };
  try {
    return { ...stamp, items: findRunning(listProcesses(), worktrees) };
  } catch (err) {
    return { ...stamp, unavailable: `the process listing: ${err?.message ?? err}` };
  }
}
