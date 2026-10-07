// The scorer of a review over a diff whose defects are known: which of them the findings name, which they
// miss, and what else they report. Zero deps, no fs: it takes the findings and the key and gives the count,
// so the tests use inline values.
//
// Why. Two configurations of the review are compared by what they find, and "found" has to mean the same
// thing for both. A finding is a file and a range of lines (`normalizeAnswer` in
// bin/lib/codex-review-answer.mjs); a defect of the key is a file and a range of lines too
// (evals/review/seeded/key.json). A finding finds a defect when it is in the same file and its lines reach
// the defect's, give or take a few: a reviewer names the statement, or the line after the one that is
// wrong, where the key names the expression. What a finding says is not read here: no text of one is
// compared with any text of the key, so a finding that is on the right lines for the wrong reason counts.
// That is the limit of a scorer that asks no model, and the reason every extra is kept to be read.

// How many lines beside a defect a finding may be and still find it.
export const DEFAULT_TOLERANCE = 3;

// A path as both sides are compared: with forward slashes, since Codex names a file with the separator of
// the machine it ran on and the key is written with `/`. The case is kept: the fixture is a git tree, where
// `Store.mjs` and `store.mjs` are two files.
const slashed = (file) => String(file).replaceAll('\\', '/');

/** How many lines `finding` has in common with `defect` once the defect's range is `tolerance` lines wider
 * on each side: 0 or less when they are apart. */
function linesInCommon(finding, defect, tolerance) {
  return Math.min(finding.end, defect.end + tolerance) - Math.max(finding.start, defect.start - tolerance) + 1;
}

/** Whether the candidate `a` is a better match than `b`: more lines in common, then the nearer start. A
 * tie is not better, so of two equals the one met first is kept. */
const better = (a, b) => a.common > b.common || (a.common === b.common && a.distance < b.distance);

/** What `findings` (each `{ file, start, end, … }`, `file` from the root of the repository) found of the
 * defects of `key` (`{ defects: [{ id, kind, file, start, end }] }`):
 *
 *  - `found`: `{ id, kind, finding }` for each defect a finding counts for, in the order of the key, with
 *    the finding as it was given;
 *  - `missed`: `{ id, kind }` for every other defect, in the order of the key;
 *  - `extra`: the findings that count for no defect, in the order they were given;
 *  - `counts`: how many `defects`, `found`, `missed` and `extra`;
 *  - `recall`: found over defects, from 0 to 1, and `null` for a key with no defect.
 *
 * A finding matches a defect in the same file (see `slashed`) whose lines, widened by `tolerance` on each
 * side, it has a line in common with. It counts for one defect at most: of those it matches, the one it has
 * most lines in common with, then the one whose start is nearer its own, then the first in the key. That
 * choice looks at no other finding, so which defects are found is the same in whatever order the findings
 * come. A defect is found once: of the findings that count for it, the best by the same two measures, then
 * the first given, is the one named, and the others are extras. Neither input is changed.
 *
 * Throws when `findings` is not an array, `key` holds no array of defects, or `tolerance` is not a whole
 * number of lines, zero or more. */
export function scoreFindings(findings, key, { tolerance = DEFAULT_TOLERANCE } = {}) {
  if (!Array.isArray(findings)) throw new Error(`Expected the findings of a review as an array, got ${findings === null ? 'null' : typeof findings}.`);
  if (key === null || typeof key !== 'object' || !Array.isArray(key.defects)) throw new Error('Expected a key with its `defects`, as evals/review/seeded/key.json holds them.');
  if (!Number.isInteger(tolerance) || tolerance < 0) throw new Error(`The tolerance must be a whole number of lines, zero or more, got ${JSON.stringify(tolerance)}.`);
  const { defects } = key;
  // The best finding of each defect so far, by its place in the key; `undefined` while none counts for it.
  const best = new Array(defects.length).fill(undefined);
  findings.forEach((finding, order) => {
    const file = slashed(finding.file);
    let choice = null;
    defects.forEach((defect, at) => {
      if (slashed(defect.file) !== file) return;
      const candidate = { at, order, common: linesInCommon(finding, defect, tolerance), distance: Math.abs(finding.start - defect.start) };
      if (candidate.common > 0 && (choice === null || better(candidate, choice))) choice = candidate;
    });
    if (choice !== null && (best[choice.at] === undefined || better(choice, best[choice.at]))) best[choice.at] = choice;
  });
  const found = [];
  const missed = [];
  // The places, among the findings, of the ones that found a defect: every other finding is an extra.
  const counted = new Set();
  defects.forEach(({ id, kind }, at) => {
    if (best[at] === undefined) {
      missed.push({ id, kind });
    } else {
      counted.add(best[at].order);
      found.push({ id, kind, finding: findings[best[at].order] });
    }
  });
  const extra = findings.filter((_, order) => !counted.has(order));
  return {
    found,
    missed,
    extra,
    counts: { defects: defects.length, found: found.length, missed: missed.length, extra: extra.length },
    recall: defects.length === 0 ? null : found.length / defects.length,
  };
}
