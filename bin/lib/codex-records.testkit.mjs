// Codex review records as `js-harness codex-review` writes them, for the tests (odd/tasks/review-gate.md, S5). Not a
// test file, so `node --test` does not run it; the tests under bin/ import it.
//
// A record of a review is evidence only where a run line of the log names it (`admittedCodexReviews`): the command
// writes the run line first and the record after it, naming it. A test that writes a record of a review by hand, to
// be read as one, writes that line too through `withRunLine`; one that names its own `run` or `runs`, or writes a
// skip or a range with nothing to review, is left as it is, and a forged record is written bare on purpose. A line it
// writes says `testkit: true`, so a test that counts the lines of its own run can leave them out.
import fs from 'node:fs';
import path from 'node:path';
import { appendCodexReviewRun, codexReviewRunsPath, CODEX_REVIEW_RUN_SCHEMA } from './codex-review-runs.mjs';

let made = 0;

/** `rec` as the command records it: where it is a review naming no run, a run line of its range is appended to the
 * log of `root` (with `deps`, as `appendCodexReviewRun` takes them), and `rec` comes back naming it. */
export function withRunLine(root, rec, deps = {}) {
  if ((rec.outcome ?? 'reviewed') !== 'reviewed' || rec.runs !== undefined) return rec;
  if (typeof rec.run === 'string') {
    // Its line written before it says no range: given the record's. Written after it, for its answer: a line of the
    // range is written now, as the command's line would carry it.
    if (!giveRange(root, rec.run, rec, deps)) appendCodexReviewRun(root, { schema: CODEX_REVIEW_RUN_SCHEMA, id: rec.run, base: rec.base, from: rec.base, head: rec.head, outcome: 'reviewed', testkit: true }, deps);
    return rec;
  }
  if (rec.run !== undefined) return rec;
  const id = `testkit-run-${process.pid}-${(made += 1)}`;
  appendCodexReviewRun(root, { schema: CODEX_REVIEW_RUN_SCHEMA, id, base: rec.base, from: rec.base, head: rec.head, outcome: 'reviewed', testkit: true }, deps);
  return { ...rec, run: id };
}

/** Gives the run lines of `id` in the log of `root` that say no range the range of the record that names them, as the
 * command writes every run line with its `base`, `from` and `head`: a test that writes a run line for its answer
 * alone, then a record naming it, gets what `codex-review` would have written. A line that says a range keeps it.
 * Returns whether a line of `id` says this range now. */
export function giveRange(root, id, { base, head }, deps = {}) {
  const file = codexReviewRunsPath(root, deps);
  if (!file || !fs.existsSync(file)) return false;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let found = false;
  let changed = false;
  const out = lines.map((text) => {
    if (!text.trim()) return text;
    let line;
    try { line = JSON.parse(text); } catch { return text; }
    if (line?.id !== id) return text;
    if (line.head !== undefined) {
      if (line.head === head && (line.base === base || line.from === base)) found = true;
      return text;
    }
    found = true;
    changed = true;
    return JSON.stringify({ ...line, base, from: base, head });
  });
  if (changed) fs.writeFileSync(file, out.join('\n'), 'utf8');
  // Whether a line of `id` now says this range.
  return found;
}

/** The line of `rec`, a record written straight into `<git dir>/js-harness/codex-reviews.jsonl` of the repository at
 * `root` (its `.git` folder), with its run line written beside it in the same folder (`withRunLine`). */
export function recordLine(root, rec) {
  const dir = path.join(root, '.git', 'js-harness');
  fs.mkdirSync(dir, { recursive: true });
  const named = withRunLine(root, rec, { where: { commonGitDir: path.join(root, '.git') } });
  return `${JSON.stringify(named)}\n`;
}
