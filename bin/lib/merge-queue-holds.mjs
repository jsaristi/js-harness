// The two holds of a land (odd/tasks/merge-queue.md, S11 and S12), out of bin/merge-queue.mjs, which is over the
// size a module may grow to: a pull request waits while a step only he can do is open in its feature document, and a
// reopened pull request's run is trusted only once GitHub's merge ref of it sits on the default branch. Zero
// dependencies; every git and gh call goes through the caller's `ask`, so the tests answer them.

import { HIS_KIND, tasksOf } from './contract.mjs';
import { defaultBranchOf } from './default-branch.mjs';

/** Why the pull request `pr` waits for him, or null: a feature document its diff from `main` touches, read at its head,
 * holds an open task of kind `his`, a step only he can do (odd/tasks/merge-queue.md, S11; docs/FAILURES.md,
 * land-took-pending-pr: a land took PR 596 while his walk through the console was pending). A list of files or a
 * document that cannot be read holds it too, since "could not look" is never "none". */
export function hisStepOpen(gitIn, cwd, main, pr) {
  const unknown = 'so whether a step of his is open cannot be told.';
  const diff = gitIn(cwd, 'diff', '--name-only', '--diff-filter=d', `${main}...${pr.headRefOid}`);
  if (!diff.ok) return `the files it changes could not be read (${diff.err || `git exited ${diff.status}`}), ${unknown}`;
  const documents = diff.out.split(/\r?\n/).filter((file) => /^odd\/tasks\/[^/]+\.md$/.test(file));
  for (const doc of documents) {
    const shown = gitIn(cwd, 'show', `${pr.headRefOid}:${doc}`);
    if (!shown.ok) return `its feature document ${doc} could not be read at its head (${shown.err || `git exited ${shown.status}`}), ${unknown}`;
    const open = tasksOf(shown.out).find((task) => !task.done && task.kind === HIS_KIND);
    if (open) return `${doc} holds ${open.id}, a step of his still open (kind: ${HIS_KIND}): it lands once he has done it and the task is ticked.`;
  }
  return null;
}

/** How long `--reopen` waits for GitHub's merge ref of a reopened pull request to sit on the default branch, and how
 * often it looks. */
export const REOPEN_WAIT_MS = 10 * 60_000;
export const REOPEN_POLL_MS = 15_000;

/** `--reopen <n>`: reopens the pull request, then waits until GitHub's merge ref of it (`refs/pull/<n>/merge`) has
 * origin's default branch as its first parent, since GitHub computes that ref later, and a run started on the old one
 * tested the old base (odd/tasks/merge-queue.md, S12; docs/FAILURES.md, reopen-tested-old-base). Exit 0 once it does,
 * naming the merge commit a run must have tested; 5 past REOPEN_WAIT_MS; 1 when gh refuses the reopen or origin
 * cannot be read. */
export async function reopenRun(args, { ask, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), stdout, stderr }) {
  const { cwd, reopen: number } = args;
  const fail = (line) => {
    stderr(`merge-queue: ${line}`);
    return 1;
  };
  const gitIn = (...gitArgs) => ask('git', gitArgs);
  const defaultRead = defaultBranchOf(ask);
  if (!defaultRead.name) return fail(defaultRead.why);
  const branch = defaultRead.name;
  const reopened = ask('gh', ['pr', 'reopen', String(number)]);
  if (!reopened.ok) return fail(`gh pr reopen ${number} failed (${reopened.err || `gh exited ${reopened.status}`}): nothing was waited for.`);
  const short = (sha) => sha.slice(0, 7);
  const until = now() + REOPEN_WAIT_MS;
  let last = null;
  for (;;) {
    // Each look reads both again: main may move while GitHub computes the ref.
    // An origin that cannot be fetched is said at once with git's words: waiting would only hide it.
    const fetched = gitIn('fetch', '-q', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`);
    if (!fetched.ok) return fail(`git fetch of origin's ${branch} failed (${fetched.err || `git exited ${fetched.status}`}): no run of PR ${number} is to be trusted yet.`);
    const main = gitIn('rev-parse', `origin/${branch}`).out.trim();
    const merge = main && gitIn('fetch', '-q', 'origin', `refs/pull/${number}/merge`).ok ? gitIn('rev-parse', 'FETCH_HEAD').out.trim() : '';
    const parent = merge ? gitIn('rev-parse', `${merge}^1`).out.trim() : '';
    if (parent && parent === main) {
      stdout(`PR ${number}'s merge ref ${short(merge)} has ${branch} ${short(main)} as its first parent: trust a run of PR ${number} only on ${short(merge)}.`);
      return 0;
    }
    if (main && parent) last = { merge, parent, main };
    if (now() >= until) {
      const minutes = Math.round(REOPEN_WAIT_MS / 60_000);
      stdout(last
        ? `PR ${number}'s merge ref ${short(last.merge)} still has ${short(last.parent)} as its first parent, not ${branch} ${short(last.main)}, after ${minutes} minutes: no run of PR ${number} is to be trusted yet.`
        : `PR ${number}'s merge ref or origin's ${branch} could not be read in ${minutes} minutes: no run of PR ${number} is to be trusted yet.`);
      return 5;
    }
    await sleep(REOPEN_POLL_MS);
  }
}
