// The gate of one commit on GitHub's machines (odd/tasks/first-version.md, "Gates on CI machines").
//
// This machine runs one gate at a time: two suites at once take twice as long each, so a second line here gains
// nothing (S7). The repository is public, and GitHub runs its workflows for free, 20 jobs at once. A gate there
// took a median of 144 s from the push, against 218 s here with a free lock, and runs the whole suite, so every
// commit's gate sends its tests there first (`ciGateWanted`; odd/tasks/commit-gates-first.md, item C), and the
// machine's lock is left to what only runs here.
//
// The proof stays the commit's own (AGENTS.md): `runCiGate` writes the tree being committed, the index and not
// the working tree, as a commit object on HEAD, pushes it to `gate/<sha>`, waits for the run of
// `.github/workflows/gate.yml` on that exact commit, and deletes the branch. The caller lets the commit through
// on green only. Anything that is not a green or a red run (no push, no `gh`, no run, a run cancelled or past
// its bound) is no answer, `{ ran: false, why }`, and the caller runs the gate here as it always did: CI only
// ever shortens a wait, it never makes a gate impossible.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ruleValue } from './rules.mjs';

/** Set to `0`, the gate never goes to CI. */
export const CI_GATE_ENV = 'JS_HARNESS_GATE_CI';

/** The workflow a project holds when its gates may run on GitHub's machines. */
export const CI_WORKFLOW = '.github/workflows/gate.yml';

/** How long a pushed gate waits for its run to appear, and for the run to end (the rule ci-gate-bound), from the
 * push. */
export const CI_START_MS = 3 * 60_000;
export const CI_RUN_MS = ruleValue('ci-gate-bound', 'minutes') * 60_000;
const CI_POLL_MS = 10_000;

/** How many lines of a red run's failed log the gate prints. */
const LOG_LINES = 80;

// The job, the step and the time gh's `--log-failed` puts before each line of a run's log.
const GH_LOG_PREFIX = /^[^\t\r\n]*\t[^\t\r\n]*\t\S+ ?/;

/** The `LOG_LINES` of a red run's log the gate prints, each without gh's prefix: from the test runner's list of
 * the failing tests when it has one, which the gate log reads their names from and the end alone can cut, and
 * otherwise the end. Lines a window from the list leaves out at the end are said, with where to read them. */
function failedLog(stdout, id) {
  const lines = String(stdout ?? '').trimEnd().split(/\r?\n/).map((line) => line.replace(GH_LOG_PREFIX, ''));
  const list = lines.findIndex((line) => line.trim() === '✖ failing tests:');
  const from = list === -1 ? Math.max(0, lines.length - LOG_LINES) : Math.min(list, Math.max(0, lines.length - LOG_LINES));
  const left = lines.length - (from + LOG_LINES);
  return [...lines.slice(from, from + LOG_LINES), ...(left > 0 ? [`… ${left} more lines: gh run view ${id} --log-failed`] : [])].join('\n');
}

/** Why this gate's tests go to CI, or null when they run here: it is the gate of a commit (or a merge) being made,
 * the project holds the workflow, nothing switches it off, and this is not already a CI machine. The machine's
 * lock is not read: a free one no longer keeps a gate here. A check by hand stays here: CI tests the index
 * (`git write-tree`), and a check by hand tests the working tree, unstaged edits included. A commit's hook is told
 * by `GIT_INDEX_FILE`, which git hands every hook that commits and a check by hand is not given, as
 * ../check.mjs tells it. */
export function ciGateWanted({ cwd, env = process.env }) {
  if (env[CI_GATE_ENV] === '0' || onCiMachine(env)) return null;
  if (!Object.keys(env).some((key) => key.toUpperCase() === 'GIT_INDEX_FILE')) return null;
  if (!fs.existsSync(path.join(cwd, CI_WORKFLOW))) return null;
  return `the project holds ${CI_WORKFLOW}, so a commit's tests go to GitHub's machines first`;
}

/** Whether `env` is a CI machine's, read as `onCi` of ../check.mjs reads it: a `CI` of `false` or `0` says it is not. */
export function onCiMachine(env) {
  const value = env.CI?.trim().toLowerCase();
  return Boolean(value) && value !== 'false' && value !== '0';
}

const spawner = (command, env) => (args, { cwd } = {}) => {
  const run = spawnSync(command, args, { cwd, encoding: 'utf8', env, windowsHide: true, timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
  return { status: run.error ? null : run.status, stdout: String(run.stdout ?? ''), stderr: String(run.stderr ?? run.error?.message ?? '').trim() };
};

const firstLine = (text) => String(text).trim().split(/\r?\n/)[0] ?? '';

/** The environment git runs in during a gate: `env` with every credential prompt off, so a push that would ask for a
 * password, in the terminal or in Git Credential Manager's window, fails at once and the gate runs here. Now that
 * every commit's gate pushes, a prompt would hold every commit. */
export function pushEnv(env) {
  return { ...env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
}

/** The `owner/name` of a GitHub repository from a remote's URL, in the forms git takes (https, ssh, scp-style), or
 * null for a URL that is not GitHub's. */
export function githubRepository(url) {
  const match = /^(?:https?:\/\/(?:[^@/]+@)?github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(String(url).trim());
  return match ? `${match[1]}/${match[2]}` : null;
}

/** Runs the gate of the commit being made on GitHub's machines and says how it ended: `{ ran: true, pass, url,
 * seconds, output }`, `output` the end of a red run's failed log, or `{ ran: false, why }`. `gh`, `now`, `sleep`
 * and `onGit` (told the arguments of each git call) are injectable. */
export async function runCiGate({ cwd, remote = 'origin', env = process.env, gh, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), onGit = () => {} }) {
  const runGit = spawner('git', pushEnv(env));
  const git = (...args) => {
    onGit(args);
    return runGit(['-C', cwd, ...args]);
  };
  // The repository the push goes to, as the remote is written (its push URL first), before git rewrites it: `gh`
  // is asked about that repository and no other, whatever folder `check` was started from.
  const url = git('config', '--get', `remote.${remote}.pushurl`).stdout.trim() || git('config', '--get', `remote.${remote}.url`).stdout.trim();
  const repository = githubRepository(url);
  if (!repository) return { ran: false, why: `${remote} is not a GitHub repository (${url || 'no URL'})` };
  const runGh = gh ?? spawner('gh', env);
  const ghIn = ([verb, sub, ...rest]) => runGh([verb, sub, '--repo', repository, ...rest], { cwd });
  // Asked before anything is written or pushed: a `gh` missing, signed out or barred from the repository would
  // otherwise leave a run going that no one reads, after a push every commit pays.
  const probe = ghIn(['run', 'list', '--workflow', path.basename(CI_WORKFLOW), '--json', 'databaseId', '--limit', '1']);
  if (probe.status !== 0) return { ran: false, why: `gh cannot read the runs of ${repository}, so nothing was pushed: ${firstLine(probe.stderr)}` };
  const tree = git('write-tree');
  if (tree.status !== 0) return { ran: false, why: `git write-tree failed: ${firstLine(tree.stderr)}` };
  const head = git('rev-parse', '--verify', '--quiet', 'HEAD');
  const parent = head.status === 0 ? ['-p', head.stdout.trim()] : [];
  const made = git('commit-tree', tree.stdout.trim(), ...parent, '-m', 'gate: the tree of a commit being made');
  if (made.status !== 0) return { ran: false, why: `git commit-tree failed: ${firstLine(made.stderr)}` };
  const sha = made.stdout.trim();
  const ref = `refs/heads/gate/${sha}`;
  // `--no-verify`: the pre-push hook asks a Codex record of every code commit pushed, which a commit not made yet
  // cannot have. This branch is never merged; it is deleted below, whatever happened.
  const pushed = git('push', '--quiet', '--no-verify', remote, `${sha}:${ref}`);
  if (pushed.status !== 0) return { ran: false, why: `git push to ${remote} failed: ${firstLine(pushed.stderr)}` };
  const startedAt = now();
  try {
    return await followRun({ sha, gh: ghIn, now, sleep, startedAt });
  } finally {
    git('push', '--quiet', '--no-verify', remote, '--delete', ref);
  }
}

/** Finds the run of the gate workflow on `sha` and waits for it to end. */
async function followRun({ sha, gh, now, sleep, startedAt }) {
  const json = (args) => {
    const answer = gh(args);
    if (answer.status !== 0) throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${firstLine(answer.stderr)}`);
    return JSON.parse(answer.stdout);
  };
  // The id of the run once it is found: a run left going when `gh` fails after it is cancelled.
  let id = null;
  try {
    let run;
    for (;;) {
      [run] = json(['run', 'list', '--commit', sha, '--workflow', path.basename(CI_WORKFLOW), '--json', 'databaseId,status,conclusion,url', '--limit', '1']);
      if (run) break;
      if (now() - startedAt >= CI_START_MS) return { ran: false, why: `no run of ${CI_WORKFLOW} started within ${CI_START_MS / 60_000} minutes` };
      await sleep(CI_POLL_MS);
    }
    id = String(run.databaseId);
    for (;;) {
      if (run.status === 'completed') break;
      if (now() - startedAt >= CI_RUN_MS) {
        gh(['run', 'cancel', id]);
        return { ran: false, why: `its run (${run.url}) was not done after ${CI_RUN_MS / 60_000} minutes, and was cancelled` };
      }
      await sleep(CI_POLL_MS);
      run = { ...run, ...json(['run', 'view', id, '--json', 'status,conclusion,url']) };
    }
    const seconds = Math.round((now() - startedAt) / 1000);
    if (run.conclusion === 'success') return { ran: true, pass: true, url: run.url, seconds, output: '' };
    // A job past its own timeout (`timed_out`) proves nothing of the tests, so it is no answer, as a run past this
    // gate's bound is.
    if (run.conclusion === 'failure') {
      const log = gh(['run', 'view', id, '--log-failed']);
      return { ran: true, pass: false, url: run.url, seconds, output: failedLog(log.stdout, id) };
    }
    return { ran: false, why: `its run (${run.url}) ended ${run.conclusion || 'with no conclusion'}` };
  } catch (err) {
    if (id !== null) gh(['run', 'cancel', id]);
    return { ran: false, why: err instanceof Error ? err.message : String(err) };
  }
}
