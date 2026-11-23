// What `js-harness rules change` says of another rule/ branch that holds an open change (./rules-change-run.mjs):
// whether it is pushed, how many commits it is ahead, and the worktree that has it checked out. The refusal alone named
// the branch and `git branch -D`, so a session met by it could not tell a forgotten local branch from one a live
// worktree still works on, nor whether deleting it loses commits no one pushed. It only reads refs this clone holds:
// no fetch, as a dry run moves no ref, and a git call that fails leaves out what it would have said, never the refusal.
import { parseWorktreeList } from './sessions.mjs';

const BASE = 'origin/main';

/** The words of `count` commits. */
const commits = (count) => `${count} commit${count === 1 ? '' : 's'}`;

/**
 * One sentence on the branch `ref`, a local `rule/<name>` or a remote-tracking `origin/rule/<name>`: whether it is
 * pushed (its origin ref exists), the commits it is ahead of that ref (or of origin/main when it is not pushed), and
 * the worktree that has it checked out, the main checkout included, or none. `git(args)` runs git in the checkout and
 * gives `{ status, stdout }`; it may fail or throw, and what it could not read is left out of the sentence.
 */
export function heldDetail(ref, git) {
  const run = (args) => {
    try {
      const result = git(args);
      return result?.status === 0 ? String(result.stdout ?? '') : null;
    } catch {
      return null;
    }
  };
  if (ref.startsWith('origin/')) return `${ref} is pushed, with no local branch or worktree`;

  const remote = `origin/${ref}`;
  // for-each-ref, not rev-parse: it exits 0 with nothing for a ref that is not there, so a failure is told apart.
  const found = run(['for-each-ref', '--format=%(objectname)', `refs/remotes/${remote}`]);
  const pushed = found !== null && found.trim() !== '';
  const ahead = found === null ? null : run(['rev-list', '--count', `${pushed ? `refs/remotes/${remote}` : BASE}..refs/heads/${ref}`]);
  const count = ahead !== null && /^\d+$/.test(ahead.trim()) ? Number(ahead.trim()) : null;
  const listed = run(['worktree', 'list', '--porcelain']);
  const tree = listed === null ? undefined : parseWorktreeList(listed).find((one) => one.branch === ref && !one.bare) ?? null;

  if (found === null && count === null && tree === undefined) return `${ref}: git could not say whether it is pushed or which worktree holds it`;
  const parts = [found === null ? `${ref} (git could not say whether it is pushed)` : pushed ? `${ref} is pushed (${remote})` : `${ref} is not pushed (no ${remote})`];
  if (count !== null) parts.push(`${commits(count)} ahead of ${pushed ? 'it' : BASE}`);
  if (tree !== undefined) parts.push(tree === null ? 'checked out in no worktree' : `checked out in the worktree ${tree.path}`);
  return parts.join(', ');
}
