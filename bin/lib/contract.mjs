// The task contract: the head of a feature document, in the shape `docs/origin.md` ("Task contract
// template") defines. This file is the template, a parser for its sections and a validator that
// rejects a contract `/goal` could not drive — see odd/tasks/task-contract.md. No fs here: every
// function takes markdown text, so the tests use inline fixture strings.
import { tokenize } from './progress.mjs';

export const CONTRACT_TEMPLATE = `## Goal
<one sentence: the outcome, not the steps>

## Why
<the reason — lets the model make judgment calls you didn't foresee>

## Done when
- \`<command>\` exits 0            # executable, never prose
- <observable behavior a human can check>

## In scope / Out of scope
- In: <areas it may touch>
- Out: <areas it must not touch, and why>

## Constraints
- <real constraint> — because <reason>

## Ask me before
<the few decisions that are mine: spend, irreversible, product choices>

## Tasks
- [ ] T1 (kind: design | build | verify | docs) <the first task; its kind sets its effort and sub-agent models>
`;

// `## Effort` is no longer required: a task's kind sets its effort (odd/tasks/effort-by-task.md, S1). It is
// still validated when present, so the documents that state one stay valid, and nothing reads it.
const REQUIRED_SECTIONS = ['Goal', 'Why', 'Done when', 'In scope / Out of scope', 'Constraints', 'Ask me before'];
const EFFORTS = ['medium', 'high'];

const ITEM_PATTERN = /^\s*[-*+]\s+(.*)$/;
// An inline code span at the very start of an item, then the rest of the item.
const COMMAND_PATTERN = /^(`+)(.+?)\1(?!`)\s*(.*)$/s;
const EXITS_ZERO_PATTERN = /\bexits 0\b/i;
// A code span that is wholly one `<...>` is a template placeholder (`<command>`); an `<ok>` inside a
// real command, or a shell redirect (`cmd <in.txt >out.txt`), is not.
const PLACEHOLDER_PATTERN = /^<[^<>]+>$/;

/** Every `## ` section outside a fence, as `title -> tokens` in document order; the tokens are the
 * shared fence-aware ones, so a `## Goal` inside a fenced example never opens a section. A title
 * that appears twice keeps its first section. */
function readSections(markdown) {
  const sections = new Map();
  let current = null;
  for (const token of tokenize(markdown, { stripComments: true })) {
    if (token.heading?.level === 2) {
      const { title } = token.heading;
      current = sections.has(title) ? null : [];
      if (current) sections.set(title, current);
      continue;
    }
    current?.push(token);
  }
  return sections;
}

/** True when the document has a real (not fenced) `## Goal` heading: the mark of a contract. */
export function isContract(markdown) {
  return readSections(markdown).has('Goal');
}

/** Each `## ` section's body by title, in document order: its lines up to the next `## ` heading,
 * trimmed, HTML comments removed. `### ` subheadings and fenced lines belong to the body. */
export function parseContract(markdown) {
  const bodies = new Map();
  for (const [title, tokens] of readSections(markdown)) {
    bodies.set(title, tokens.map((token) => token.line).join('\n').trim());
  }
  return bodies;
}

/** The `## Done when` list items, one string per item: a wrapped item is joined onto one line, and
 * fenced lines are ignored. */
function doneWhenItems(sectionTokens) {
  const items = [];
  let open = false; // whether the previous line was an item, so an indented line continues it
  for (const token of sectionTokens) {
    if (token.fence || token.heading) {
      open = false;
      continue;
    }
    const item = token.line.match(ITEM_PATTERN);
    if (item) {
      items.push(item[1].trim());
      open = true;
    } else if (open && /^\s+\S/.test(token.line)) {
      items[items.length - 1] += ` ${token.line.trim()}`;
    } else {
      open = false;
    }
  }
  return items;
}

/** The `## Done when` items split in two: `commands` (an item that opens with an inline code span
 * and says `exits 0`; the code span's text) and `checks` (every other item, for a human to judge). */
export function doneWhen(markdown) {
  const commands = [];
  const checks = [];
  for (const item of doneWhenItems(readSections(markdown).get('Done when') ?? [])) {
    const command = item.match(COMMAND_PATTERN);
    const span = command?.[2].trim();
    // An empty code span is no command: there is nothing to run.
    if (span && EXITS_ZERO_PATTERN.test(command[3])) commands.push(span);
    else checks.push(item);
  }
  return { commands, checks };
}

// A code span right before `exits 0`: the done-when form where it is not a list item of its own, as in a
// roadmap's table cell (odd/tasks/onboarding.md, D6).
const SPAN_EXITS_ZERO_PATTERN = /(`+)(.+?)\1(?!`)\s*exits 0\b/gi;

/** The commands `text` names in the done-when form, a code span right before `exits 0`, in order; an empty span
 * and a template placeholder (`<command>`) are none. */
export function commandsIn(text) {
  const commands = [];
  for (const match of text.matchAll(SPAN_EXITS_ZERO_PATTERN)) {
    const span = match[2].trim();
    if (span && !PLACEHOLDER_PATTERN.test(span)) commands.push(span);
  }
  return commands;
}

/** `{ ok, errors }`: one human-readable reason per problem — a missing or empty section, a `Done
 * when` with no command, a command still holding a placeholder, an `Effort` that is not `medium` or
 * `high` when there is one, a task whose `(kind: …)` is not one of TASK_KINDS. Static only: it never runs
 * a command. */
export function validateContract(markdown) {
  const errors = [];
  const bodies = parseContract(markdown);
  const usable = new Set();
  for (const title of REQUIRED_SECTIONS) {
    if (!bodies.has(title)) errors.push(`missing section "## ${title}"`);
    else if (bodies.get(title) === '') errors.push(`section "## ${title}" is empty`);
    else usable.add(title);
  }

  if (usable.has('Done when')) {
    const { commands } = doneWhen(markdown);
    if (commands.length === 0) {
      errors.push('"## Done when" has no command: add a list item that opens with an inline code span and says "exits 0"');
    }
    for (const command of commands) {
      if (PLACEHOLDER_PATTERN.test(command)) errors.push(`command \`${command}\` still holds a template placeholder`);
    }
  }

  if (bodies.has('Effort')) {
    const effort = bodies.get('Effort');
    if (effort === '') errors.push('section "## Effort" is empty');
    else if (!EFFORTS.includes(effort.toLowerCase())) {
      errors.push(`"## Effort" must be exactly "medium" or "high", found "${effort}"`);
    }
  }

  for (const { id, kind } of tasksOf(markdown)) {
    if (kind !== null && !TASK_KINDS.includes(kind)) {
      errors.push(`task ${id} names the kind "${kind}": one of ${TASK_KINDS.join(', ')}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** The kinds of work a task names as `(kind: <kind>)` (odd/tasks/effort-by-task.md, S1). They name
 * work, not a value Sebastián set, so they are a constant here and not rules. */
export const TASK_KINDS = ['design', 'build', 'verify', 'docs'];

// A checklist line: its box, then the rest of its first line.
const TASK_LINE_PATTERN = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
// A task's ID, as the session board reads it (`taskId` of bin/lib/sessions.mjs); a test holds the two alike.
const TASK_ID_PATTERN = /^([A-Za-z]{1,6}\d+[a-z]?)(?=[\s:]|$)/;
const KIND_PATTERN = /\(kind:\s*([^)]*?)\s*\)/;

/** Every checklist line that opens with a task ID, outside fences: `{ id, kind, done, line }` in document
 * order. `kind` is the text of its `(kind: …)` as written, or `null` when the first line names none. */
export function tasksOf(markdown) {
  const tasks = [];
  const tokens = tokenize(markdown, { stripComments: true });
  tokens.forEach((token, index) => {
    if (token.fence || token.heading) return;
    const step = token.line.match(TASK_LINE_PATTERN);
    const id = step && TASK_ID_PATTERN.exec(step[2])?.[1];
    if (!id) return;
    const kind = KIND_PATTERN.exec(step[2])?.[1] ?? null;
    // `tokenize` gives one token a line, so a token's index plus one is its line (the resume hook names it).
    tasks.push({ id, kind, done: step[1] !== ' ', start: index + 1, end: itemEnd(tokens, index) + 1 });
  });
  return tasks;
}

/** The index of the last written line of the list item at `tokens[index]`: the item runs over every line indented
 * further than its own line, blank lines between them included, and stops at a heading or at the first written
 * line indented no further than it. */
function itemEnd(tokens, index) {
  const indent = (line) => line.length - line.trimStart().length;
  const own = indent(tokens[index].line);
  let last = index;
  for (let at = index + 1; at < tokens.length; at++) {
    const { line, heading } = tokens[at];
    if (line.trim() === '') continue;
    if (heading || indent(line) <= own) break;
    last = at;
  }
  return last;
}

// The rows of the rules list a task's mode is read from (bin/lib/rules-data.mjs). A kind may have its own
// session effort, `session-effort-<kind>`; none is declared today (his answer of 2026-10-14, "Ninguno
// todavía"), so every kind takes `session-effort`.
const MODE_RULES = {
  session: 'session-effort',
  writer: 'subagent-writer-model',
  reader: 'subagent-reader-model',
  subagent: 'subagent-effort',
};
// The kinds whose tasks launch writers; a task with no kind may be any work, so it names both roles.
const WRITING_KINDS = new Set(['build', null]);

/** The mode of each task of the checklist, done ones included: `{ id, kind, done, effort, writerModel,
 * readerModel, subagentEffort, off }`. `readRule(id)` is the caller's `ruleHere` bound to the project's
 * rules text, giving `{ value, alias? }` or `{ off }`, or `null` for a rule the list does not declare.
 * `off` is `null`, or `'elsewhere'` / `'behind'` as `ruleHere` says, and then the four values are `null`.
 * A kind that is not one of TASK_KINDS is read as no kind here; `validateContract` names it. */
export function taskModes(markdown, readRule) {
  return tasksOf(markdown).map(({ id, kind: written, done }) => {
    const kind = TASK_KINDS.includes(written) ? written : null;
    const session = (kind && readRule(`session-effort-${kind}`)) || readRule(MODE_RULES.session);
    const writer = readRule(MODE_RULES.writer);
    const reader = readRule(MODE_RULES.reader);
    const subagent = readRule(MODE_RULES.subagent);
    const off = [session, writer, reader, subagent].find((rule) => rule?.off)?.off ?? null;
    if (off) return { id, kind, done, effort: null, writerModel: null, readerModel: null, subagentEffort: null, off };
    return {
      id,
      kind,
      done,
      effort: session?.value ?? null,
      writerModel: WRITING_KINDS.has(kind) ? (writer?.alias ?? writer?.value ?? null) : null,
      readerModel: reader?.alias ?? reader?.value ?? null,
      subagentEffort: subagent?.value ?? null,
      off: null,
    };
  });
}

const OFF_TEXT = {
  elsewhere: 'no effort or model declared in this project',
  behind: "this copy of the harness is older than the project's rules",
};

/** One task's mode as `contract modes` prints it:
 * `T3 (kind: build): session high; writers haiku, readers opus; every sub-agent at high`. */
export function modeLine(mode) {
  const head = `${mode.id} ${mode.kind ? `(kind: ${mode.kind})` : '(no kind)'}`;
  if (mode.off) return `${head}: ${OFF_TEXT[mode.off]}`;
  const roles = [mode.writerModel && `writers ${mode.writerModel}`, mode.readerModel && `readers ${mode.readerModel}`].filter(Boolean);
  const parts = [`session ${mode.effort ?? 'not declared'}`];
  if (roles.length) parts.push(roles.join(', '));
  if (mode.subagentEffort) parts.push(`every sub-agent at ${mode.subagentEffort}`);
  return `${head}: ${parts.join('; ')}`;
}
