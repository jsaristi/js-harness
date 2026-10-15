// `js-harness merge-queue`: the ready pull requests merged into main as one candidate (odd/tasks/merge-queue.md).
//
// The candidate is origin/main with each ready pull request merged into it in order of number, built in a
// worktree of its own under the git directory and removed before the command ends. A pull request is ready
// when nothing of its own keeps it from merging (`pullRequestProblems`), every code commit of it has a Codex
// review record (`checkCodexReviews`), and it merges into the candidate so far with no conflict. `--dry-run`
// builds and prints the candidate; `--land` tests it and moves main to it (`landCandidate`).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { checkCodexReviews } from './check.mjs';
import { pullRequestProblems } from './lib/pull-request.mjs';

export const USAGE = `Usage: js-harness merge-queue --dry-run | --land [--cwd <path>]

Builds the candidate main would be: origin/main with each ready pull request merged into it in order of
number. Ready means open, not a draft, mergeable, based on main, a gentle-ai line in its body, a Codex
review record for every code commit, and no conflict with the candidate so far. A pull request GitHub
has not yet computed (mergeable UNKNOWN) is decided by its merge into the candidate. It names each pull
request it leaves out and why.

--dry-run builds and prints the candidate, tests and pushes nothing, and removes it before it ends.
--land tests the candidate: the whole suite on this machine under the gate lock, then CircleCI's run
of a queue/* branch pushed for it and removed after. When both are green, main is pushed as the
candidate, by fast-forward from the main it was built from. A candidate red on this machine is
bisected: the pull request that turns it red is left out and named, and the rest is landed. The
pre-push hook refuses every other push of main. Exit 0 landed or nothing to land, 4 red, 3 main
moved meanwhile (nothing pushed), 1 anything else.
A landed pull request whose branch moved during the land is named after the landing: its new commits
are not in main, so it needs another run of the queue.`;

const TIMEOUT_MS = 60_000;

function answer(run, command, args, cwd, timeout = TIMEOUT_MS, env = null) {
  let result;
  try {
    result = run(command, args, { cwd, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024, ...(env ? { env: { ...process.env, ...env } } : {}) });
  } catch (err) {
    return { ok: false, out: '', err: err.message };
  }
  return { ok: !result?.error && result?.status === 0, out: String(result?.stdout ?? ''), err: String(result?.stderr ?? result?.error?.message ?? '').trim() };
}

function parseArgs(argv) {
  const args = { dryRun: false, land: false, cwd: process.cwd() };
  for (let at = 0; at < argv.length; at += 1) {
    if (argv[at] === '--dry-run') args.dryRun = true;
    else if (argv[at] === '--land') args.land = true;
    else if (argv[at] === '--cwd' && at + 1 < argv.length) args.cwd = argv[(at += 1)];
    else return null;
  }
  // One mode, named: a run that pushes main is never what a bare command does.
  return args.dryRun === args.land ? null : args;
}

/** How long the queue waits for CircleCI's result on a candidate, and how often it asks. */
const CI_WAIT_MS = 30 * 60_000;
const CI_POLL_MS = 30_000;
const RED = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale']);

/** CircleCI's result on the commit `sha`, from GitHub: its check runs (the CircleCI GitHub app) and its
 * statuses (`ci/circleci...`, the OAuth integration). `{ state: 'green' | 'red' | 'pending', name, conclusion,
 * url }`; pending while it has posted nothing or something is still running. */
export function circleciState(checkRuns, statuses) {
  const runs = (checkRuns ?? []).filter((one) => /circleci/i.test(one?.app?.slug ?? ''));
  const posted = (statuses ?? []).filter((one) => /^ci\/circleci/i.test(one?.context ?? ''));
  const redRun = runs.find((one) => one.status === 'completed' && RED.has(one.conclusion));
  if (redRun) return { state: 'red', name: redRun.name, conclusion: redRun.conclusion, url: redRun.html_url };
  const redStatus = posted.find((one) => one.state === 'failure' || one.state === 'error');
  if (redStatus) return { state: 'red', name: redStatus.context, conclusion: redStatus.state, url: redStatus.target_url };
  const all = runs.length + posted.length;
  // Every run a success: a skipped or neutral run is no run of the suite, and green is the suite passing (Codex, 2026-10-14).
  const done = runs.every((one) => one.status === 'completed' && one.conclusion === 'success') && posted.every((one) => one.state === 'success');
  return { state: all > 0 && done ? 'green' : 'pending' };
}

/** The gate's own FAIL rows in its `output`. `check` prints its rows as one block, then each failed sensor's
 * output after a blank line (`main` of bin/check.mjs), and that output can hold a FAIL a test printed; so the
 * rows are the first run of lines that begin with a row's status, up to the first blank line. */
export function failedRows(output) {
  const lines = String(output ?? '').split(/\r?\n/);
  const start = lines.findIndex((line) => /^(PASS|FAIL|INFO) {2}/.test(line));
  if (start === -1) return [];
  const rows = [];
  for (const line of lines.slice(start)) {
    if (line.trim() === '') break;
    if (/^FAIL {2}/.test(line)) rows.push(line.trim());
  }
  return rows;
}

/** The whole suite on the candidate at `place`, under the gate lock, by the candidate's own commands. */
function localSuite(run, place) {
  const bin = path.join(place, 'bin', 'js-harness.mjs');
  const done = answer(run, process.execPath, [bin, 'gate', '--wait', '90', '--', process.execPath, path.join(place, 'bin', 'check.mjs')], place, 120 * 60_000);
  const last = failedRows(done.out);
  return { ok: done.ok, said: last.length ? last.join('; ') : 'the gate exited non-zero' };
}

/** `--land`: the candidate at `place`, built on `main`, tested on this machine and then on CircleCI, and main
 * moved to it when both are green (S6, S7). Its CircleCI run is that of a `queue/*` branch pushed for it and
 * removed afterwards, whatever the result. Main moves by fast-forward only, leased on the `main` the candidate
 * was built from: a main that moved in between is left as it is (exit 3). Red anywhere is exit 4. */
async function landCandidate({ run, gitIn, place, main, merged, suite, sleep, stdout, fail }) {
  const candidate = gitIn(place, 'rev-parse', 'HEAD').out.trim();
  if (!candidate) return fail('could not read the candidate.');
  const local = suite(place);
  if (!local.ok && merged.length > 1) {
    // Bisected (S8): the candidate of the first k pull requests is the commit after the k-th merge, so the
    // shortest red prefix names the pull request that turns it red. It leaves, the ones after it are merged
    // again on the green prefix, and that candidate is landed as any other.
    // A reset that fails leaves another tree in place, and its suite would judge the wrong pull request.
    const resetTo = (commit, what) => {
      const reset = gitIn(place, 'reset', '--quiet', '--hard', commit);
      return reset.ok ? null : fail(`could not reset the candidate to ${what} (${reset.err.split('\n')[0] || 'git gave no reason'}): nothing was pushed.`);
    };
    let [low, high] = [1, merged.length];
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const failed = resetTo(merged[mid - 1].merge, `the merge of PR ${merged[mid - 1].number}`);
      if (failed !== null) return failed;
      if (suite(place).ok) low = mid + 1;
      else high = mid;
    }
    const culprit = merged[low - 1];
    stdout(`PR ${culprit.number} is left out: the candidate turns red on this machine when it is merged (${local.said}).`);
    const failed = low > 1 ? resetTo(merged[low - 2].merge, `the merge of PR ${merged[low - 2].number}`) : resetTo(main, 'main');
    if (failed !== null) return failed;
    const kept = merged.slice(0, low - 1);
    for (const pr of merged.slice(low)) {
      const again = gitIn(place, 'merge', '--no-ff', '--no-verify', '--quiet', '-m', `Merge pull request #${pr.number} from ${pr.headRefName}`, pr.headRefOid);
      if (!again.ok) {
        gitIn(place, 'merge', '--abort');
        stdout(`PR ${pr.number} is left out: it does not merge into the candidate without PR ${culprit.number}.`);
        continue;
      }
      kept.push({ ...pr, merge: gitIn(place, 'rev-parse', 'HEAD').out.trim() });
    }
    if (kept.length === 0) {
      stdout('No pull request is left to land: nothing was pushed.');
      return 4;
    }
    return landCandidate({ run, gitIn, place, main, merged: kept, suite, sleep, stdout, fail });
  }
  if (!local.ok) {
    stdout(`The candidate is red on this machine (${local.said}): nothing was pushed.`);
    return 4;
  }
  stdout(`The candidate ${candidate.slice(0, 7)} is green on this machine.`);
  // `--no-verify`: the branch is the candidate's run on CircleCI, and no hook judges it; main's push is judged.
  const branch = `queue/${new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '')}-${candidate.slice(0, 7)}`;
  if (!gitIn(place, 'push', '--quiet', '--no-verify', 'origin', `${candidate}:refs/heads/${branch}`).ok) return fail(`could not push ${branch}.`);
  let ci = { state: 'pending' };
  try {
    for (let waited = 0; waited <= CI_WAIT_MS; waited += CI_POLL_MS) {
      const read = (what) => {
        try {
          return JSON.parse(answer(run, 'gh', ['api', `repos/{owner}/{repo}/commits/${candidate}/${what}`], place).out);
        } catch {
          return null;
        }
      };
      // A read that fails is asked again at the next turn, never taken for an empty answer (Codex, 2026-10-14).
      const [checks, statuses] = [read('check-runs')?.check_runs, read('status')?.statuses];
      ci = Array.isArray(checks) && Array.isArray(statuses) ? circleciState(checks, statuses) : { state: 'pending' };
      if (ci.state !== 'pending') break;
      await sleep(CI_POLL_MS);
    }
  } finally {
    const removed = gitIn(place, 'push', '--quiet', '--no-verify', 'origin', '--delete', branch);
    // Named, never silent: a queue branch origin keeps runs nothing more, and only a hand removes it.
    if (!removed.ok) stdout(`Could not remove ${branch} from origin (${removed.err.split('\n')[0] || 'git gave no reason'}): remove it by hand.`);
  }
  if (ci.state === 'red') {
    stdout(`The candidate is red on CircleCI (${ci.name}: ${ci.conclusion}, ${ci.url}): main was not pushed.`);
    return 4;
  }
  if (ci.state !== 'green') {
    stdout(`CircleCI gave no result for the candidate in ${CI_WAIT_MS / 60_000} minutes: main was not pushed.`);
    return 4;
  }
  stdout(`The candidate ${candidate.slice(0, 7)} is green on CircleCI.`);
  // The one push of main the pre-push hook lets through: it says it is the queue's (S9).
  const pushed = answer(run, 'git', ['push', '--quiet', `--force-with-lease=refs/heads/main:${main}`, 'origin', `${candidate}:refs/heads/main`], place, TIMEOUT_MS, { JS_HARNESS_MERGE_QUEUE: '1' });
  if (!pushed.ok) {
    const now = gitIn(place, 'ls-remote', 'origin', 'refs/heads/main').out.split('\t')[0];
    // A push that reached origin and lost its answer, as a timeout loses it: main is the candidate, landed.
    if (now === candidate) {
      stdout(`The push of main reported a failure (${pushed.err.split('\n')[0] || 'git gave no reason'}), and origin's main is the candidate all the same.`);
    } else if (now && now !== main) {
      stdout('Main moved while the candidate was tested: nothing was pushed to main; run the queue again.');
      return 3;
    } else {
      return fail(`could not push main: ${pushed.err.split('\n')[0] || 'git gave no reason'}.`);
    }
  }
  stdout(`Landed: main ${main.slice(0, 7)} is now ${candidate.slice(0, 7)}, with ${merged.map((pr) => `PR ${pr.number}`).join(', ')}.`);
  // A head pushed after the candidate merged it is not in main, and GitHub leaves its pull request open: named,
  // so it is landed again. The push of main is not undone for it: the candidate was tested whole (lead, 2026-10-15).
  const refs = gitIn(place, 'ls-remote', 'origin', ...merged.map((pr) => `refs/heads/${pr.headRefName}`));
  if (!refs.ok) {
    stdout(`Could not read the heads of the landed pull requests (${refs.err.split('\n')[0] || 'git gave no reason'}): check none moved during the land.`);
    return 0;
  }
  const heads = new Map(refs.out.split('\n').filter(Boolean).map((line) => line.split('\t').reverse()));
  for (const pr of merged) {
    const head = heads.get(`refs/heads/${pr.headRefName}`);
    if (head && head !== pr.headRefOid) stdout(`PR ${pr.number} moved to ${head.slice(0, 7)} during the land; its new commits are not in main.`);
  }
  return 0;
}

export async function mergeQueueMain(argv = process.argv.slice(2), { run = spawnSync, covered = null, suite = null, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), stdout = console.log, stderr = console.error } = {}) {
  if (argv.includes('--help') || argv.includes('-h')) {
    stdout(USAGE);
    return 0;
  }
  const args = parseArgs(argv);
  if (args === null) {
    stderr(USAGE);
    return 2;
  }
  const cwd = args.cwd;
  const fail = (line) => {
    stderr(`merge-queue: ${line}`);
    return 1;
  };
  const gitIn = (dir, ...gitArgs) => answer(run, 'git', gitArgs, dir);
  const isCovered = covered ?? ((head) => checkCodexReviews(cwd, head));

  if (!gitIn(cwd, 'fetch', '-q', 'origin').ok) return fail('could not fetch origin.');
  const main = gitIn(cwd, 'rev-parse', 'origin/main').out.trim();
  if (!main) return fail('could not read origin/main.');
  let listed;
  try {
    listed = JSON.parse(answer(run, 'gh', ['pr', 'list', '--state', 'open', '--base', 'main', '--limit', '100', '--json', 'number,state,isDraft,mergeable,baseRefName,body,headRefOid,headRefName'], cwd).out);
  } catch {
    listed = null;
  }
  if (!Array.isArray(listed)) return fail('could not list the open pull requests.');

  // In order of number: the oldest pull request first, so that a newer one never jumps a queue it joined later.
  const candidates = [];
  for (const pr of [...listed].sort((a, b) => a.number - b.number)) {
    // UNKNOWN is GitHub not having computed the merge yet, for about a minute after main moves: the merge into
    // the candidate below is the queue's own test of it, so it decides. CONFLICTING is GitHub's answer.
    const problems = pullRequestProblems(pr.mergeable === 'UNKNOWN' ? { ...pr, mergeable: 'MERGEABLE' } : pr);
    if (problems.length) {
      stdout(`PR ${pr.number} is left out: ${problems.join(' ')}`);
      continue;
    }
    const coverage = isCovered(pr.headRefOid);
    if (!coverage?.pass) {
      stdout(`PR ${pr.number} is left out: ${String(coverage?.detail ?? 'its Codex review records could not be read').replace(/\.$/, '')}.`);
      continue;
    }
    candidates.push(pr);
  }
  if (candidates.length === 0) {
    stdout('No pull request is ready to merge: nothing was built.');
    return 0;
  }

  // The candidate is built in a worktree under the git directory, which this command removes before it ends,
  // whatever happens in between: nothing it makes outlives the run.
  const common = gitIn(cwd, 'rev-parse', '--git-common-dir').out.trim();
  if (!common) return fail('could not find the git directory.');
  const place = path.join(path.resolve(cwd, common), 'js-harness', `merge-queue-${process.pid}-${Date.now()}`);
  fs.mkdirSync(path.dirname(place), { recursive: true });
  if (!gitIn(cwd, 'worktree', 'add', '--quiet', '--detach', place, main).ok) return fail('could not make the worktree of the candidate.');
  try {
    // No identity is written: a linked worktree has no configuration of its own, so `git config` here wrote the
    // shared one, and every session's commits were authored "js-harness merge-queue" until it was undone
    // (verifier, 2026-10-14). The merges take the identity the repository already has.
    const merged = [];
    for (const pr of candidates) {
      // `--no-verify`: the repository's pre-merge-commit hook runs the gate on every merge, which the queue
      // runs once on the whole candidate instead (S6); under the hook a merge waited for a turn of the lock
      // and was then refused, and read as a conflict.
      const done = answer(run, 'git', ['merge', '--no-ff', '--no-verify', '--quiet', '-m', `Merge pull request #${pr.number} from ${pr.headRefName}`, pr.headRefOid], place);
      if (done.ok) {
        // The commit after each merge: the candidate of the pull requests up to this one, which bisection tests.
        merged.push({ ...pr, merge: gitIn(place, 'rev-parse', 'HEAD').out.trim() });
        continue;
      }
      const conflicted = gitIn(place, 'diff', '--name-only', '--diff-filter=U').out.split('\n').map((line) => line.trim()).filter(Boolean);
      gitIn(place, 'merge', '--abort');
      if (conflicted.length) stdout(`PR ${pr.number} is left out: it conflicts with the candidate so far in ${conflicted.join(', ')}.`);
      else stdout(`PR ${pr.number} is left out: it does not merge into the candidate so far: ${done.err.split('\n').find((line) => line.trim()) ?? 'git gave no reason'}.`);
    }
    if (merged.length === 0) {
      stdout('No pull request merges into main: nothing was built.');
      return 0;
    }
    const list = merged.map((pr) => `PR ${pr.number} (${pr.headRefName})`).join(', ');
    stdout(`Candidate: main ${main.slice(0, 7)} with ${merged.length} pull request${merged.length === 1 ? '' : 's'} merged in order: ${list}.`);
    if (args.dryRun) {
      stdout('Dry run: nothing was tested or pushed, and the candidate was removed.');
      return 0;
    }
    return await landCandidate({ run, gitIn, place, main, merged, suite: suite ?? ((dir) => localSuite(run, dir)), sleep, stdout, fail });
  } finally {
    gitIn(cwd, 'worktree', 'remove', '--force', place);
  }
}
