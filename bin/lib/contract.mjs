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

## Effort
medium | high

## Ask me before
<the few decisions that are mine: spend, irreversible, product choices>
`;

const REQUIRED_SECTIONS = ['Goal', 'Why', 'Done when', 'In scope / Out of scope', 'Constraints', 'Effort', 'Ask me before'];
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

/** `{ ok, errors }`: one human-readable reason per problem — a missing or empty section, a `Done
 * when` with no command, a command still holding a placeholder, an `Effort` that is not `medium` or
 * `high`. Static only: it never runs a command. */
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

  if (usable.has('Effort')) {
    const effort = bodies.get('Effort');
    if (!EFFORTS.includes(effort.toLowerCase())) {
      errors.push(`"## Effort" must be exactly "medium" or "high", found "${effort}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}
