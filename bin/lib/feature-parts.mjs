// The parts of a feature document (`odd/tasks/<name>.md`) that a session resumed after a compaction needs: its resume
// sections, the task it works on, that task's specs and its last log entries, each as 1-based lines, inclusive, as
// the Read tool's `offset` takes them (odd/tasks/resume-open-task.md, S4). It reads the shapes the documents already
// use and asks none of them to change. Pure: it reads no file and calls no git, so the resume hook's deadline holds.
import { tasksOf } from './contract.mjs';
import { tokenize } from './progress.mjs';

// A resume section's title: one of these, then nothing, a parenthesis or a colon. `Next step, earlier` and
// `Next step, history` are history, and no title of that shape matches.
const RESUME_TITLE = /^(?:next step|next|state for a resume|resume here)(?:\s*\(.*\)|\s*:.*)?$/i;
const SPECS_TITLE = /^specs(?:\s*\(.*\))?$/i;
const LOG_TITLE = /^(?:log|progress)(?:\s*\(.*\))?$/i;
// A spec item opens at the margin with `- S1`, `- **S1**` or `S1.`.
const SPEC_START = /^(?:- \*\*(S\d+[a-z]?)\*\*|- (S\d+[a-z]?)\b|(S\d+[a-z]?)\.)/;
// A log entry opens at the margin with a bullet or with an `L<n>` paragraph.
const ENTRY_START = /^(?:- |L\d+\b)/;
const MAX_ENTRIES = 5;

/** `{ lines, sections, task, specs, entries }` of `markdown`; see odd/tasks/resume-open-task.md, S4. */
export function featureParts(markdown) {
  const tokens = tokenize(markdown, { stripComments: true });
  // The last line is the one `wc -l` ends on: a final newline opens no line of its own.
  const lines = tokens.length > 1 && tokens.at(-1).line === '' ? tokens.length - 1 : tokens.length;
  const sectionsAll = sectionsOf(tokens, lines);
  const sections = sectionsAll.filter((section) => RESUME_TITLE.test(section.title));
  const task = taskOf(markdown, tokens, sections[0]);
  if (task === null) return { lines, sections, task, specs: [], entries: [] };
  const named = new Set(textOf(tokens, task).match(/\bS\d+[a-z]?\b/g) ?? []);
  const specs = itemsOf(tokens, sectionsAll.find((section) => SPECS_TITLE.test(section.title)), SPEC_START)
    .map((item) => ({ id: item.match.slice(1).find(Boolean), start: item.start, end: item.end }))
    .filter((spec) => named.has(spec.id));
  const names = wordOf(task.id);
  const entries = itemsOf(tokens, sectionsAll.find((section) => LOG_TITLE.test(section.title)), ENTRY_START)
    .filter((item) => names.test(textOf(tokens, item)))
    .slice(-MAX_ENTRIES)
    .map(({ start, end }) => ({ start, end }));
  return { lines, sections, task, specs, entries };
}

/** Every `## ` section outside fences, `{ title, start, end }`: it ends before the next heading of level one or two,
 * at its last written line. */
function sectionsOf(tokens, lines) {
  const sections = [];
  tokens.forEach((token, index) => {
    if (!token.heading || token.heading.level > 2) return;
    const open = sections.at(-1);
    if (open && open.end === null) open.end = lastWritten(tokens, open.start, index + 1);
    if (token.heading.level === 2) sections.push({ title: token.heading.title, start: index + 1, end: null });
  });
  const open = sections.at(-1);
  if (open && open.end === null) open.end = lastWritten(tokens, open.start, lines + 1);
  return sections;
}

/** The task the session works on: the open task the first resume section names first, else the first open task. */
function taskOf(markdown, tokens, section) {
  const open = tasksOf(markdown).filter((task) => !task.done);
  if (open.length === 0) return null;
  const text = section === undefined ? '' : textOf(tokens, section);
  const named = open
    .map((task) => ({ task, at: text.search(wordOf(task.id)) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at)[0]?.task;
  const { id, start, end } = named ?? open[0];
  return { id, start, end };
}

/** The items of `section` that open at the margin with `start`, each to its last written line before the next item
 * or heading: `{ start, end, match }`. No section gives none. */
function itemsOf(tokens, section, start) {
  if (section === undefined) return [];
  const items = [];
  for (let index = section.start; index < section.end; index++) {
    const token = tokens[index];
    const match = token.fence ? null : start.exec(token.line);
    const boundary = match !== null || Boolean(token.heading);
    const open = items.at(-1);
    if (boundary && open && open.end === null) open.end = lastWritten(tokens, open.start, index + 1);
    if (match !== null) items.push({ start: index + 1, end: null, match });
  }
  const open = items.at(-1);
  if (open && open.end === null) open.end = lastWritten(tokens, open.start, section.end + 1);
  return items;
}

/** The last line, from `start` up to the line before `before` (both 1-based), that holds more than white space. */
function lastWritten(tokens, start, before) {
  let end = before - 1;
  while (end > start && tokens[end - 1].line.trim() === '') end -= 1;
  return end;
}

const textOf = (tokens, { start, end }) => tokens.slice(start - 1, end).map((token) => token.line).join('\n');

/** A pattern that finds `id` as a whole word: `T6` is not in `T6b`. */
const wordOf = (id) => new RegExp(`(?<![A-Za-z0-9])${id}(?![A-Za-z0-9])`);
