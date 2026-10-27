// The scripts a task may carry beside its fixture (`setup/setup.mjs`, a proof's `setup/reference.mjs`), and the file
// a `reply` task's grader reads. Apart from runner.mjs, which the gate holds under its size limit.
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** Where a `reply` task's grader finds the agent's final answer, in the workspace. */
export const REPLY_FILE = '.eval-reply.md';
const SCRIPT_TIMEOUT_MS = 60 * 1000;

/** `env` without a single `GIT_*` variable, in any case. A script runs git in its workspace, and a caller inside a git
 * hook (the pre-commit gate runs the task proofs) exports `GIT_DIR` and `GIT_INDEX_FILE` of the real repository,
 * which a `git init` or `git add` there would then write to. */
export const withoutGit = (env) => Object.fromEntries(Object.entries(env).filter(([key]) => !/^git_/i.test(key)));

/** Runs the task script `script` (`task.setup`, or a proof's reference script) with this process's `node`, in
 * `workspace`, under `env`; throws, naming the task, the script and what it printed on stderr, when it does not exit 0.
 * Synchronous: a setup is a few git commands, and a trial that cannot be set up must not start its agent. */
export function runTaskScript(task, script, workspace, env) {
  const result = spawnSync(process.execPath, [path.resolve(script)], { cwd: workspace, env: withoutGit(env), encoding: 'utf8', timeout: SCRIPT_TIMEOUT_MS, windowsHide: true });
  const name = path.relative(path.dirname(task.fixtureDir), script).split(path.sep).join('/');
  if (result.error) throw new Error(`task ${task.id}: ${name} could not run: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`task ${task.id}: ${name} failed (exit ${result.status ?? result.signal}): ${`${result.stderr}`.trim() || `${result.stdout}`.trim()}`);
}
