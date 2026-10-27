// The Claude lens rows of `js-harness check` (odd/tasks/f8-s1-reviews.md, T4 and T5; diet section 10, "S1, the Claude
// lens runner", items 7 to 9): the `--push` row, which refuses a code commit no complete lens record covers, as the
// `codex-review` row refuses one no Codex record covers, so a slice pushes only with both reviews.
//
// What a code commit is and which records cover it is the one definition both reviews share (`reviewCoverage`, with
// the lens records read in place of Codex's). A record covers its own head commit, so an amend or a rebase leaves the
// range uncovered, and only while its range still hashes to its subject hash. A skip (`--unavailable`) covers, and
// is listed on every row that reads it until a review covers the same commits.
import { spawnSync } from 'node:child_process';
import { defaultBranch, gitOut, MARKS_UNREAD, NOT_A_REVIEW, notReviews, reviewCoverage } from './codex-review-coverage.mjs';
import { commitTree, functionsOf, gitIn, harnessOfCommit } from './project-functions.mjs';
import { isValidLensReview, readLensReviews } from './lens-reviews.mjs';

// Code commits committed before this moment need no lens record: the gate landed after it, and a branch begun before
// it was reviewed as the rules of its day asked, as the merge door's gentle-ai cut-over did (`./gentle-ai-evidence.mjs`).
export const LENS_CUTOVER = '2026-10-27T18:00:00Z';

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** What the lens records say of the code commits between the default branch of `remote` and `head`: `{ unknown }`
 * when it cannot be told, else `{ base, codeCommits, uncovered, skips, note }`, the code commits being those committed
 * from `cutover` on. */
export function lensCoverage(cwd, head, { spawn = spawnSync, remote = 'origin', cutover = LENS_CUTOVER } = {}) {
  const tip = gitOut(spawn, cwd, ['rev-parse', '--verify', '--quiet', `${head}^{commit}`]);
  if (!tip) return { unknown: `cannot resolve ${head} to a commit` };
  const branch = defaultBranch(spawn, cwd, remote);
  if (!branch) return { unknown: `no default branch of ${remote} to compare against` };
  const coverage = reviewCoverage(cwd, { from: branch.ref, tip, spawn, read: readLensReviews, isValid: isValidLensReview });
  if (coverage.unknown === MARKS_UNREAD) return { unknown: 'cannot read which files a review leaves out (`git check-attr --source` needs git 2.40 or later)' };
  if (coverage.unknown) return { unknown: `cannot list the commits in ${branch.label}..${head}` };
  const dates = gitOut(spawn, cwd, ['log', '--format=%H%x09%cI', `${branch.ref}..${tip}`]);
  if (dates === null) return { unknown: `cannot read when the commits in ${branch.label}..${head} were committed` };
  const committed = new Map(dates.split('\n').filter(Boolean).map((line) => line.split('\t')));
  const since = Date.parse(cutover);
  const due = (commit) => Date.parse(committed.get(commit.id) ?? '') >= since;
  const codeCommits = coverage.codeCommits.filter(due);
  const uncovered = coverage.uncovered.filter(due);
  const skips = notReviews({ covers: coverage.covers, codeCommits }).filter((rec) => rec.outcome === 'unavailable');
  const noteParts = [
    coverage.stale ? `${plural(coverage.stale, 'record')} whose range no longer hashes as reviewed` : '',
    coverage.invalid ? `${plural(coverage.invalid, 'record')} that are no evidence (an incomplete run among them)` : '',
  ].filter(Boolean);
  return { base: branch.label, codeCommits, uncovered, skips, note: noteParts.length ? `; ${noteParts.join('; ')} ignored` : '' };
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

/** The `--push` row: refuses a code commit no complete lens record covers, listing each with the command that makes
 * the record; passes with a line for each skip that covers one. A project with its review switched off asks for none. */
export function checkLensReviews(cwd, head = 'HEAD', { spawn = spawnSync, remote = 'origin', cutover = LENS_CUTOVER } = {}) {
  const name = 'lens-review';
  if (reviewOffAt(cwd, head, spawn)) return { name, pass: true, detail: 'the review is off at the pushed commit, so no lens record is asked for' };
  const state = lensCoverage(cwd, head, { spawn, remote, cutover });
  if (state.unknown) return { name, pass: false, detail: state.unknown };
  const { base, codeCommits, uncovered, skips, note } = state;
  if (uncovered.length) {
    const oldest = uncovered[uncovered.length - 1];
    return {
      name,
      pass: false,
      detail: `${uncovered.length} of ${plural(codeCommits.length, 'code commit')} since ${base} have no complete Claude lens record${note}`,
      lines: [
        ...uncovered.map((commit) => `${commit.shortId} ${commit.subject}`),
        `make the record with: js-harness lens-review --base ${oldest.isRoot ? base : `${oldest.shortId}^`} --lenses <lens,...> --reason "<what it touched and how>"`,
        'an amend or a rebase after a review leaves its commits uncovered: review the range again',
      ],
    };
  }
  const detail = codeCommits.length ? `${plural(codeCommits.length, 'code commit')} since ${base}, all covered by a Claude lens record${note}` : `no code commits since ${base} that ask for a lens record${note}`;
  return { name, pass: true, detail, ...(skips.length ? { lines: skips.map(skipLine) } : {}) };
}
