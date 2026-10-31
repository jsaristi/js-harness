// The control of `rule:depth-pass` (odd/tasks/depth-pass-rule.md, T5): a feature document opened on or after the day
// its project declares, `harness.json` `depthPassSince`, holds a `## Depth pass` in the rule's order (js-harness-protocols
// section 9), and the commit that brings its verdict holds documents alone and comes before the feature's first code.
// It reads form and order, never depth: a hollow pass that cites, measures and concludes passes it, and the readers
// and the user judge the rest. A project with no `depthPassSince` is not held at all, so no project turns red on
// upgrade, and a document opened before the day keeps the form it was written in.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseContract } from './contract.mjs';
import { citationsIn } from './citations.mjs';
import { localDay } from './flaky.mjs';

const ITEMS = ['Method', 'Raw material', 'The bar', 'Refutation', 'Request'];
// An item opens a line, as a list item or a heading, bold or not: `- 1. Method:`, `### 2. Raw material`.
const ITEM_START = /^\s*(?:[-*+]\s+|#{3,4}\s+)?(?:\*\*)?(\d)\.\s+(Method|Raw material|The bar|Refutation|Request)\b/;
const VERDICT = /^\s*(?:[-*+]\s+)?Verdict: (supports|refutes)\b/m;
const ANSWERED = /\banswered: question \d+/;
const ADDS = /^\s*(?:[-*+]\s+)?Adds: (?:none|.+\(question \d+\))\s*\.?\s*$/;
const URL = /\bhttps?:\/\/\S+/;
const TRANSCRIPT_LINE = /\btranscript\b[^\n]*?\bline\s+\d+/i;
const SPEC = /^(\d+)\.\s/;
const NO_PASS = 'no "## Depth pass": large work holds one before its first code commit (js-harness-protocols section 9)';

/** The form of `markdown`'s pass, `file` being its repository path: the faults, in the order of the items. */
export function depthPassText(markdown, file) {
  const bodies = parseContract(markdown);
  if (!bodies.has('Depth pass')) return [NO_PASS];
  const lines = bodies.get('Depth pass').split('\n');
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
  for (const line of (bodies.get('Specs') ?? '').split('\n')) {
    const number = SPEC.exec(line)?.[1];
    if (number && !new RegExp(`\\bspec ${number}: (?:\`[^\`\\n]+\`: \\S|left out because \\S)`, 'i').test(bar)) {
      errors.push(`item 3, The bar, has no line for spec ${number}: \`spec ${number}: <command>: <result>\` or \`spec ${number}: left out because <reason>\``);
    }
  }
  const refutation = item(3).join('\n');
  if (!/`[^`\n]+`/.test(refutation.replace(ITEM_START, ''))) errors.push('item 4, Refutation, runs no command: name it in a code span with its result');
  if (!VERDICT.test(refutation)) errors.push('item 4, Refutation, gives no `Verdict: supports` or `Verdict: refutes`');
  const request = item(4).filter((line) => line.trim() !== '');
  if (!ADDS.test(request.at(-1))) errors.push('item 5, Request, does not end with `Adds: none` or `Adds: <what> (question <n>)`');
  return errors;
}

/** The control for every document of `root`, as `(file, markdown) => faults`: nothing at all where the project
 * declares no `depthPassSince`, else `depthPassErrors` with the history of openings read once, at the first call. */
export function depthPassFor(root) {
  if (sinceOf(root) === null) return () => [];
  let opened;
  return (file, markdown) => depthPassErrors({ root, file, markdown, opened: (opened ??= openedOn(root)) });
}

const gitIn = (root) => (args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split('\n').map((line) => line.trim()).filter(Boolean) : [];
};

/** The commit and the day each feature document under `odd/tasks/` was first added in `root`'s history, by path:
 * one `git log` for all of them, so the `contracts` row pays it once. */
export function openedOn(root, git = gitIn(root)) {
  const opened = new Map();
  let commit = null;
  // Newest first, so the last commit seen for a path is the one that first added it.
  for (const line of git(['log', '--diff-filter=A', '--format=>%H %cs', '--name-only', '--', 'odd/tasks'])) {
    if (line.startsWith('>')) {
      const [hash, day] = line.slice(1).split(' ');
      commit = { hash, day };
    } else if (commit) opened.set(line, commit);
  }
  return opened;
}

/** The day `root`'s `harness.json` holds the control from, or `null` where it declares none. */
function sinceOf(root) {
  try {
    const since = JSON.parse(fs.readFileSync(path.join(root, 'harness.json'), 'utf8'))?.depthPassSince;
    return typeof since === 'string' ? since : null;
  } catch {
    return null;
  }
}

/** The files of `commits` that are not documents (a document is Markdown). */
function codeIn(git, commits) {
  if (commits.length === 0) return [];
  return [...new Set(git(['show', '--format=', '--name-only', ...commits]))].filter((name) => !name.endsWith('.md'));
}

/** Every fault of the feature document at `file` (its repository path) in `root`, whose text is `markdown`: none
 * where the project declares no `depthPassSince` or the document was opened before it; else the form of its pass
 * (`depthPassText`) and the order of its commits. An untracked document counts as opened `today`. */
export function depthPassErrors({ root, file, markdown, git = gitIn(root), opened, today = localDay() }) {
  const since = sinceOf(root);
  if (since === null) return [];
  const added = (opened ?? openedOn(root, git)).get(file) ?? null;
  if ((added?.day ?? today) < since) return [];
  const errors = depthPassText(markdown, file);
  if (errors.includes(NO_PASS)) return errors;

  // The feature's own line: the commits after the one that opened the document, and that one, merges left out.
  const after = (tip) => (added ? [...git(['rev-list', '--no-merges', '--ancestry-path', `${added.hash}..${tip}`]), added.hash] : []);
  const staged = git(['diff', '--cached', '--name-only']).filter((name) => !name.endsWith('.md'));
  const [verdictCommit] = added ? git(['log', '--reverse', '--format=%H', '-G', 'Verdict: (supports|refutes)', '--', file]) : [];
  if (verdictCommit) {
    const mixed = codeIn(git, [verdictCommit]);
    if (mixed.length > 0) errors.push(`the commit that brings the verdict holds more than documents: ${mixed.join(', ')}; the pass is committed with documents alone, before the code`);
    const early = codeIn(git, after(verdictCommit).filter((hash) => hash !== verdictCommit));
    if (early.length > 0) errors.push(`code was committed before the pass's verdict: ${early.join(', ')}`);
  } else {
    const early = codeIn(git, after('HEAD'));
    if (early.length > 0) errors.push(`code was committed before the pass's verdict: ${early.join(', ')}`);
    if (staged.length > 0) errors.push(`code is staged before the pass's verdict is committed: ${staged.join(', ')}; commit the pass with documents alone first`);
  }
  const pass = parseContract(markdown).get('Depth pass');
  if (VERDICT.exec(pass)?.[1] === 'refutes' && !ANSWERED.test(pass) && (staged.length > 0 || codeIn(git, after('HEAD')).length > 0)) {
    errors.push('the verdict refutes and code is on the branch with no `answered: question <n>` in the pass');
  }
  return errors;
}
