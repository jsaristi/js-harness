// The worktrees a repository can lose with nothing lost (odd/tasks/land-unattended.md, T9 and T10): those on a
// branch already in main, clean and idle. Left behind by every landed pull request, they slowed every command that
// lists them: 151 of 184 were such worktrees, and the board took 126 s over them (L22).
import fs from 'node:fs';
import path from 'node:path';

/** The minutes a worktree's index must have stood still before the worktree is removed: a session that staged
 * something a moment ago may be about to commit there. */
export const IDLE_MINUTES = 10;

/** `git worktree list --porcelain` as `{ path, head, branch, locked, prunable }` entries, the main worktree first;
 * `branch` is the short name, `null` for a detached head. */
export function worktreesOf(porcelain) {
  return porcelain.replace(/\r\n/g, '\n').split('\n\n').map((block) => block.split('\n').filter(Boolean)).filter((lines) => lines.length > 0).map((lines) => {
    const value = (key) => lines.find((line) => line === key || line.startsWith(`${key} `))?.slice(key.length + 1) ?? null;
    const branch = value('branch');
    return {
      path: value('worktree'),
      head: value('HEAD'),
      branch: branch === null ? null : branch.replace(/^refs\/heads\//, ''),
      locked: lines.some((line) => line === 'locked' || line.startsWith('locked ')),
      prunable: lines.some((line) => line === 'prunable' || line.startsWith('prunable ')),
    };
  });
}

/** Whether `dir` is under a `.claude/worktrees` folder: the Claude app's own worktrees, which the app removes. */
const appsOwn = (dir) => /(^|\/)\.claude\/worktrees\//i.test(`${dir.replace(/\\/g, '/')}/`);

/** Two paths of one folder, as git and a caller may spell them differently on Windows. */
const sameFolder = (a, b) => {
  const plain = (dir) => path.resolve(dir).replace(/\\/g, '/').replace(/\/$/, '');
  return process.platform === 'win32' ? plain(a).toLowerCase() === plain(b).toLowerCase() : plain(a) === plain(b);
};

/** The linked worktrees of the repository at `cwd` that can be removed with nothing lost, as `{ path, branch }`, or
 * `null` when git cannot list them: on a branch (in `branches`, when given), outside `.claude/worktrees`, not the one
 * `cwd` is in, not locked, with a head `base` holds, a clean `git status`, and an index unchanged for `IDLE_MINUTES`.
 * The cheap questions are asked first: a `git status` in each of a hundred worktrees is what this exists to spare.
 * `gitIn(dir, ...args)` answers `{ ok, out }`. */
export function removableWorktrees({ cwd, base, branches = null, gitIn, now = Date.now, idleMinutes = IDLE_MINUTES }) {
  const listed = gitIn(cwd, 'worktree', 'list', '--porcelain');
  if (!listed.ok) return null;
  const here = gitIn(cwd, 'rev-parse', '--show-toplevel').out.trim();
  const [, ...linked] = worktreesOf(listed.out);
  const found = [];
  for (const tree of linked) {
    if (!tree.path || !tree.head || tree.branch === null || tree.locked || tree.prunable) continue;
    if (branches !== null && !branches.has(tree.branch)) continue;
    if (appsOwn(tree.path) || (here && sameFolder(tree.path, here))) continue;
    if (!gitIn(cwd, 'merge-base', '--is-ancestor', tree.head, base).ok) continue;
    const index = gitIn(tree.path, 'rev-parse', '--git-path', 'index');
    if (!index.ok) continue;
    let changed;
    try {
      changed = fs.statSync(path.resolve(tree.path, index.out.trim())).mtimeMs;
    } catch {
      // No index read is no proof that it stood still.
      continue;
    }
    if (now() - changed < idleMinutes * 60_000) continue;
    const status = gitIn(tree.path, 'status', '--porcelain');
    if (!status.ok || status.out.trim() !== '') continue;
    found.push({ path: tree.path, branch: tree.branch });
  }
  return found;
}
