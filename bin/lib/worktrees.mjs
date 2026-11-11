// The worktrees a repository can lose with nothing lost (odd/tasks/land-unattended.md, T9 and T10): those on a
// branch already in main, clean and idle. Left behind by every landed pull request, they slowed every command that
// lists them: 151 of 184 were such worktrees, and the board took 126 s over them (L22).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** The minutes a worktree's index must have stood still before the worktree is removed: a session that staged
 * something a moment ago may be about to commit there. */
const IDLE_MINUTES = 10;

/** `git worktree list --porcelain` as `{ path, head, branch, locked, lockReason, prunable }` entries, the main worktree
 * first; `branch` is the short name, `null` for a detached head, `lockReason` what the lock says, `''` when it says
 * nothing or there is none. */
function worktreesOf(porcelain) {
  return porcelain.replace(/\r\n/g, '\n').split('\n\n').map((block) => block.split('\n').filter(Boolean)).filter((lines) => lines.length > 0).map((lines) => {
    const value = (key) => lines.find((line) => line === key || line.startsWith(`${key} `))?.slice(key.length + 1) ?? null;
    const branch = value('branch');
    return {
      path: value('worktree'),
      head: value('HEAD'),
      branch: branch === null ? null : branch.replace(/^refs\/heads\//, ''),
      locked: lines.some((line) => line === 'locked' || line.startsWith('locked ')),
      lockReason: value('locked') ?? '',
      prunable: lines.some((line) => line === 'prunable' || line.startsWith('prunable ')),
    };
  });
}

/** Whether `dir` is another app's worktree, which that app manages and removes: under `.claude/worktrees` (the Claude
 * app) or `orca/workspaces` (the Orca app, which leaves no marker of its own in the worktree; T11). */
const appsOwn = (dir) => /(^|\/)(\.claude\/worktrees|orca\/workspaces)\//i.test(`${dir.replace(/\\/g, '/')}/`);

/** Two paths of one folder, as git and a caller may spell them differently on Windows. */
export const sameFolder = (a, b) => {
  const plain = (dir) => path.resolve(dir).replace(/\\/g, '/').replace(/\/$/, '');
  return process.platform === 'win32' ? plain(a).toLowerCase() === plain(b).toLowerCase() : plain(a) === plain(b);
};

/** The files claude writes into a worktree it makes, which are not a session's work: its copy of the checkout's local
 * settings, in every one of the 27 worktrees of background sessions measured on 2026-11-11
 * (odd/tasks/sessions-close-themselves.md). Left out of the rule only for the worktree of a finished session
 * `js-harness sessions start` recorded: there it holds the permissions of a session that ended. */
export const HOST_FILES = ['.claude/settings.local.json'];

/** The linked worktrees git lists for the repository at `cwd`, as `worktreesOf` reads them, and `here`, the one `cwd`
 * is in: `{ linked, here }`, or `null` when git cannot list them. */
export function linkedWorktrees(cwd, gitIn) {
  const listed = gitIn(cwd, 'worktree', 'list', '--porcelain');
  if (!listed.ok) return null;
  const [, ...linked] = worktreesOf(listed.out);
  return { linked, here: gitIn(cwd, 'rev-parse', '--show-toplevel').out.trim() };
}

/** Why the worktree `tree` (an entry of `linkedWorktrees`) cannot be removed with nothing lost, or `null` when it
 * can: it is on a branch, not locked, with a head `base` holds, a `git status` clean of ignored files too, and an index
 * unchanged for `idleMinutes`. `hostFiles` names the ignored files that do not count; `baseName` is `base` in words.
 * The cheap questions are asked first: a `git status` in each of a hundred worktrees is what this exists to spare.
 * `ownLock(tree)` says a lock is the caller's own to release, which then keeps nothing: nobody else's ever is.
 * `gitIn(dir, ...args)` answers `{ ok, out }`. */
export function worktreeKept(tree, { cwd, base, baseName = 'main', gitIn, now = Date.now, idleMinutes = IDLE_MINUTES, hostFiles = [], ownLock = () => false }) {
  if (!tree.path || !tree.head) return 'git names no folder or no head for it';
  if (tree.branch === null) return 'it is on no branch';
  if (tree.locked && !ownLock(tree)) return `it is locked${tree.lockReason ? `: ${tree.lockReason}` : ''}`;
  if (tree.prunable) return 'git lists it as prunable';
  if (!gitIn(cwd, 'merge-base', '--is-ancestor', tree.head, base).ok) return `its head is not in ${baseName}`;
  const index = gitIn(tree.path, 'rev-parse', '--git-path', 'index');
  let changed;
  try {
    if (!index.ok) throw new Error('no index');
    changed = fs.statSync(path.resolve(tree.path, index.out.trim())).mtimeMs;
  } catch {
    // No index read is no proof that it stood still.
    return 'its index could not be read';
  }
  const idle = Math.floor((now() - changed) / 60_000);
  if (now() - changed < idleMinutes * 60_000) return `its index changed ${idle} minute${idle === 1 ? '' : 's'} ago, under the ${idleMinutes} a removal waits for`;
  // Ignored files too: `git worktree remove` takes them with it, and no branch brings an eval run or a `.env` back
  // (Codex, 2026-10-17, P1).
  const status = gitIn(tree.path, 'status', '--porcelain', '--ignored');
  if (!status.ok) return 'git status could not run in it';
  const held = status.out.split(/\r?\n/).filter((line) => line.trim() !== '' && !hostOnly(line, tree.path, hostFiles)).map((line) => line.trim());
  if (held.length === 0) return null;
  return `it holds what no branch brings back: ${held.slice(0, 3).join(', ')}${held.length > 3 ? ` and ${held.length - 3} more` : ''}`;
}

/** Whether the `git status --porcelain --ignored` line `line` of the worktree at `dir` names only files of
 * `hostFiles`: one of them, or a folder git reports whole because all of it is ignored, when those files are all it
 * holds (a project that tracks nothing under `.claude`). A folder that cannot be read counts as holding more. */
function hostOnly(line, dir, hostFiles) {
  if (hostFiles.some((file) => line === `!! ${file}`)) return true;
  const folder = /^!! (.+\/)$/.exec(line)?.[1];
  if (folder === undefined || !hostFiles.some((file) => file.startsWith(folder))) return false;
  try {
    const files = fs.readdirSync(path.join(dir, folder), { recursive: true, withFileTypes: true }).filter((entry) => !entry.isDirectory());
    return files.length > 0 && files.every((entry) => hostFiles.includes(path.relative(dir, path.join(entry.parentPath, entry.name)).replace(/\\/g, '/')));
  } catch {
    return false;
  }
}

/** The linked worktrees of the repository at `cwd` that can be removed with nothing lost (`worktreeKept`), as
 * `{ path, branch }`, or `null` when git cannot list them: on a branch (in `branches`, when given), outside
 * `.claude/worktrees` and not the one `cwd` is in. */
export function removableWorktrees({ cwd, base, branches = null, gitIn, now = Date.now, idleMinutes = IDLE_MINUTES }) {
  const listed = linkedWorktrees(cwd, gitIn);
  if (listed === null) return null;
  const found = [];
  for (const tree of listed.linked) {
    if (!tree.path || tree.branch === null) continue;
    if (branches !== null && !branches.has(tree.branch)) continue;
    if (appsOwn(tree.path) || (listed.here && sameFolder(tree.path, listed.here))) continue;
    if (worktreeKept(tree, { cwd, base, gitIn, now, idleMinutes }) === null) found.push({ path: tree.path, branch: tree.branch });
  }
  return found;
}

/** How long one git call of `boundedGit` may run before it is killed. */
const GIT_TIMEOUT_MS = 20_000;

/** A `gitIn(dir, ...args)` over `run` that answers `{ ok, out, err }`, each call bounded by `timeout`, `GIT_TIMEOUT_MS`
 * unless given, as the heartbeat bounds its commands: one that hangs counts as a no (T11). That bound is for a
 * question; a call that deletes is given a longer one, since killing it part-way leaves a folder half removed. */
export function boundedGit(run = spawnSync, timeout = GIT_TIMEOUT_MS) {
  return (dir, ...args) => {
    // No optional locks: a `git status` killed at its limit would otherwise leave an index.lock that breaks a worktree
    // that was only slow (a review, 2026-10-17, R4).
    const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
    const result = run('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true, timeout, env });
    return { ok: !result?.error && result?.status === 0, out: String(result?.stdout ?? ''), err: String(result?.stderr || result?.error?.message || '').trim() };
  };
}

/** The worktrees `removableWorktrees` gives against origin/main as this clone last fetched it, whatever landed their
 * branches, or `null` when git cannot say: what `doctor` counts, with no fetch of its own (T10), each git call bounded
 * (`boundedGit`). */
export function worktreesInMain({ cwd, run = spawnSync, now = Date.now }) {
  const gitIn = boundedGit(run);
  const base = gitIn(cwd, 'rev-parse', '--verify', '--quiet', 'origin/main').out.trim();
  return base ? removableWorktrees({ cwd, base, gitIn, now }) : null;
}
