// The budget of the root CLAUDE.md (odd/tasks/f8-s3-split.md, S5): Claude works from it and the AGENTS.md it imports
// (docs/proposals/harness-diet.md, D3), so it is paid on every turn too and is held to rule:claude-md-budget, beside
// AGENTS.md's own budget.
import fs from 'node:fs';
import path from 'node:path';
import { estimateTokens } from './payload.mjs';
import { ruleValue } from './rules.mjs';
import { RULES } from './rules-data.mjs';
import { firstStep } from './next-step.mjs';
import { namedRules } from './rules-check.mjs';
import { isHarnessRepository } from './spec.mjs';

// The budget the root CLAUDE.md is held to: the declared rule `claude-md-budget` (bin/lib/rules-data.mjs).
export const CLAUDE_MD_BUDGET = ruleValue('claude-md-budget', 'estimated tokens');

/** The PASS/FAIL row of the root CLAUDE.md's token budget at `cwd`, as a list: none where the project has no CLAUDE.md,
 * since one that works from AGENTS.md alone pays nothing more. A CRLF checkout counts as its LF text. */
export function checkClaudeBudget(cwd) {
  const file = path.join(cwd, 'CLAUDE.md');
  if (!fs.existsSync(file)) return [];
  const tokens = estimateTokens(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  const pass = tokens <= CLAUDE_MD_BUDGET;
  return [{ name: 'claude-md budget', pass, detail: `${tokens} estimated tokens (budget ${CLAUDE_MD_BUDGET})`, ...(!pass && { next: firstStep(`cut CLAUDE.md from ${tokens} to ${CLAUDE_MD_BUDGET} estimated tokens or fewer`) }) }];
}

// The folder instruction files (odd/tasks/folder-instructions.md): the host loads one when a session reads or writes a
// file in its folder, so each holds only what is bound to that place and names the rules it rests on, never their text.
export const FOLDER_INSTRUCTIONS = ['odd/tasks/CLAUDE.md', 'bin/CLAUDE.md', 'docs/CLAUDE.md', 'evals/CLAUDE.md'];

/** The most lines a folder instruction file may hold: 49, since the layout of odd/tasks/activity-folders-trial.md says under 50. A
 * constant until a `rules change` declares it, which only a rule/ branch can do. */
export const FOLDER_INSTRUCTIONS_LINES = 49;

const squash = (text) => text.replace(/\s+/g, ' ');

/** The PASS/FAIL rows of the folder instruction files at `cwd`, one per file that is there: within its line budget,
 * naming at least one rule as `rules check` reads a name (`namedRules`, so a mark inside a fence names none), and
 * holding no phrase of a live prose rule of `rules`, since a rule has one home and a second copy drifts. A file that is
 * there but cannot be read is a failed row. The rows are the harness's own: `own` (by default `isHarnessRepository`)
 * false gives none, since odd/tasks/folder-instructions.md keeps other projects out of scope. A CRLF checkout counts
 * as its LF text. */
export function checkFolderInstructions(cwd, { rules = RULES, own = isHarnessRepository(cwd) } = {}) {
  const rows = [];
  if (!own) return rows;
  for (const relative of FOLDER_INSTRUCTIONS) {
    const file = path.join(cwd, ...relative.split('/'));
    if (!fs.existsSync(file)) continue;
    let text;
    try {
      text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    } catch (error) {
      rows.push({ name: `folder instructions ${relative}`, pass: false, detail: `cannot be read (${error.code ?? error.message})`, next: firstStep(`make ${relative} a readable file, or remove it`) });
      continue;
    }
    const lines = text.replace(/\n$/, '').split('\n').length;
    const named = new Set(namedRules([{ path: relative, text }]).map((mark) => mark.id));
    const body = squash(text);
    const copies = rules
      .filter((rule) => !Object.hasOwn(rule, 'retired') && Array.isArray(rule.phrases))
      .filter((rule) => rule.phrases.some((phrase) => body.includes(squash(phrase))))
      .map((rule) => rule.id);
    const faults = [
      ...(lines > FOLDER_INSTRUCTIONS_LINES ? [`cut ${relative} to ${FOLDER_INSTRUCTIONS_LINES} lines or fewer`] : []),
      ...(named.size === 0 ? [`name in ${relative} the rules it rests on, as \`rule:<id>\``] : []),
      ...copies.map((id) => `replace in ${relative} the text of rule "${id}" with \`rule:${id}\``),
    ];
    const said = [
      `${lines} lines (budget ${FOLDER_INSTRUCTIONS_LINES})`,
      named.size === 0 ? 'names no rule' : `names ${named.size} rule${named.size === 1 ? '' : 's'}`,
      ...copies.map((id) => `repeats rule "${id}"`),
    ];
    rows.push({ name: `folder instructions ${relative}`, pass: faults.length === 0, detail: said.join(', '), ...(faults.length > 0 && { next: firstStep(faults[0]) }) });
  }
  return rows;
}
