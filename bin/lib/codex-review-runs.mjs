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
//
// Reading old lines. The schema stayed `v1` when `session` was added, so lines written before it have
// none: they were all run in the `current` session, the only one there was, and a reader takes a missing
// `session` as `current` (`runSession`), never as unknown. `durationMs` is `null` when the wall time of
// the attempt could not be measured; it is never a guess.
//
// What an attempt spent. `usage` holds the four token counts, each `null` when it is not known, and
// `usageSource` says where they were read: `rollout`, the rollout files of the lean session's own Codex
// home, or `null` when no count was read, which is every `current` attempt (ephemeral, in the user's home,
// which the command never reads). With them come `requests` (the token counts those files held, taken as
// requests to the model), `firstRequestInputTokens` (the input of the session's first request: what it
// loads before it has run anything) and `threads` (the rollout files that held a count), each `null` when
// unknown. A line with NO `usageSource` field was written before it existed: its `usage` is what Codex's
// `turn.completed` events reported, which for `exec review` on codex-cli 0.160.0 is zeros by construction
// and not a measurement (`rolloutReading` in ./codex-usage.mjs has the source). Read such a `usage` as
// unknown, not as a review that cost nothing.
import { appendJsonLine, jsonLinesPath, readJsonLines } from './codex-reviews.mjs';

export const CODEX_REVIEW_RUN_SCHEMA = 'js-harness.codex-review-run/v1';

const FILE = 'codex-review-runs.jsonl';

/** The session a run line was measured in: its `session` when that is `current` or `lean`, else
 * `current`, which is what every line written before the field existed ran in. */
export function runSession(run) {
  return run?.session === 'lean' ? 'lean' : 'current';
}

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
