// What `js-harness guard` decides for a note of a project's Claude Code memory folder whose type is `feedback`
// (odd/tasks/memory-feedback-home.md, S2): such a note holds a rule he stated, and memory is read by an agent that may
// or may not recall it. On 2026-10-15 a session waited for him to type /compact because his newer rule lived only in a
// note while AGENTS.md said the old one. A feedback note is therefore written only when it names its rule's home in
// the repository: `rule:<id>` of a live declared rule, or a phrase AGENTS.md holds, quoted on a line that names
// AGENTS.md. It is in force only where `rule:memory-feedback-home` is: a project that installs the harness turns
// nothing on by default (odd/tasks/honesty-audit.md S5). Loaded by bin/guard.mjs only for a memory note.
import { resultOf } from './memory-index-guard.mjs';
import { memoryNoteType } from './memory-rules.mjs';
import { RULES } from './rules-data.mjs';
import { ruleHere, ruleValue } from './rules.mjs';

const NAMED_RULE = /`rule:([a-z][a-z0-9-]*)`/g;
const QUOTED = /"([^"]+)"|“([^”]+)”/g;
const squash = (text) => text.replace(/\s+/g, ' ').trim();

/** The value of `rule:memory-feedback-home` where the project whose rules file reads `rulesText` declares it (the
 * rule is of this repository only), or null. */
export function homeRuleValue(rulesText) {
  const rule = ruleHere('memory-feedback-home', undefined, rulesText);
  return Object.hasOwn(rule, 'value') ? rule.value : null;
}

/** Where the note `text` says its rule lives: `{ home }` the first home found (`rule:<id>` or `AGENTS.md "<phrase>"`),
 * else `{ home: null, undeclared }` with the ids it names that no live rule declares. `agentsText` is the text of the
 * project's AGENTS.md, or null. A phrase counts at `rule:control-phrase-min` characters or more, whitespace squashed,
 * as `rules check` matches a rule's phrases. */
export function homeOf(text, agentsText) {
  const named = [...new Set([...text.matchAll(NAMED_RULE)].map((match) => match[1]))];
  const live = named.find((id) => RULES.some((rule) => rule.id === id && !Object.hasOwn(rule, 'retired')));
  if (live !== undefined) return { home: `rule:${live}` };
  if (typeof agentsText === 'string') {
    const agents = squash(agentsText);
    const shortest = ruleValue('control-phrase-min', 'characters');
    for (const line of text.split(/\r?\n/).filter((item) => item.includes('AGENTS.md'))) {
      for (const match of line.matchAll(QUOTED)) {
        const phrase = squash(match[1] ?? match[2]);
        if (phrase.length >= shortest && agents.includes(phrase)) return { home: `AGENTS.md "${phrase}"` };
      }
    }
  }
  return { home: null, undeclared: named };
}

/** Why the note `text`, named `name`, is refused, or null when it is no feedback note or names its home. */
export function noteRefusal(name, text, agentsText, value) {
  if (memoryNoteType(text) !== 'feedback') return null;
  const found = homeOf(text, agentsText);
  if (found.home !== null) return null;
  const undeclared = found.undeclared.length === 0 ? '' : ` It names ${found.undeclared.map((id) => `rule:${id}`).join(', ')}, which no live rule declares.`;
  return `js-harness guard: ${name} is a feedback note, a rule he stated, and it names no home of that rule in the `
    + `repository (rule memory-feedback-home: ${value}); a memory note is read by an agent that may or may not recall it. `
    + 'Cement the rule first, then make the note a pointer to it: declare it with js-harness rules change <id> and name '
    + '`rule:<id>` in the note, or write it into AGENTS.md and quote that line in the note as AGENTS.md "<phrase>".'
    + undeclared;
}

/** Why the `Write` or `Edit` of `toolInput` on the memory note `name` is refused, or null. The note is judged as the
 * call leaves it (`readNote` reads it from disk); the project is read (`rulesText()`, `agentsText()`) only for a
 * feedback note, so every other note costs no read. */
export function feedbackNoteRefusal(toolName, toolInput, name, { readNote, rulesText, agentsText }) {
  let before = null;
  try {
    before = readNote(toolInput.file_path);
  } catch {
    // A new note, or one that cannot be read: the call's own text is judged.
  }
  const text = resultOf(toolName, toolInput, typeof before === 'string' ? before : null);
  if (typeof text !== 'string' || memoryNoteType(text) !== 'feedback') return null;
  const value = homeRuleValue(rulesText());
  if (value === null) return null;
  return noteRefusal(name, text, agentsText(), value);
}
