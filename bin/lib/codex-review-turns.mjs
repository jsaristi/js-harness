// Where a review of a range is cut into turns: a merge of the default branch below HEAD, read by what was
// written in it, then the commits after it (odd/tasks/merge-below-head.md). His answer of 2026-10-16:
// a hand-resolved merge of main is reviewed only on the lines written in it, wherever it sits.

import { spawnSync } from 'node:child_process';
import { mergeStart } from './codex-review-coverage.mjs';
import { recheckState } from './codex-review-recheck.mjs';
import { readCodexReviewRuns } from './codex-review-runs.mjs';
import { readCodexReviews } from './codex-reviews.mjs';
import { leftOutOf } from './codex-review-scope.mjs';

/** The merge the review of `given..tip` is cut at, from `uncovered`, the code commits of that range no record
 * covers (`reviewCoverage`, newest first): `{ merge, from, side, branch, auto }`, the merge, its first parent
 * and what `mergeStart` says of it, or `null` for a range reviewed as one.
 *
 * It is cut only where nothing is lost by the cut (S1): the oldest uncovered commit is a merge below `tip`
 * that `mergeStart` reads as a merge at HEAD when asked of it (so every code commit before it has a record);
 * the review that ended at its first parent owes no correction, since a recheck of it would otherwise be
 * taken by the review of the merge, which is never one; and the files written in it are left out alike by
 * the marks at the merge and at `tip`, since the merge's turn reads its marks and the push reads those of
 * `tip`. `null` too wherever git or the records cannot say. */
export function mergeTurn(cwd, { given, tip, uncovered, spawn = spawnSync, where, remote = 'origin' }) {
  const oldest = uncovered.at(-1);
  if (oldest === undefined || oldest.id === tip || oldest.parentCount !== 2) return null;
  const atMerge = mergeStart(cwd, { given, tip: oldest.id, spawn, where, remote });
  if (atMerge === null) return null;
  const marksAt = (source) => leftOutOf(oldest.files, { cwd, source, spawn, where });
  const atMergeMarks = marksAt(oldest.id);
  const atTipMarks = marksAt(tip);
  if (atMergeMarks === null || atTipMarks === null) return null;
  if (oldest.files.some((file) => atMergeMarks.has(file) !== atTipMarks.has(file))) return null;
  let state;
  try {
    state = recheckState({ from: atMerge.from, records: readCodexReviews(cwd, { spawn, where }), runs: readCodexReviewRuns(cwd, { spawn }) });
  } catch {
    return null;
  }
  if (state.kind !== 'review') return null;
  return { merge: oldest.id, ...atMerge };
}
