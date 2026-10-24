// Whether a push waits in a worktree: commits a push would take now, on a branch whose pull request is
// open. `js-harness gate` refuses a turn while one does, because a push needs no turn of the lock and a
// merge waits for it: on 2026-10-14 the push of pull request 121 waited about 16 minutes behind a measure
// it did not need (odd/tasks/gate-turn-guards.md, S1).
import { spawnSync } from 'node:child_process';
import { checkCodexReviews } from './codex-review-rows.mjs';

/** The milliseconds git or gh is given for one answer before it is stopped. A gh that hangs on the network or
 * on a credential helper would otherwise hold the gate before any bound of its own applies (Codex,
 * 2026-10-14); stopped, it is an answer that could not be had, which refuses nothing. */
const ANSWER_TIMEOUT_MS = 10_000;

/** `run`, a spawnSync, with every call given `ANSWER_TIMEOUT_MS`. */
const bounded = (run) => (command, args, options) => run(command, args, { ...options, timeout: ANSWER_TIMEOUT_MS });

/** What git or gh answered, trimmed, or `null` when it failed or was stopped at its timeout. */
function answer(run, command, args, cwd) {
  let result;
  try {
    result = bounded(run)(command, args, { cwd, encoding: 'utf8', windowsHide: true });
  } catch {
    return null;
  }
  if (result?.error || result?.status !== 0) return null;
  return String(result.stdout ?? '').trim();
}

/** A command line that pushes or merges: the turn a waiting push is no reason to refuse. The command has to
 * be one the shell runs, at the start of the line or after `&&`, `||`, `;`, `|` or `(`: named in an
 * argument (`echo git push && node --test`) it runs nothing of the kind (Codex, 2026-10-14). */
export function isPushOrMerge(commandLine) {
  return /(?:^|[;&|(\n])\s*(?:git\s+(?:-C\s+(?:"[^"]*"|'[^']*'|\S+)\s+)?(?:push|merge)|gh\s+pr\s+merge)(?:\s|$)/.test(commandLine);
}

/** A path as one word of the command line printed for a person to run. */
const pathWord = (dir) => (/[\s"'&|;<>()]/.test(dir) ? `"${dir}"` : dir);

/** `null`, or the push that waits in the worktree at `cwd`: `{ branch, count, pullRequest, command }`.
 * One waits when all of these hold, asked in this order so that the network is asked last and only then:
 * - `HEAD` is a branch, which has a remote ref (its upstream, or `<remote>/<branch>`): it was pushed once;
 * - the branch holds `count` commits that ref does not, and the ref is one of its ancestors, so the push is a
 *   fast-forward (a branch that came apart from its remote one is refused at the push: Codex, 2026-10-14).
 *   Each commit passed its gate when it was made, since the pre-commit hook runs the gate;
 * - the pre-push check of the Codex records (`checkCodexReviews`) accepts the head, so a push goes now;
 * - `gh` lists an open pull request for the branch.
 * Anything that cannot be told is no wait: a guard must never stop the gates of a machine. `deps.git`,
 * `deps.gh` and `deps.codexReviews` are replaceable. */
export function pushWaiting(cwd, { git = spawnSync, gh = spawnSync, codexReviews = checkCodexReviews } = {}) {
  const ask = (...args) => answer(git, 'git', args, cwd);
  const branch = ask('symbolic-ref', '--quiet', '--short', 'HEAD');
  if (!branch) return null;
  const remote = ask('config', '--get', `branch.${branch}.remote`) || 'origin';
  const merge = ask('config', '--get', `branch.${branch}.merge`);
  const remoteBranch = merge?.startsWith('refs/heads/') ? merge.slice('refs/heads/'.length) : branch;
  const tracked = `refs/remotes/${remote}/${remoteBranch}`;
  if (!ask('rev-parse', '--verify', '--quiet', tracked)) return null;
  const count = Number(ask('rev-list', '--count', `${tracked}..HEAD`));
  if (!(count > 0)) return null;
  if (ask('merge-base', '--is-ancestor', tracked, 'HEAD') === null) return null;
  let accepted;
  try {
    accepted = codexReviews(cwd, 'HEAD', { spawn: bounded(git), remote }).pass === true;
  } catch {
    return null;
  }
  if (!accepted) return null;
  const listed = answer(gh, 'gh', ['pr', 'list', '--head', branch, '--state', 'open', '--limit', '1', '--json', 'number,url'], cwd);
  let open;
  try {
    open = JSON.parse(listed ?? '')[0];
  } catch {
    return null;
  }
  if (!Number.isInteger(open?.number)) return null;
  const target = remoteBranch === branch ? branch : `${branch}:${remoteBranch}`;
  return { branch, count, pullRequest: open.number, command: `git -C ${pathWord(cwd)} push ${remote} ${target}` };
}
