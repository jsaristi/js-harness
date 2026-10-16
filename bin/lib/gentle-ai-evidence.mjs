// gentle-ai's evidence for a pull request's code commits, written on its own branch, and the line of coverage each
// code commit gets in the merge queue (odd/tasks/rule-hierarchy.md, "The merge door (T16e)", items 5 and 6).
// Why: on 2026-10-12 a gentle-ai review was claimed in a message, and written in a document of another branch
// (pull requests 68 and 69); the line in the body (bin/lib/pull-request.mjs) is a word, and stays as one.

import { spawnSync } from 'node:child_process';
import { gitOut } from './codex-review-coverage.mjs';

/** The commits a pull request's code commits must be named for: those committed after this moment. The pull requests
 * open when slice (b) landed pass as they are (the design's cut-over, his answer of 2026-10-16). */
export const GENTLE_AI_CUTOVER = '2026-10-17T05:00:00Z';

const FEATURE_DOCUMENT = /^odd\/tasks\/[^/]+\.md$/;

/** The lines a `git diff -U0` text adds to feature documents (`odd/tasks/<name>.md`) that say gentle-ai, in any case:
 * `{ path, line, text }`, `line` its number in the result. */
export function evidenceLines(diff) {
  const found = [];
  let file = null;
  let at = 0;
  let inHunk = false;
  for (const line of String(diff).split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      [file, inHunk] = [null, false];
      continue;
    }
    // A `+++ ` line is a header only before a file's first hunk, since an added line can start with "++"; git ends
    // a header with a tab when the path holds a space.
    if (!inHunk && line.startsWith('+++ ')) {
      file = line.startsWith('+++ b/') ? line.slice(6).replace(/\t$/, '') : null;
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      [at, inHunk] = [Number(hunk[1]), true];
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith('+')) {
      if (file !== null && FEATURE_DOCUMENT.test(file) && /gentle-ai/i.test(line)) found.push({ path: file, line: at, text: line.slice(1) });
      at += 1;
    } else if (line.startsWith(' ')) {
      at += 1;
    }
  }
  return found;
}

const HEX = '[0-9a-f]{7,40}';
const ALONE = (pattern) => new RegExp(`(?<![\\w-])${pattern}(?![\\w-])`, 'gi');

/** The ranges `a..b` a line names and the hashes it names outside them, each of seven to forty hexadecimal characters
 * standing alone (a lineage such as `review-702ae2f77ce86f47` names none). */
export function namedIds(text) {
  const ranges = [...String(text).matchAll(ALONE(`(${HEX})\\.\\.(${HEX})`))].map((match) => [match[1], match[2]]);
  const rest = String(text).replace(ALONE(`${HEX}\\.\\.${HEX}`), ' ');
  const hashes = [...rest.matchAll(ALONE(HEX))].map((match) => match[0]);
  return { ranges, hashes };
}

/** What the branch `main..head` writes of gentle-ai for its `codeCommits` (each `{ id, shortId, parentCount }`), read
 * in `cwd`: `{ due, where, missing, stray }`, or `{ unknown }` when git does not answer. `due` are the code commits
 * committed after `cutover`, less a merge of `main` (its review is Codex's, by what was written in it; gentle-ai's
 * range starts after it); `where` maps each commit a line names to that line's `path:line`; `missing` are the due
 * commits no line names; `stray` the first id a line names that is no commit of `main..head`, with its line, which is
 * what a rebase leaves. A line names a commit by its hash (seven characters at least) or holds it in a range `a..b`,
 * read first and last both included (`a`, and what `git rev-list a..b` lists): the range is resolved here, never
 * taken at the line's word. Only lines the branch adds to its feature documents count. */
export function gentleAiEvidence(cwd, { main, head, codeCommits, cutover = GENTLE_AI_CUTOVER, spawn = spawnSync }) {
  const git = (args) => gitOut(spawn, cwd, args);
  const listed = git(['rev-list', `${main}..${head}`]);
  const dated = git(['log', '--format=%H %cI', `${main}..${head}`]);
  const diff = git(['-c', 'core.quotePath=false', 'diff', '-U0', '--no-renames', '--no-relative', '--no-color', '--no-ext-diff', `${main}...${head}`, '--', ':(top)odd/tasks/']);
  if (listed === null || dated === null || diff === null) return { unknown: true };
  const inRange = new Set(listed.split('\n').filter(Boolean));
  const dateOf = new Map(dated.split('\n').filter(Boolean).map((line) => line.split(' ')));
  const resolve = (name) => git(['rev-parse', '--verify', '--quiet', `${name}^{commit}`])?.trim() || null;
  const mergeOfMain = (commit) => commit.parentCount > 1
    && (git(['rev-list', '--parents', '-n', '1', commit.id])?.trim().split(' ').slice(2) ?? [])
      .some((parent) => spawn('git', ['merge-base', '--is-ancestor', parent, main], { cwd }).status === 0);
  const due = codeCommits.filter((commit) => Date.parse(dateOf.get(commit.id) ?? '') > Date.parse(cutover) && !mergeOfMain(commit));

  const where = new Map();
  let stray = null;
  const name = (id, at) => {
    if (!where.has(id)) where.set(id, at);
  };
  for (const found of evidenceLines(diff)) {
    const at = `${found.path}:${found.line}`;
    const { ranges, hashes } = namedIds(found.text);
    for (const hash of hashes) {
      const id = resolve(hash);
      if (id !== null && inRange.has(id)) name(id, at);
      else stray ??= { id: hash.slice(0, 7), at };
    }
    for (const [from, to] of ranges) {
      const [first, last] = [resolve(from), resolve(to)];
      if (first === null || last === null || !inRange.has(last)) {
        stray ??= { id: (last === null || !inRange.has(last) ? to : from).slice(0, 7), at };
        continue;
      }
      for (const id of [first, ...(git(['rev-list', `${first}..${last}`]) ?? '').split('\n').filter(Boolean)]) name(id, at);
    }
  }
  return { due, where, missing: due.filter((commit) => !where.has(commit.id)), stray };
}

/** The sentence that leaves a pull request out for `evidence` (`gentleAiEvidence`) with commits `missing`, or `null`. */
export function evidenceRefusal({ missing, stray }) {
  if (missing.length === 0) return null;
  const names = missing.map((commit) => commit.shortId).join(', ');
  const hint = stray === null ? '' : `; ${stray.id} on ${stray.at} is no commit of this branch: a rebase changes the hashes, so name the new ones`;
  return `no written gentle-ai evidence for ${names} on this branch: name it, or its range, on a gentle-ai line of its feature document${hint}`;
}
