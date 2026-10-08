// The record of Codex reviews: one JSON line per review of a commit range, per explicit skip of one, or
// per range that held nothing to review.
//
// It lives in the git common dir, not in the working tree, so it adds no file to the project and
// every worktree of a clone shares it; deleting that one file undoes everything this module writes.
// (Neither the Codex plugin nor gentle-ai keeps a record a check could use: see T7 in
// odd/tasks/project-init.md.)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gitDirs } from './project.mjs';

export const CODEX_REVIEW_SCHEMA = 'js-harness.codex-review/v1';

// The outcome of a record of a range that held nothing to review: the range was read, there was nothing in
// it for a review to look at (its `reason` says what: it changes no file, for one), and no Codex session was
// started. It is an outcome of its own because it is neither of the other two. `reviewed` says Codex
// reviewed the range, which it did not; `unavailable` says a review could not be made, and here there was
// none to make. The range still needs a record: it can hold commits, a change and its revert for one, and
// `check --push` asks for a record over every code commit. The schema stays `v1`: a reader written before
// this outcome takes such a record as one it does not know (`isValidCodexReview` was false for it), so it
// counts it as invalid and covers nothing with it, and never takes it for a review.
export const NOTHING_TO_REVIEW = 'nothing-to-review';

// The three functions below are the plumbing of a JSON Lines file in the git common dir. The record of
// reviews is one such file and the log of review runs (`codex-review-runs.mjs`) another, in the same folder.

/** `<git common dir>/js-harness/<name>` for the repository at `root`, or `null` when `root` is not
 * inside one. */
export function jsonLinesPath(root, name, { spawn = spawnSync } = {}) {
  const { commonGitDir } = gitDirs(root, spawn);
  return commonGitDir ? path.join(commonGitDir, 'js-harness', name) : null;
}

/** `<git common dir>/js-harness/codex-reviews.jsonl` for the repository at `root`, or `null` when
 * `root` is not inside one. */
export function codexReviewsPath(root, deps = {}) {
  return jsonLinesPath(root, 'codex-reviews.jsonl', deps);
}

/** Whether `file` exists, is not empty and does not end with a newline. */
function endsUnterminated(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const { size } = fs.fstatSync(fd);
    if (size === 0) return false;
    const last = Buffer.alloc(1);
    fs.readSync(fd, last, 0, 1, size - 1);
    return last[0] !== 0x0a;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Appends `record` as one JSON line to the file `name`, creating the folder on first use, and returns
 * the file's path. Throws when `root` is not inside a git repository: there is no honest place to write. */
export function appendJsonLine(root, name, record, deps = {}) {
  const file = jsonLinesPath(root, name, deps);
  if (!file) throw new Error(`not a git repository: ${root}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // A damaged or hand-cut tail has no newline; starting on a fresh line keeps it from swallowing this record.
  const line = `${JSON.stringify(record)}\n`;
  fs.appendFileSync(file, endsUnterminated(file) ? `\n${line}` : line, 'utf8');
  return file;
}

/** Every JSON object in the file `name`, oldest first. A missing file, a blank line or a line that is
 * not a JSON object is skipped rather than thrown: a hand-edited or truncated line must never break
 * whoever reads the file. */
export function readJsonLines(root, name, deps = {}) {
  const file = jsonLinesPath(root, name, deps);
  if (!file) return [];
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const records = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) records.push(parsed);
    } catch {
      // A malformed line is not a record.
    }
  }
  return records;
}

/** Appends `record` as one JSON line, creating the folder on first use, and returns the file's
 * path. Throws when `root` is not inside a git repository: there is no honest place to write. */
export function appendCodexReview(root, record, deps = {}) {
  return appendJsonLine(root, 'codex-reviews.jsonl', record, deps);
}

/** Every record in the file, oldest first. A missing file, a blank line or a line that is not a
 * JSON object is skipped rather than thrown: a hand-edited or truncated record must never break
 * the check that reads it. */
export function readCodexReviews(root, deps = {}) {
  return readJsonLines(root, 'codex-reviews.jsonl', deps);
}

const COMMIT_ID = /^[0-9a-f]{40,64}$/;

/** Whether `rec` is a record a check may treat as evidence: the v1 schema, full commit ids for
 * `base` and `head` (which also keeps a hand-edited id from ever reaching git as an option), a
 * string `reviewedAt`, and an outcome of `reviewed`, or one of the two that are no review of Codex's,
 * `unavailable` and `NOTHING_TO_REVIEW`, with a reason that says why there is none. */
export function isValidCodexReview(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return false;
  if (rec.schema !== CODEX_REVIEW_SCHEMA) return false;
  if (typeof rec.base !== 'string' || !COMMIT_ID.test(rec.base)) return false;
  if (typeof rec.head !== 'string' || !COMMIT_ID.test(rec.head)) return false;
  if (typeof rec.reviewedAt !== 'string') return false;
  if (rec.outcome === 'reviewed') return true;
  return (rec.outcome === 'unavailable' || rec.outcome === NOTHING_TO_REVIEW) && typeof rec.reason === 'string' && rec.reason.trim() !== '';
}
