// The Codex review rows of `js-harness check`: the `--push` row, which refuses a code commit no record covers,
// the row of the plain check, which says how large the review of the branch is, and the switch they read. `check`
// re-exports what it exported; a library module imports them from here, so it does not load the whole gate to
// read one row (odd/tasks/reorganization.md, S1).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { reviewParts } from './codex-review-parts.mjs';
import { MAX_PARTS_WITHOUT_FLAG, partsBound } from './codex-review-plan.mjs';
import { beyondLines, defaultBranch, gitOut, MARKS_UNREAD, mergeStart, NOT_A_REVIEW, notReviews, rangeDiff, rangeStart, remoteHoldsNoBranch, reviewCoverage, reviewStart, admittedRecords } from './codex-review-coverage.mjs';
import { mergeTurn, recheckAt, turnsCheaper } from './codex-review-turns.mjs';
import { codexReviewsPath, isValidCodexReview, readCodexReviews } from './codex-reviews.mjs';
import { readCodexReviewRuns } from './codex-review-runs.mjs';
import { classifyRecheck, ESCALATION_SAID, priorLine, recheckState, runAnswerFindings } from './codex-review-recheck.mjs';
import { counted, leftOutOf, rangeFiles, reviewScope } from './codex-review-scope.mjs';
import { commitTree, functionsOf, gitIn, harnessOfCommit, harnessOfTree, workingTree } from './project-functions.mjs';
import { commandStep, firstStep, noStep, reviewCommand } from './next-step.mjs';
import { reviewStep } from './lens-review-rows.mjs';
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
  const unknown = (detail, why, next) => ({ unknown: { detail, ...(why ? { why } : {}), next } });
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!tip) {
    return gitOut(spawn, cwd, ['rev-parse', '--git-dir']) === null
      ? unknown(`${cwd} is not a git repository`, 'this is not a git repository', noStep(`${cwd} is not a git repository, so there is no range to check`))
      : unknown(`cannot resolve --head ${head} to a commit`, `${head} does not name a commit`, firstStep('give --head a commit this repository holds, by its hash, or check out the branch that has it'));
  }
  // Git hands a hook the URL, not a name, when the push names a URL: no ref of it can exist.
  const remotes = gitOut(spawn, cwd, ['remote'])?.split('\n').map((line) => line.trim()) ?? [];
  if (!remotes.includes(remote)) {
    return unknown(
      `${remote} is not a configured remote, so there is no default branch to compare against`,
      undefined,
      firstStep('add a remote with git remote add <name> <url> and push through it, or name an existing one with --remote <name>'),
    );
  }
  const branch = defaultBranch(spawn, cwd, remote);
  if (!branch) {
    return unknown(
      `no default branch of ${remote} to compare against (refs/remotes/${remote}/HEAD, ${remote}/main or ${remote}/master), so there is no range to check`,
      undefined,
      firstStep(`set the default branch of ${remote}: git remote set-head ${remote} --auto`),
    );
  }
  const { ref: baseRef, label: base } = branch;

  // A record whose head lies past the tip covers nothing here, as at the merge door (`beyondTip`).
  const coverage = reviewCoverage(cwd, { from: baseRef, tip, spawn, beyondTip: false });
  if (coverage.unknown === MARKS_UNREAD) {
    return unknown(`cannot read which files of ${base}..${head} a Codex review leaves out (\`git check-attr --source\` failed; it needs git 2.40 or later)`, undefined, firstStep('use git 2.40 or later, which reads the marks of the files'));
  }
  if (coverage.unknown) return unknown(`cannot list the commits in ${base}..${head}`, undefined, noStep(`git did not list the commits in ${base}..${head}`));
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
 * refuses the head whose next review would be a first recheck, and nothing else. The head of a recheck that
 * left findings open passes with a warning that names them, and names the second recheck when one may still
 * run (at most three reviews, `recheckState`): whether a disputed finding is waived is the user's call
 * (decided 2026-10-15: no waiver, the warning is enough). Coverage is still read from the records alone (./codex-review-runs.mjs says why);
 * the run log, where the findings are kept, only adds this refusal, and a log that cannot be read proves
 * nothing owed. Documents committed after that head change nothing here: they are no code commit.
 *
 * A merge does not clear what the review below it owes (`recheckThrough`, codex-spend L21): where that last record is
 * the clean one of what was written in a merge, what is owed is read from the merge's first parent, as `codex-review`
 * reads it. `below`, a commit, asks it of the review that ended at or behind that commit instead: the first parent of
 * a merge at the tip that no record covers, which `codex-review` does not review while that correction is owed, or
 * the commit the review of the commits no record covers starts at. Read past a merge, a merge's own record that owes
 * joins the debt below it (`recheckThrough`, codex-spend L24): the review after it is the recheck of both. `through`
 * says the debt was read past a merge, or joined there. */
function correctionOwed(cwd, { codeCommits, covers, tip }, { spawn, below = null }) {
  let from = below;
  let last;
  if (below === null) {
    const newest = codeCommits[0];
    if (newest === undefined) return null;
    // Only a review of Codex's says what the code owes: a skip or a range that held nothing records no
    // review, so one written later, as to a document commit after the head, must not hide the debt.
    last = covers.filter(({ rec, covered }) => rec.outcome === 'reviewed' && covered.has(newest.id)).at(-1)?.rec;
    if (last !== undefined) from = last.head;
    // Covered by records that are no review alone, a skip or a range with nothing to review, the newest code commit
    // pays no correction either: what is owed is read from the tip as the next run reads it (`recheckAt`), and a
    // commit and its revert above a review that owes leave it owed (Y1, JH 199's verifier on pull request 883).
    else if (covers.some(({ covered }) => covered.has(newest.id))) [from, below] = [tip, tip];
    else return null;
  }
  let records;
  let runs;
  try {
    // Only a review a run line admits says what is owed (F2, the opus verifier on pull request 896): a bare record at
    // the owing head read as the review the branch ends on, with nothing owed. Admission is asked of reviews alone.
    records = admittedRecords(cwd, { spawn });
    runs = readCodexReviewRuns(cwd, { spawn });
  } catch {
    return null;
  }
  // A run log with no line holds no finding: nothing is owed, and git is asked nothing more.
  if (runs.length === 0) return null;
  // Git is asked more only past a merge: most pushes end on a record of no merge, and pay nothing for this. So too
  // the head of a recheck of a merge's own record, which may have been the third review of a debt below the merge
  // (`recheckThrough`, codex-spend L26): read alone, it would name a second recheck the run then refuses.
  const mergeOwnAt = (head) => records.findLast((rec) => isValidCodexReview(rec) && rec.outcome === 'reviewed' && rec.head === head)?.diff === 'remerge';
  if (last !== undefined && (last.diff === 'remerge' || (typeof last.recheckOf === 'string' && mergeOwnAt(last.recheckOf)))) below = from;
  let state = recheckState({ from, records, runs });
  if (below !== null) state = recheckAt(cwd, { from, tip, records, runs, spawn }) ?? state;
  const through = state.at !== undefined;
  // The head whose review owes it: found past a merge (`at`), or past documents, where a recheck names it (`of`).
  if (state.at !== undefined || state.kind === 'recheck') from = state.at ?? state.of;
  if (state.kind === 'review' || (state.kind === 'refused' && state.open === 0)) return null;
  const shortOf = (id) => gitOut(spawn, cwd, ['rev-parse', '--short', id]) ?? id.slice(0, 7);
  const findings = (n) => `${n} finding${n === 1 ? '' : 's'}`;
  if (state.kind === 'recheck' && state.second !== true) {
    const at = shortOf(from);
    // The step is the commit: the next run of the push names the recheck's command, at the head the commit makes.
    return {
      refuse: true,
      through,
      of: from,
      detail: `the Codex review that ended at ${at} owes a correction: ${findings(state.findings.length)} open, not rechecked`,
      lines: state.findings.map(priorLine),
      next: firstStep('fix the open findings above in code and commit the fix'),
    };
  }

  // A recheck that left findings open, which a second recheck may not take up: the recheck is the last
  // reviewed record that ends at `from` when it is one, else the last one of the findings that ended there.
  const reviewed = records.filter((rec) => isValidCodexReview(rec) && rec.outcome === 'reviewed');
  const atFrom = reviewed.filter((rec) => rec.head === from).at(-1);
  const recheck = typeof atFrom?.recheckOf === 'string' ? atFrom : reviewed.filter((rec) => rec.recheckOf === from).at(-1);
  // Asked below a merge no record covers, the state may be read past documents from a head that is none of them.
  if (recheck === undefined) return null;
  const id = Array.isArray(recheck.runs) ? recheck.runs.at(-1) : recheck.run;
  const line = runs.findLast((one) => one?.id === id);
  const answered = runAnswerFindings(line);
  const prior = line?.recheck?.findings;
  // The findings it left open are those its answer marked not fixed or blocking, or did not mark, as
  // `codex-review` counted them; a line that kept no answer or no count lists none, and still refuses.
  const read = answered !== null && Number.isInteger(prior) ? classifyRecheck({ findings: answered }, prior) : null;
  const open = read === null ? [] : [...read.notFixed, ...read.blocking, ...read.unmarked];
  const at = shortOf(recheck.head);
  const counts = line?.recheck;
  const left = Number.isInteger(counts?.notFixed) && Number.isInteger(counts?.blocking)
    ? `${findings(counts.notFixed + counts.blocking + (Number.isInteger(counts.unmarked) ? counts.unmarked : 0))} open`
    : 'findings open (its counts were not kept)';
  return {
    refuse: false,
    lines: [
      `warning: the Codex recheck that ended at ${at} left ${left} of the review that ended at ${shortOf(recheck.recheckOf)}`,
      ...open.map(priorLine),
      ...(state.reviews === 3 ? [`three reviews did not settle this change: ${ESCALATION_SAID}`] : []),
      ...(state.kind === 'recheck' ? [`a second recheck, the last of three reviews, takes them up: js-harness codex-review --base ${shortOf(from)}`] : []),
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
    const madeOn = madeWithReviewOn(cwd, git, head, { spawn, remote });
    if (madeOn) return madeOn;
    const owed = owedWhereOff(cwd, git, head, tip, { spawn, remote });
    if (owed?.refuse) return owed.row;
    const row = { name: 'codex-review', pass: true, detail: `the Codex review is off at the pushed commit (${atTip.because}), so no record is asked for` };
    const turned = turnsReviewOff(cwd, git, spawn, remote, tip);
    const lines = [...(turned ? [turned] : []), ...(owed?.paid ? [owed.paid] : [])];
    return lines.length ? { ...row, lines } : row;
  }
  const row = codexCoverageRow(cwd, head, { spawn, remote });
  if (!atTip?.errors.length) return row;
  return { ...row, lines: [...atTip.errors.map((error) => `read as on: ${error}`), ...(row.lines ?? [])] };
}

/** The failing push row for the code commits no record covers that were made with the Codex review on, read from each
 * commit's own tree as the lens door reads its switch, where the pushed commit has it off; `null` when there are none,
 * or the range cannot be read (no remote, no default branch), where the off row passes as it did. Without it, a push
 * that turns the review off let every commit before it go unread (B2-1, the full audit of 2026-11-14). */
function madeWithReviewOn(cwd, git, head, { spawn, remote }) {
  const state = codexReviewCoverage(cwd, head, { spawn, remote });
  if (state.unknown) return null;
  const asked = state.uncovered.filter((commit) => codexSwitchAt(git, commit.id).value !== 'off');
  if (asked.length === 0) return null;
  const oldest = asked[asked.length - 1];
  const base = oldest.isRoot ? git(['rev-parse', '--verify', '--quiet', `${state.baseRef}^{commit}`])?.trim() : `${oldest.shortId}^`;
  const review = { tool: 'codex-review', base };
  const one = asked.length === 1;
  return {
    name: 'codex-review',
    pass: false,
    detail: `${asked.length} code commit${one ? '' : 's'} since ${state.base} made with the Codex review on ${one ? 'has' : 'have'} no Codex review record: the review is off at the pushed commit, not at ${one ? 'its' : 'theirs'}`,
    lines: uncoveredNames(asked),
    // Bound to the newest of them, where the review is on: `codex-review` records nothing at a head with it off (Codex on S4).
    next: reviewStep(cwd, { spawn, ...review, tip: asked[0].id }),
    review,
  };
}

/** The correction a Codex review owes where the review is off at the pushed commit `tip` (F3, the opus verifier on pull
 * request 896; the lead, L34 and L42 of odd/tasks/review-gate.md): `null` when none is owed or the range cannot be
 * read; `{ paid }`, the line of the skip that pays it; else `{ refuse: true, row }`. It is read from the code commits a
 * record covers, as `correctionOwed` reads it, since the commits made after the review went off ask for none. While
 * the review is off `codex-review` records no recheck, so the correction is paid by a recheck made with it on again,
 * or by a skip from the owing head, recorded on the owner's typed no with his words as its reason; the skip pays it
 * only here, with the review off at the tip, never with it on. */
function owedWhereOff(cwd, git, head, tip, { spawn, remote }) {
  const state = codexReviewCoverage(cwd, head, { spawn, remote });
  if (state.unknown) return null;
  // Read from the newest code commit a review covers: a later skip or record of nothing to review, of commits made off,
  // would put the read past the uncovered commit that turned the review off, where the walk back stops (Codex on F3).
  const reviewed = new Set(state.covers.filter(({ rec }) => rec.outcome === 'reviewed').flatMap(({ covered }) => [...covered]));
  const owed = correctionOwed(cwd, { ...state, codeCommits: state.codeCommits.filter((commit) => reviewed.has(commit.id)) }, { spawn });
  if (!owed?.refuse) return null;
  const shortOf = (id) => git(['rev-parse', '--short', id])?.trim() ?? id.slice(0, 7);
  // The record log is shared by every branch and worktree: a skip pays only where it ends on the history pushed, at
  // or past the owing head (Codex on F3).
  const onLine = (older, newer) => spawn('git', ['merge-base', '--is-ancestor', older, newer], { cwd, encoding: 'utf8' }).status === 0;
  const skip = readCodexReviews(cwd, { spawn }).findLast((rec) => isValidCodexReview(rec) && rec.outcome === 'unavailable' && rec.base === owed.of && onLine(rec.base, rec.head) && onLine(rec.head, tip));
  if (skip !== undefined) return { paid: `skip ${shortOf(skip.base)}..${shortOf(skip.head)} pays the correction the review that ended there owes while the Codex review is off, and stays listed: ${skip.reason}` };
  const step = reviewCommand('codex-review', { base: shortOf(owed.of), at: tip.slice(0, 12), flags: ['--unavailable "<the owner\'s own words>"'] });
  return {
    refuse: true,
    row: {
      name: 'codex-review',
      pass: false,
      detail: `${owed.detail}; turning the Codex review off at the pushed commit does not pay it`,
      lines: [...owed.lines, 'it is paid by a recheck made with the review on again, or, on the owner\'s typed no, by a skip from that head with his words as its reason'],
      next: commandStep(step),
    },
  };
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
  const fail = (detail, lines, next, review) => ({ name, pass: false, detail, ...(lines ? { lines } : {}), next: next, ...(review ? { review } : {}) });
  const state = codexReviewCoverage(cwd, head, { spawn, remote });
  if (state.unknown) return firstPushRow(cwd, head, { spawn, remote }) ?? fail(state.unknown.detail, undefined, state.unknown.next);
  const { tip, baseRef, base, codeCommits, covers, uncovered, note } = state;
  if (uncovered.length) {
    // `git log` lists newest first, so the oldest uncovered commit is the last one.
    const oldest = uncovered[uncovered.length - 1];
    // A merge at the tip alone uncovered, below which a review owes a correction: the fix comes first, since
    // `codex-review` reviews no such merge before the recheck, which only commits after it can be (codex-spend L21).
    const tipMerge = uncovered.length === 1 && oldest.id === tip && oldest.parentCount === 2;
    const owedBelow = tipMerge ? correctionOwed(cwd, state, { spawn, below: oldest.parent }) : null;
    if (owedBelow?.refuse) return fail(`${owedBelow.detail}${note}`, owedBelow.lines, owedBelow.next);
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
    // The command's base is a hash, as every printed command's is: the default branch's own where there is no parent to name.
    const review = { tool: 'codex-review', base: before === null ? gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]) : `${before.shortId}^` };
    const lines = [...uncoveredNames(uncovered), ...beyondLines(uncovered, state.beyond, tip)];
    if (oldest.isRoot) lines.push(`${oldest.shortId} is a root commit, so ${oldest.shortId}^ does not exist: a range from the default branch reaches it (--unavailable <reason> records a skip instead)`);
    const missing = `${uncovered.length} of ${codeCommits.length} code commit${codeCommits.length === 1 ? '' : 's'} since ${base} have no Codex review record (${codexReviewsPath(cwd, { spawn }) ?? 'no record file'})`;
    // Their review starts below a merge, or reads past one, to a review that owes a correction: it is that recheck,
    // and the row says the correction is owed until it is recorded, as it does once they are covered (codex-spend
    // L24, V6). The command is still the review of them, which holds the correction already committed. Where the
    // range is taken as given, an oldest uncovered merge is still cut at its first parent (`mergeTurn`).
    const first = before ?? (oldest.parentCount === 2 ? oldest : null);
    // Asked once: a merge alone at the tip was asked it above, from the same commit.
    const owedFirst = first === null ? null : tipMerge && first === oldest ? owedBelow : correctionOwed(cwd, state, { spawn, below: first.parent });
    if (owedFirst?.refuse && (first.parentCount === 2 || owedFirst.through)) {
      return fail(`${owedFirst.detail}; ${missing}, and their review is that recheck${note}`, [...owedFirst.lines, ...lines], reviewStep(cwd, { spawn, ...review, tip }), review);
    }
    return fail(`${missing}${note}`, lines, reviewStep(cwd, { spawn, ...review, tip }), review);
  }

  const owed = correctionOwed(cwd, state, { spawn });
  if (owed?.refuse) return fail(`${owed.detail}${note}`, owed.lines, owed.next);

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
 * the marks of the commit `tip`, as that command reads them. `null` when git cannot say. Renames are asked
 * for, as in that command. */
function reviewSize(spawn, cwd, from, tip, merge = null) {
  // The output ends with the NUL that ends its last record, which is no whitespace: `gitOut` trims nothing of it.
  // `--no-relative`, as for the commits (`reviewCoverage`): every file of the range, named from the top.
  // A merge of the default branch is sized by what was written in it, as that command reads it (`mergeStart`).
  // Renames off where one brings a file a review leaves out into one it reads, as that command reads it (`rangeFiles`).
  const args = (renames) => (merge === null ? ['diff', '--numstat', '-z', renames, '--no-relative', from, tip] : rangeDiff({ from, head: tip, merge, renames }, ['--numstat', '-z', '--no-relative']));
  if (from === null) return null;
  try {
    const { files, why, failed } = rangeFiles((renames) => gitOut(spawn, cwd, args(renames)), (names) => leftOutOf(names, { cwd, source: tip, spawn }));
    if (failed) return null;
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
  // A merge below a review that owes a correction is cut whatever it costs, as the command cuts it (`mergeTurn`).
  const inTurns = turnSizes !== null && turnSizes.every((each) => each !== null) && (turn.owes !== undefined || turnsCheaper(one, turnSizes));
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
