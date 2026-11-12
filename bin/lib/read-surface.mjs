// What a session reads to start, counted and held to a budget (F8 S6, odd/tasks/f8-s6-read-surface.md; the diet's
// section 7, C5 "what a session reads to start"): a session starts from the roadmap's Next and Decided and from the
// resume sections of its feature document (its `## State` head, or the older titles), and none of the three had a
// bound: the roadmap's two sections alone grew from 12.8k estimated tokens at S0 to 15.5k in fifteen days (with the
// one head S0 counted, 647, its measure was 13,413). The `read surface` row of `check`
// counts them, characters of the LF text over four, and refuses a roadmap or a head over its share. The budgets are
// the plan's figures, constants here because the messages and the tests read them: 15k in all, 10k of it for the
// roadmap's two sections, which leaves 5k for a head. It reads the roadmap and the feature documents, nothing else.
import fs from 'node:fs';
import path from 'node:path';
import { firstStep } from './next-step.mjs';
import { estimateTokens } from './payload.mjs';
import { tokenize } from './progress.mjs';
import { featureParts } from './feature-parts.mjs';
import { isHarnessRepository } from './spec.mjs';

/** The most the roadmap's Next and Decided hold together, in estimated tokens. */
export const ROADMAP_READ_BUDGET = 10000;
/** The most the `## State` head of a feature document holds, in estimated tokens. */
export const STATE_HEAD_BUDGET = 5000;
/** The most a session reads to start: the roadmap's two sections and one head. */
export const READ_SURFACE_BUDGET = ROADMAP_READ_BUDGET + STATE_HEAD_BUDGET;

/** The feature documents of this repository whose resume head was over the budget when the row arrived
 * (2026-11-11), by file name: history kept under a resume title. The list only shrinks: its test fails for a name
 * at or under the budget. It holds in the harness's own repository alone, and the row names what it leaves out. */
export const RESUME_LEGACY = ['one-model-home.md', 'rule-hierarchy.md', 'session-channel.md'];
/** The share of the roadmap's budget from which the row says, while it still passes, that the budget is near. */
export const NEAR_SHARE = 0.9;

const ROADMAP = 'docs/ROADMAP.md';
const HISTORY = 'docs/roadmap-history.md';
const TASKS = 'odd/tasks';

/** The level-two section `title` of `markdown`, from its heading to the line before the next heading of level one
 * or two, as LF text; `null` when it has none. A heading inside a fence opens no section. */
export function sectionOf(markdown, title) {
  const tokens = tokenize(markdown);
  const start = tokens.findIndex((token) => token.heading?.level === 2 && token.heading.title === title);
  if (start === -1) return null;
  const after = tokens.findIndex((token, index) => index > start && token.heading && token.heading.level <= 2);
  const lines = tokens.slice(start, after === -1 ? tokens.length : after).map((token) => token.line);
  // The text's last line break leaves an empty last line: it ends the section's last line and is no line of its own.
  if (after === -1 && lines.at(-1) === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

const tokensOf = (markdown, title) => {
  const section = markdown === null ? null : sectionOf(markdown, title);
  return section === null ? 0 : estimateTokens(section);
};

/** The resume head of the feature document `markdown`, in estimated tokens: every section the resume hook tells a
 * session to read (`featureParts`: `State`, and the older `Next step`, `State for a resume` and their kin), counted
 * together, since a document that keeps its state under an older title is read as much. None gives 0. */
export function resumeHead(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  return featureParts(markdown).sections.reduce((sum, { start, end }) => sum + estimateTokens(`${lines.slice(start - 1, end).join('\n')}\n`), 0);
}

/** The read surface of a project: `{ next, decided, state, total, legacy }` in estimated tokens. `roadmap` is the
 * roadmap's text, or `null` where there is none; `documents` are the feature documents, `{ name, text }`. `state`
 * is the largest resume head (`resumeHead`) of a document not named in `legacy`, `{ tokens, name }`, or `null` when
 * no document has one; `legacy` gives back the names of that list the project holds, which no figure counts. */
export function readSurface(roadmap, documents, legacy = []) {
  const next = tokensOf(roadmap, 'Next');
  const decided = tokensOf(roadmap, 'Decided');
  const state = documents
    .filter(({ name }) => !legacy.includes(name))
    .map(({ name, text }) => ({ tokens: resumeHead(text), name }))
    .filter(({ tokens }) => tokens > 0)
    .sort((a, b) => b.tokens - a.tokens)[0] ?? null;
  return { next, decided, state, total: next + decided + (state?.tokens ?? 0), legacy: documents.map(({ name }) => name).filter((name) => legacy.includes(name)) };
}

/** The text of `file`, `null` where there is none. A file that is there and cannot be read is no absence: its path
 * goes to `unread`, and the row fails on it instead of counting it as nothing. */
const textOf = (file, unread) => {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') unread.push(file);
    return null;
  }
};

/** The `read surface` row of `check` at `cwd`, as a list: none where the project has no Next or Decided in its
 * roadmap and no State head in a feature document. It fails for a roadmap or a head over its budget, and its next
 * step names the one to cut; it fails too for a roadmap or a document it could not read. `legacy` is the list of
 * documents left out of the head, `RESUME_LEGACY` in the harness's own repository and none elsewhere: the row
 * names each one it left out. */
export function checkReadSurface(cwd, { legacy = isHarnessRepository(cwd) ? RESUME_LEGACY : [] } = {}) {
  let names = [];
  const unread = [];
  try {
    names = fs.readdirSync(path.join(cwd, TASKS)).filter((name) => name.endsWith('.md')).sort();
  } catch (error) {
    // No folder of feature documents is no head; one that is there and cannot be listed is not measured.
    if (error.code !== 'ENOENT') unread.push(path.join(cwd, TASKS));
  }
  const documents = names.map((name) => ({ name, text: textOf(path.join(cwd, TASKS, name), unread) })).filter(({ text }) => text !== null);
  const { next, decided, state, total, legacy: leftOut } = readSurface(textOf(path.join(cwd, ROADMAP), unread), documents, legacy);
  if (unread.length > 0) {
    const files = unread.map((file) => path.relative(cwd, file).replaceAll('\\', '/')).join(', ');
    return [{ name: 'read surface', pass: false, detail: `could not read ${files}, so what a session reads to start is not measured`, next: firstStep(`make ${files} readable, then run this again`) }];
  }
  if (total === 0 && leftOut.length === 0) return [];
  const roadmap = next + decided;
  const head = state === null ? 'no resume head' : `the largest resume head ${state.tokens} in ${TASKS}/${state.name} (budget ${STATE_HEAD_BUDGET})`;
  const out = leftOut.length === 0 ? '' : `; not counted, the legacy documents whose resume sections are over the head's budget of ${STATE_HEAD_BUDGET}: ${leftOut.join(', ')}`;
  const detail = `${total} estimated tokens (budget ${READ_SURFACE_BUDGET}): the roadmap's Next ${next} and Decided ${decided} (budget ${ROADMAP_READ_BUDGET}), ${head}${out}`;
  if (roadmap > ROADMAP_READ_BUDGET) {
    return [{ name: 'read surface', pass: false, detail, next: firstStep(`move settled paragraphs of the Next or Decided of ${ROADMAP}, word for word, to ${HISTORY}, from ${roadmap} to ${ROADMAP_READ_BUDGET} estimated tokens or fewer`) }];
  }
  if (state !== null && state.tokens > STATE_HEAD_BUDGET) {
    return [{ name: 'read surface', pass: false, detail, next: firstStep(`rewrite the resume sections of ${TASKS}/${state.name} from ${state.tokens} to ${STATE_HEAD_BUDGET} estimated tokens or fewer: its State says what is done, what is next and what is open, and its history goes to the Log`) }];
  }
  const near = roadmap > ROADMAP_READ_BUDGET * NEAR_SHARE;
  return [{ name: 'read surface', pass: true, detail, ...(near && { lines: [`the roadmap's two sections are within ${ROADMAP_READ_BUDGET - roadmap} estimated tokens of their budget: move settled paragraphs of Next, or the history a row of Decided keeps after its decision, word for word to ${HISTORY} before a commit is refused`] }) }];
}
