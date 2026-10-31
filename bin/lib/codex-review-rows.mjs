// The Codex review rows of `js-harness check`: the `--push` row, which refuses a code commit no record covers,
// the row of the plain check, which says how large the review of the branch is, and the switch they read. `check`
// re-exports what it exported; a library module imports them from here, so it does not load the whole gate to
// read one row (odd/tasks/reorganization.md, S1).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { numstatFiles, reviewParts } from './codex-review-parts.mjs';
import { MAX_PARTS_WITHOUT_FLAG, partsBound } from './codex-review-plan.mjs';
import { beyondLines, defaultBranch, gitOut, MARKS_UNREAD, mergeStart, NOT_A_REVIEW, notReviews, rangeDiff, rangeStart, remoteHoldsNoBranch, reviewCoverage, reviewStart } from './codex-review-coverage.mjs';
import { mergeTurn, turnsCheaper } from './codex-review-turns.mjs';
import { codexReviewsPath, isValidCodexReview, readCodexReviews } from './codex-reviews.mjs';
import { readCodexReviewRuns } from './codex-review-runs.mjs';
import { classifyRecheck, priorLine, recheckState, runAnswerFindings } from './codex-review-recheck.mjs';
import { counted, leftOutOf, reviewScope } from './codex-review-scope.mjs';
import { commitTree, functionsOf, gitIn, harnessOfCommit, harnessOfTree, workingTree } from './project-functions.mjs';
// The Claude lens rows, beside Codex's, for `check` to import from one place (odd/tasks/f8-s1-reviews.md, T4).
export { checkLensReviews } from './lens-review-rows.mjs';

/** What the Codex review records say of the code commits between the default branch of `remote` and
 * `head`, for the two rows that read it: the `--push` row, which fails on a commit no record covers, and
 * the row of the plain check, which says how large the review of those commits is.
 *
 * `{ unknown }` when it cannot be told: the `detail` and `lines` of the `--push` row and, where those words
 * speak of a push, the `why` of the plain one. Otherwise the commit `tip` that `head` names, the default
 * branch as the ref `baseRef` and its label `base`, and what the records say of `base..tip`, as
 * `reviewCoverage` gives it: the `codeCommits` (newest first), the `covers`, the `uncovered` code commits,
 * with the `note` that counts the records that were left out.
 *
 * Which commits are code and which records cover them is not decided here. It is the one definition this
 * check shares with `js-harness codex-review` (`./codex-review-coverage.mjs`), which reads it for the
 * range it is asked to review: what this refuses to push is what that command reviews. */
function codexReviewCoverage(cwd, head, { spawn, remote }) {
  const unknown = (detail, lines, why) => ({ unknown: { detail, ...(lines ? { lines } : {}), ...(why ? { why } : {}) } });
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!tip) {
    return gitOut(spawn, cwd, ['rev-parse', '--git-dir']) === null
      ? unknown(`${cwd} is not a git repository`, undefined, 'this is not a git repository')
      : unknown(`cannot resolve --head ${head} to a commit`, undefined, `${head} does not name a commit`);
  }
  // Git hands a hook the URL, not a name, when the push names a URL: no ref of it can exist.
  const remotes = gitOut(spawn, cwd, ['remote'])?.split('\n').map((line) => line.trim()) ?? [];
  if (!remotes.includes(remote)) {
    return unknown(`${remote} is not a configured remote, so there is no default branch to compare against`, [
      'push through a configured remote: git remote add <name> <url>, then git push <name> ...',
      'or name one that exists: js-harness check --push --remote <name>',
    ]);
  }
  const branch = defaultBranch(spawn, cwd, remote);
  if (!branch) {
    return unknown(
      `no default branch of ${remote} to compare against (refs/remotes/${remote}/HEAD, ${remote}/main or ${remote}/master), so there is no range to check`,
      [`set it with: git remote set-head ${remote} --auto`],
    );
  }
  const { ref: baseRef, label: base } = branch;

  // A record whose head lies past the tip covers nothing here, as at the merge door (`beyondTip`).
  const coverage = reviewCoverage(cwd, { from: baseRef, tip, spawn, beyondTip: false });
  if (coverage.unknown === MARKS_UNREAD) {
    return unknown(`cannot read which files of ${base}..${head} a Codex review leaves out (\`git check-attr --source\` failed; it needs git 2.40 or later)`);
  }
  if (coverage.unknown) return unknown(`cannot list the commits in ${base}..${head}`);
  const { codeCommits, covers, uncovered, beyond, invalid, ignored } = coverage;
  const noteParts = [
    invalid ? `${invalid} invalid record${invalid === 1 ? '' : 's'} ignored` : '',
    ignored ? `${ignored} record${ignored === 1 ? '' : 's'} ignored (base or head not found)` : '',
  ].filter(Boolean);
  const note = noteParts.length ? `; ${noteParts.join('; ')}` : '';
  return { tip, baseRef, base, codeCommits, covers, uncovered, beyond, note };
}

/** The lines that both rows print for the code commits no Codex review record covers: one per commit, with its
 * short id and subject, newest first as `git log` lists them. Each row closes them with the command that
 * makes the record, from the base that row names. */
const uncoveredNames = (uncovered) => uncovered.map((commit) => `${commit.shortId} ${commit.subject}`);

/** What both rows say of a coverage that leaves no code commit uncovered, before its `note`. */
function coveredDetail({ codeCommits, base }) {
  return codeCommits.length
    ? `${codeCommits.length} code commit${codeCommits.length === 1 ? '' : 's'} since ${base}, all covered by a Codex review record`
    : `no code commits since ${base}`;
}

/** What the Codex review the pushed branch ends on still owes: `null` when it owes nothing, or when nothing
 * can be proven; `{ refuse: true, detail, lines }` when it owes a correction never rechecked; and
 * `{ refuse: false, lines }`, a warning the passing row carries, when a recheck left findings open.
 *
 * Why. A record covers its commits whatever its review found, so coverage alone let a branch push right
 * after Codex called its head incorrect (2026-10-14: two P2 findings, then "all covered by a Codex review
 * record"). The review the branch ends on is the last record that covers its newest code commit; what it
 * owes is what `codex-review` reads to decide whether the next range is a recheck (`recheckState`). So this
 * refuses the head whose next review would be a recheck, and nothing else. The head of a recheck that left
 * findings open passes with a warning that names them: a second recheck is not run, so refusing it would
 * leave a session away from the user no way forward, and whether a disputed finding is waived is the user's
 * call (decided 2026-10-15: no waiver, the warning is enough). Coverage is still read from the records alone (./codex-review-runs.mjs says why);
 * the run log, where the findings are kept, only adds this refusal, and a log that cannot be read proves
 * nothing owed. Documents committed after that head change nothing here: they are no code commit. */
function correctionOwed(cwd, { codeCommits, covers }, { spawn }) {
  const newest = codeCommits[0];
  if (newest === undefined) return null;
  // Only a review of Codex's says what the code owes: a skip or a range that held nothing records no
  // review, so one written later, as to a document commit after the head, must not hide the debt.
  const last = covers.filter(({ rec, covered }) => rec.outcome === 'reviewed' && covered.has(newest.id)).at(-1);
  if (last === undefined) return null;
  const from = last.rec.head;
  let records;
  let runs;
  try {
    records = readCodexReviews(cwd, { spawn });
    runs = readCodexReviewRuns(cwd, { spawn });
  } catch {
    return null;
  }
  const state = recheckState({ from, records, runs });
  if (state.kind === 'review' || (state.kind === 'refused' && state.open === 0)) return null;
  const shortOf = (id) => gitOut(spawn, cwd, ['rev-parse', '--short', id]) ?? id.slice(0, 7);
  const findings = (n) => `${n} finding${n === 1 ? '' : 's'}`;
  if (state.kind === 'recheck') {
    const at = shortOf(from);
    return {
      refuse: true,
      detail: `the Codex review that ended at ${at} owes a correction: ${findings(state.findings.length)} open, not rechecked`,
      lines: [...state.findings.map(priorLine), `commit the correction, then recheck it: js-harness codex-review --base ${at}`],
    };
  }

  // A recheck that left findings open, which a second recheck may not take up: the recheck is the last
  // reviewed record that ends at `from` when it is one, else the last one of the findings that ended there.
  const reviewed = records.filter((rec) => isValidCodexReview(rec) && rec.outcome === 'reviewed');
  const atFrom = reviewed.filter((rec) => rec.head === from).at(-1);
  const recheck = typeof atFrom?.recheckOf === 'string' ? atFrom : reviewed.filter((rec) => rec.recheckOf === from).at(-1);
  const id = Array.isArray(recheck.runs) ? recheck.runs.at(-1) : recheck.run;
  const line = runs.findLast((one) => one?.id === id);
  const answered = runAnswerFindings(line);
  const prior = line?.recheck?.findings;
  // The findings it left open are those its answer marked not fixed or blocking, or did not mark, as
  // `codex-review` counted them; a line that kept no answer or no count lists none, and still refuses.
  const read = answered !== null && Number.isInteger(prior) ? classifyRecheck({ findings: answered }, prior) : null;
  const open = read === null ? [] : [...read.notFixed, ...read.blocking, ...read.unmarked];
  const at = shortOf(recheck.head);
  const left = state.open === null ? 'findings open (its counts were not kept)' : `${findings(state.open)} open`;
  return {
    refuse: false,
    lines: [
      `warning: the Codex recheck that ended at ${at} left ${left} of the review that ended at ${shortOf(state.of)}`,
      ...open.map(priorLine),
      // No skip is offered: a skip records no correction.
      `the push passes; the user decides whether they are waived, or a correction is committed as code and reviewed`,
    ],
  };
}

/** The `--push` row: every commit between the remote's default branch and `head` that changes a file
 * a review reads (not a document, not a path the project marks; a merge by the files somebody wrote
 * in it, so one that only brings two sides together needs none: `reviewCoverage`)
 * must lie in a range some `codex-review` record covers (any
 * outcome: an `unavailable` record is an explicit skip, and a `nothing-to-review` one a range that held
 * nothing for a review to look at, such as a change and its revert; both are listed), and the review the
 * branch ends on must owe no unrechecked correction (`correctionOwed`; a recheck that left findings open
 * passes with a warning that names them). Plain `check` never
 * runs it, because a slice under the review budget is committed before it is reviewed: what it
 * runs is `checkCodexReviewDebt`, which reads the same records and fails nothing. */
export function checkCodexReviews(cwd, head = 'HEAD', { spawn = spawnSync, remote = 'origin' } = {}) {
  // The switch is read at the commit pushed, before the remote is resolved: a project with the review off is
  // never refused for a remote this row cannot measure. One that cannot be read is read as on, and said.
  const git = gitIn(cwd, spawn);
  const tip = git(['rev-parse', '--verify', '--quiet', `${head}^{commit}`])?.trim();
  const atTip = tip ? codexSwitchAt(git, tip) : null;
  if (atTip?.value === 'off') {
    const row = { name: 'codex-review', pass: true, detail: `the Codex review is off at the pushed commit (${atTip.because}), so no record is asked for` };
    const turned = turnsReviewOff(cwd, git, spawn, remote, tip);
    return turned ? { ...row, lines: [turned] } : row;
  }
  const row = codexCoverageRow(cwd, head, { spawn, remote });
  if (!atTip?.errors.length) return row;
  return { ...row, lines: [...atTip.errors.map((error) => `read as on: ${error}`), ...(row.lines ?? [])] };
}

/** Whether the Codex review is off at the commit `head` of the repository `cwd` is in, read as `checkCodexReviews`
 * reads it (one that cannot be read is on). For the merge queue, whose code commits are then those that change a file
 * that is not Markdown (odd/tasks/rule-hierarchy.md, "The merge door (T16e)", item 5). */
export function codexReviewOffAt(cwd, head, { spawn = spawnSync } = {}) {
  const git = gitIn(cwd, spawn);
  const tip = git(['rev-parse', '--verify', '--quiet', `${head}^{commit}`])?.trim();
  return tip ? codexSwitchAt(git, tip).value === 'off' : false;
}

/** The Codex review's switch at the commit `rev`, read from that commit's own files: `{ value, because, errors }`. */
function codexSwitchAt(git, rev) {
  const { errors, resolved } = functionsOf(harnessOfCommit(git, rev), commitTree(git, rev));
  return { ...resolved.codexReview, errors };
}

/** The top of the working tree `cwd` is in: the nearest folder up from it that holds `.git` (a folder, or the
 * file of a worktree), found without starting git, since the rows that read it count their git processes.
 * `cwd` itself where none does. */
function topOf(cwd) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) return cwd;
  }
}

/** The Codex review's switch in the working tree of the repository `cwd` is in, read at its top: `cwd` may be
 * a folder below it. Outside a repository, `cwd` itself. */
export function codexSwitchHere(cwd, spawn) {
  const { errors, resolved } = functionsOf(harnessOfTree(topOf(cwd)), workingTree(gitIn(cwd, spawn)));
  return { ...resolved.codexReview, errors };
}

/** The line of a push that turns the review off where the default branch of `remote` has it on, or `null`:
 * the switch is the pushed commit's to say, and the push says it in plain sight. */
function turnsReviewOff(cwd, git, spawn, remote, tip) {
  const remotes = git(['remote'])?.split('\n').map((line) => line.trim()) ?? [];
  if (!remotes.includes(remote)) return null;
  const branch = defaultBranch(spawn, cwd, remote);
  if (!branch || codexSwitchAt(git, branch.ref).value !== 'on') return null;
  return `this push turns the Codex review off: it is on at ${branch.label} and off at ${git(['rev-parse', '--short', tip]).trim()}`;
}

/** git's empty tree: the base a diff of everything a commit holds is taken from. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/** The push row of the first push of a project to an empty repository, or `null` when it is not one. His
 * answer (odd/tasks/on-demand-functions.md, S10): it passes and says so, with what went unread and the
 * command that reviews it, which plans its cost first. It is one only where the remote holds no branch at all
 * (`remoteHoldsNoBranch`); a remote that cannot be asked is no first push, and the row fails as before. */
function firstPushRow(cwd, head, { spawn, remote }) {
  if (!remoteHoldsNoBranch(cwd, { spawn, remote })) return null;
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  const commits = tip && gitOut(spawn, cwd, ['rev-list', '--count', tip]);
  const roots = tip && gitOut(spawn, cwd, ['rev-list', '--max-parents=0', tip])?.split('\n').filter(Boolean);
  if (!commits || !roots?.length) return null;
  const first = roots[roots.length - 1].slice(0, 7);
  const size = reviewSize(spawn, cwd, EMPTY_TREE, tip);
  const unread = size === null ? 'git could not size them' : `${counted(size.changedLines, 'changed line')} in ${counted(size.files, 'file')}`;
  return {
    name: 'codex-review',
    pass: true,
    detail: `${remote} holds no branch yet, so this first push passes with no Codex review; from the next push on, every code commit is measured against what it leaves there`,
    lines: [
      `${counted(Number(commits), 'commit')} went unread by Codex: ${unread}`,
      `review them when you choose: js-harness codex-review --base ${first} --plan prints the cost and starts nothing; without --plan it reviews them`,
      `${first} itself, the first commit, is in no range: what it holds stays unread`,
    ],
  };
}

/** The push row with the review on: what the records say of the code commits pushed. */
function codexCoverageRow(cwd, head, { spawn, remote }) {
  const name = 'codex-review';
  const fail = (detail, lines) => ({ name, pass: false, detail, ...(lines ? { lines } : {}) });
  const state = codexReviewCoverage(cwd, head, { spawn, remote });
  if (state.unknown) return firstPushRow(cwd, head, { spawn, remote }) ?? fail(state.unknown.detail, state.unknown.lines);
  const { tip, baseRef, base, codeCommits, covers, uncovered, note } = state;
  if (uncovered.length) {
    // `git log` lists newest first, so the oldest uncovered commit is the last one.
    const oldest = uncovered[uncovered.length - 1];
    // A root commit has no `<id>^` to use as a base; a range from the unrelated default branch does
    // reach it, and `--unavailable` records a skip instead of a review. The command "makes the record",
    // not "the review": over a range with nothing to review it records that, and starts no review.
    // A merge is no root commit: its `<id>^` is the first of its parents, and the range from there holds
    // the merge and all it changed against that parent, what was written in it included.
    // The base is the one the plain row sizes (`checkCodexReviewDebt`): the parent of the oldest uncovered
    // commit only where a review can start there (`reviewStart`), else the default branch. Named as
    // `<oldest>^` alone, it was the `main` a branch left once `main` had been merged in after that commit,
    // and the range read again all `main` gained since (failure 15, 41 parts where 6 were due). With the
    // commits before the merge covered, that parent is the merge commit itself.
    const range = rangeStart(cwd, { base: baseRef, tip, spawn });
    const { before } = range.unknown ? { before: null } : reviewStart(uncovered, { cwd, from: range.from, tip, spawn });
    const hint = oldest.isRoot
      ? `${oldest.shortId} is a root commit, so ${oldest.shortId}^ does not exist; a range from the default branch reaches it: js-harness codex-review --base ${base} (add --unavailable <reason> to record a skip instead)`
      : `make the record with: js-harness codex-review --base ${before === null ? base : `${before.shortId}^`}`;
    const lines = [...uncoveredNames(uncovered), ...beyondLines(uncovered, state.beyond, tip), hint];
    return fail(`${uncovered.length} of ${codeCommits.length} code commit${codeCommits.length === 1 ? '' : 's'} since ${base} have no Codex review record (${codexReviewsPath(cwd, { spawn }) ?? 'no record file'})${note}`, lines);
  }

  const owed = correctionOwed(cwd, state, { spawn });
  if (owed?.refuse) return fail(`${owed.detail}${note}`, owed.lines);

  // The records that cover a code commit here and are no review of Codex's, each as a line that says which
  // it is and why: an explicit skip, or a range that held nothing to review. The detail counts the commits
  // as covered by a record, which they are; these lines are what keeps that from reading as "reviewed".
  const lines = notReviews(state).map((rec) => `${NOT_A_REVIEW[rec.outcome]} ${rec.base.slice(0, 7)}..${rec.head.slice(0, 7)}: ${rec.reason ?? 'no reason given'}`);
  if (owed !== null) lines.push(...owed.lines);
  return { name, pass: true, detail: `${coveredDetail(state)}${note}`, ...(lines.length ? { lines } : {}) };
}

/** How large the review of `from..tip` is today, sized as `js-harness codex-review` sizes a range: how many
 * `parts` it is reviewed in at the default bound of a part, and the `changedLines` and `files` they hold,
 * which are those of the files a review reads; `leftOut` is how many files of the range it leaves out, by
 * the marks of the commit `tip`, as that command reads them. `null` when git cannot say. Renames are off,
 * as in that command. */
function reviewSize(spawn, cwd, from, tip, merge = null) {
  // The output ends with the NUL that ends its last record, which is no whitespace: `gitOut` trims nothing of it.
  // `--no-relative`, as for the commits (`reviewCoverage`): every file of the range, named from the top.
  // A merge of the default branch is sized by what was written in it, as that command reads it (`mergeStart`).
  const args = merge === null ? ['diff', '--numstat', '-z', '--no-renames', '--no-relative', from, tip] : rangeDiff({ from, head: tip, merge }, ['--numstat', '-z', '--no-relative']);
  const numstat = from === null ? null : gitOut(spawn, cwd, args);
  if (numstat === null) return null;
  try {
    const files = numstatFiles(numstat);
    const why = leftOutOf(files.map((file) => file.path), { cwd, source: tip, spawn });
    if (why === null) return null;
    const { read, leftOut } = reviewScope(files, why);
    return { parts: reviewParts(read).length, files: read.length, changedLines: read.reduce((sum, file) => sum + file.changedLines, 0), leftOut: leftOut.files };
  } catch {
    return null;
  }
}

/** The `codex-review` row of the plain check: how much code waits for a Codex review, said at every commit.
 * A branch once reached 28 parts of review because no slice was reviewed when it closed and nothing said the
 * debt was growing (odd/tasks/codex-review-cost.md); the `--push` row says it when the push is refused, and
 * by then the review is as large as it will get.
 *
 * Informational: it reads what the `--push` row reads (`codexReviewCoverage`, from the remote's default
 * branch to `HEAD`) and fails nothing, a state it cannot tell included. For the code commits no record
 * covers it says how many they are, names each one as the `--push` row does, with the command that makes
 * the record, and says how large the review that covers them is today: the review
 * `js-harness codex-review` would run, which starts where the records end (`reviewStart`, the one rule the
 * two share) and leaves out the files a review leaves out; and it names the command that prints the plan of
 * that review and starts nothing.
 *
 * It fails nothing by throwing either. Every git call under it answers `null` where it fails and the
 * records are read by a reader that passes over what it cannot read, but the plain check ran none of this
 * before the row existed: whatever still throws is said as what the row cannot tell, with what failed, and
 * the check goes on as it would have. The `--push` row has no such guard, and a throw under it stays loud. */
export function checkCodexReviewDebt(cwd, { spawn = spawnSync, remote = 'origin' } = {}) {
  const row = (detail, lines) => ({ name: 'codex-review', pass: true, info: true, detail, ...(lines?.length ? { lines } : {}) });
  const cannotTell = (why) => row(`cannot tell how much code waits for a Codex review: ${why}`);
  try {
    // Inside the guard: the switch is read from files and git as the rest is, and fails nothing either.
    const here = codexSwitchHere(cwd, spawn);
    if (here.value === 'off') return row(`the Codex review is off here (${here.because}): no code waits for one`);
    return codexReviewDebt(cwd, { spawn, remote }, { row, cannotTell });
  } catch (err) {
    return cannotTell(`reading the commits, their Codex review records or the size of their review failed (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** What `checkCodexReviewDebt` says, made with its `row` and its `cannotTell`, and free to throw. */
function codexReviewDebt(cwd, { spawn, remote }, { row, cannotTell }) {
  const state = codexReviewCoverage(cwd, 'HEAD', { spawn, remote });
  // A fresh clone, a project with no remote, a folder that is no repository: this runs in all of them.
  if (state.unknown) return cannotTell(state.unknown.why ?? state.unknown.detail);
  const { tip, baseRef, base, codeCommits, uncovered, note } = state;
  if (uncovered.length === 0) {
    // Covered by a record is not reviewed: a skip and a range with nothing to review cover too. How many
    // such records there are is said; which they are is the push check's listing, not repeated at every commit.
    const others = notReviews(state).length;
    const said = others ? ` (${others} of the records that cover them ${others === 1 ? 'is' : 'are'} a skip or a range with nothing to review: js-harness check --push lists them)` : '';
    return row(`${coveredDetail(state)}${said}${note}`);
  }
  // The review that is sized is the one `js-harness codex-review` would run: it starts where that command
  // starts it (`reviewStart`), from the commit the range of the default branch starts at, which is `null`
  // where the two histories share none. That is the parent of the oldest uncovered commit, named as
  // `<id>^`, when a review can start there; where it cannot (a root commit has no `<id>^`, for one) the
  // push check names the default branch as the base that reaches every commit, and so does this.
  // Where git did not say which commit the range starts at, no start is known and none is sized: taken
  // for two histories that share none, a later start would be held to no commit (`rangeStart`).
  const range = rangeStart(cwd, { base: baseRef, tip, spawn });
  // A merge of the default branch at the tip, after a branch whose every other code commit has a record, is
  // reviewed from its first parent by what was written in it (`mergeStart`), and named as `<merge>^`.
  const merge = range.unknown || range.from === null ? null : mergeStart(cwd, { given: range.from, tip, spawn, remote });
  const atMerge = merge === null ? null : uncovered.find((commit) => commit.id === tip);
  const { start, before } = atMerge ? { start: merge.from, before: atMerge } : range.unknown ? { start: null, before: null } : reviewStart(uncovered, { cwd, from: range.from, tip, spawn });
  const baseArg = before === null ? base : `${before.shortId}^`;
  const one = reviewSize(spawn, cwd, start, tip, atMerge ? merge : null);
  // A merge of main below HEAD, after code commits that each have a record, is reviewed in two turns where they
  // cost less than the one review (`mergeTurn`, `turnsCheaper`): the command decides it so, and so does this.
  const turn = atMerge || one === null || range.unknown || range.from === null ? null : mergeTurn(cwd, { given: range.from, tip, uncovered, spawn, remote });
  // A merge that has the review off cannot be a turn of its own, as the command says of it (`cutInTurns`).
  const turnable = turn !== null && codexSwitchAt(gitIn(cwd, spawn), turn.merge).value !== 'off';
  const turnSizes = turnable ? [reviewSize(spawn, cwd, turn.from, turn.merge, turn), reviewSize(spawn, cwd, turn.merge, tip)] : null;
  const inTurns = turnSizes !== null && turnSizes.every((each) => each !== null) && turnsCheaper(one, turnSizes);
  const both = (key) => turnSizes[0][key] + turnSizes[1][key];
  const size = inTurns ? { parts: both('parts'), changedLines: both('changedLines'), files: both('files'), leftOut: both('leftOut') } : one;
  // More parts than a run starts by itself: the review is already one that has to be asked for by its count.
  const over = size !== null && size.parts > MAX_PARTS_WITHOUT_FLAG;
  let sized = `how large the review of ${baseArg}..HEAD is today could not be told`;
  if (size?.parts === 0) sized = `the review of ${baseArg}..HEAD has no part today, since the range changes no file ${size.leftOut > 0 ? 'a review reads ' : ''}as a whole`;
  else if (size) {
    const what = inTurns ? `2 turns today, the merge ${turn.merge.slice(0, 7)} by what was written in it and then the commits after it: ${counted(size.parts, 'part')}` : `${counted(size.parts, 'part')} today`;
    sized =
      `the review of ${baseArg}..HEAD is ${what}, ${counted(size.changedLines, 'changed line')} in ${counted(size.files, 'file')}` +
      (over ? `, already more parts than ${partsBound({ maxParts: MAX_PARTS_WITHOUT_FLAG, maxPartsGiven: false })}` : '');
  }
  return row(`no Codex review record for ${uncovered.length} of ${counted(codeCommits.length, 'code commit')} since ${base}: ${sized}${note}`, [
    // The base is the one the size above was read from, so the row names one review, not two.
    ...uncoveredNames(uncovered),
    ...beyondLines(uncovered, state.beyond, tip),
    `make the record with: js-harness codex-review --base ${baseArg}`,
    ...(over ? ['the cheaper way is to review now: every commit added to this range makes its review larger'] : []),
    `what it would cost, with nothing spent: js-harness codex-review --base ${baseArg} --plan`,
  ]);
}
