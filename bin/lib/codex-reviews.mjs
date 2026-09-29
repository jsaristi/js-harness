// The record of Codex reviews: one JSON line per review, or per explicit skip, of a commit range.
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

/** `<git common dir>/js-harness/codex-reviews.jsonl` for the repository at `root`, or `null` when
 * `root` is not inside one. */
export function codexReviewsPath(root, { spawn = spawnSync } = {}) {
  const { commonGitDir } = gitDirs(root, spawn);
  return commonGitDir ? path.join(commonGitDir, 'js-harness', 'codex-reviews.jsonl') : null;
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

/** Appends `record` as one JSON line, creating the folder on first use, and returns the file's
 * path. Throws when `root` is not inside a git repository: there is no honest place to write. */
export function appendCodexReview(root, record, deps = {}) {
  const file = codexReviewsPath(root, deps);
  if (!file) throw new Error(`not a git repository: ${root}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // A damaged or hand-cut tail has no newline; starting on a fresh line keeps it from swallowing this record.
  const line = `${JSON.stringify(record)}\n`;
  fs.appendFileSync(file, endsUnterminated(file) ? `\n${line}` : line, 'utf8');
  return file;
}

/** Every record in the file, oldest first. A missing file, a blank line or a line that is not a
 * JSON object is skipped rather than thrown: a hand-edited or truncated record must never break
 * the check that reads it. */
export function readCodexReviews(root, deps = {}) {
  const file = codexReviewsPath(root, deps);
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
