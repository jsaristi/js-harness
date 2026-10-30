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
import { endsUnterminated } from './jsonl-tail.mjs';
import { lensCandidate } from './lens-candidate.mjs';

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
 * inside one.
 *
 * One git process says where that folder is, each time. A caller that reads and writes these files several
 * times over one repository asks once itself and says so in `where`: an object whose `commonGitDir` is what
 * `gitDirs` answered for `root`, the folder, or `null` for a `root` that is in no repository. It is read
 * once and taken as it is, `null` too, and git is not asked. So whoever keeps an answer from one call to the
 * next is the one who must not keep a `null`: a git that failed once may answer the next time
 * (`codexReviewMain`). A `where` that does not say (`undefined`) is none. Nothing is kept here: `check` reads
 * these files too, for a repository after another in one process. */
export function jsonLinesPath(root, name, { spawn = spawnSync, where } = {}) {
  const known = where?.commonGitDir;
  const commonGitDir = known === undefined ? gitDirs(root, spawn).commonGitDir : known;
  return commonGitDir ? path.join(commonGitDir, 'js-harness', name) : null;
}

/** `<git common dir>/js-harness/codex-reviews.jsonl` for the repository at `root`, or `null` when
 * `root` is not inside one. */
export function codexReviewsPath(root, deps = {}) {
  return jsonLinesPath(root, 'codex-reviews.jsonl', deps);
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

/** `record` with the subject hash of its range `base..head` (`./lens-candidate.mjs`), the identity the Claude lens
 * records carry too, so a check covers with it only while that range still hashes so (odd/tasks/f8-s1-reviews.md, T4;
 * diet section 10, item 6). The hash is asked of git itself, never of a caller's stand-in, since it is evidence; a
 * range git cannot diff leaves the record as it was, and a record without one covers as records always did. */
export function withSubjectHash(root, record) {
  const candidate = lensCandidate(root, { base: record.base, head: record.head });
  return candidate.error ? record : { ...record, subjectHash: candidate.subjectHash };
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

/** Whether the review of `rec`, a valid record, left out a file the project marks (`./codex-review-scope.mjs`),
 * as far as the record says: a check then takes the record to cover its commits only when what is pushed
 * holds its head.
 *
 * A record holds what its review did not read in `leftOut`, the count `reviewScope` gives: how many `files`
 * and `changedLines`, and the same two for the `documents` and for the `marked` ones among them. The two
 * kinds are not alike. A Markdown file is left out at every commit, by a rule no commit can change. A mark
 * is read at the head of the reviewed range, and a commit of that range can be the one that adds it: at the
 * commits before it the file is code, which nobody read.
 *
 * `false` only for a record that says none was marked: one with no `leftOut`, whose review read every file,
 * and one whose `leftOut.marked.files` is the count 0. Anything else is read as a record that left a marked
 * file out, the first records of it among them, which hold the two totals alone and cannot say. It does not
 * make a record less valid: `isValidCodexReview` never looked at `leftOut`. */
export function leftMarkedFilesOut(rec) {
  if (rec.leftOut === undefined) return false;
  return rec.leftOut?.marked?.files !== 0;
}
