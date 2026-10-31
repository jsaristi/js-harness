// The control of `rule:depth-pass` (odd/tasks/depth-pass-rule.md, T5): a feature document opened on or after the day
// its project declares, `harness.json` `depthPassSince`, holds a `## Depth pass` in the rule's order (js-harness-protocols
// section 9), and on the feature's branch the commit that brings its verdict holds documents alone and no code comes
// before it. It reads form and order, never depth: a hollow pass that cites, measures and concludes passes it, and the
// readers and the user judge the rest. A project with no `depthPassSince` is not held at all, so no project turns red
// on upgrade, and a document opened before the day keeps the form it was written in.
//
// The order is judged on the branch alone, the commits `HEAD` holds and the trunk (`origin/HEAD`, `origin/main` or
// `origin/master`) does not: once a feature is on the trunk its order was judged, and a squash, a refuted plan left
// there or another feature's later code says nothing new. Pure: the command reads the history (`depthPassFor`,
// ../contract.mjs) and hands this module what it read.
import { parseContract } from './contract.mjs';
import { tokenize } from './progress.mjs';
import { citationsIn } from './citations.mjs';

const ITEMS = ['Method', 'Raw material', 'The bar', 'Refutation', 'Request'];
// An item opens a line, as a list item or a heading, bold or not: `- 1. Method:`, `### 2. Raw material`.
const ITEM_START = /^\s*(?:[-*+]\s+|#{3,4}\s+)?(?:\*\*)?(\d)\.\s+(Method|Raw material|The bar|Refutation|Request)\b/;
const VERDICT = /^\s*(?:[-*+]\s+)?Verdict: (supports|refutes)\b/m;
const ANSWERED = /\banswered: question \d+/;
const ADDS = /^\s*(?:[-*+]\s+)?Adds: (?:none|.+\(question \d+\))\s*\.?\s*$/;
const URL = /\bhttps?:\/\/\S+/;
const TRANSCRIPT_LINE = /\btranscript\b[^\n]*?\bline\s+\d+/i;
const SPEC = /^(\d+)\.\s/;
/** Whether `name` is a document: Markdown, the only files a pass may be committed with. */
export const isDocument = (name) => name.toLowerCase().endsWith('.md');
const NO_PASS = 'no "## Depth pass": large work holds one before its first code commit (js-harness-protocols section 9)';

/** The lines of `markdown`'s `## Depth pass`, fenced lines left out, or `null` where it has none. */
function passLines(markdown) {
  let lines = null;
  let inPass = false;
  for (const token of tokenize(markdown, { stripComments: true })) {
    if (token.heading?.level === 2) {
      inPass = token.heading.title === 'Depth pass' && lines === null;
      if (inPass) lines = [];
    } else if (inPass && !token.fence) lines.push(token.line);
  }
  return lines;
}

/** The verdict of `markdown`'s pass, `'supports'` or `'refutes'`, or `null` where its pass gives none. */
export function verdictOf(markdown) {
  return VERDICT.exec((passLines(markdown ?? '') ?? []).join('\n'))?.[1] ?? null;
}

/** The form of `markdown`'s pass, `file` being its project path: the faults, in the order of the items. */
export function depthPassText(markdown, file) {
  const lines = passLines(markdown);
  if (lines === null) return [NO_PASS];
  const starts = [];
  lines.forEach((line, index) => {
    const match = ITEM_START.exec(line);
    if (match) starts.push({ number: Number(match[1]), name: match[2], index });
  });
  const inOrder = starts.length === ITEMS.length && starts.every((start, k) => start.name === ITEMS[k] && start.number === k + 1);
  if (!inOrder) return ['the pass does not hold items 1. Method to 5. Request in that order, each once'];
  const item = (k) => lines.slice(starts[k].index, k + 1 < starts.length ? starts[k + 1].index : lines.length);
  const errors = [];

  const cites = (line) => citationsIn(line).some((cited) => cited.kind !== 'path' || cited.path !== file) || URL.test(line);
  if (!item(1).some(cites) && !TRANSCRIPT_LINE.test(item(1).join(' '))) {
    errors.push('item 2, Raw material, cites no `path:line`, commit, URL or transcript line outside this document');
  }
  const bar = item(2).join('\n');
  for (const line of (parseContract(markdown).get('Specs') ?? '').split('\n')) {
    const number = SPEC.exec(line)?.[1];
    if (number && !new RegExp(`\\bspec ${number}: (?:\`[^\`\\n]+\`: \\S|left out because \\S)`, 'i').test(bar)) {
      errors.push(`item 3, The bar, has no line for spec ${number}: \`spec ${number}:\`, its command in a code span, \`:\` and its result, or \`spec ${number}: left out because <reason>\``);
    }
  }
  const refutation = item(3).join('\n');
  if (!/`[^`\n]+`/.test(refutation.replace(ITEM_START, ''))) errors.push('item 4, Refutation, runs no command: name it in a code span with its result');
  if (!VERDICT.test(refutation)) errors.push('item 4, Refutation, gives no `Verdict: supports` or `Verdict: refutes`');
  const request = item(4).filter((line) => line.trim() !== '');
  if (!ADDS.test(request.at(-1))) errors.push('item 5, Request, does not end with `Adds: none` or `Adds: <what> (question <n>)`');
  return errors;
}

/** The order of one document's pass on its branch, from what the branch holds: `branch`, its commits oldest first,
 * each `{ code, brings }` (its files that are not documents, and whether it is the first whose version of the
 * document has a verdict in its pass); `staged`, the staged files that are not documents; `verdict` and `answered`,
 * read from the document as it stands. The faults, none where the branch has no say. */
export function depthPassOrder({ branch, staged, verdict, answered }) {
  const errors = [];
  const at = branch.findIndex((commit) => commit.brings);
  const before = (at < 0 ? branch : branch.slice(0, at)).flatMap((commit) => commit.code);
  if (at >= 0 && branch[at].code.length > 0) {
    errors.push(`the commit that brings the verdict holds more than documents: ${branch[at].code.join(', ')}; the pass is committed with documents alone, before the code`);
  }
  if (before.length > 0) errors.push(`code was committed before the pass's verdict: ${[...new Set(before)].join(', ')}`);
  if (at < 0 && staged.length > 0) errors.push(`code is staged before the pass's verdict is committed: ${staged.join(', ')}; commit the pass with documents alone first`);
  const code = staged.length > 0 || branch.some((commit) => commit.code.length > 0);
  if (verdict === 'refutes' && !answered && code) errors.push('the verdict refutes and code is on the branch with no `answered: question <n>` in the pass');
  return errors;
}

/** The control over one project, as `(file, markdown) => faults`, `file` the document's project path, from the
 * history the command read: `since` and `today`; `opened`, each document's path to `{ day }` it first came in, renames
 * followed; `branch`, the branch's commits oldest first as `{ hash, files }`, or `null` where no trunk is known;
 * `staged`, the staged files; and three readers of one document: `onTrunk(file)`, its text on the trunk or `null`;
 * `trail(file)`, the branch's commits that touched it oldest first as `{ hash, path }`, renames followed; and
 * `version(hash, path)`, its text at that commit or `null`. */
export function depthPassJudge({ since, today, opened, branch, staged, onTrunk, trail, version }) {
  return (file, markdown) => {
    if ((opened.get(file)?.day ?? today) < since) return [];
    const errors = depthPassText(markdown, file);
    if (errors.includes(NO_PASS) || branch === null) return errors;
    // A verdict already on the trunk was judged on the branch that brought it.
    if (verdictOf(onTrunk(file)) !== null) return errors;
    const touched = trail(file);
    if (opened.has(file) && touched.length === 0) return errors;
    const first = touched.find(({ hash, path }) => verdictOf(version(hash, path)) !== null);
    const facts = branch.map(({ hash, files }) => ({ code: files.filter((name) => !isDocument(name)), brings: hash === first?.hash }));
    const pass = (passLines(markdown) ?? []).join('\n');
    const code = staged.filter((name) => !isDocument(name));
    return [...errors, ...depthPassOrder({ branch: facts, staged: code, verdict: verdictOf(markdown), answered: ANSWERED.test(pass) })];
  };
}
