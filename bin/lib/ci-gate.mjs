// The gate of one commit on GitHub's machines (odd/tasks/first-version.md, "Gates on CI machines").
//
// This machine runs one gate at a time: two suites at once take twice as long each, so a second line here gains
// nothing (S7). The repository is public, and GitHub runs its workflows for free, 20 jobs at once. So a gate
// whose turn at the machine's lock would wait sends its tests there instead (`ciGateWanted`), and a gate whose
// turn is free runs here, which is faster for one session alone.
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
import { readGateHolder, readGateWaiters } from './gate-lock.mjs';

/** Set to `0`, the gate never goes to CI. */
export const CI_GATE_ENV = 'JS_HARNESS_GATE_CI';

/** The workflow a project holds when its gates may run on GitHub's machines. */
export const CI_WORKFLOW = '.github/workflows/gate.yml';

/** How long a pushed gate waits for its run to appear, and for the run to end, from the push. */
export const CI_START_MS = 3 * 60_000;
export const CI_RUN_MS = 20 * 60_000;
const CI_POLL_MS = 10_000;

/** How many lines of a red run's failed log the gate prints. */
const LOG_LINES = 80;

/** Why this gate's tests go to CI, or null when they run here: the project holds the workflow, nothing switches it
 * off, this is not already a CI machine, and the machine's gate lock is held or has gates waiting for it. Reads
 * the lock and never takes it, so a gate that takes it a moment later is waited for as before. */
export function ciGateWanted({ cwd, home, env = process.env, readHolder = readGateHolder, readWaiters = readGateWaiters }) {
  if (env[CI_GATE_ENV] === '0' || onCiMachine(env)) return null;
  if (!fs.existsSync(path.join(cwd, CI_WORKFLOW))) return null;
  let holder;
  let waiters;
  try {
    holder = readHolder(home);
    waiters = readWaiters(home);
  } catch {
    return null;
  }
  if (holder) return `the machine's gate lock is held by another gate (pid ${holder.pid ?? 'unknown'})`;
  if (waiters.length > 0) return `${waiters.length} ${waiters.length === 1 ? 'gate waits' : 'gates wait'} for the machine's gate lock`;
  return null;
}

/** Whether `env` is a CI machine's, read as `onCi` of ../check.mjs reads it: a `CI` of `false` or `0` says it is not. */
function onCiMachine(env) {
  const value = env.CI?.trim().toLowerCase();
  return Boolean(value) && value !== 'false' && value !== '0';
}

const spawner = (command, env) => (args) => {
  const run = spawnSync(command, args, { encoding: 'utf8', env, windowsHide: true, timeout: 60_000, maxBuffer: 64 * 1024 * 1024 });
  return { status: run.error ? null : run.status, stdout: String(run.stdout ?? ''), stderr: String(run.stderr ?? run.error?.message ?? '').trim() };
};

const firstLine = (text) => String(text).trim().split(/\r?\n/)[0] ?? '';

/** Runs the gate of the commit being made on GitHub's machines and says how it ended: `{ ran: true, pass, url,
 * seconds, output }`, `output` the end of a red run's failed log, or `{ ran: false, why }`. `gh`, `now`, `sleep`
 * and `onGit` (told the arguments of each git call) are injectable. */
export async function runCiGate({ cwd, remote = 'origin', env = process.env, gh, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), onGit = () => {} }) {
  const runGit = spawner('git', env);
  const runGh = gh ?? spawner('gh', env);
  const git = (...args) => {
    onGit(args);
    return runGit(['-C', cwd, ...args]);
  };
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
    return await followRun({ sha, gh: runGh, now, sleep, startedAt });
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
  try {
    let run;
    for (;;) {
      [run] = json(['run', 'list', '--commit', sha, '--workflow', path.basename(CI_WORKFLOW), '--json', 'databaseId,status,conclusion,url', '--limit', '1']);
      if (run) break;
      if (now() - startedAt >= CI_START_MS) return { ran: false, why: `no run of ${CI_WORKFLOW} started within ${CI_START_MS / 60_000} minutes` };
      await sleep(CI_POLL_MS);
    }
    const id = String(run.databaseId);
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
    if (run.conclusion === 'failure' || run.conclusion === 'timed_out') {
      const log = gh(['run', 'view', id, '--log-failed']);
      return { ran: true, pass: false, url: run.url, seconds, output: log.stdout.trimEnd().split(/\r?\n/).slice(-LOG_LINES).join('\n') };
    }
    return { ran: false, why: `its run (${run.url}) ended ${run.conclusion || 'with no conclusion'}` };
  } catch (err) {
    return { ran: false, why: err instanceof Error ? err.message : String(err) };
  }
}
