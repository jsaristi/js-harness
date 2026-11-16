// The Claude lens rows of `js-harness check` (odd/tasks/f8-s1-reviews.md, T4 and T5; diet section 10, "S1, the Claude
// lens runner", items 7 to 9): the `--push` row, which refuses a code commit no complete lens record covers, as the
// `codex-review` row refuses one no Codex record covers, so a slice pushes only with both reviews.
//
// What a code commit is and which records cover it is the one definition both reviews share (`reviewCoverage`, with
// the lens records read in place of Codex's). A record covers its own head commit, so an amend or a rebase leaves the
// range uncovered, and only while its range still hashes to its subject hash. A skip (`--unavailable`) covers, and
// is listed on every row that reads it until a complete review covers the same commits. A first push to a remote
// that holds no branch passes, as the `codex-review` row lets it.
import { spawnSync } from 'node:child_process';
import { beyondLines, defaultBranch, gitOut, MARKS_UNREAD, NOT_A_REVIEW, notReviews, remoteHoldsNoBranch, reviewCoverage } from './codex-review-coverage.mjs';
import { commitTree, functionsOf, gitIn, harnessOfCommit } from './project-functions.mjs';
import { admittedLensReviews } from './lens-reviews.mjs';
import { classifyRecheck } from './codex-review-recheck.mjs';
import { commandStep, firstStep, noStep, reviewCommand } from './next-step.mjs';

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The next step of a refusal that reruns `tool` over `base..tip` (hashes): the command bound to them, with `--at` the
 * head it was computed at, when `tip` is the commit HEAD names, where it runs as printed; else the step to check `tip`
 * out first, since the command is refused at any other head (`atRefusal`). Shared by the rows of both reviews. */
export function reviewStep(cwd, { spawn = spawnSync, tool, base, tip }) {
  const head = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
  if (head === tip) return commandStep(reviewCommand(tool, { base, at: tip }));
  return firstStep(`check out ${tip.slice(0, 7)}, the commit the command is bound to; HEAD is ${head ? head.slice(0, 7) : 'unborn'} here`);
}

/** The severities of a lens finding that owe a correction (B2-2 of the full audit of 2026-11-14: "lens findings never
 * block"), the two the lens prompt holds to proof of introduced harm (`./lens-prompts.mjs`). */
const OWED = new Set(['BLOCKER', 'CRITICAL']);

/** The runs whose findings of `lens` the record `rec` rechecked, oldest first: its `rechecked` map, or, for a record
 * written before it, the one run `recheckOf` names where that run's record holds findings of `lens` (`byRun`). */
export function recheckedRuns(rec, lens, byRun) {
  // A lens the record holds no complete answer of rechecked nothing (the reliability lens on S6).
  if (!rec.results?.some((one) => one?.lens === lens && one.outcome === 'complete')) return [];
  if (rec.rechecked && typeof rec.rechecked === 'object') return Array.isArray(rec.rechecked[lens]) ? rec.rechecked[lens].filter((run) => typeof run === 'string') : [];
  if (typeof rec.recheckOf !== 'string') return [];
  return findingsOf(byRun.get(rec.recheckOf), lens).length > 0 ? [rec.recheckOf] : [];
}

/** The findings of `lens` in the record `rec`, `[]` when it holds none or no complete result of it. */
const findingsOf = (rec, lens) => {
  const result = rec?.results?.find((one) => one?.lens === lens && one.outcome === 'complete');
  return Array.isArray(result?.findings) ? result.findings : [];
};

/** What the admitted lens reviews of `covers` owe, as a Codex review owes a correction (`correctionOwed` in
 * ./codex-review-rows.mjs), read from the records themselves, where a lens keeps its findings. Each lens of each record
 * is read alone (Codex on S6): it is a round of correction when what it rechecked (`recheckedRuns`) held a BLOCKER or
 * CRITICAL finding; else it reviewed afresh, a recheck of WARNINGs among them, and its own BLOCKER and CRITICAL findings
 * are `owed` until a later recheck by that lens names its run and marks them fixed (`classifyRecheck`, as
 * `lens-review` counts them, each finding at its place in the findings of every run that recheck took up). A round of
 * correction owes nothing more: what it left not fixed, and any new finding it marked blocking, are `open`, which
 * warns and passes, the Codex rule of 2026-10-15 (no waiver, the warning is enough). Only a recheck pays: a later
 * review that is no recheck of that run, as one run from below a document commit before the fix, leaves the debt.
 * `admitted` is every admitted lens record, where the runs a recheck names are looked up. */
function lensCorrections(covers, admitted) {
  const byRun = new Map(admitted.filter((rec) => typeof rec.run === 'string').map((rec) => [rec.run, rec]));
  const reviewed = covers.map(({ rec }) => rec).filter((rec) => rec.outcome === 'reviewed' && Array.isArray(rec.results));
  const owed = [];
  const open = [];
  for (const [index, rec] of reviewed.entries()) {
    for (const result of rec.results) {
      if (result?.outcome !== 'complete') continue;
      const { lens } = result;
      const findings = findingsOf(rec, lens);
      const runs = recheckedRuns(rec, lens, byRun);
      const prior = runs.flatMap((run) => findingsOf(byRun.get(run), lens));
      if (prior.some((finding) => OWED.has(finding?.severity))) {
        const asked = findings.map((finding) => ({ title: finding?.claim ?? '' }));
        const read = classifyRecheck({ findings: asked }, prior.length);
        const blocking = findings.filter((finding, at) => read.blocking.includes(asked[at]));
        const left = [...prior.filter((finding, at) => OWED.has(finding?.severity) && read.status[at] !== 'fixed'), ...blocking];
        if (left.length > 0) open.push({ rec, lens, findings: left });
        continue;
      }
      const severe = findings.filter((finding) => OWED.has(finding?.severity));
      if (severe.length === 0) continue;
      const paid = reviewed.slice(index + 1).some((later) => recheckedRuns(later, lens, byRun).includes(rec.run));
      if (!paid) owed.push({ rec, lens, findings: severe });
    }
  }
  return { owed, open };
}

/** The line of an owed or open lens finding. */
const findingLine = (lens, finding) => `${lens} ${finding.severity} ${finding.location} ${finding.claim}`;

/** What the oldest lens review that owes a correction says, from `lensCoverage`'s state: `null` when none owes, else
 * `{ detail, lines, next, review }`, the step being its recheck, run from its head, or the fix when the tip is that head. */
function correctionRefusal(cwd, state, spawn) {
  const [first] = state.corrections.owed;
  if (first === undefined) return null;
  const mine = state.corrections.owed.filter(({ rec }) => rec === first.rec);
  const count = mine.reduce((sum, { findings }) => sum + findings.length, 0);
  const at = first.rec.head.slice(0, 7);
  const review = { tool: 'lens-review', base: at };
  return {
    detail: `the lens review that ended at ${at} owes a correction: ${count} BLOCKER or CRITICAL finding${count === 1 ? '' : 's'} open, not rechecked`,
    lines: mine.flatMap(({ lens, findings }) => findings.map((finding) => findingLine(lens, finding))),
    next: first.rec.head === state.tip ? firstStep('fix the open findings above in code and commit the fix') : reviewStep(cwd, { spawn, ...review, tip: state.tip }),
    review,
  };
}

/** The warning lines of each lens recheck that left a BLOCKER or CRITICAL finding open, from `lensCoverage`'s state. */
const openLines = (state) => state.corrections.open.flatMap(({ rec, lens, findings }) => [
  `warning: the lens recheck that ended at ${rec.head.slice(0, 7)} left ${findings.length} BLOCKER or CRITICAL or blocking finding${findings.length === 1 ? '' : 's'} open`,
  ...findings.map((finding) => findingLine(lens, finding)),
  'the push passes; the user decides whether they are waived, or a correction is committed as code and reviewed',
]);

/** The base a command that makes the record of the oldest uncovered commit is bound to, as its row prints it: that
 * commit's parent (`<id>^`), or, for a root commit, the default branch's hash (`baseHash`). */
const commandBase = ({ uncovered, baseHash }) => {
  const oldest = uncovered[uncovered.length - 1];
  return oldest.isRoot ? baseHash : `${oldest.shortId}^`;
};

/** Whether the lens review is on at the commit `id`, read from that commit's own `harness.json` (`lensReview`), so a
 * commit is asked by the switch it was made under: a branch made before a project turned the review on is never asked
 * wherever it lands, nor is a project that never turns it on (odd/tasks/f8-s1-reviews.md, L9). A time cut-over did
 * neither: it asked the commits of every session that had no `lens-review` yet. The files are not listed, since the
 * switch's `auto` does not read them. */
const lensOnAt = (git, id) => functionsOf(harnessOfCommit(git, id), { paths: [] }).resolved.lensReview.value === 'on';

/** Whether the Codex review is off at the commit `id`, read from that commit's own files as the Codex rows read it
 * (`codexReviewOffAt`): its `auto` reads the commit's files, so they are listed. */
const codexOffAt = (git, id) => functionsOf(harnessOfCommit(git, id), commitTree(git, id)).resolved.codexReview.value === 'off';

/** What the lens records say of the code commits between the default branch of `remote` and `head`: `{ unknown }`
 * when it cannot be told, else `{ base, codeCommits, uncovered, skips, note }`, the code commits being those whose own
 * tree turns the lens review on (`lensOnAt`), and with `whereCodexOff` also those whose own tree turns the Codex review
 * off (`codexOffAt`), where the lenses are the one review. */
export function lensCoverage(cwd, head, { spawn = spawnSync, remote = 'origin', whereCodexOff = false } = {}) {
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!tip) {
    return { unknown: `cannot resolve ${head} to a commit`, next: head === 'HEAD' ? firstStep('make the first commit of this branch, so HEAD names one') : firstStep(`give ${head} a commit this repository holds, by its hash`) };
  }
  const branch = defaultBranch(spawn, cwd, remote);
  if (!branch) return { unknown: `no default branch of ${remote} to compare against`, next: firstStep(`set the default branch of ${remote}: git remote set-head ${remote} --auto`) };
  // A record counts only where the run line lens-review wrote first names it (lens-reviews.mjs, provenance).
  const lens = admittedLensReviews(cwd, { spawn });
  // A record whose head lies past the tip covers nothing here, as at the merge door (`beyondTip`).
  const coverage = reviewCoverage(cwd, { from: branch.ref, tip, spawn, read: () => lens.records, isValid: lens.admitted, beyondTip: false });
  if (coverage.unknown === MARKS_UNREAD) return { unknown: 'cannot read which files a review leaves out (`git check-attr --source` needs git 2.40 or later)', next: firstStep('use git 2.40 or later, which reads the marks of the files') };
  if (coverage.unknown) return { unknown: `cannot list the commits in ${branch.label}..${head}`, next: noStep(`git did not list the commits in ${branch.label}..${head}`) };
  const git = gitIn(cwd, spawn);
  const asked = new Map(coverage.codeCommits.map((commit) => [commit.id, lensOnAt(git, commit.id) || (whereCodexOff && codexOffAt(git, commit.id))]));
  const due = (commit) => asked.get(commit.id) === true;
  const codeCommits = coverage.codeCommits.filter(due);
  const uncovered = coverage.uncovered.filter(due);
  const noteParts = [
    coverage.stale ? `${plural(coverage.stale, 'record')} whose range no longer hashes as reviewed` : '',
    coverage.invalid ? `${plural(coverage.invalid, 'record')} that are no evidence (an incomplete run, or a record no run line of lens-review names, among them)` : '',
  ].filter(Boolean);
  // The hash of the default branch, which a command names as its base where the oldest uncovered commit is a root.
  const baseHash = uncovered.length ? gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${branch.ref}^{commit}`]) : null;
  return { tip, baseRef: branch.ref, baseHash, base: branch.label, codeCommits, uncovered, beyond: coverage.beyond, skips: owedSkips(coverage, codeCommits), corrections: lensCorrections(coverage.covers, lens.records.filter(lens.admitted)), note: noteParts.length ? `; ${noteParts.join('; ')} ignored` : '' };
}

/** The skips (`--unavailable`) among `coverage`'s records that still owe a review: a skip is debt only while a code
 * commit of `codeCommits` it covers has no `reviewed` record, so a review made later pays it. */
function owedSkips(coverage, codeCommits) {
  const reviewed = new Set(coverage.covers.filter(({ rec }) => rec.outcome === 'reviewed').flatMap(({ covered }) => [...covered]));
  const owed = codeCommits.filter((commit) => !reviewed.has(commit.id));
  return notReviews({ covers: coverage.covers, codeCommits: owed }).filter((rec) => rec.outcome === 'unavailable');
}

/** The Codex skips that still owe a review over `from..tip`, read as `owedSkips` reads the lens ones; `null` when git
 * cannot list the commits. */
export function codexSkipsOwed(cwd, { from, tip, spawn = spawnSync }) {
  const coverage = reviewCoverage(cwd, { from, tip, spawn });
  return coverage.unknown ? null : owedSkips(coverage, coverage.codeCommits);
}

/** The Codex skips that still owe a review on the branch at HEAD of `cwd`, as records; `null` when it cannot be told. */
export function branchCodexSkips(cwd, { spawn = spawnSync, remote = 'origin' } = {}) {
  const state = lensCoverage(cwd, 'HEAD', { spawn, remote });
  return state.unknown ? null : codexSkipsOwed(cwd, { from: state.baseRef, tip: state.tip, spawn });
}

/** Whether the review is switched off at the commit `head`, read from that commit's own files as the Codex rows read it
 * (`codexReviewOffAt`); one that cannot be read is on. */
function reviewOffAt(cwd, head, spawn) {
  const git = gitIn(cwd, spawn);
  const tip = git(['rev-parse', '--verify', '--quiet', `${head}^{commit}`])?.trim();
  return tip ? codexOffAt(git, tip) : false;
}

/** The line a skip is listed with. */
export const skipLine = (rec) => `${NOT_A_REVIEW[rec.outcome]} ${rec.base.slice(0, 7)}..${rec.head.slice(0, 7)}: ${rec.reason}`;

/** The line of each skip of both reviews that still owes one, lens skips first, from `state`, what `lensCoverage` said. */
function skipLinesOf(cwd, state, spawn) {
  const codexSkips = codexSkipsOwed(cwd, { from: state.baseRef, tip: state.tip, spawn }) ?? [];
  return [...state.skips.map((rec) => `lens: ${skipLine(rec)}`), ...codexSkips.map((rec) => `codex: ${skipLine(rec)}`)];
}

/** The skips of both reviews that still owe one on the branch at HEAD, each as its line (`doctor`'s `review-skips` row);
 * `null` when it cannot be told. */
export function owedSkipLines(cwd, { spawn = spawnSync, remote = 'origin' } = {}) {
  const state = lensCoverage(cwd, 'HEAD', { spawn, remote });
  return state.unknown ? null : skipLinesOf(cwd, state, spawn);
}

/** The merge door's word on the lens review of the pull request at `head` (odd/tasks/f8-s1-reviews.md, T5; S7: a skip is
 * refused by the merge path until reviewed): `null` when it may land, else `{ pass: false, detail }` for a code commit
 * no complete lens record covers, or for a lens skip that still owes a review. A Codex skip stays the door's to take, as
 * it was: the Codex review's own rules let a skip through when Codex cannot run. It reads the lens records itself, not
 * through the push row: that row passes where the Codex review is off and on a first push, and neither lets a pull
 * request land with its lens debt (L11). Where the Codex review is off it asks for the lenses even with their own switch
 * off, so a code commit never lands unreviewed (his answer to question 104, odd/tasks/f8-s11-complements.md, L14). */
export function lensDoor(cwd, head, { spawn = spawnSync, remote = 'origin' } = {}) {
  const state = lensCoverage(cwd, head, { spawn, remote, whereCodexOff: true });
  if (state.unknown) return { pass: false, detail: `lens review: ${state.unknown}`, next: state.next };
  // `review` names the review that pays the refusal, by its base, so the merge door can bind it to the head it judges for.
  // A correction a lens review owes comes first: its recheck, run from that review's head, also covers what is past it.
  const owed = correctionRefusal(cwd, state, spawn);
  if (owed) return { pass: false, detail: `lens review: ${owed.detail}`, next: owed.next, review: owed.review };
  if (state.uncovered.length) {
    const review = { tool: 'lens-review', base: commandBase(state) };
    return { pass: false, detail: `lens review: ${uncoveredDetail(state)}`, next: reviewStep(cwd, { spawn, ...review, tip: state.tip }), review };
  }
  if (!state.skips.length) return null;
  const [skip] = state.skips;
  const review = { tool: 'lens-review', base: skip.base };
  return { pass: false, detail: `it holds a lens review skip, which owes a review before it lands: ${skipLine(skip)}`, next: reviewStep(cwd, { spawn, ...review, tip: state.tip }), review };
}

/** What a range with code commits no complete lens record covers is said to hold, from `lensCoverage`'s `state`. */
const uncoveredDetail = ({ uncovered, codeCommits, base, note }) => `${uncovered.length} of ${plural(codeCommits.length, 'code commit')} since ${base} have no complete Claude lens record${note}`;

/** The lines that name the `uncovered` commits since `base`, those a record covers only from past the tip (`beyond`),
 * and the command that makes their record, from `lensCoverage`'s state. */
const uncoveredLines = (state) => {
  const { base } = state;
  const oldest = state.uncovered[state.uncovered.length - 1];
  return [...uncoveredNames(state), `make the record with: js-harness lens-review --base ${oldest.isRoot ? base : `${oldest.shortId}^`} --lenses <lens,...> --reason "<what it touched and how>"`];
};

/** The lines that name the `uncovered` commits and those a record covers only from past the tip (`beyond`): the
 * refusal's lines, the command that makes the record being its next step. */
const uncoveredNames = ({ uncovered, beyond, tip }) => [...uncovered.map((commit) => `${commit.shortId} ${commit.subject}`), ...beyondLines(uncovered, beyond, tip)];

/** The `review` row every commit's gate shows, informing and failing nothing (odd/tasks/f8-s1-reviews.md, T5): the code
 * commits since the default branch that no lens record covers, and the skips of both reviews that still owe one, so the
 * debt shows before the push that
 * refuses it. With the Codex review off the lenses are the one review, and its debt is still said; the push asks
 * for none (his answer S9 of odd/tasks/on-demand-functions.md, its risk tiers dropped by "revisión siempre"). */
export function checkReviewDebt(cwd, { spawn = spawnSync, remote = 'origin' } = {}) {
  const row = (detail, lines) => ({ name: 'review', pass: true, info: true, detail, ...(lines?.length ? { lines } : {}) });
  try {
    const state = lensCoverage(cwd, 'HEAD', { spawn, remote });
    if (state.unknown) return row(`cannot tell what waits for a review: ${state.unknown}`);
    const { base, codeCommits, uncovered, note } = state;
    const skipLines = skipLinesOf(cwd, state, spawn);
    const owing = skipLines.length ? `; ${plural(skipLines.length, 'skip')} still owe${skipLines.length === 1 ? 's' : ''} a review` : '';
    const owed = correctionRefusal(cwd, state, spawn);
    if (owed) skipLines.unshift(...owed.lines);
    skipLines.push(...openLines(state));
    const correction = owed ? `; ${owed.detail}` : '';
    const off = reviewOffAt(cwd, 'HEAD', spawn) ? '; the Codex review is off here, so the lenses are the one review, and no push is refused for a missing record, only for a correction owed' : '';
    if (uncovered.length) return row(`no Claude lens record for ${uncovered.length} of ${plural(codeCommits.length, 'code commit')} since ${base}${correction}${owing}${off}${note}`, [...uncoveredLines(state), ...skipLines]);
    const said = codeCommits.length ? `every one of ${plural(codeCommits.length, 'code commit')} since ${base} has a Claude lens record` : `no code commits since ${base} that ask for a lens record`;
    return row(`${said}${correction}${owing}${off}${note}`, skipLines);
  } catch (err) {
    return row(`cannot tell what waits for a review: reading the commits or their records failed (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** The `--push` row: refuses a code commit no complete lens record covers, listing each with the command that makes
 * the record; passes with a line for each skip that covers one. A project with its review switched off asks for none. */
export function checkLensReviews(cwd, head = 'HEAD', { spawn = spawnSync, remote = 'origin' } = {}) {
  const name = 'lens-review';
  if (reviewOffAt(cwd, head, spawn)) {
    // Off at the tip, nothing uncovered is asked for, but a correction a lens review already owes stays owed until a
    // recheck pays it, as at the door (F3, the lead, L34 of odd/tasks/review-gate.md); `lens-review` records it off.
    const state = lensCoverage(cwd, head, { spawn, remote });
    const owed = state.unknown ? null : correctionRefusal(cwd, state, spawn);
    if (owed) return { name, pass: false, ...owed };
    return { name, pass: true, detail: 'the review is off at the pushed commit, so no lens record is asked for' };
  }
  const state = lensCoverage(cwd, head, { spawn, remote });
  if (state.unknown && remoteHoldsNoBranch(cwd, { spawn, remote })) {
    return { name, pass: true, detail: `${remote} holds no branch yet, so this first push passes with no lens record, as the codex-review row says of its own` };
  }
  if (state.unknown) return { name, pass: false, detail: state.unknown, next: state.next };
  const { base, codeCommits, uncovered, skips, note } = state;
  const owed = correctionRefusal(cwd, state, spawn);
  if (owed) return { name, pass: false, ...owed };
  if (uncovered.length) {
    const review = { tool: 'lens-review', base: commandBase(state) };
    return {
      name,
      pass: false,
      detail: uncoveredDetail(state),
      lines: [...uncoveredNames(state), 'an amend or a rebase after a review leaves its commits uncovered: review the range again'],
      next: reviewStep(cwd, { spawn, ...review, tip: state.tip }),
      review,
    };
  }
  const detail = codeCommits.length ? `${plural(codeCommits.length, 'code commit')} since ${base}, all covered by a Claude lens record${note}` : `no code commits since ${base} that ask for a lens record${note}`;
  const lines = [...skips.map(skipLine), ...openLines(state)];
  return { name, pass: true, detail, ...(lines.length ? { lines } : {}) };
}
