// The record of Claude lens reviews: one JSON line per run of `js-harness lens-review` (odd/tasks/f8-s1-reviews.md,
// T3; diet section 10, "S1, the Claude lens runner", item 6).
//
// It lives beside Codex's record, in `<git common dir>/js-harness/`, so every worktree of a clone shares it and
// deleting the one file undoes everything this module writes. A run holds each picked lens's outcome, findings,
// tokens, cost and duration. Only a run whose every lens was complete is `reviewed`; one with an incomplete lens is
// recorded as `incomplete` and covers nothing, so the attempt is kept and the review is not.
import { appendJsonLine, NOTHING_TO_REVIEW, readJsonLines } from './codex-reviews.mjs';

export const LENS_REVIEW_SCHEMA = 'js-harness.lens-review/v1';
export const LENS_REVIEWS_FILE = 'lens-reviews.jsonl';
export const INCOMPLETE = 'incomplete';

/** Appends `record` as one line and returns the file's path; throws outside a git repository. */
export function appendLensReview(root, record, deps = {}) {
  return appendJsonLine(root, LENS_REVIEWS_FILE, record, deps);
}

/** Every record, oldest first; a line that is not a JSON object is skipped. */
export function readLensReviews(root, deps = {}) {
  return readJsonLines(root, LENS_REVIEWS_FILE, deps);
}

const COMMIT_ID = /^[0-9a-f]{40,64}$/;
const HASH = /^[0-9a-f]{64}$/;

/** Whether `rec` is a record a check may treat as evidence over its range: the schema, full commit ids, a subject
 * hash, a `reviewedAt`, and an outcome of `reviewed` (with its lenses' results), or a skip (`unavailable`) or a
 * range with nothing to review, each with a reason. An `incomplete` run is never evidence. */
export function isValidLensReview(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return false;
  if (rec.schema !== LENS_REVIEW_SCHEMA) return false;
  if (typeof rec.base !== 'string' || !COMMIT_ID.test(rec.base)) return false;
  if (typeof rec.head !== 'string' || !COMMIT_ID.test(rec.head)) return false;
  if (typeof rec.subjectHash !== 'string' || !HASH.test(rec.subjectHash)) return false;
  if (typeof rec.reviewedAt !== 'string') return false;
  if (rec.outcome === 'reviewed') return Array.isArray(rec.results) && rec.results.length > 0 && rec.results.every((result) => result?.outcome === 'complete');
  return (rec.outcome === 'unavailable' || rec.outcome === NOTHING_TO_REVIEW) && typeof rec.reason === 'string' && rec.reason.trim() !== '';
}
