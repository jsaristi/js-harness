// The work that runs on the machine, for the live board (odd/tasks/visual-pages.md, spec 4, T5): the gates, the Codex
// and lens reviews and the eval batches, read from the process listing at a check of the board and held until the
// next, so the board shows "en curso" while a paid batch runs and no session writes. It reads nothing itself:
// `readRunning` calls the `listProcesses` it is handed.
//
// A process is matched by its arguments, as `findGates` matches a gate: the script itself (`bin/codex-review.mjs`,
// `bin/lens-review.mjs`, `evals/suite.mjs`) or the dispatcher with the verb right after it, so a test file whose
// name holds the same words is none.

import { argumentsOf, comparable, DISPATCHER_PATTERN, findGates } from './sessions.mjs';

/** The listing's filter, as `listCommandLines` takes it: every command line any kind below could match. */
export const RUNNING_PROCESSES = String.raw`check\.mjs|codex-review|lens-review|suite\.mjs|js-harness(\.mjs)?"?\s+"?check`;

// Each kind by its script, and by the dispatcher's verb where it has one.
const KINDS = [
  { kind: 'codex-review', script: /(^|[\\/])bin[\\/]codex-review\.mjs$/, verb: 'codex-review' },
  { kind: 'lens-review', script: /(^|[\\/])bin[\\/]lens-review\.mjs$/, verb: 'lens-review' },
  { kind: 'evals', script: /(^|[\\/])evals[\\/]suite\.mjs$/ },
];

const NODE = /^\s*(?:"([^"]+)"|(\S+))/;

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
    const program = NODE.exec(commandLine);
    if (!program || !/(^|[\\/])node(\.exe)?$/i.test(program[1] ?? program[2])) continue;
    const args = argumentsOf(commandLine.slice(program[0].length));
    const [first] = args;
    if (first === undefined) continue;
    const byScript = KINDS.find((one) => one.script.test(first));
    const byVerb = DISPATCHER_PATTERN.test(first) ? KINDS.find((one) => one.verb !== undefined && one.verb === args[1]) : undefined;
    const found = byScript ?? byVerb;
    if (found === undefined) continue;
    others.push({ kind: found.kind, pid, since: sinceOf(createdAt), where: byScript ? worktreeOf(first, worktrees) : null });
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
