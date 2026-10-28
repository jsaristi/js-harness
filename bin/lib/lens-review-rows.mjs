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
import { defaultBranch, gitOut, MARKS_UNREAD, NOT_A_REVIEW, notReviews, remoteHoldsNoBranch, reviewCoverage } from './codex-review-coverage.mjs';
import { commitTree, functionsOf, gitIn, harnessOfCommit } from './project-functions.mjs';
import { admittedLensReviews } from './lens-reviews.mjs';

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Whether the lens review is on at the commit `id`, read from that commit's own `harness.json` (`lensReview`), so a
 * commit is asked by the switch it was made under: a branch made before a project turned the review on is never asked
 * wherever it lands, nor is a project that never turns it on (odd/tasks/f8-s1-reviews.md, L9). A time cut-over did
 * neither: it asked the commits of every session that had no `lens-review` yet. The files are not listed, since the
 * switch's `auto` does not read them. */
const lensOnAt = (git, id) => functionsOf(harnessOfCommit(git, id), { paths: [] }).resolved.lensReview.value === 'on';

/** What the lens records say of the code commits between the default branch of `remote` and `head`: `{ unknown }`
 * when it cannot be told, else `{ base, codeCommits, uncovered, skips, note }`, the code commits being those whose own
 * tree turns the lens review on (`lensOnAt`). */
export function lensCoverage(cwd, head, { spawn = spawnSync, remote = 'origin' } = {}) {
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!tip) return { unknown: `cannot resolve ${head} to a commit` };
  const branch = defaultBranch(spawn, cwd, remote);
  if (!branch) return { unknown: `no default branch of ${remote} to compare against` };
  // A record counts only where the run line lens-review wrote first names it (lens-reviews.mjs, provenance).
  const lens = admittedLensReviews(cwd, { spawn });
  const coverage = reviewCoverage(cwd, { from: branch.ref, tip, spawn, read: () => lens.records, isValid: lens.admitted });
  if (coverage.unknown === MARKS_UNREAD) return { unknown: 'cannot read which files a review leaves out (`git check-attr --source` needs git 2.40 or later)' };
  if (coverage.unknown) return { unknown: `cannot list the commits in ${branch.label}..${head}` };
  const git = gitIn(cwd, spawn);
  const asked = new Map(coverage.codeCommits.map((commit) => [commit.id, lensOnAt(git, commit.id)]));
  const due = (commit) => asked.get(commit.id) === true;
  const codeCommits = coverage.codeCommits.filter(due);
  const uncovered = coverage.uncovered.filter(due);
  const noteParts = [
    coverage.stale ? `${plural(coverage.stale, 'record')} whose range no longer hashes as reviewed` : '',
    coverage.invalid ? `${plural(coverage.invalid, 'record')} that are no evidence (an incomplete run, or a record no run line of lens-review names, among them)` : '',
  ].filter(Boolean);
  return { tip, baseRef: branch.ref, base: branch.label, codeCommits, uncovered, skips: owedSkips(coverage, codeCommits), note: noteParts.length ? `; ${noteParts.join('; ')} ignored` : '' };
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

/** Whether the review is switched off at the commit `head`, read from that commit's own files as the Codex rows read it
 * (`codexReviewOffAt`); one that cannot be read is on. */
function reviewOffAt(cwd, head, spawn) {
  const git = gitIn(cwd, spawn);
  const tip = git(['rev-parse', '--verify', '--quiet', `${head}^{commit}`])?.trim();
  return tip ? functionsOf(harnessOfCommit(git, tip), commitTree(git, tip)).resolved.codexReview.value === 'off' : false;
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
 * request land with its lens debt (L11). */
export function lensDoor(cwd, head, { spawn = spawnSync, remote = 'origin' } = {}) {
  const state = lensCoverage(cwd, head, { spawn, remote });
  if (state.unknown) return { pass: false, detail: `lens review: ${state.unknown}` };
  if (state.uncovered.length) return { pass: false, detail: `lens review: ${uncoveredDetail(state)}` };
  return state.skips.length ? { pass: false, detail: `it holds a lens review skip, which owes a review before it lands: ${skipLine(state.skips[0])}` } : null;
}

/** What a range with code commits no complete lens record covers is said to hold, from `lensCoverage`'s `state`. */
const uncoveredDetail = ({ uncovered, codeCommits, base, note }) => `${uncovered.length} of ${plural(codeCommits.length, 'code commit')} since ${base} have no complete Claude lens record${note}`;

/** The lines that name the `uncovered` commits since `base` and the command that makes their record. */
const uncoveredLines = (uncovered, base) => {
  const oldest = uncovered[uncovered.length - 1];
  return [
    ...uncovered.map((commit) => `${commit.shortId} ${commit.subject}`),
    `make the record with: js-harness lens-review --base ${oldest.isRoot ? base : `${oldest.shortId}^`} --lenses <lens,...> --reason "<what it touched and how>"`,
  ];
};

/** The `review` row every commit's gate shows, informing and failing nothing (odd/tasks/f8-s1-reviews.md, T5; it
 * replaced the row that asked gentle-ai whether a review was due): the code commits since the default branch that
 * no lens record covers, and the skips of both reviews that still owe one, so the debt shows before the push that
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
    const off = reviewOffAt(cwd, 'HEAD', spawn) ? '; the Codex review is off here, so the lenses are the one review, and no push is refused for it' : '';
    if (uncovered.length) return row(`no Claude lens record for ${uncovered.length} of ${plural(codeCommits.length, 'code commit')} since ${base}${owing}${off}${note}`, [...uncoveredLines(uncovered, base), ...skipLines]);
    const said = codeCommits.length ? `every one of ${plural(codeCommits.length, 'code commit')} since ${base} has a Claude lens record` : `no code commits since ${base} that ask for a lens record`;
    return row(`${said}${owing}${off}${note}`, skipLines);
  } catch (err) {
    return row(`cannot tell what waits for a review: reading the commits or their records failed (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** The `--push` row: refuses a code commit no complete lens record covers, listing each with the command that makes
 * the record; passes with a line for each skip that covers one. A project with its review switched off asks for none. */
export function checkLensReviews(cwd, head = 'HEAD', { spawn = spawnSync, remote = 'origin' } = {}) {
  const name = 'lens-review';
  if (reviewOffAt(cwd, head, spawn)) return { name, pass: true, detail: 'the review is off at the pushed commit, so no lens record is asked for' };
  const state = lensCoverage(cwd, head, { spawn, remote });
  if (state.unknown && remoteHoldsNoBranch(cwd, { spawn, remote })) {
    return { name, pass: true, detail: `${remote} holds no branch yet, so this first push passes with no lens record, as the codex-review row says of its own` };
  }
  if (state.unknown) return { name, pass: false, detail: state.unknown };
  const { base, codeCommits, uncovered, skips, note } = state;
  if (uncovered.length) {
    return {
      name,
      pass: false,
      detail: uncoveredDetail(state),
      lines: [...uncoveredLines(uncovered, base), 'an amend or a rebase after a review leaves its commits uncovered: review the range again'],
    };
  }
  const detail = codeCommits.length ? `${plural(codeCommits.length, 'code commit')} since ${base}, all covered by a Claude lens record${note}` : `no code commits since ${base} that ask for a lens record${note}`;
  return { name, pass: true, detail, ...(skips.length ? { lines: skips.map(skipLine) } : {}) };
}
