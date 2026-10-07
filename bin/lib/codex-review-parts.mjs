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

// How many changed lines (additions plus deletions) a part holds at most. PROVISIONAL: a range of 216
// changed lines was reviewed whole twice, with every line seen, and ranges of about a thousand were not;
// 400 is a number between the two and nothing more. The comparison runs of T12
// (odd/tasks/codex-review-lean.md) are what set it. `js-harness codex-review --part-lines <n>` takes another.
export const PART_MAX_CHANGED_LINES = 400;

// One record of `git diff --numstat -z --no-renames`: the additions, the deletions (`-` for both when the
// file is binary) and the path, which may hold anything but a NUL.
const NUMSTAT_RECORD = /^(?:(\d+)\t(\d+)|-\t-)\t([\s\S]+)$/;

/** The changed files of a range, from the output of `git diff --numstat -z --no-renames <from> <head>`:
 * each `{ path, changedLines, binary }`, in git's order. `changedLines` is the additions plus the deletions,
 * and 0 for a binary file, which git counts no lines of and which is still a changed file. With `-z` a
 * path is written as it is, with no quoting, so it is taken as it is.
 *
 * Throws on anything that is not such a record, a rename among them (`-z` writes one with an empty path
 * and two names after it, which is why the command is run with `--no-renames`): a path guessed wrong would
 * be a file no part reviews. */
export function numstatFiles(numstat) {
  if (typeof numstat !== 'string') throw new Error(`Expected the output of \`git diff --numstat -z --no-renames\`, got ${typeof numstat}.`);
  if (numstat === '') return [];
  const records = numstat.split('\0');
  // Every record ends with a NUL, so the text after the last one is empty unless the output was cut.
  const cut = records.pop();
  if (cut !== '') throw new Error(`The \`git diff --numstat -z\` output does not end where a record ends: ${JSON.stringify(cut.slice(0, 80))}.`);
  return records.map((record) => {
    const match = NUMSTAT_RECORD.exec(record);
    if (!match) throw new Error(`Not a record of \`git diff --numstat -z --no-renames\`: ${JSON.stringify(record.slice(0, 80))}.`);
    const [, added, deleted, path] = match;
    const binary = added === undefined;
    return { path, changedLines: binary ? 0 : Number(added) + Number(deleted), binary };
  });
}

const isChangedFile = (file) =>
  file !== null && typeof file === 'object' && typeof file.path === 'string' && file.path !== '' && Number.isInteger(file.changedLines) && file.changedLines >= 0;

/** The parts a range is reviewed in: `files` (each `{ path, changedLines }`, as `numstatFiles` gives them)
 * grouped into `{ files, changedLines }`, the paths of a part and the changed lines they add up to.
 *
 *  - The files are taken in path order (by code unit, so the same on every machine), whatever order they
 *    are given in, and a part is a run of that order: the same range always gives the same parts.
 *  - A part holds as many whole files as fit in `maxChangedLines`. A file larger than that is alone in a
 *    part of its own; no file is ever in two parts.
 *  - A file that changes no line (a binary one) is in the part its place in the order gives it.
 *  - No part is empty: a range with no file has no part, and one at or under the bound has one.
 *
 * Throws when `maxChangedLines` is not a positive integer or a file is not a path with a count. */
export function reviewParts(files, maxChangedLines = PART_MAX_CHANGED_LINES) {
  if (!Number.isInteger(maxChangedLines) || maxChangedLines < 1) {
    throw new Error(`The bound of a part must be a positive integer of changed lines, got ${JSON.stringify(maxChangedLines)}.`);
  }
  for (const file of files) {
    if (!isChangedFile(file)) throw new Error(`Not a changed file with its count of changed lines: ${JSON.stringify(file)}.`);
  }
  const ordered = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const parts = [];
  let part = null;
  for (const { path, changedLines } of ordered) {
    // A file that does not fit beside the ones before it starts a part. One larger than the bound fits
    // beside nothing, and nothing fits beside it, so it ends up alone without being asked for by name.
    if (part === null || part.changedLines + changedLines > maxChangedLines) {
      part = { files: [], changedLines: 0 };
      parts.push(part);
    }
    part.files.push(path);
    part.changedLines += changedLines;
  }
  return parts;
}
