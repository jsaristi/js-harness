// Away hours: while he is away, how long each session of the project worked and how long it waited, and what ended
// each wait (odd/tasks/away-work.md). He said on 2026-11-19 that when he leaves the sessions alone almost nothing
// advances; the sitting that decides the cure reads this table, so it is measured from the records, not told.
//
// What it reads, each by the rule that already says it: his messages by `quoteOf`'s (`personTimesOf`, a tapped answer
// is his too), and an absence as a gap between two of them longer than `ABSENCE_MS`, the return check's; the sessions
// as the transcripts of the project's folders under the Claude home. A gap between two entries of a session is work
// when it is short (`idleMs`, measured to the next entry even past the window's end) or when the session's own tool
// call runs under it; any other gap is a wait, and so is one under a call that itself waits (a question, `js-harness
// wait`, a watch, a `sleep`). The rule does not read whether the turn had closed: a model thinking longer than
// `idleMs` with no call pending reads as waiting, which is why the totals are printed at two limits. A background run
// shows as a wait ended by its task's notice: the table names that ending so the reader can tell it apart.
//
// Read-only and wired into nothing: run it by hand, `node workshop/lib/away-hours.mjs --since <iso> [--now <iso>]
// [--idle <minutes>] [--root <checkout>] [--from <iso> --to <iso>] [--archive <session>=<iso> ...] [--json]`; `--from` and
// `--to` measure one window a record names instead of his absences; `--archive` ends a session at its archive time, the
// session named by the start of its transcript's id, which must name one session only. The functions above `main` take inline values; `main` reads the transcripts.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ABSENCE_MS } from '../../bin/lib/return-report.mjs';
import { gateLogDir, readGateLog } from '../../bin/lib/gate-log.mjs';
import { personTimesOf } from '../../bin/lib/person-times.mjs';
import { waitPartsOf } from '../../bin/lib/wake.mjs';
import { spawnSync } from 'node:child_process';
import { mainCheckout, parseTranscript, projectDirsOf, projectSlug, QUESTION_TOOLS, questionCallsOf, quoteEntry } from '../../bin/lib/sessions.mjs';

/** The process runner `mainCheckout` and `projectDirsOf` take: git, read whole as text. */
const gitRun = (command, args, options = {}) => spawnSync(command, args, { encoding: 'utf8', windowsHide: true, ...options });

const USAGE = 'usage: node workshop/lib/away-hours.mjs --since <iso> [--now <iso>] [--idle <minutes>] [--root <checkout>] [--from <iso> --to <iso>] [--archive <session>=<iso> ...] [--json]';
/** An argument `main` refuses: the command answers it with the usage and status 2. */
class UsageError extends Error {}

const HOUR_MS = 3_600_000;
const round = (n) => Math.round(n * 100) / 100;
const hours = (ms) => round(ms / HOUR_MS);
const iso = (ms) => new Date(ms).toISOString();

/** The entry kinds that say a session did or received something; the host's own records are left out. */
const ACTIVITY = new Set(['user', 'assistant', 'attachment', 'system']);
/** Tool calls that wait rather than work while they are pending. */
const WAIT_TOOLS = new Set([...QUESTION_TOOLS, 'Monitor', 'ScheduleWakeup']);
/** The shell waits besides `js-harness wait`, which `waitPartsOf` recognizes by its steps (a command that only names
 * it, `echo 'js-harness wait'`, is no wait; `node bin/js-harness.mjs wait` is one). */
const OTHER_WAIT_COMMAND = /js-harness(?:\.mjs)?["']?\s+(?:quiet\s+--wait|sessions\s+--watch)|(?:^|[;&|]\s*)sleep\s/;
const isWaitShell = (command) => waitPartsOf(command).length > 0 || OTHER_WAIT_COMMAND.test(command);
/** When `entry` happened: a queued message may carry its time only on its attachment. */
const timeOf = (entry) => Date.parse(entry?.timestamp ?? entry?.attachment?.timestamp ?? '');
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
/** The app's call that starts a session (`mcp__ccd_session__start_session`). */
const START_TOOL = /(?:^|__)start_session$/;

const blocksOf = (entry) => (Array.isArray(entry?.message?.content) ? entry.message.content : []);
const textOf = (entry) => {
  const content = entry?.message?.content;
  if (typeof content === 'string') return content;
  return blocksOf(entry).filter((block) => block?.type === 'text').map((block) => block.text).join('\n');
};

/** His absences among `times` (his messages, oldest first): each gap longer than `minMs` as `{ from, to, open }`, and,
 * when `now` is further than `minMs` past his last message, the absence that still runs (`open: true`). */
export function absencesOf(times, { minMs = ABSENCE_MS, now }) {
  const sorted = [...times].sort();
  const out = [];
  for (let i = 1; i < sorted.length; i += 1) {
    if (Date.parse(sorted[i]) - Date.parse(sorted[i - 1]) > minMs) out.push({ from: sorted[i - 1], to: sorted[i], open: false });
  }
  const last = sorted.at(-1);
  if (last !== undefined && now - Date.parse(last) > minMs) out.push({ from: last, to: iso(now), open: true });
  return out;
}

/** What `entry`, the one that ended a wait, is, in words; 'nothing before the end' when `entry` is `undefined`. Read
 * by `quoteEntry`'s provenance first (`calls`, the session's question calls, make a tapped answer his): his words, a
 * peer message with or without its wrapper, a queued task notice. Only an entry that is not his is read by its tags,
 * for the app's events that record no origin. */
export function endedBy(entry, calls) {
  if (entry === undefined) return 'nothing before the end';
  const quote = quoteEntry(entry, calls);
  if (quote.person) return 'his words';
  if (/from another session/.test(quote.what)) return 'a message of another session';
  if (/task notification/.test(quote.what)) return 'an event of the app or a task';
  if (blocksOf(entry).some((block) => block?.type === 'tool_result')) return 'the result of its call';
  const text = textOf(entry);
  if (text.includes('<cross-session-message')) return 'a message of another session';
  if (/<(?:task-notification|side-sessions-event|ci-monitor-event)/.test(text)) return 'an event of the app or a task';
  return `an entry of type ${entry.type}${entry.attachment?.type ? ` (${entry.attachment.type})` : ''}`;
}

/** The kind of the call `block`: 'wait' (a call that itself waits), 'start' (the app starting a session, whose time to
 * return is the app's latency and not the session's work) or 'work'; with its words. */
function callKind(block) {
  if (WAIT_TOOLS.has(block.name)) return { kind: 'wait', label: block.name };
  const command = String(block.input?.command ?? '');
  if (SHELL_TOOLS.has(block.name) && isWaitShell(command)) return { kind: 'wait', label: `${block.name} ${command.trim().slice(0, 60)}` };
  if (START_TOOL.test(String(block.name))) return { kind: 'start', label: block.name };
  return { kind: 'work', label: block.name };
}

/** The calls still pending after each of `timed` (oldest first): a call is pending from its entry to the entry that
 * holds its own result (`tool_use_id`), and a call whose result never comes is never pending. */
function pendingAfter(timed) {
  const answered = new Map();
  timed.forEach((entry, index) => {
    for (const block of blocksOf(entry)) if (block?.type === 'tool_result' && !answered.has(block.tool_use_id)) answered.set(block.tool_use_id, index);
  });
  let open = [];
  return timed.map((entry, index) => {
    for (const block of blocksOf(entry)) {
      if (block?.type !== 'tool_use' || !(answered.get(block.id) > index)) continue;
      open = [...open, { ...callKind(block), until: answered.get(block.id) }];
    }
    open = open.filter((call) => call.until > index);
    return open;
  });
}

/** How much of the intervals `cuts` ([start, end] in ms) lies inside `[from, to)`. */
const overlapMs = (cuts, from, to) => cuts.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0);

/** The session's working, waiting and launch hours inside `[from, to)` (ms), from its `entries`, with each wait of at
 * least `idleMs` as `{ from, to, hours, endedBy, reason, lastReply }`. Time before its first entry is not its own; after its last
 * entry before `to` it waits. A call whose result the transcript does not hold is never pending, so a call still running
 * at the transcript's end reads as a wait: in an absence still open, a long gate running now is not told from idle time,
 * which a later run, once its result is written, corrects. `archivedAt` ends its window there; `lockWaits`, the
 * spans ([start, end] in ms) its gates queued for the machine's gate lock, are waits even under a running call. */
export function activityOf(entries, { from, to: windowTo, idleMs, archivedAt = Infinity, lockWaits = [] }) {
  const to = Math.min(windowTo, archivedAt);
  const timed = entries
    .filter((entry) => ACTIVITY.has(entry?.type) && Number.isFinite(timeOf(entry)))
    .sort((a, b) => timeOf(a) - timeOf(b));
  const pending = pendingAfter(timed);
  const questionCalls = questionCallsOf(timed);
  let working = 0;
  let waiting = 0;
  let launch = 0;
  let locked = 0;
  let inside = 0;
  const waits = [];
  let lastReply = '';
  for (let i = 0; i < timed.length; i += 1) {
    const a = timed[i];
    const start = timeOf(a);
    if (start >= to) break;
    if (start >= from) inside += 1;
    if (a.type === 'assistant' && textOf(a).trim() !== '') lastReply = textOf(a).trim();
    const next = timed[i + 1];
    const end = next === undefined ? to : Math.min(timeOf(next), to);
    const inStart = Math.max(start, from);
    if (end <= inStart) continue;
    const span = end - inStart;
    const calls = pending[i];
    const waitCall = calls.find((call) => call.kind === 'wait');
    // The gap is judged whole, to the next entry even past `to`: a window cut short does not turn idle time into work.
    const gap = next === undefined ? Infinity : timeOf(next) - start;
    if (calls.some((call) => call.kind === 'work') || (calls.length === 0 && gap <= idleMs)) {
      const queued = Math.min(span, overlapMs(lockWaits, inStart, end));
      working += span - queued;
      if (queued > 0) {
        waiting += queued;
        locked += queued;
        // The wait is dated by the lock's own spans inside the gap, not by the gap.
        const inGap = lockWaits.filter(([a, b]) => b > inStart && a < end);
        const lockFrom = Math.max(inStart, Math.min(...inGap.map(([a]) => a)));
        const lockTo = Math.min(end, Math.max(...inGap.map(([, b]) => b)));
        waits.push({ from: iso(lockFrom), to: iso(lockTo), hours: hours(queued), endedBy: "the machine's gate lock", reason: null, lastReply: lastReply.slice(-200) });
      }
      continue;
    }
    if (!waitCall && calls.some((call) => call.kind === 'start')) {
      launch += span;
      continue;
    }
    waiting += span;
    const ending = next !== undefined && timeOf(next) <= to ? next : undefined;
    // Under a wait call, the call is the reason and its own result the ending, when that came by the cutoff.
    const result = waitCall ? timed[waitCall.until] : undefined;
    const ended = waitCall ? (result !== undefined && timeOf(result) <= to ? result : undefined) : ending;
    waits.push({ from: iso(inStart), to: iso(end), hours: hours(span), endedBy: endedBy(ended, questionCalls), reason: waitCall ? `its own wait call: ${waitCall.label}` : null, lastReply: lastReply.slice(-200) });
  }
  return { workingHours: hours(working), waitingHours: hours(waiting), launchHours: hours(launch), lockHours: hours(locked), inside, waits };
}

/** `sessions` (`{ id, entries }`) with each entry counted once by its `uuid`: a transcript that copies another's history
 * holds the same entries under its own session id, so an entry stays in the transcript whose first entry is oldest (then
 * by id) and leaves the others; each session says how many it lost as `copied`. Returned in the order given. */
export function dedupeByUuid(sessions) {
  const first = (session) => session.entries.map((entry) => entry?.timestamp ?? '').filter(Boolean).sort()[0] ?? '~';
  const order = [...sessions].sort((a, b) => first(a).localeCompare(first(b)) || String(a.id).localeCompare(String(b.id)));
  const seen = new Set();
  const kept = new Map();
  for (const session of order) {
    const entries = session.entries.filter((entry) => {
      if (typeof entry?.uuid !== 'string') return true;
      if (seen.has(entry.uuid)) return false;
      seen.add(entry.uuid);
      return true;
    });
    kept.set(session, { ...session, entries, copied: session.entries.length - entries.length });
  }
  return sessions.map((session) => kept.get(session));
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** The manifest of the inputs read (`[{ file, text }]`): each file's bytes and sha256, and one digest over them all, in
 * the order given, so a figure can name exactly what it was measured from. */
export function manifestOf(inputs) {
  const files = inputs.map(({ file, text }) => ({ file, bytes: Buffer.byteLength(text), sha256: sha256(text) }));
  return { files, digest: sha256(files.map((f) => `${f.sha256} ${f.bytes} ${f.file}`).join('\n')) };
}

/** Which of the folder `names` under the Claude home's projects are the checkout's at `root` (its main checkout):
 * its own, each one `listed` names (the folders `projectDirsOf` gives for the worktrees git lists, wherever they are),
 * and, by name, the worktrees git no longer lists: the app's (`<repo>/.claude/worktrees/<name>`) and the siblings
 * `CLAUDE.md` asks for (`<repo>-worktrees/<name>`). Of 186 such folders on 2026-11-21, git listed 42 worktrees, so
 * git alone would drop the sessions of every removed one. A project whose path only starts with the checkout's
 * (`<repo>-site`, `<repo>--site`) is not one of them. */
export function projectFolders(names, root, listed = []) {
  const slug = projectSlug(path.resolve(root));
  const known = new Set(listed.map((dir) => path.basename(dir)));
  const ours = (name) => name === slug || known.has(name) || name.startsWith(`${slug}--claude-worktrees-`) || name.startsWith(`${slug}-worktrees-`);
  return names.filter(ours);
}

const titleOf = (entries) => entries.filter((entry) => entry?.type === 'custom-title').at(-1)?.customTitle ?? '(no title)';

/** Reads the project's transcripts changed since `since`, and prints each absence with each session's hours. */
export function main(argv = process.argv.slice(2), { claudeHome = path.join(os.homedir(), '.claude'), harnessHome = os.homedir(), root = process.cwd(), print = console.log, run = gitRun } = {}) {
  const flags = { idle: '10', archive: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const valued = token === '--archive' || ['--since', '--now', '--idle', '--root', '--from', '--to'].includes(token);
    // A flag never stands as a value: `--root --json` is a missing directory, not one named `--json`.
    if (valued && (argv[i + 1] === undefined || argv[i + 1].startsWith('--'))) throw new UsageError(`${token} needs a value`);
    if (token === '--json') flags.json = true;
    else if (token === '--archive') flags.archive.push(argv[(i += 1)]);
    else if (valued) flags[token.slice(2)] = argv[(i += 1)];
    else throw new UsageError(`unknown argument: ${token}`);
  }
  if (!flags.since) throw new UsageError('--since <iso> is required');
  if ((flags.from === undefined) !== (flags.to === undefined)) throw new UsageError('--from and --to go together');
  for (const name of ['since', 'now', 'from', 'to']) {
    if (flags[name] !== undefined && !Number.isFinite(Date.parse(flags[name]))) throw new UsageError(`--${name} is a time, not ${flags[name]}`);
  }
  // An archive time is a session's end the transcript does not hold: the app's record of it, given by hand.
  const archives = flags.archive.map((value) => {
    const [id, at] = value.split('=');
    if (!id || !Number.isFinite(Date.parse(at ?? ''))) throw new UsageError(`--archive is <session>=<iso>, not ${value}`);
    return { id, at: Date.parse(at) };
  });
  const idleMs = Number(flags.idle) * 60_000;
  // `Infinity` is no limit: the last gap of a session is measured as Infinity, which it would then count as work.
  if (!(idleMs > 0 && Number.isFinite(idleMs))) throw new UsageError(`--idle is a number of minutes above 0, not ${flags.idle}`);
  const since = Date.parse(flags.since);
  const now = flags.now ? Date.parse(flags.now) : Date.now();
  // A named window is measured with the same bounds as his messages, so it lies inside `--since` and `--now`.
  if (flags.from !== undefined) {
    if (!(Date.parse(flags.from) < Date.parse(flags.to))) throw new UsageError(`--from is before --to, not ${flags.from} after ${flags.to}`);
    if (Date.parse(flags.from) < since || Date.parse(flags.to) > now) throw new UsageError('--from and --to lie inside --since and --now');
  }
  const read = [];
  const checkout = mainCheckout(run, path.resolve(flags.root ?? root));
  const projectsDir = path.join(claudeHome, 'projects');
  const names = fs.existsSync(projectsDir) ? fs.readdirSync(projectsDir) : [];
  for (const folder of projectFolders(names, checkout, projectDirsOf(run, checkout, claudeHome)).map((name) => path.join(projectsDir, name))) {
    for (const name of fs.readdirSync(folder).filter((file) => file.endsWith('.jsonl'))) {
      const file = path.join(folder, name);
      if (fs.statSync(file).mtimeMs < since) continue;
      const text = fs.readFileSync(file, 'utf8');
      const { entries } = parseTranscript(text);
      read.push({ file, text, session: { id: name.slice(0, -'.jsonl'.length), title: titleOf(entries), entries } });
    }
  }
  // Copied history counts once, before his messages are read from it: a copy would double his entries too.
  const sessions = dedupeByUuid(read.map((input) => input.session)).map((session) => ({ ...session, his: personTimesOf(session.entries) }));
  for (const archive of archives) {
    const named = sessions.filter((session) => session.id.startsWith(archive.id)).length;
    if (named !== 1) throw new UsageError(`--archive ${archive.id} names ${named} sessions, not one`);
  }
  // The machine's gate log says how long each gate queued for the lock before it ran, and for which session.
  const lockWaits = new Map();
  for (const event of readGateLog(harnessHome).events) {
    if (!['start', 'refused'].includes(event.event) || !(event.waitedSeconds > 0) || typeof event.session !== 'string') continue;
    const end = Date.parse(event.at);
    lockWaits.set(event.session, [...(lockWaits.get(event.session) ?? []), [end - event.waitedSeconds * 1000, end]]);
  }
  const logInputs = ['log.1.jsonl', 'log.jsonl'].map((name) => path.join(gateLogDir(harnessHome), name)).filter((file) => fs.existsSync(file)).map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
  const manifest = manifestOf([...read.map(({ file, text }) => ({ file, text })), ...logInputs]);
  const times = sessions.flatMap((session) => session.his).filter((time) => Date.parse(time) >= since && Date.parse(time) <= now);
  // A window named by a record (`--from`, `--to`) is measured as it is; otherwise his absences are.
  const windows = flags.from ? [{ from: iso(Date.parse(flags.from)), to: iso(Date.parse(flags.to)), open: false, named: true }] : absencesOf(times, { now });
  const absences = windows.map((absence) => {
    const window = { from: Date.parse(absence.from), to: Date.parse(absence.to), idleMs };
    const measured = sessions.map((session) => {
      const archivedAt = archives.find((archive) => session.id.startsWith(archive.id))?.at;
      const activity = activityOf(session.entries, { ...window, archivedAt, lockWaits: lockWaits.get(session.id) ?? [] });
      return { id: session.id.slice(0, 8), title: session.title, copied: session.copied, ...(archivedAt !== undefined && { archivedAt: iso(archivedAt) }), ...activity };
    });
    // A session with an entry inside, or a call running across the whole window (work or launch measured with no entry
    // inside it), is a row. One with neither may have been open and idle, or archived: the transcript cannot tell.
    const rows = measured.filter((row) => row.inside > 0 || row.workingHours > 0 || row.launchHours > 0).sort((a, b) => b.workingHours - a.workingHours);
    const silent = measured.filter((row) => !rows.includes(row) && row.waitingHours > 0).map((row) => `${row.id} ${row.title}`);
    const his = times.filter((time) => Date.parse(time) > window.from && Date.parse(time) < window.to).length;
    return { ...absence, hours: hours(window.to - window.from), hisMessagesInside: his, rows, silent };
  });
  if (flags.json) {
    print(JSON.stringify({ since: iso(since), now: iso(now), idleMinutes: Number(flags.idle), manifest, absences }, null, 2));
    return 0;
  }
  print(`inputs: ${manifest.files.length} files (${read.length} transcripts, ${logInputs.length} of the gate log), digest ${manifest.digest.slice(0, 16)}`);
  for (const absence of absences) {
    print(`${absence.named ? 'window' : 'absence'} ${absence.from} -> ${absence.to}${absence.open ? ' (still open)' : ''}: ${absence.hours} h, idle ${flags.idle} min, his messages inside ${absence.hisMessagesInside}`);
    for (const row of absence.rows) {
      const longest = [...row.waits].sort((a, b) => b.hours - a.hours)[0];
      const extra = [row.launchHours > 0 && `launch ${row.launchHours} h`, row.lockHours > 0 && `gate lock ${row.lockHours} h`, row.copied > 0 && `${row.copied} copied entries left out`, row.archivedAt && `archived ${row.archivedAt}`].filter(Boolean);
      print(`  ${row.id} ${row.title}: working ${row.workingHours} h, waiting ${row.waitingHours} h${extra.length ? ` (${extra.join('; ')})` : ''}${longest ? `; longest wait ${longest.hours} h from ${longest.from}, ended by ${longest.endedBy}${longest.reason ? ` (${longest.reason})` : ''}` : ''}`);
    }
    const total = (key) => round(absence.rows.reduce((sum, row) => sum + row[key], 0));
    print(`  total of the ${absence.rows.length} sessions with an entry or a running call inside: working ${total('workingHours')} h, waiting ${total('waitingHours')} h, launch ${total('launchHours')} h`);
    if (absence.silent.length) print(`  no entry inside (open and idle, or archived: not told apart): ${absence.silent.length}: ${absence.silent.join('; ')}`);
  }
  return 0;
}

/** `main` as a command: its status, 2 with the usage for an argument it refuses, 1 for anything else that fails (a
 * transcript or a log that cannot be read), as `docs` and `subagents` keep 2 for their argument errors. */
export function cli(argv = process.argv.slice(2), { error = console.error, ...options } = {}) {
  try {
    return main(argv, options);
  } catch (failure) {
    error(failure.message);
    if (!(failure instanceof UsageError)) return 1;
    error(USAGE);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = cli();
