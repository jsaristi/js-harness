// Away hours: while he is away, how long each session of the project worked and how long it waited, and what ended
// each wait (odd/tasks/away-work.md). He said on 2026-11-19 that when he leaves the sessions alone almost nothing
// advances; the sitting that decides the cure reads this table, so it is measured from the records, not told.
//
// What it reads, each by the rule that already says it: his messages by `quoteOf`'s (`personTimesOf`, a tapped answer
// is his too), and an absence as a gap between two of them longer than `ABSENCE_MS`, the return check's; the sessions
// as the transcripts of the project's folders under the Claude home. A gap between two entries of a session is work
// when it is short (`idleMs`) or when the session's own tool call runs under it, and a wait when the session had
// closed its turn or its pending call is itself a wait (a question, `js-harness wait`, a watch). A background run
// shows as a wait ended by its task's notice: the table names that ending so the reader can tell it apart.
//
// Read-only and wired into nothing: run it by hand, `node workshop/lib/away-hours.mjs --since <iso> [--now <iso>]
// [--idle <minutes>] [--json]`. The functions above `main` take inline values; `main` reads the transcripts.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ABSENCE_MS } from '../../bin/lib/return-report.mjs';
import { personTimesOf } from '../../bin/lib/person-times.mjs';
import { parseTranscript, QUESTION_TOOLS, quoteEntry } from '../../bin/lib/sessions.mjs';

const HOUR_MS = 3_600_000;
const round = (n) => Math.round(n * 100) / 100;
const hours = (ms) => round(ms / HOUR_MS);
const iso = (ms) => new Date(ms).toISOString();

/** The entry kinds that say a session did or received something; the host's own records are left out. */
const ACTIVITY = new Set(['user', 'assistant', 'attachment', 'system']);
/** Tool calls that wait rather than work while they are pending. */
const WAIT_TOOLS = new Set([...QUESTION_TOOLS, 'Monitor', 'ScheduleWakeup']);
const WAIT_COMMAND = /js-harness\s+(?:wait\b|quiet\s+--wait|sessions\s+--watch)|(?:^|[;&|]\s*)sleep\s/;
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

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

/** The session's own call that waits, among the tool calls of `entry`, in words, or `null`. */
function waitCallOf(entry) {
  for (const block of blocksOf(entry)) {
    if (block?.type !== 'tool_use') continue;
    if (WAIT_TOOLS.has(block.name)) return block.name;
    const command = String(block.input?.command ?? '');
    if (SHELL_TOOLS.has(block.name) && WAIT_COMMAND.test(command)) return `${block.name} ${command.trim().slice(0, 60)}`;
  }
  return null;
}

const callsTools = (entry) => entry?.type === 'assistant' && blocksOf(entry).some((block) => block?.type === 'tool_use');

/** What `entry`, the one that ended a wait, is, in words; `undefined` when nothing came before the window's end. */
export function endedBy(entry) {
  if (entry === undefined) return 'nothing before the end';
  const text = textOf(entry);
  if (text.includes('<cross-session-message')) return 'a message of another session';
  if (/<(?:task-notification|side-sessions-event|ci-monitor-event)/.test(text)) return 'an event of the app or a task';
  if (quoteEntry(entry).person) return 'his words';
  return `an entry of type ${entry.type}${entry.attachment?.type ? ` (${entry.attachment.type})` : ''}`;
}

/** The session's working and waiting hours inside `[from, to)` (ms), from its `entries`, with each wait of at least
 * `idleMs` as `{ from, to, hours, endedBy, lastReply }`. Time before its first entry is not its own; after its last
 * entry before `to` it waits, unless a call of its own still runs. */
export function activityOf(entries, { from, to, idleMs }) {
  const timed = entries
    .filter((entry) => ACTIVITY.has(entry?.type) && Number.isFinite(Date.parse(entry?.timestamp ?? '')))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  let working = 0;
  let waiting = 0;
  let inside = 0;
  const waits = [];
  let lastReply = '';
  for (let i = 0; i < timed.length; i += 1) {
    const a = timed[i];
    const start = Date.parse(a.timestamp);
    if (start >= to) break;
    if (start >= from) inside += 1;
    if (a.type === 'assistant' && textOf(a).trim() !== '') lastReply = textOf(a).trim();
    const next = timed[i + 1];
    const end = next === undefined ? to : Math.min(Date.parse(next.timestamp), to);
    const inStart = Math.max(start, from);
    if (end <= inStart) continue;
    const span = end - inStart;
    const waitCall = callsTools(a) ? waitCallOf(a) : null;
    const isWork = waitCall === null && (callsTools(a) || end - start <= idleMs);
    if (isWork) {
      working += span;
      continue;
    }
    waiting += span;
    const ending = next !== undefined && Date.parse(next.timestamp) <= to ? next : undefined;
    waits.push({ from: iso(inStart), to: iso(end), hours: hours(span), endedBy: waitCall ? `its own wait call: ${waitCall}` : endedBy(ending), lastReply: lastReply.slice(-200) });
  }
  return { workingHours: hours(working), waitingHours: hours(waiting), inside, waits };
}

/** The project folders under `projectsDir` for the checkout at `root`: its own, its worktrees' under it, and the
 * sibling worktrees `CLAUDE.md` asks for (`<repo>-worktrees/<name>`), whose folder name only starts with the slug. */
export function projectFolders(projectsDir, root) {
  const slug = path.resolve(root).replace(/[^A-Za-z0-9]/g, '-');
  return fs.readdirSync(projectsDir).filter((name) => name === slug || name.startsWith(`${slug}-`)).map((name) => path.join(projectsDir, name));
}

const titleOf = (entries) => entries.filter((entry) => entry?.type === 'custom-title').at(-1)?.customTitle ?? '(no title)';

/** Reads the project's transcripts changed since `since`, and prints each absence with each session's hours. */
export function main(argv = process.argv.slice(2), { claudeHome = path.join(os.homedir(), '.claude'), root = process.cwd(), print = console.log } = {}) {
  const flags = { idle: '10' };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--json') flags.json = true;
    else if (['--since', '--now', '--idle', '--root', '--from', '--to'].includes(token) && argv[i + 1] !== undefined) flags[token.slice(2)] = argv[(i += 1)];
    else throw new Error(`unknown argument: ${token}`);
  }
  if (!flags.since) throw new Error('--since <iso> is required');
  if ((flags.from === undefined) !== (flags.to === undefined)) throw new Error('--from and --to go together');
  const since = Date.parse(flags.since);
  const now = flags.now ? Date.parse(flags.now) : Date.now();
  const idleMs = Number(flags.idle) * 60_000;
  const sessions = [];
  for (const folder of projectFolders(path.join(claudeHome, 'projects'), flags.root ?? root)) {
    for (const name of fs.readdirSync(folder).filter((file) => file.endsWith('.jsonl'))) {
      const file = path.join(folder, name);
      if (fs.statSync(file).mtimeMs < since) continue;
      const { entries } = parseTranscript(fs.readFileSync(file, 'utf8'));
      sessions.push({ id: name.slice(0, 8), title: titleOf(entries), entries, his: personTimesOf(entries) });
    }
  }
  const times = sessions.flatMap((session) => session.his).filter((time) => Date.parse(time) >= since && Date.parse(time) <= now);
  // A window named by a record (`--from`, `--to`) is measured as it is; otherwise his absences are.
  const windows = flags.from ? [{ from: iso(Date.parse(flags.from)), to: iso(Date.parse(flags.to)), open: false, named: true }] : absencesOf(times, { now });
  const absences = windows.map((absence) => {
    const window = { from: Date.parse(absence.from), to: Date.parse(absence.to), idleMs };
    const measured = sessions.map((session) => ({ id: session.id, title: session.title, ...activityOf(session.entries, window) }));
    // A session with no entry inside the window may have been open and idle, or archived: the transcript cannot tell.
    const rows = measured.filter((row) => row.inside > 0).sort((a, b) => b.workingHours - a.workingHours);
    const silent = measured.filter((row) => row.inside === 0 && row.waitingHours > 0).map((row) => `${row.id} ${row.title}`);
    const his = times.filter((time) => Date.parse(time) > window.from && Date.parse(time) < window.to).length;
    return { ...absence, hours: hours(window.to - window.from), hisMessagesInside: his, rows, silent };
  });
  if (flags.json) {
    print(JSON.stringify({ since: iso(since), now: iso(now), idleMinutes: Number(flags.idle), absences }, null, 2));
    return 0;
  }
  for (const absence of absences) {
    print(`${absence.named ? 'window' : 'absence'} ${absence.from} -> ${absence.to}${absence.open ? ' (still open)' : ''}: ${absence.hours} h, idle ${flags.idle} min, his messages inside ${absence.hisMessagesInside}`);
    for (const row of absence.rows) {
      const longest = [...row.waits].sort((a, b) => b.hours - a.hours)[0];
      print(`  ${row.id} ${row.title}: working ${row.workingHours} h, waiting ${row.waitingHours} h${longest ? `; longest wait ${longest.hours} h from ${longest.from}, ended by ${longest.endedBy}` : ''}`);
    }
    const total = (key) => round(absence.rows.reduce((sum, row) => sum + row[key], 0));
    print(`  total of the ${absence.rows.length} sessions with an entry inside: working ${total('workingHours')} h, waiting ${total('waitingHours')} h`);
    if (absence.silent.length) print(`  no entry inside (open and idle, or archived: not told apart): ${absence.silent.length}: ${absence.silent.join('; ')}`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
