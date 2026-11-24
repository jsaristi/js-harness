// What runs from the installed copy, for `merge-queue --refresh-copy` run alone (S4, S5 of
// odd/tasks/lead-manual-steps.md). The lead refreshed the copy by hand while sessions held only waits on it: he listed
// the copy's node processes by its folder, stopped the waits, and told each session whose wait he stopped to run it
// again; anything else running from the copy (an eval batch, a Codex or lens review, a gate) meant no refresh. This
// reads the same from one process table and one listing of command lines, so the refresh refuses on other work and
// leaves a wait running, since a wait outlives its folder's swap (JH 284): one that runs alone and has loaded its code.
// A copy command a wait started, a wait still starting and a shell that runs more after its wait are other work (Codex
// P2 and P3s on 85e45a1..70d5c4e). The land's refresh asks here too whether a
// session claude calls busy only waits (`onlyWaits`). Pure: the listings and the transcripts are handed in. Zero
// dependencies.
import path from 'node:path';
import { CLOCK_TOLERANCE_MS, selectDescendants } from './process-tree.mjs';
import { argumentsOf, comparable, DISPATCHER_PATTERN, parseTranscript, sessionFacts } from './sessions.mjs';
import { shellWords } from './guard.mjs';
import { isWaitCommand } from './wake.mjs';

/** Whether the words of one simple command run `js-harness wait` itself: the command name or the dispatcher, run by
 * node or not, followed by `wait`, or `wait.mjs`. A wait that is only a word of it, as a shell's `-c` body or an echo's
 * argument, is not (Codex P1 on 7f918a9..b9a1512: `bash -c 'npm run check; js-harness wait --for 1'`). */
function runsWait([name, ...rest]) {
  const [script, ...after] = /(^|[/\\])node(\.exe)?$/i.test(name) ? rest : [name, ...rest];
  const dispatched = /(^|[/\\])js-harness(\.mjs)?$/.test(script ?? '') && after[0] === 'wait';
  if (!dispatched && !/(^|[/\\])wait\.mjs$/.test(script ?? '')) return false;
  // Every option of a wait takes one value, so its words after `wait` are pairs: a process listing writes a line break
  // as a space, and `js-harness wait --pr 1` with a second line reads as one wait with more words (Codex P2 on
  // 85e45a1..70d5c4e).
  const words = (dispatched ? after.slice(1) : after).filter((word) => !/^\d?>&\d$/.test(word));
  return words.every((word, at) => at % 2 === 1 || word.startsWith('--'));
}

/** Whether the command line `typed` does nothing but wait, as its shell reads it (`shellWords`): simple commands joined
 * by `;` or `&&`, each a `cd` or a `js-harness wait` (`runsWait`), the wait's output piped at most into `tail` or
 * `head`, with no redirection but `2>&1`, no substitution and nothing sent to the background. A wait in a line that
 * runs anything else is no wait (Codex P1 on be294ca..7f918a9: `js-harness wait --for 1; npm run check`). */
function waitAlone(typed) {
  // `shellWords` leaves a heredoc's body out, and bash expands it before the command runs (Codex P2 on fa61c36..5a411a9).
  if (!isWaitCommand(typed) || typed.includes('<<')) return false;
  const words = shellWords(typed, { groups: true });
  let waited = false;
  let start = 0;
  for (let at = 0; at <= words.length; at += 1) {
    if (at < words.length && !words.operators.has(at)) continue;
    const [name, ...rest] = words.slice(start, at);
    const before = start === 0 ? null : words[start - 1];
    const after = at === words.length ? null : words[at];
    // A line break or a `;` with nothing beside it runs nothing (Codex P2 on fa61c36..5a411a9).
    if (name === undefined && [null, ';'].includes(before) && [null, ';'].includes(after)) {
      start = at + 1;
      continue;
    }
    if (name === undefined || ![null, ';', '&&', '|'].includes(before) || ![null, ';', '&&', '|'].includes(after)) return false;
    if (rest.some((word) => /[<>`]|\$/.test(word) && !/^\d?>&\d$/.test(word))) return false;
    const wait = runsWait([name, ...rest]);
    if (before === '|' ? !/^(tail|head)$/.test(name) : after === '|' ? !wait : !(wait || (name === 'cd' && rest.length <= 1))) return false;
    waited ||= wait;
    start = at + 1;
  }
  return waited;
}

/** Whether the session of transcript `text` only waits: every work it has open is a `js-harness wait` (`waitAlone`),
 * and it is between turns with at least one open, or in its turn with every call it has open such a wait. claude
 * agents calls a background session busy while a wait of its runs (JH 130 on 2026-11-02,
 * odd/tasks/defect-trio.md), so the land's refresh reads this before it waits for one. Anything else open, calls run
 * in parallel beside a wait included (Codex P1 on be294ca..7f918a9), a turn with no call open (the session writes its
 * next step, whose hooks the copy runs), or a transcript that shows no wait, is a session at work. */
export function onlyWaits(text) {
  const facts = sessionFacts(text);
  const calls = new Map(); // the session's own tool_use id -> { tool, command }
  const answered = new Set();
  for (const entry of parseTranscript(text).entries) {
    if (entry.isSidechain || !Array.isArray(entry.message?.content)) continue;
    for (const block of entry.message.content) {
      if (entry.type === 'assistant' && block?.type === 'tool_use' && !calls.has(block.id)) calls.set(block.id, { tool: block.name, command: block.input?.command });
      if (entry.type === 'user' && block?.type === 'tool_result') answered.add(block.tool_use_id);
    }
  }
  const waits = (id) => calls.get(id)?.tool === 'Bash' && waitAlone(calls.get(id).command);
  const open = facts.work.filter((work) => !work.ended);
  const pending = [...calls.keys()].filter((id) => !answered.has(id));
  if (!open.every((work) => waits(work.toolUseId)) || !pending.every(waits)) return false;
  return facts.turnEndedAt !== null ? open.length > 0 : pending.length > 0;
}

/** How long a wait is taken as still starting: the dispatcher imports its command once it runs
 * (bin/js-harness.mjs), so a swap before that takes the code it has not loaded yet. A wait loads in about 0.3 s on
 * this machine (2026-11-24); a hundred times that leaves a stalled start room. */
export const WAIT_LOADED_MS = 30_000;

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

/** The line typed into a shell whose command line is `commandLine`, or null when it is no shell's: the body of the
 * last `eval '...'`, where claude's Bash tool puts the typed line among its own steps, its single quotes written `'\''`
 * and its double quotes `\"`; else the word after a shell's `-c`. */
function typedIn(commandLine) {
  const evals = [...commandLine.matchAll(/\beval '((?:[^']|'\\'')*)'/g)];
  if (evals.length > 0) return evals.at(-1)[1].replaceAll("'\\''", "'").replaceAll('\\"', '"');
  const [shell, flag, body] = argumentsOf(commandLine);
  return /(^|[/\\])(ba|da|z)?sh(\.exe)?$/i.test(shell ?? '') && /^-\w*c$/.test(flag ?? '') ? (body ?? null) : null;
}

/** Whether `commandLine` is a shell running a `js-harness wait` chained to other work (`waitAlone`): what it runs after
 * the wait starts when the wait ends, which can be inside the swap (Codex P2 on 85e45a1..70d5c4e). */
function chainsWait(commandLine) {
  const typed = typedIn(commandLine ?? '');
  return typed !== null && isWaitCommand(typed) && !waitAlone(typed);
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
 * with its parents and what it started. `now` is the clock of the look. `{ waits, blockers }`: each wait is
 * `{ pid, createdAt, commandLine, targets }`, `targets` the wait and what it started, by pid and creation time. A
 * blocker is `{ pid, createdAt, verb, commandLine, kind }`: `copy` for every other copy process, one a wait started
 * included (Codex P3 on 85e45a1..70d5c4e), and a wait whose creation time is not known; `starting` for a wait younger
 * than WAIT_LOADED_MS, which may not have loaded its code; `chained` for a listed shell that runs a wait chained to
 * other work (`chainsWait`). Both sorted by pid. */
export function readCopy({ snapshot, processes, globalDir, self, now = Date.now() }) {
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
  const others = processes.filter((one) => !(own.has(one.pid) && agrees(one, true))).sort((a, b) => a.pid - b.pid);
  const waits = [];
  const blockers = [];
  const blocker = ({ pid, createdAt, commandLine }, kind) => blockers.push({ pid, createdAt, verb: verbOf(commandLine), commandLine, kind });
  for (const one of others) {
    if (!fromCopy(one.commandLine, globalDir)) {
      // The shell of a chain is no copy process, and pnpm's shim stands between it and the wait.
      if (chainsWait(one.commandLine)) blocker(one, 'chained');
      continue;
    }
    if (!isWait(one.commandLine) || !Number.isFinite(one.createdAt) || created.get(one.pid) !== one.createdAt) {
      blocker(one, 'copy');
      continue;
    }
    if (now - one.createdAt < WAIT_LOADED_MS) {
      blocker(one, 'starting');
      continue;
    }
    const pids = selectDescendants(snapshot, { pid: one.pid, createdAt: one.createdAt });
    waits.push({ pid: one.pid, createdAt: one.createdAt, commandLine: one.commandLine, targets: pids.filter((pid) => created.has(pid)).map((pid) => ({ pid, createdAt: created.get(pid) })) });
  }
  return { waits, blockers };
}
