// Which code commits of a range a Codex review record already covers, and where the review of the rest
// starts: the one definition `js-harness check` and `js-harness codex-review` both read. Zero deps. Every
// function that asks git takes an injected `spawn`, and answers that it cannot tell where git fails.
//
// Why one definition. `check --push` refuses a branch with a code commit no record covers, and
// `codex-review` reads the same records to pay for no review twice: it starts where they end, and starts
// nothing over a range they cover whole. One review of a whole branch held four reviews of ranges reviewed
// an hour before, because the command always reviewed from the base it was given
// (odd/tasks/codex-review-cost.md). Were the two to count apart, the command would call a range covered
// that the push then refuses, or pay again for one the push lets through.
import { spawnSync } from 'node:child_process';
import { isValidCodexReview, leftMarkedFilesOut, NOTHING_TO_REVIEW, readCodexReviews } from './codex-reviews.mjs';
import { leftOutOf } from './codex-review-scope.mjs';

/** Trimmed stdout of a successful `git <args>` run in `cwd`, else `null`. `input`, when given, is what
 * git reads on its standard input. */
export function gitOut(spawn, cwd, args, input) {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...(input !== undefined && { input }) });
    if (result && !result.error && result.status === 0) return result.stdout.trim();
  } catch {
    // No git on PATH: the caller reports the repository or revision as unresolvable.
  }
  return null;
}

/** Whether git exits 0 for `git <args>` in `cwd` (for the yes/no commands such as
 * `merge-base --is-ancestor`, where a non-zero exit is an answer, not a failure). */
function gitYes(spawn, cwd, args) {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8' });
    return Boolean(result) && !result.error && result.status === 0;
  } catch {
    return false;
  }
}

/** The commits a valid `rec` covers, or `null` when its ids are not commits this repository knows. */
function coveredBy(spawn, cwd, rec) {
  const listed = gitOut(spawn, cwd, ['rev-list', `${rec.base}..${rec.head}`]);
  return listed === null ? null : new Set(listed.split('\n').filter(Boolean));
}

/** Which of `heads` (full commit ids) lie past `tip`, as `merge-base --is-ancestor <tip> <head>` says it:
 * the commits `tip` is an ancestor of, itself among them.
 *
 * One git process answers for them all, because the heads are those of every record ever written and this
 * runs at every commit: `rev-list --ancestry-path ^<tip> <heads>` lists the commits on a path from `tip` to
 * any of them, which holds a head past the tip and no other head. `--ignore-missing` passes over an id this
 * repository does not know, and the ids go on standard input, which no count of records makes too long for
 * a command line. Should git refuse that, each head is asked about on its own. */
function headsPastTip(spawn, cwd, tip, heads) {
  if (heads.length === 0) return new Set();
  const onPath = gitOut(spawn, cwd, ['rev-list', '--ancestry-path', '--ignore-missing', `^${tip}`, '--stdin'], `${heads.join('\n')}\n`);
  if (onPath === null) return new Set(heads.filter((head) => gitYes(spawn, cwd, ['merge-base', '--is-ancestor', tip, head])));
  const listed = new Set(onPath.split('\n'));
  return new Set(heads.filter((head) => head === tip || listed.has(head)));
}

// What `git log` is asked to write for each commit: an empty field, then its line,
// `<id>\t<short id>\t<parents>\t<subject>` (four fields, the subject last so that a tab inside it
// survives). `loggedCommits` reads what comes back, and takes for such a line only what `COMMIT_LINE` matches.
const COMMIT_FORMAT = '%x00%H%x09%h%x09%P%x09%s';
const COMMIT_LINE = /^[0-9a-f]{40,64}\t[0-9a-f]+\t[0-9a-f ]*\t/;

/** The commits of what `git log -z --name-only --format=<COMMIT_FORMAT>` printed, in its order: each
 * `{ id, shortId, parent, isRoot, subject, files }`, the files as git names them, whatever a name holds, and
 * `parent` the full id of its first parent, `null` for a root commit. `null` when the text is not that: a
 * list read as far as it goes would leave out a commit, or the files of one.
 *
 * With `-z` git ends every field with a NUL, the line of a commit and each name after it, and writes a name
 * as it is, with a newline between the line of a commit and its first name. So the fields are told apart by
 * the NULs alone, and a commit starts at the empty field the format writes before its line: two NULs with
 * nothing between them, or the start of the text. No file name can stand for that. A name holds no NUL, and
 * is never empty, so neither one name nor several in a row put two NULs together; and what comes after an
 * empty field is never read as a name. What a name does hold is not looked at: one may be a control
 * character, a newline, or the whole line of a commit, and is still the name it is. */
function loggedCommits(log) {
  const fields = log.split('\0');
  // Every field ends with a NUL, so what follows the last one is empty unless the text was cut.
  if (fields.pop() !== '') return null;
  const commits = [];
  let at = 0;
  while (at < fields.length) {
    const line = fields[at + 1];
    if (fields[at] !== '' || line === undefined || !COMMIT_LINE.test(line)) return null;
    const [id, shortId, parents, ...subject] = line.split('\t');
    const files = [];
    for (at += 2; at < fields.length && fields[at] !== ''; at += 1) {
      // The first name of a commit comes after a newline, which is git's and not the name's.
      const first = files.length === 0;
      if (first && !/^\n./s.test(fields[at])) return null;
      files.push(first ? fields[at].slice(1) : fields[at]);
    }
    commits.push({ id, shortId, parent: parents.split(' ')[0] || null, isRoot: !parents, subject: subject.join('\t'), files });
  }
  return commits;
}

// What a coverage that cannot be told could not read (`reviewCoverage`): the commits of the range, or the
// files of them a review leaves out. Each caller says it in its own words.
export const COMMITS_UNREAD = 'commits';
export const MARKS_UNREAD = 'marks';

/** What the Codex review records say of the code commits of `from..tip`, as git reads that range in `cwd`:
 * `tip` a full commit id, `from` any revision. `{ unknown }` when it cannot be told, `COMMITS_UNREAD` or
 * `MARKS_UNREAD`. Otherwise the `codeCommits` of the range (newest first: every non-merge commit that
 * changes a file a review reads), the `covers` (each valid record that reaches the range, as `{ rec,
 * covered }` with the commits it covers), the `uncovered` code commits, and how many records were left out:
 * `invalid`, the ones that are no evidence, and `ignored`, the valid ones whose base or head is no commit of
 * this repository.
 *
 * A file a review reads is one `js-harness codex-review` does not leave out (`./codex-review-scope.mjs`):
 * not a document, and not a path the project marks with `-codex-review`. What is marked is read from the
 * commit `tip`, for the paths of every commit under it in one git process: the commit that is judged, never
 * the tree or the index, which at a commit hold the change being made. */
export function reviewCoverage(cwd, { from, tip, spawn = spawnSync }) {
  // Every commit of the range, merges included: a record whose head is one is worth expanding.
  const inRange = gitOut(spawn, cwd, ['rev-list', `${from}..${tip}`]);
  if (inRange === null) return { unknown: COMMITS_UNREAD };
  const rangeIds = new Set(inRange.split('\n').filter(Boolean));

  // The line of each commit, followed by the names of the files it changes (`loggedCommits`). With `-z`
  // every name is written as it is. Without it git writes a name that holds a quote, a backslash, a
  // control character or a letter outside ASCII in quotes and escapes (a Markdown file then ends in
  // `.md"`), and that is not a path its attributes can be asked for.
  //
  // `--no-relative`: the names are from the top of the repository, wherever `cwd` is in it. They are by
  // default, but a repository whose configuration sets `diff.relative` has git write them from the folder
  // it runs in and leave out every file outside that folder: run below the top, a commit of code elsewhere
  // would list no file, and count as one that needs no record.
  //
  // `--no-renames`: the files a commit changes are those `js-harness codex-review` reads of it, and that
  // command reads a range with renames off. With git's detection of them, which is on by default, a commit
  // that moves a file lists the new path alone: moved to a path the project marks, the file that went,
  // which that command reviews as removed, would be in no list, and the commit would need no record.
  //
  // `--root`: a commit with no parent lists the files it adds. It does by default, but not in a repository
  // whose configuration turns `log.showRoot` off, where such a commit would list none.
  //
  // `--no-show-signature`: nothing but the commits and their files. In a repository whose configuration
  // sets `log.showSignature`, git writes what the program that checks a signature said of a signed commit
  // before the line of that commit, on this same output: a list of another shape, which is read as no list
  // at all, so that a branch whose every commit had a record failed the push check.
  const log = gitOut(spawn, cwd, ['log', '-z', '--no-merges', '--root', '--no-show-signature', '--no-relative', '--no-renames', '--name-only', `--format=${COMMIT_FORMAT}`, `${from}..${tip}`]);
  const commits = log === null ? null : loggedCommits(log);
  if (commits === null) return { unknown: COMMITS_UNREAD };
  const leftOut = leftOutOf(commits.flatMap((commit) => commit.files), { cwd, source: tip, spawn });
  if (leftOut === null) return { unknown: MARKS_UNREAD };
  const codeCommits = commits.filter((commit) => commit.files.some((file) => !leftOut.has(file)));

  const records = readCodexReviews(cwd, { spawn });
  const valid = records.filter(isValidCodexReview);
  // A record can cover part of the range only when its head is in it, or lies past the tip (a review of
  // base..D still covers C when C is the tip). Any other record is unrelated, and expanding it would cost
  // one git process per record ever written.
  // Two kinds of record are the exception to the second case, and cover only when the range holds their
  // head. A record of nothing to review: its range changes no file only as a whole (a commit and its
  // revert), so a tip short of its head is a patch nobody reviewed. And a review that left out files the
  // project marks (`leftMarkedFilesOut`): the marks are those of its head, and a commit of its range can
  // be the one that adds them, so at a tip short of that head a file it left out can be code.
  const outside = (rec) => !rangeIds.has(rec.head);
  const onlyWhole = (rec) => rec.outcome === NOTHING_TO_REVIEW || leftMarkedFilesOut(rec);
  const mayLiePast = valid.filter((rec) => outside(rec) && !onlyWhole(rec));
  const pastTip = headsPastTip(spawn, cwd, tip, [...new Set(mayLiePast.map((rec) => rec.head))]);
  const covers = [];
  let ignored = 0;
  for (const rec of valid) {
    if (outside(rec) && (onlyWhole(rec) || !pastTip.has(rec.head))) continue;
    const covered = coveredBy(spawn, cwd, rec);
    if (covered) covers.push({ rec, covered });
    else ignored += 1;
  }
  const uncovered = codeCommits.filter((commit) => !covers.some(({ covered }) => covered.has(commit.id)));
  return { codeCommits, covers, uncovered, invalid: records.length - valid.length, ignored };
}

// The outcomes of a record that is no review of Codex's, each with what a row calls it.
export const NOT_A_REVIEW = { unavailable: 'unavailable', [NOTHING_TO_REVIEW]: 'nothing to review' };

/** The records of a coverage (`reviewCoverage`) that cover a code commit and are no review of Codex's:
 * covered by a record is not reviewed, and whoever says the first says how many of these there are. */
export function notReviews({ covers, codeCommits }) {
  return covers
    .filter(({ rec, covered }) => Object.hasOwn(NOT_A_REVIEW, rec.outcome) && codeCommits.some((commit) => covered.has(commit.id)))
    .map(({ rec }) => rec);
}

/** Where the review of `from..tip` starts, once the records have been read: `uncovered` are the code commits
 * of the range no record covers, newest first (`reviewCoverage`), `tip` a full commit id, and `from` the
 * commit the range starts at, by its full id, or `null` when it has none (the two histories share no
 * commit). `{ start, before }`: the commit the review starts at, and the commit it starts right before,
 * when it starts where the records end.
 *
 * The records end at the oldest commit they do not cover, so the review starts at its parent, `before`
 * being that commit, when that is safe; and at `from` when it is not, with `before` `null`. Safe is all
 * of: that commit has a parent; `from` is that parent or an ancestor of it, or the range would grow by
 * history it never held (a branch that forked before `from` and was merged in); and every uncovered commit
 * lies in `<parent>..tip`, or one of them would be in no review (two lines of history, each with a commit
 * no record covers). With nothing uncovered there is nothing to start: `from`, as it was given.
 *
 * In doubt, the range as it was given, never less: an answer git does not give is not a yes. At most two
 * git processes, and none when the parent is `from` itself, where nothing is left to ask. */
export function reviewStart(uncovered, { cwd, from, tip, spawn = spawnSync }) {
  const asGiven = { start: from, before: null };
  // `git log` lists newest first, so the oldest uncovered commit is the last one.
  const oldest = uncovered.at(-1);
  if (oldest === undefined || oldest.parent === null) return asGiven;
  const whereTheRecordsEnd = { start: oldest.parent, before: oldest };
  if (oldest.parent === from) return whereTheRecordsEnd;
  if (from !== null && !gitYes(spawn, cwd, ['merge-base', '--is-ancestor', from, oldest.parent])) return asGiven;
  const after = gitOut(spawn, cwd, ['rev-list', `${oldest.parent}..${tip}`]);
  if (after === null) return asGiven;
  const reviewed = new Set(after.split('\n'));
  return uncovered.every((commit) => reviewed.has(commit.id)) ? whereTheRecordsEnd : asGiven;
}
