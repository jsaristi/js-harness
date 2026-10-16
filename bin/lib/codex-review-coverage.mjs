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

/** Whether `git <args>` answers yes (exit 0) or no (exit 1), for the yes/no commands where a non-zero exit is
 * an answer; `null` when git did not say: it failed, it could not be started, or it threw. Unlike `gitYes`,
 * a git that fails is no "no", which is what a caller needs when a "no" is the one answer it acts on. */
function gitAnswer(spawn, cwd, args) {
  try {
    const result = spawn('git', args, { cwd, encoding: 'utf8' });
    if (!result || result.error) return null;
    if (result.status === 0) return true;
    return result.status === 1 ? false : null;
  } catch {
    return null;
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
export const COMMIT_FORMAT = '%x00%H%x09%h%x09%P%x09%s';
const COMMIT_LINE = /^[0-9a-f]{40,64}\t[0-9a-f]+\t[0-9a-f ]*\t/;

/** The commits of what `git log -z --diff-merges=combined --name-only --format=<COMMIT_FORMAT>` printed, in
 * its order: each `{ id, shortId, parent, isRoot, parentCount, subject, files }`, the files as git names
 * them, whatever a name holds, `parent` the full id of its first parent, `null` for a root commit, which is
 * what `isRoot` says, and `parentCount` how many it has, more than one for a merge. `null` when the text is
 * not that: a list read as far as it goes would leave out a commit, or the files of one.
 *
 * With `-z` git ends every field with a NUL, the line of a commit and each name after it, and writes a name
 * as it is, with a newline between the line of a commit and its first name. So the fields are told apart by
 * the NULs alone, and a commit starts at the empty field the format writes before its line: two NULs with
 * nothing between them, or the start of the text. No file name can stand for that. A name holds no NUL, and
 * is never empty, so neither one name nor several in a row put two NULs together. What a name does hold is
 * not looked at: one may be a control character, a newline, or the whole line of a commit, and is still the
 * name it is.
 *
 * A merge is written in a shape of its own (seen on git 2.54, for two parents and for more): after its line
 * comes one more empty field, where another commit has the newline, and then its names as they are, the
 * first one too; a merge that changes no file by itself has that field and no name. The line of a commit
 * names its parents, so it says which shape follows: the empty field after the line of a merge starts no
 * commit, the one after its names does, and a merge with no such field, which is how `git log` writes one
 * whose files it was not asked for, is no list. One such text reads as a list all the same: a merge with
 * nothing after its line and then a commit, which is also a merge whose first name is the line of that
 * commit. The two differ in how many commits they hold, which is what `reviewCoverage` holds a list to. */
export function loggedCommits(log) {
  const fields = log.split('\0');
  // Every field ends with a NUL, so what follows the last one is empty unless the text was cut.
  if (fields.pop() !== '') return null;
  const commits = [];
  let at = 0;
  while (at < fields.length) {
    const line = fields[at + 1];
    if (fields[at] !== '' || line === undefined || !COMMIT_LINE.test(line)) return null;
    const [id, shortId, parents, ...subject] = line.split('\t');
    const parentIds = parents ? parents.split(' ') : [];
    const isMerge = parentIds.length > 1;
    const files = [];
    at += 2;
    if (isMerge) {
      // The empty field git writes after the line of a merge: one that lacks it was not asked for its files.
      if (fields[at] !== '') return null;
      at += 1;
    }
    for (; at < fields.length && fields[at] !== ''; at += 1) {
      // The first name of a commit that is no merge comes after a newline, which is git's and not the name's.
      const first = !isMerge && files.length === 0;
      if (first && !/^\n./s.test(fields[at])) return null;
      files.push(first ? fields[at].slice(1) : fields[at]);
    }
    commits.push({ id, shortId, parent: parentIds[0] ?? null, isRoot: !parents, parentCount: parentIds.length, subject: subject.join('\t'), files });
  }
  return commits;
}

/** The files that differ between the merge `id`, a full commit id, and what merging its two parents again
 * gives, as `git show --remerge-diff` names them: an edit made in the merge and a conflict resolved by hand
 * among them, and no file git merged by itself. `null` when git does not answer that, whole: unknown is not
 * "none".
 *
 * Asked with `-z` and the id as the format, git writes the id and a NUL, then a newline and the names, each
 * ended by a NUL, or nothing more when no file differs (seen on git 2.54). Anything else is no answer: a git
 * that fails, as one older than 2.36 does on the option; the id of another commit; and text that is no
 * names, which is what git writes for a merge of more than two parents, a warning that it merges none of
 * them again. `--no-relative` and `--no-renames` for the reasons the log has them (`reviewCoverage`): the
 * names are compared with its names. */
function writtenInMerge(spawn, cwd, id) {
  const shown = gitOut(spawn, cwd, ['show', '-z', '--remerge-diff', '--no-show-signature', '--no-relative', '--no-renames', '--no-ext-diff', '--name-only', '--format=%H', id]);
  const fields = shown?.split('\0') ?? [];
  if (fields.pop() !== '' || fields.shift() !== id) return null;
  if (fields.length === 0) return [];
  // The first name comes after a newline, which is git's and not the name's, and no name is empty.
  if (!/^\n./s.test(fields[0]) || fields.includes('')) return null;
  return [fields[0].slice(1), ...fields.slice(1)];
}

// What a coverage that cannot be told could not read (`reviewCoverage`): the commits of the range, or the
// files of them a review leaves out. Each caller says it in its own words.
export const COMMITS_UNREAD = 'commits';
export const MARKS_UNREAD = 'marks';

/** What the Codex review records say of the code commits of `from..tip`, as git reads that range in `cwd`:
 * `tip` a full commit id, `from` any revision. `{ unknown }` when it cannot be told, `COMMITS_UNREAD` or
 * `MARKS_UNREAD`. Otherwise the `codeCommits` of the range (newest first: every commit that changes a file
 * a review reads, a merge by the files somebody wrote in it), the `covers` (each valid record that reaches
 * the range, as `{ rec, covered }` with the commits it covers), the `uncovered` code commits, and how many
 * records were left out: `invalid`, the ones that are no evidence, and `ignored`, the valid ones whose base
 * or head is no commit of this repository.
 *
 * A file a review reads is one `js-harness codex-review` does not leave out (`./codex-review-scope.mjs`):
 * not a document, and not a path the project marks with `-codex-review`. What is marked is read from the
 * commit `tip`, for the paths of every commit under it in one git process: the commit that is judged, never
 * the tree or the index, which at a commit hold the change being made.
 *
 * `where` is for a caller that already knows where the repository of `cwd` is. It is handed on as it is to
 * the two that would ask git: its `top` to `leftOutOf`, with the `marks` that one fills for its caller, and
 * its `commonGitDir` to the reader of the records (`jsonLinesPath`). Each then starts one git process fewer;
 * without it both ask, as before. */
export function reviewCoverage(cwd, { from, tip, spawn = spawnSync, where }) {
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
  //
  // `--diff-merges=combined`: a merge lists the files it leaves as none of its parents has them, which is
  // where what somebody wrote in it is: a conflict resolved by hand, an edit made in the merge. `git log`
  // lists no file of a merge unless it is asked, and this once passed `--no-merges`: such an edit was then
  // in the patch of no commit a record was asked of, so a range whose other commits each had one was
  // pushed, and called covered by `js-harness codex-review`, with the edit in no review. A merge that takes
  // each file from one side or the other lists none, and is done with here.
  const log = gitOut(spawn, cwd, ['log', '-z', '--diff-merges=combined', '--root', '--no-show-signature', '--no-relative', '--no-renames', '--name-only', `--format=${COMMIT_FORMAT}`, `${from}..${tip}`]);
  const commits = log === null ? null : loggedCommits(log);
  // The log and the `rev-list` above walk the same range, so what was read is every commit of it, each
  // once. A list that is not was misread: the one text that reads two ways holds one commit fewer when the
  // line of a commit is taken for a name of the merge before it (`loggedCommits`).
  const readIds = new Set(commits?.map((commit) => commit.id));
  const isTheRange = commits !== null && commits.length === rangeIds.size && readIds.size === rangeIds.size && commits.every((commit) => rangeIds.has(commit.id));
  if (!isTheRange) return { unknown: COMMITS_UNREAD };
  const leftOut = leftOutOf(commits.flatMap((commit) => commit.files), { cwd, source: tip, spawn, where });
  if (leftOut === null) return { unknown: MARKS_UNREAD };
  const isCode = (commit) => commit.files.some((file) => !leftOut.has(file));
  // A merge is a code commit by the files somebody wrote in it: those the log lists for it that also differ
  // from what merging its parents again gives (`writtenInMerge`). Neither list is the rule alone. The log's
  // holds what git merged by itself, a file both sides changed with no conflict: the default branch merged
  // into a branch already reviewed became a commit the push check refused, and its record a second review of
  // code that had one. The other holds what a merge dropped, a conflict resolved as one side, which leaves
  // the file as a parent has it and no line to review; it costs a merge for each merge of the range; and
  // for more than two parents git gives none. So it is asked of a merge of two parents that would be a code
  // commit, and of no other commit: a range with no such merge pays nothing. Where it is not asked or not
  // answered the files of the log stand, since unknown is written by hand.
  const ownFiles = (commit) => {
    const written = commit.parentCount === 2 ? writtenInMerge(spawn, cwd, commit.id) : null;
    return written === null ? commit : { ...commit, files: commit.files.filter((file) => written.includes(file)) };
  };
  const codeCommits = commits.filter(isCode).map(ownFiles).filter(isCode);

  const records = readCodexReviews(cwd, { spawn, where });
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

/** The commit the range `base..tip` starts at, the one `git merge-base` names: `{ from }`, its full id, or
 * `null` when the two histories share no commit; `{ unknown: true }` when git did not say.
 *
 * The two are kept apart because `reviewStart` reads them apart: with no commit to hold a start to, it
 * holds it to none. Git says that the two share no commit by exiting 1 with nothing written. Any other
 * failure, a git that could not be started among them, is a question left unanswered: read as "none", it
 * would let a review start at a commit nothing was asked about. */
export function rangeStart(cwd, { base, tip, spawn = spawnSync }) {
  const unknown = { unknown: true };
  let result;
  try {
    result = spawn('git', ['merge-base', base, tip], { cwd, encoding: 'utf8' });
  } catch {
    return unknown;
  }
  if (!result || result.error) return unknown;
  const id = String(result.stdout ?? '').trim();
  if (result.status === 0) return id ? { from: id } : unknown;
  return result.status === 1 && !id ? { from: null } : unknown;
}

/** Where the review of `from..tip` starts, once the records have been read: `uncovered` are the code commits
 * of the range no record covers, newest first (`reviewCoverage`), `tip` a full commit id, and `from` the
 * commit the range starts at, by its full id, or `null` when it has none (the two histories share no
 * commit, as git said and not as a git that failed leaves it: `rangeStart`). `{ start, before }`: the
 * commit the review starts at, and the commit it starts right before, when it starts where the records end.
 *
 * The records end at the oldest commit they do not cover, so the review starts at its parent, `before`
 * being that commit, when that is safe; and at `from` when it is not, with `before` `null`. Safe is all
 * of: that commit has a parent; `from` is that parent or an ancestor of it, or the range would grow by
 * history it never held (a branch that forked before `from` and was merged in); and every uncovered commit
 * lies in `<parent>..tip`, or one of them would be in no review (two lines of history, each with a commit
 * no record covers). With nothing uncovered there is nothing to start: `from`, as it was given. The parent
 * of a merge is its first one: the patch from there holds all the merge changed against it, what was
 * written in the merge among it, and the same checks hold that start.
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

/** The branch a push is measured against: what `refs/remotes/<remote>/HEAD` points at, else
 * `<remote>/main`, else `<remote>/master`; `null` when none of them resolves to a commit. Only the
 * remote's own refs count, never a local branch: pushing `main` itself would otherwise be measured
 * against the very commits being pushed and pass with nothing to review. */
export function defaultBranch(spawn, cwd, remote) {
  const resolves = (ref) => gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  const pointed = gitOut(spawn, cwd, ['symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`]);
  const candidates = [pointed, `refs/remotes/${remote}/main`, `refs/remotes/${remote}/master`].filter(Boolean);
  const ref = candidates.find((candidate) => resolves(candidate));
  return ref ? { ref, label: ref.replace(/^refs\/remotes\//, '') } : null;
}

/** The base of a review, when it is a code commit of the branch that no Codex review record covers: `{ id,
 * shortId, subject }` of `from`, with `merged`, the label of the default branch, when `from` is a merge of it;
 * else `null`. `from` is the full id of the commit a review's range starts at (`js-harness codex-review --base`). A git range starts after its base, so the base itself is never read,
 * and no record of the range covers it: a branch whose first commit was the base kept that commit with no
 * review and no word about it.
 *
 * It is this case only when all of these hold: `remote` has a default branch; `from` is not an ancestor of
 * it nor the commit it names, so `from` is a commit of the branch under review; `from` has a parent, the
 * first one, as `reviewStart` takes it; and the coverage of `<parent>..<from>` reads, and lists `from` as an
 * uncovered code commit, and so does that of `<parent>..<tip>` when the caller gives `tip`, the head of the
 * review. Every other case is `null`, and so is every case in which git cannot say, a failed git among
 * them. It never throws: the caller prints a note or nothing. */
export function baseLeftOut(cwd, { from, tip, remote = 'origin', spawn = spawnSync, where }) {
  try {
    // Every review asks this, and most repositories a test builds have no remote: one question says so,
    // where finding no default branch takes three.
    if (!gitOut(spawn, cwd, ['for-each-ref', '--count=1', '--format=%(refname)', `refs/remotes/${remote}/`])) return null;
    const branch = defaultBranch(spawn, cwd, remote);
    if (branch === null) return null;
    // Only exit 1 is the answer that `from` is not on the default branch: a failed git is no answer.
    if (gitAnswer(spawn, cwd, ['merge-base', '--is-ancestor', from, branch.ref]) !== false) return null;
    // A root commit has no `<from>^`, and so no range to be a code commit of.
    const parent = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${from}^`]);
    if (parent === null) return null;
    // `from` as a code commit no record covers in `<parent>..<upTo>`: the commit, `null` when it is not one,
    // and `undefined` when the coverage does not read.
    const uncoveredUpTo = (upTo) => {
      const coverage = reviewCoverage(cwd, { from: parent, tip: upTo, spawn, where });
      return coverage.unknown !== undefined ? undefined : coverage.uncovered.find((entry) => entry.id === from) ?? null;
    };
    // Asked at `from` first, the short range, where most bases have their answer. A base with no record
    // there is asked again at `tip`, the head of the review: a record of nothing to review, and one that
    // left marked files out, cover only a range that holds their head (`reviewCoverage`), so a base such a
    // record covers from a later commit of the branch reads as left out at `from` and as covered at `tip`,
    // which is where the push check reads it.
    let commit = uncoveredUpTo(from);
    if (commit && tip !== undefined && tip !== from) commit = uncoveredUpTo(tip);
    if (!commit) return null;
    // A merge of the default branch is read by what was written in it only where it is HEAD (`mergeStart`), so its
    // first parent is no base that reviews it: the caller names the worktree at it instead (merge-review-covers-main
    // in docs/FAILURES.md).
    const parents = gitOut(spawn, cwd, ['rev-list', '--parents', '-n', '1', from])?.split(' ') ?? [];
    const merged = parents.length === 3 && gitAnswer(spawn, cwd, ['merge-base', '--is-ancestor', parents[2], branch.ref]) === true;
    return { id: commit.id, shortId: commit.shortId, subject: commit.subject, ...(merged ? { merged: branch.label } : {}) };
  } catch {
    return null;
  }
}

/** The git arguments of the diff a review of `from..head` reads, with `shape` (options of the diff) and,
 * when given, `files` as pathspecs: `git diff <from> <head>`, or, for the review of a merge (`merge`, from
 * `mergeStart`), `git diff <automatic merge> <head>`, what was written in the merge. Renames are off in both,
 * as everywhere a range is counted, split or shown. */
export function rangeDiff({ from, head, merge = null }, shape = [], files = null) {
  const paths = files === null ? [] : ['--', ...files];
  return ['diff', ...shape, '--no-renames', merge === null ? from : merge.auto, head, ...paths];
}

/** The full id of the tree that merging `first` and `side` again gives, conflict markers included, as
 * `git merge-tree --write-tree` writes it into the object store; `null` when git cannot say. Its diff with
 * the merge holds the lines of the merge's remerge-diff, and reads objects that exist: `git show
 * --remerge-diff` writes a temporary object directory, and where the object store is read-only, as in
 * Codex's sandbox, it printed nothing and exited 0 (odd/tasks/merge-review.md, L12). */
function automaticMerge(spawn, cwd, first, side) {
  let result;
  try {
    result = spawn('git', ['merge-tree', '--write-tree', '--no-messages', first, side], { cwd, encoding: 'utf8' });
  } catch {
    return null;
  }
  // Exit 1 is a merge with conflicts, whose tree holds their markers: an answer, as exit 0 is.
  if (!result || result.error || (result.status !== 0 && result.status !== 1)) return null;
  const tree = result.stdout.split('\n')[0].trim();
  return /^[0-9a-f]{40}([0-9a-f]{24})?$/.test(tree) ? tree : null;
}

/** Where the review of `given..head` starts when it is that of a merge of the remote's default branch, read
 * by what was written in it: `{ from, side, branch, auto }`, the first parent of the merge, the merged parent,
 * the label of the branch that holds it and the tree of their automatic merge (`automaticMerge`); else
 * `null`, and the range is read as it would be without this.
 *
 * A branch that merges its default branch and resolves a conflict has one code commit no record covers, the
 * merge (`writtenInMerge` counts it by the files written in it). Its review,
 * asked from the default branch, started at the merged parent and read the whole branch again, which the
 * records cannot move past (`reviewStart`: that parent is no ancestor of the first); asked from the first
 * parent, it read everything the default branch brought in. Pull request 124 paid 175,025 input tokens for
 * it. What the merge adds of its own is its remerge-diff, the merge against what merging its parents again
 * gives: the resolution of its conflicts and any edit made in it.
 *
 * It is this case when `head` has two parents, the second is a commit of the default branch of `origin`
 * (`defaultBranch`), and every code commit of `given` up to the first parent has a record. The record of
 * `<first parent>..head` then covers the merge and the commits of the default branch it brought in, which
 * had their reviews where they were made; a second parent off that branch would be commits nobody read
 * called covered. `null` whenever git or the records cannot say. */
export function mergeStart(cwd, { given, tip: head, spawn = spawnSync, where, remote = 'origin' }) {
  const parents = gitOut(spawn, cwd, ['rev-list', '--parents', '-n', '1', head])?.split(' ') ?? [];
  if (parents.length !== 3 || parents[0] !== head) return null;
  const [, first, side] = parents;
  const branch = defaultBranch(spawn, cwd, remote);
  if (branch === null) return null;
  if (!gitYes(spawn, cwd, ['merge-base', '--is-ancestor', side, branch.ref])) return null;
  if (given !== first) {
    const before = reviewCoverage(cwd, { from: given, tip: first, spawn, where });
    if (before.unknown !== undefined || before.uncovered.length > 0) return null;
  }
  // A merge a record already covers is no review to start: the range is then read as without this, and the
  // records say it is covered, instead of a second paid review of the same merge (Codex, 2026-10-14).
  const atMerge = reviewCoverage(cwd, { from: first, tip: head, spawn, where });
  if (atMerge.unknown !== undefined || atMerge.covers.some(({ covered }) => covered.has(head))) return null;
  // And only a merge the push check counts as code: one that took a side whole has a remerge-diff of the
  // markers it removed, and no line anybody wrote (verifier B1, 2026-10-14).
  if (!atMerge.uncovered.some((commit) => commit.id === head)) return null;
  const auto = automaticMerge(spawn, cwd, first, side);
  if (auto === null) return null;
  return { from: first, side, branch: branch.label, auto };
}
