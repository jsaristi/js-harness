// A large range, in parts: which files of a range are reviewed together. Zero deps, no fs, no git: both
// functions take what git printed, or what the other returned, so the tests use inline values.
//
// Why parts. The evidence rule of `js-harness codex-review` asks that every changed line of the range be in
// the output of a command the review ran. The model reads the diff through a tool whose output is bounded,
// so on a large range the output is cut and some changed lines never appear: the rule then says, rightly,
// that the range was not inspected (`R3-exact-coverage-large-range` in odd/tasks/codex-exec-review.md). The
// rule is not relaxed for that. A range too large for one session is reviewed as several, each over some of
// its files and each held to the same rule for the changed lines of those files.
//
// Whole files only. A part is a list of files, because that is what a command can be limited to
// (`git diff <from> <head> -- <files>`) and what a finding names. A file is never cut in two: a file larger
// than the bound is a part of its own, and whether one session can read it is for the evidence rule to say.

import { ruleValue } from './rules.mjs';

// How many changed lines (additions plus deletions) a part holds at most. Measured against larger parts and
// kept by decision: one review in larger parts cost less and did not find one defect that parts of this
// size had found (odd/tasks/codex-review-cost.md, `## Progress`, the entry of T5 on 2026-10-09).
// `js-harness codex-review --part-lines <n>` takes another. The number is the declared rule's
// (`review-part-lines` in ./rules-data.mjs), written there and nowhere else.
export const PART_MAX_CHANGED_LINES = ruleValue('review-part-lines', 'changed lines');

// How many files a part holds at most, however few lines they change. Every path of a part goes on one git
// command line (the diff this command checks the part against) and into the one command the prompt names
// for the model to run, and Windows limits a command line: 8,191 characters through `cmd.exe`, 32,767 for a
// process started without it. Bounded by changed lines alone, a range of many small or binary files would be
// one part whose command cannot be run, and the review would fail without saying why. The declared count
// (`review-part-files` in ./rules-data.mjs, forty when this was written) stays under the smaller limit up
// to about 190 characters a path, the two commit ids included.
export const PART_MAX_FILES = ruleValue('review-part-files', 'files');

// How every count, split and diff of a range asks for renames, so that they agree: a file a range renames is
// one file under its new name, counted by the lines it changes, as git measures a rename, and not the file
// removed and added again (odd/tasks/rename-counted-by-changes.md). The option itself, and not `diff.renames`
// of whoever runs the command, says it.
export const RENAMES = '--find-renames';
// The option a range is read with when a rename would bring what no review read into code (`rangeFiles`).
export const NO_RENAMES = '--no-renames';

// One record of `git diff --numstat -z --find-renames`: the additions, the deletions (`-` for both when the
// file is binary) and the path, which may hold anything but a NUL; a rename has an empty path here, and its
// old name and its new one are the two records after it.
const NUMSTAT_RECORD = /^(?:(\d+)\t(\d+)|-\t-)\t([\s\S]*)$/;

/** The changed files of a range, from the output of `git diff --numstat -z --find-renames <from> <head>`:
 * each `{ path, changedLines, binary }`, in git's order, with `from`, its old name, for a file the range
 * renames. `changedLines` is the additions plus the deletions, and 0 for a binary file, which git counts no
 * lines of and which is still a changed file. With `-z` a path is written as it is, with no quoting, so it
 * is taken as it is.
 *
 * Throws on anything that is not such a record, a rename cut before its two names among them: a path
 * guessed wrong would be a file no part reviews. */
export function numstatFiles(numstat) {
  if (typeof numstat !== 'string') throw new Error(`Expected the output of \`git diff --numstat -z ${RENAMES}\`, got ${typeof numstat}.`);
  if (numstat === '') return [];
  const records = numstat.split('\0');
  // Every record ends with a NUL, so the text after the last one is empty unless the output was cut.
  const cut = records.pop();
  if (cut !== '') throw new Error(`The \`git diff --numstat -z\` output does not end where a record ends: ${JSON.stringify(cut.slice(0, 80))}.`);
  const files = [];
  for (let at = 0; at < records.length; at += 1) {
    const record = records[at];
    const match = NUMSTAT_RECORD.exec(record);
    if (!match) throw new Error(`Not a record of \`git diff --numstat -z ${RENAMES}\`: ${JSON.stringify(record.slice(0, 80))}.`);
    const [, added, deleted, named] = match;
    const binary = added === undefined;
    const changedLines = binary ? 0 : Number(added) + Number(deleted);
    if (named !== '') {
      files.push({ path: named, changedLines, binary });
      continue;
    }
    const [from, path] = [records[at + 1], records[at + 2]];
    if (!from || !path) throw new Error(`Not a rename of \`git diff --numstat -z ${RENAMES}\`, which names its old file and its new one: ${JSON.stringify(record.slice(0, 80))}.`);
    files.push({ path, from, changedLines, binary });
    at += 2;
  }
  return files;
}

const isChangedFile = (file) =>
  file !== null && typeof file === 'object' && typeof file.path === 'string' && file.path !== '' && (file.from === undefined || (typeof file.from === 'string' && file.from !== '')) && Number.isInteger(file.changedLines) && file.changedLines >= 0;

/** The parts a range is reviewed in: `files` (each `{ path, changedLines }`, as `numstatFiles` gives them)
 * grouped into `{ files, changedLines }`, the paths of a part and the changed lines they add up to.
 *
 *  - The files are taken in path order (by code unit, so the same on every machine), whatever order they
 *    are given in, and a part is a run of that order: the same range always gives the same parts.
 *  - A part holds as many whole files as fit in `maxChangedLines`, and never more than `maxFiles` of them
 *    (see `PART_MAX_FILES`). A file larger than the bound of lines is alone in a part of its own; no file
 *    is ever in two parts.
 *  - A file that changes no line (a binary one) is in the part its place in the order gives it, and counts
 *    as a file of that part like any other.
 *  - A renamed file (one with `from`) is placed by its new name and its two names are in one part, the old
 *    before the new: a part that named one of them would show the file whole, added or removed. Each name
 *    counts toward `maxFiles`, since each goes on the command line; a part of a rename alone holds both.
 *  - No part is empty: a range with no file has no part, and one at or under both bounds has one.
 *
 * Throws when either bound is not a positive integer or a file is not a path with a count. */
export function reviewParts(files, maxChangedLines = PART_MAX_CHANGED_LINES, maxFiles = PART_MAX_FILES) {
  if (!Number.isInteger(maxChangedLines) || maxChangedLines < 1) {
    throw new Error(`The bound of a part must be a positive integer of changed lines, got ${JSON.stringify(maxChangedLines)}.`);
  }
  if (!Number.isInteger(maxFiles) || maxFiles < 1) {
    throw new Error(`The bound of a part must be a positive integer of files, got ${JSON.stringify(maxFiles)}.`);
  }
  for (const file of files) {
    if (!isChangedFile(file)) throw new Error(`Not a changed file with its count of changed lines: ${JSON.stringify(file)}.`);
  }
  const ordered = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const parts = [];
  let part = null;
  for (const { path, from, changedLines } of ordered) {
    const names = from === undefined ? [path] : [from, path];
    // A file that does not fit beside the ones before it starts a part. One larger than the bound fits
    // beside nothing, and nothing fits beside it, so it ends up alone without being asked for by name. A
    // part that already holds its count of files is full too, whatever room its lines leave.
    if (part === null || part.changedLines + changedLines > maxChangedLines || part.files.length + names.length > maxFiles) {
      part = { files: [], changedLines: 0 };
      parts.push(part);
    }
    part.files.push(...names);
    part.changedLines += changedLines;
  }
  return parts;
}
