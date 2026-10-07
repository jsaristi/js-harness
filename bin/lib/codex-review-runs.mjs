// The log of Codex review runs: one JSON line per attempt of `js-harness codex-review` that launched
// Codex, whatever came of it, with what the attempt measured (tokens, items, wall time).
//
// It lives beside the record of reviews, in the same folder of the git common dir, and is a file of its
// own because a run is never evidence of a review: `check --push` reads `codex-reviews.jsonl` alone, so
// an attempt that failed can never count as one. Deleting this one file undoes everything this module
// writes.
//
// A record of a review names its run line by id (`run`). The run line is written first, so a line whose
// outcome is `reviewed` and that no record names means the record could not be written afterwards: the
// session met the evidence rule and was measured, and the command still exited 1 with no review recorded.
import { appendJsonLine, jsonLinesPath, readJsonLines } from './codex-reviews.mjs';

export const CODEX_REVIEW_RUN_SCHEMA = 'js-harness.codex-review-run/v1';

const FILE = 'codex-review-runs.jsonl';

/** `<git common dir>/js-harness/codex-review-runs.jsonl` for the repository at `root`, or `null` when
 * `root` is not inside one. */
export function codexReviewRunsPath(root, deps = {}) {
  return jsonLinesPath(root, FILE, deps);
}

/** Appends `run` as one JSON line, creating the folder on first use, and returns the file's path.
 * Throws when `root` is not inside a git repository. */
export function appendCodexReviewRun(root, run, deps = {}) {
  return appendJsonLine(root, FILE, run, deps);
}

/** Every run in the log, oldest first, with the tolerance of `readCodexReviews`: a missing file, a
 * blank line or a line that is not a JSON object is skipped rather than thrown. */
export function readCodexReviewRuns(root, deps = {}) {
  return readJsonLines(root, FILE, deps);
}
