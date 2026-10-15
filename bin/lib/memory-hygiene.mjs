// The memory hygiene sensor (D2 of odd/tasks/memory-hygiene.md): reads a project's Claude Code memory
// folder and its hygiene journal and says whether a pass is due, for which reasons, and what a pass
// should look at. Read-only and zero-dependency; the judgment of a pass is the protocol's, never this
// file's, so a note's size or a citation to nothing is a candidate, not a reason to be due.
import fs from 'node:fs';
import path from 'node:path';
import { resolveCitations } from './citations.mjs';
import { memoryNoteType } from './memory-rules.mjs';
import { mainCheckout, projectSlug } from './sessions.mjs';

/** His index budget, 2026-10-15 (odd/tasks/memory-hygiene.md, L4); to be read from the rule
 * `memory-index-bytes` once rule-hierarchy's owner declares it. */
export const INDEX_BYTES = 4000;
/** His cadence, 2026-10-15 (L4); to be read from the rule `memory-pass-days` once declared. */
export const PASS_DAYS = 7;
/** The host's own figure for an index line (the `consolidate-memory` skill: "under ~150 chars"): a
 * constant with one home, not a rule, as rule-hierarchy settled for host figures. */
export const LINE_CHARS = 150;
/** Above this a note is printed as a candidate: notes load on demand, so their size costs nothing per
 * turn, but a long one is usually one that kept its amendments. */
export const NOTE_BYTES = 3000;

const INDEX = 'MEMORY.md';
const RULE_TYPES = new Set(['feedback', 'project']);
const DAY_MS = 24 * 60 * 60 * 1000;

/** The project's memory folder and slug: the main checkout's, so a worktree reads the same notes,
 * since Claude Code keeps one memory for a repository. */
export function memoryLocation({ home, project, run }) {
  const slug = projectSlug(path.resolve(mainCheckout(run, path.resolve(project))));
  return { slug, folder: path.join(home, '.claude', 'projects', slug, 'memory') };
}

/** Where the hygiene journal of a project lives: under `~/.js-harness`, never in the memory folder,
 * which the host owns. */
export function journalPath(home, slug) {
  return path.join(home, '.js-harness', 'memory-hygiene', slug, 'journal.jsonl');
}

/** The journal's entries, one JSON object a line; a line that does not parse is skipped, a missing
 * file is no entries. */
export function readJournal(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // A torn or foreign line says nothing about a pass.
    }
  }
  return entries;
}

/** The folder as data: the index (`null` when there is none) with its bytes, its modification time and
 * each non-empty line's number, text, length in code points and linked file; and each note, by name,
 * with its bytes, type, modification time and text. */
export function readMemory(folder) {
  const names = fs.readdirSync(folder).filter((name) => name.endsWith('.md')).sort();
  let index = null;
  if (names.includes(INDEX)) {
    const file = path.join(folder, INDEX);
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/).flatMap((line, i) => {
      if (line.trim() === '') return [];
      const link = /\]\(([^)\s]+\.md)\)/.exec(line);
      return [{ number: i + 1, text: line, chars: [...line].length, link: link ? link[1] : null }];
    });
    index = { bytes: Buffer.byteLength(text), mtimeMs: fs.statSync(file).mtimeMs, lines };
  }
  const notes = names.filter((name) => name !== INDEX).map((name) => {
    const file = path.join(folder, name);
    const text = fs.readFileSync(file, 'utf8');
    return { name, bytes: Buffer.byteLength(text), type: memoryNoteType(text), mtimeMs: fs.statSync(file).mtimeMs, text };
  });
  return { index, notes };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The line the `PostToolUse` hook adds when a pass is due (D5), or `null`. It runs after every tool call, so it
 * reads one small stamp file first and looks at the folder at most once a day for the project, whichever session
 * calls first; the stamp is written whether or not a pass was due. A folder that is missing or unreadable says
 * nothing: the hook must never cost a session more than a stat. */
export function dueNotice({ home, slug, folder, now }) {
  const stamp = path.join(path.dirname(journalPath(home, slug)), 'told');
  try {
    const told = Date.parse(fs.readFileSync(stamp, 'utf8').trim());
    if (!Number.isNaN(told) && now - told < DAY_MS) return null;
  } catch {
    // No stamp yet: look now.
  }
  if (!fs.existsSync(folder)) return null;
  let state;
  try {
    state = hygieneState({ memory: readMemory(folder), journal: readJournal(journalPath(home, slug)), now });
  } catch {
    return null;
  }
  fs.mkdirSync(path.dirname(stamp), { recursive: true });
  fs.writeFileSync(stamp, new Date(now).toISOString());
  if (!state.due) return null;
  return `js-harness: a memory hygiene pass is due for this project (${state.reasons.map((reason) => reason.id).join(', ')}): `
    + 'js-harness memory status says why. The orchestrator runs it at a task boundary, by the js-harness skill, "Memory hygiene"; '
    + 'a work session tells the orchestrator (js-harness notify) and goes on with its task. Said once a day.';
}

/** Whether a pass is due, as `{ due, reasons, candidates, lastPass }`: each reason and candidate is
 * `{ id, detail }`, in a fixed order. `lineCount(path)` and `commitExists(id)` resolve a note's
 * citations against the project (the resolver of `citations.mjs`); without them none is checked. */
export function hygieneState({ memory, journal, now, lineCount, commitExists }) {
  const reasons = [];
  const lines = memory.index?.lines ?? [];
  const lastPass = journal.filter((entry) => entry.kind === 'verify' && !Number.isNaN(Date.parse(entry.at))).at(-1) ?? null;

  if (lastPass === null) reasons.push({ id: 'no-pass', detail: 'no verified pass recorded yet' });
  if ((memory.index?.bytes ?? 0) > INDEX_BYTES) {
    reasons.push({ id: 'index-bytes', detail: `the index is ${memory.index.bytes} B, over ${INDEX_BYTES}` });
  }
  const long = lines.filter((line) => line.chars > LINE_CHARS).map((line) => line.number);
  if (long.length > 0) reasons.push({ id: 'line-chars', detail: `${plural(long.length, 'line')} over ${LINE_CHARS} characters: ${long.join(', ')}` });

  const noteNames = new Set(memory.notes.map((note) => note.name));
  const broken = lines.filter((line) => line.link !== null && !noteNames.has(line.link));
  if (broken.length > 0) reasons.push({ id: 'broken-link', detail: broken.map((line) => `${line.link} (line ${line.number})`).join(', ') });
  const linked = new Set(lines.map((line) => line.link));
  const orphans = memory.notes.filter((note) => !linked.has(note.name));
  if (orphans.length > 0) reasons.push({ id: 'orphan', detail: orphans.map((note) => note.name).join(', ') });

  if (lastPass !== null) {
    const known = new Set(lastPass.notes ?? []);
    const waiting = memory.notes.filter((note) => RULE_TYPES.has(note.type) && !known.has(note.name));
    if (waiting.length > 0) reasons.push({ id: 'new-rule-note', detail: waiting.map((note) => `${note.name} (${note.type})`).join(', ') });
    const at = Date.parse(lastPass.at);
    const written = [memory.index?.mtimeMs ?? 0, ...memory.notes.map((note) => note.mtimeMs)].some((mtime) => mtime > at);
    if (now - at >= PASS_DAYS * DAY_MS && written) {
      reasons.push({ id: 'cadence', detail: `${Math.floor((now - at) / DAY_MS)} days since the last pass, with notes written since` });
    }
  }

  const candidates = [];
  for (const note of memory.notes) {
    if (note.bytes > NOTE_BYTES) candidates.push({ id: 'note-bytes', detail: `${note.name} ${note.bytes} B` });
  }
  if (lineCount && commitExists) {
    for (const note of memory.notes) {
      const added = note.text.split(/\r?\n/).map((text, i) => ({ file: note.name, line: i + 1, text }));
      const { unresolved } = resolveCitations(added, { lineCount, commitExists });
      if (unresolved.length > 0) {
        candidates.push({ id: 'stale-citation', detail: `${note.name} ${unresolved.map((u) => `${u.citation} (${u.why})`).join(', ')}` });
      }
    }
  }

  return { due: reasons.length > 0, reasons, candidates, lastPass };
}
