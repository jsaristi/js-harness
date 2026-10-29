// What the pages of the moments read from git (odd/tasks/visual-pages.md): the default branch, its commit at a time,
// a moment's map and plan steps at a commit (with the task counts of the feature documents the steps name), and the
// pull requests merged in a window. Each reader takes the `run` of the command that calls it, so a test answers git
// by its arguments. What git cannot give is `null` or `{ unavailable }` with why, never an empty map.
import { tasksOf } from './contract.mjs';
import { PACE_REF_ARGS, paceRef } from './progress-pace.mjs';
import { mapOf, mergeLogArgs, parseMergeLog } from './report.mjs';
import { planOf } from './report-pages.mjs';

const GIT_TIMEOUT_MS = 30_000;

/** One git process in `cwd`: `{ stdout }`, or `{ error }`, the line that says why not. */
export function gitRead(run, cwd, args) {
  const result = run('git', args, { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) return { error: `git ${args[0]}: ${result.error.code === 'ETIMEDOUT' ? `took longer than ${GIT_TIMEOUT_MS / 1000} s` : result.error.message}` };
  if (result.status !== 0) return { error: `git ${args[0]}: ${String(result.stderr ?? '').trim().split('\n')[0] || `exit ${result.status}`}` };
  return { stdout: String(result.stdout) };
}

/** The default branch, as `report` and `progress --pace` read it: `{ ref, name }`, or `{ error }`. */
export function readRef(run, cwd) {
  const named = gitRead(run, cwd, PACE_REF_ARGS);
  return named.error ? { error: named.error } : paceRef(named.stdout);
}

/** The commit `ref` pointed at, on its first-parent line, at the time `ms`; `null` when git has none. */
export function headBefore(run, cwd, ref, ms) {
  const read = gitRead(run, cwd, ['rev-list', '--first-parent', '-1', `--before=${new Date(ms).toISOString()}`, ref, '--']);
  return read.error ? null : read.stdout.trim() || null;
}

/** `{ done, total }` of a feature document's tasks. */
function countsOf(markdown) {
  const tasks = tasksOf(markdown);
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

/** The moment at `commit`: `{ commit, map, plans, tasks }`, `map` the roadmap's phases (`mapOf`), `plans` its plan
 * steps (`planOf`) with each name the step quotes that is a feature document at that commit (`odd/tasks/<name>.md`)
 * added to its documents, and `tasks` the counts of every document a step names, by path. `{ commit, unavailable }`
 * when the commit holds no roadmap git can show. */
export function momentAt(run, cwd, commit) {
  const roadmap = gitRead(run, cwd, ['show', `${commit}:docs/ROADMAP.md`]);
  if (roadmap.error) return { commit, unavailable: roadmap.error };
  const listed = gitRead(run, cwd, ['ls-tree', '--name-only', commit, '--', 'odd/tasks/']);
  const present = new Set(listed.error ? [] : listed.stdout.split('\n').map((line) => line.trim()).filter(Boolean));
  const plans = planOf(roadmap.stdout).map((plan) => ({
    ...plan,
    steps: plan.steps.map((step) => {
      const found = step.names.map((name) => `odd/tasks/${name}.md`).filter((path) => present.has(path));
      return { ...step, documents: [...new Set([...step.documents, ...found])] };
    }),
  }));
  const tasks = {};
  for (const path of new Set(plans.flatMap((plan) => plan.steps.flatMap((step) => step.documents)))) {
    if (!present.has(path)) continue;
    const shown = gitRead(run, cwd, ['show', `${commit}:${path}`]);
    if (!shown.error) tasks[path] = countsOf(shown.stdout);
  }
  return { commit, map: mapOf(roadmap.stdout), plans, tasks };
}

const PULL_REQUEST = /^Merge pull request #(\d+) from (\S+)/;

/** Whether a merge's `branch` is the branch `name`: the same, or `name` after an owner's prefix. */
export const branchMatches = (branch, name) => typeof branch === 'string' && (branch === name || branch.endsWith(`/${name}`));

/** The pull requests merged into `ref` on its first-parent line from `from` to `to` (milliseconds), oldest first:
 * `[{ number, branch, subject, at, firstAt, commits }]`, grouped by number at its last merge, `firstAt` its first,
 * `commits` the hashes every merge brought in order; `branch` as the subject names it (`fix/x`; GitHub's own subject
 * puts its owner first, `owner/fix/x`, which `branchMatches` allows). A merge that names no
 * pull request is an entry of its own, `number` and `branch` null. `{ error }` when git cannot list them. */
export function pullRequestsOf(run, cwd, ref, { from, to }) {
  const log = gitRead(run, cwd, mergeLogArgs({ ref, since: new Date(from).toISOString() }));
  if (log.error) return { error: log.error };
  const entries = [];
  const byNumber = new Map();
  for (const merge of parseMergeLog(log.stdout).reverse()) {
    if (!(merge.at > from && merge.at <= to)) continue;
    const brought = gitRead(run, cwd, ['log', '--no-merges', '--format=%H', `${merge.hash}^1..${merge.hash}^2`, '--']);
    const commits = brought.error ? [] : brought.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    const named = PULL_REQUEST.exec(merge.subject);
    const number = named ? Number(named[1]) : null;
    const at = new Date(merge.at).toISOString();
    const known = number === null ? undefined : byNumber.get(number);
    if (known) {
      known.at = at;
      known.commits.push(...commits.filter((hash) => !known.commits.includes(hash)));
      continue;
    }
    const entry = { number, branch: named ? named[2] : null, subject: merge.subject, at, firstAt: at, commits };
    if (number !== null) byNumber.set(number, entry);
    entries.push(entry);
  }
  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
