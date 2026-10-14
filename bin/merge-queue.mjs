// `js-harness merge-queue`: the ready pull requests merged into main as one candidate (odd/tasks/merge-queue.md).
//
// The candidate is origin/main with each ready pull request merged into it in order of number, built in a
// worktree of its own under the git directory and removed before the command ends. A pull request is ready
// when nothing of its own keeps it from merging (`pullRequestProblems`), every code commit of it has a Codex
// review record (`checkCodexReviews`), and it merges into the candidate so far with no conflict. For now the
// command only builds and prints the candidate (`--dry-run`): testing it, its GitHub run and the push of main
// come next (T2), and until then it pushes nothing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { checkCodexReviews } from './check.mjs';
import { pullRequestProblems } from './lib/merge-ready.mjs';

export const USAGE = `Usage: js-harness merge-queue --dry-run [--cwd <path>]

Builds the candidate main would be: origin/main with each ready pull request merged into it in order of
number. Ready means open, not a draft, mergeable, based on main, a gentle-ai line in its body, a Codex
review record for every code commit, and no conflict with the candidate so far. It names each pull
request it leaves out and why. --dry-run is the only mode for now: it tests and pushes nothing, and
removes the candidate before it ends.`;

const TIMEOUT_MS = 60_000;

function answer(run, command, args, cwd) {
  let result;
  try {
    result = run(command, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    return { ok: false, out: '', err: err.message };
  }
  return { ok: !result?.error && result?.status === 0, out: String(result?.stdout ?? ''), err: String(result?.stderr ?? result?.error?.message ?? '').trim() };
}

function parseArgs(argv) {
  const args = { dryRun: false, cwd: process.cwd() };
  for (let at = 0; at < argv.length; at += 1) {
    if (argv[at] === '--dry-run') args.dryRun = true;
    else if (argv[at] === '--cwd' && at + 1 < argv.length) args.cwd = argv[(at += 1)];
    else return null;
  }
  return args;
}

export async function mergeQueueMain(argv = process.argv.slice(2), { run = spawnSync, covered = null, stdout = console.log, stderr = console.error } = {}) {
  if (argv.includes('--help') || argv.includes('-h')) {
    stdout(USAGE);
    return 0;
  }
  const args = parseArgs(argv);
  if (args === null || !args.dryRun) {
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
    const problems = pullRequestProblems(pr);
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
    gitIn(place, 'config', 'user.name', 'js-harness merge-queue');
    gitIn(place, 'config', 'user.email', 'merge-queue@js-harness.invalid');
    const merged = [];
    for (const pr of candidates) {
      // `--no-verify`: the repository's pre-merge-commit hook runs the gate on every merge, which the queue
      // runs once on the whole candidate instead (S6); under the hook a merge waited for a turn of the lock
      // and was then refused, and read as a conflict.
      const done = answer(run, 'git', ['merge', '--no-ff', '--no-verify', '--quiet', '-m', `Merge pull request #${pr.number} from ${pr.headRefName}`, pr.headRefOid], place);
      if (done.ok) {
        merged.push(pr);
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
    stdout('Dry run: nothing was tested or pushed, and the candidate was removed.');
    return 0;
  } finally {
    gitIn(cwd, 'worktree', 'remove', '--force', place);
  }
}
